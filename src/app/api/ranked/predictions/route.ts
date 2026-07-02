// GET  /api/ranked/predictions?sport=mundial
//      → mis predicciones para ese deporte  {event_id → prediction_row}
// POST /api/ranked/predictions
//      body: { event_id, pick: '1'|'X'|'2' }
//      → inserta/retorna la predicción (solo si el evento está open)
//
// Requiere auth en ambos métodos.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { awardBadges, badgesEarnedOnRankedPick } from '@/lib/badge-awards'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { apiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

function hasEnv() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!hasEnv()) return NextResponse.json({ predictions: {} })

  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ predictions: {}, reason: 'no_session' })

  const sport = new URL(req.url).searchParams.get('sport') ?? 'mundial'

  // Trae event_ids de ese deporte primero, luego filtra predicciones
  const { data: events } = await sb
    .from('ranked_events')
    .select('id')
    .eq('sport', sport)

  const eventIds = (events ?? []).map((e: { id: string }) => e.id)
  if (eventIds.length === 0) return NextResponse.json({ predictions: {} })

  const { data, error } = await sb
    .from('ranked_predictions')
    .select('event_id, prediction, points_awarded, is_correct, created_at')
    .eq('user_id', user.id)
    .in('event_id', eventIds)

  if (error) return apiError('server_error', 500)

  // Devuelve como mapa event_id → row para lookup O(1) en el cliente
  const map: Record<string, unknown> = {}
  for (const row of data ?? []) {
    map[(row as { event_id: string }).event_id] = row
  }
  return NextResponse.json({ predictions: map })
}

// ── POST ──────────────────────────────────────────────────────────────────
//
// Acepta 2 shapes según el sport del evento:
//
//   Mundial / Ranked Fútbol (sport='mundial'):
//     { event_id, pick: '1'|'X'|'2', exactScore?: {home, away} }
//
//   UFC (sport='ufc'):
//     { event_id, pick: 'a'|'b', method?: 'KO'|'SUB'|'DEC' }
//
// El sport se lee del evento — el cliente no lo declara para evitar
// inconsistencias.
interface PickBody {
  event_id: string
  pick: '1' | 'X' | '2' | 'a' | 'b'
  /** ME1 — Marcador exacto opcional (solo Mundial). */
  exactScore?: { home: number; away: number }
  /** UF3 — Método de victoria predicho (solo UFC, opcional). */
  method?: 'KO' | 'SUB' | 'DEC'
}

const MAX_EXACT_ACTIVE = 5
const SOCCER_PICKS = new Set(['1', 'X', '2'])
const UFC_PICKS    = new Set(['a', 'b'])
const UFC_METHODS  = new Set(['KO', 'SUB', 'DEC'])
const UFC_LOCK_MS  = 30 * 60 * 1000   // 30 min antes del fight

function validateExactScore(v: unknown): { home: number; away: number } | null | 'invalid' {
  if (v === undefined || v === null) return null
  if (typeof v !== 'object') return 'invalid'
  const o = v as { home?: unknown; away?: unknown }
  if (
    typeof o.home !== 'number' || !Number.isInteger(o.home) ||
    typeof o.away !== 'number' || !Number.isInteger(o.away) ||
    o.home < 0 || o.home > 20 ||
    o.away < 0 || o.away > 20
  ) return 'invalid'
  return { home: o.home, away: o.away }
}

export async function POST(req: NextRequest) {
  if (!hasEnv()) return NextResponse.json({ error: 'no_config' }, { status: 503 })

  let body: PickBody
  try {
    body = await req.json() as PickBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // Validación inicial del pick: acepta tanto 1/X/2 (fútbol) como a/b (UFC).
  // El cruce pick↔sport se valida después de leer el evento.
  if (!body?.event_id || ![...SOCCER_PICKS, ...UFC_PICKS].includes(body.pick)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const exactScore = validateExactScore(body.exactScore)
  if (exactScore === 'invalid') {
    return NextResponse.json({ error: 'invalid_exact_score' }, { status: 400 })
  }

  if (body.method !== undefined && !UFC_METHODS.has(body.method)) {
    return NextResponse.json({ error: 'invalid_method' }, { status: 400 })
  }

  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  // Freno anti-abuso por usuario: cada POST inserta/actualiza una predicción.
  // Generoso para rellenar un cuadro entero del Mundial, corta scripts.
  const rl = await checkRateLimit({
    bucket: 'ranked_predictions',
    key: `${getClientIp(req)}:${user.id}`,
    windowSeconds: 60,
    max: 120,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  // Verificar que el evento existe y está open
  const { data: event } = await sb
    .from('ranked_events')
    .select('id, status, sport, event_date')
    .eq('id', body.event_id)
    .single()

  if (!event) return NextResponse.json({ error: 'event_not_found' }, { status: 404 })

  const ev = event as { status: string; sport: string; event_date: string }

  if (ev.status !== 'open') {
    return NextResponse.json({ error: 'event_closed', status: ev.status }, { status: 409 })
  }

  // UF3 — cruce pick↔sport
  const isUfc = ev.sport === 'ufc'
  if (isUfc && !UFC_PICKS.has(body.pick)) {
    return NextResponse.json({ error: 'invalid_pick_for_ufc' }, { status: 400 })
  }
  if (!isUfc && !SOCCER_PICKS.has(body.pick)) {
    return NextResponse.json({ error: 'invalid_pick_for_soccer' }, { status: 400 })
  }
  // method solo aplica a UFC
  if (!isUfc && body.method !== undefined) {
    return NextResponse.json({ error: 'method_not_allowed_for_soccer' }, { status: 400 })
  }
  // exactScore solo aplica a fútbol
  if (isUfc && exactScore) {
    return NextResponse.json({ error: 'exact_not_allowed_for_ufc' }, { status: 400 })
  }

  // Lock picks: 30 min antes (UFC) / 60 min antes (fútbol).
  const lockOffsetMs = isUfc ? UFC_LOCK_MS : 60 * 60 * 1000
  const matchStart   = new Date(ev.event_date).getTime()
  const lockAt       = matchStart - lockOffsetMs
  const nowMs        = Date.now()
  if (nowMs >= lockAt) {
    const minsLeft = Math.max(0, Math.ceil((matchStart - nowMs) / 60_000))
    const lockMins = Math.round(lockOffsetMs / 60_000)
    return NextResponse.json(
      { error: 'pick_locked', message: `Las predicciones se bloquean ${lockMins} min antes. Quedan ${minsLeft} min.` },
      { status: 409 }
    )
  }

  // ¿Ya existe predicción para este partido?
  const { data: existing } = await sb
    .from('ranked_predictions')
    .select('id, prediction')
    .eq('user_id', user.id)
    .eq('event_id', body.event_id)
    .maybeSingle()

  const existingPrediction = (existing as { prediction?: { exactScore?: { home: number; away: number } } } | null)?.prediction
  const hadExact = !!existingPrediction?.exactScore

  // ME1 — Si se está añadiendo un exact NUEVO (no había antes en este evento),
  // verificar que no excedemos MAX_EXACT_ACTIVE para el user.
  if (exactScore && !hadExact) {
    const { data: openEvents } = await sb
      .from('ranked_events')
      .select('id')
      .eq('sport', ev.sport)
      .neq('status', 'resolved')
    const openIds = (openEvents ?? []).map((e: { id: string }) => e.id)
    if (openIds.length > 0) {
      const { data: activeExacts } = await sb
        .from('ranked_predictions')
        .select('event_id, prediction')
        .eq('user_id', user.id)
        .in('event_id', openIds)
      const count = (activeExacts ?? [])
        .filter((r) => !!(r as { prediction?: { exactScore?: unknown } }).prediction?.exactScore)
        .length
      if (count >= MAX_EXACT_ACTIVE) {
        return NextResponse.json(
          {
            error: 'exact_limit',
            message: `Ya tienes ${MAX_EXACT_ACTIVE} marcadores exactos activos. Espera al cierre de alguno antes de añadir otro.`,
          },
          { status: 409 },
        )
      }
    }
  }

  // Construye el JSONB final. Las keys opcionales se omiten cuando faltan.
  //   Fútbol: { pick: '1'|'X'|'2', exactScore?: {home, away} }
  //   UFC:    { pick: 'a'|'b',     method?: 'KO'|'SUB'|'DEC' }
  const predictionPayload: Record<string, unknown> = { pick: body.pick }
  if (exactScore) predictionPayload.exactScore = exactScore
  if (isUfc && body.method) predictionPayload.method = body.method

  // ── Cambio de pick (el evento sigue open) ────────────────────────
  // Si ya hay predicción y el partido aún no ha empezado, permitimos
  // actualizarla. Los badges NO se re-disparan en actualizaciones.
  if (existing) {
    const { data: updated, error: updateErr } = await sb
      .from('ranked_predictions')
      .update({ prediction: predictionPayload })
      .eq('user_id', user.id)
      .eq('event_id', body.event_id)
      .select()
      .single()

    if (updateErr) return apiError('server_error', 500)
    return NextResponse.json({ prediction: updated, updated: true }, { status: 200 })
  }

  // ── Primera predicción para este partido ─────────────────────────
  const { data: prediction, error } = await sb
    .from('ranked_predictions')
    .insert({
      user_id:    user.id,
      event_id:   body.event_id,
      prediction: predictionPayload,
    })
    .select()
    .single()

  if (error) {
    // 23505 = unique_violation: race condition entre dos requests simultáneos.
    // Reintentamos como update (el pick ya quedó guardado por el otro request).
    if (error.code === '23505') {
      const { data: fallback } = await sb
        .from('ranked_predictions')
        .update({ prediction: predictionPayload })
        .eq('user_id', user.id)
        .eq('event_id', body.event_id)
        .select()
        .single()
      return NextResponse.json({ prediction: fallback, updated: true }, { status: 200 })
    }
    return apiError('server_error', 500)
  }

  // ── Badges — solo en primera inserción ──────────────────────────
  // Usamos adminSupabase() para bypassear RLS en quiniela_badges
  // (la tabla no tiene política INSERT para usuarios — solo service role).
  try {
    const adm = adminSupabase()
    if (adm) {
      const eventSport = (event as { sport?: string }).sport ?? ''

      const [{ count: totalCount }, { count: mundialCount }] = await Promise.all([
        adm.from('ranked_predictions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        eventSport === 'mundial'
          ? adm.from('ranked_predictions')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .in('event_id',
                (await adm.from('ranked_events').select('id').eq('sport', 'mundial'))
                  .data?.map((e: { id: string }) => e.id) ?? []
              )
          : Promise.resolve({ count: null }),
      ])

      const isFirstPick    = (totalCount ?? 0) <= 1
      const isFirstMundial = eventSport === 'mundial' && (mundialCount ?? 0) <= 1

      const earned = badgesEarnedOnRankedPick({ isFirstPick })
      if (isFirstMundial) earned.push('mundialista_2026')
      if (earned.length > 0) await awardBadges(adm, user.id, earned)
    }
  } catch { /* badge fallo — nunca bloquea la respuesta */ }

  // RT1 — Racha Taka unificada: cualquier predicción cuenta como actividad
  // diaria. ping_game_streak es idempotente (un ping por día por user) y
  // usa auth.uid() internamente, así que la llamada va por el client del
  // user (sb) — no adminSupabase. Best-effort, no bloquea la respuesta.
  try {
    await sb.rpc('ping_game_streak')
  } catch { /* */ }

  return NextResponse.json({ prediction }, { status: 201 })
}

// ── DELETE ──────────────────────────────────────────────────────────────────
//   body: { event_id }
//   Borra mi predicción para ese evento ("des-elegir" un pick). Solo si el
//   evento sigue open y dentro de la ventana de picks (mismo lock que el POST:
//   30 min UFC / 60 min fútbol). La RLS (rp_delete_own, migr. 073) ya limita
//   a filas propias + eventos open; aquí añadimos el lock fino por tiempo.
export async function DELETE(req: NextRequest) {
  if (!hasEnv()) return NextResponse.json({ error: 'no_config' }, { status: 503 })

  let body: { event_id?: string }
  try {
    body = await req.json() as { event_id?: string }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body?.event_id) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  const { data: event } = await sb
    .from('ranked_events')
    .select('id, status, sport, event_date')
    .eq('id', body.event_id)
    .single()
  if (!event) return NextResponse.json({ error: 'event_not_found' }, { status: 404 })

  const ev = event as { status: string; sport: string; event_date: string }
  if (ev.status !== 'open') {
    return NextResponse.json({ error: 'event_closed', status: ev.status }, { status: 409 })
  }

  const lockOffsetMs = ev.sport === 'ufc' ? UFC_LOCK_MS : 60 * 60 * 1000
  const lockAt       = new Date(ev.event_date).getTime() - lockOffsetMs
  if (Date.now() >= lockAt) {
    return NextResponse.json(
      { error: 'pick_locked', message: 'El combate ya está bloqueado; no puedes quitar el pick.' },
      { status: 409 },
    )
  }

  const { error } = await sb
    .from('ranked_predictions')
    .delete()
    .eq('user_id', user.id)
    .eq('event_id', body.event_id)
  if (error) return apiError('server_error', 500)

  return NextResponse.json({ ok: true, cleared: true }, { status: 200 })
}
