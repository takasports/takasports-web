// GET  /api/ranked/predictions?sport=mundial
//      → mis predicciones para ese deporte  {event_id → prediction_row}
// POST /api/ranked/predictions
//      body: { event_id, pick: '1'|'X'|'2' }
//      → inserta/retorna la predicción (solo si el evento está open)
//
// Requiere auth en ambos métodos.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { awardBadges, badgesEarnedOnRankedPick } from '@/lib/badge-awards'

export const dynamic = 'force-dynamic'

function hasEnv() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!hasEnv()) return NextResponse.json({ predictions: {} })

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Devuelve como mapa event_id → row para lookup O(1) en el cliente
  const map: Record<string, unknown> = {}
  for (const row of data ?? []) {
    map[(row as { event_id: string }).event_id] = row
  }
  return NextResponse.json({ predictions: map })
}

// ── POST ──────────────────────────────────────────────────────────────────
interface PickBody {
  event_id: string
  pick: '1' | 'X' | '2'
  /** ME1 — Marcador exacto opcional. Si presente y la tendencia es correcta
   *  Y los goles coinciden, +3 pts extra (o +6 si featured). Máx 3 activos
   *  por user (en eventos status='open' / no resueltos). */
  exactScore?: { home: number; away: number }
}

const MAX_EXACT_ACTIVE = 3

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

  if (!body?.event_id || !['1', 'X', '2'].includes(body.pick)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const exactScore = validateExactScore(body.exactScore)
  if (exactScore === 'invalid') {
    return NextResponse.json({ error: 'invalid_exact_score' }, { status: 400 })
  }

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'no_session' }, { status: 401 })

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

  // Lock picks 60 minutos antes del inicio del partido
  const matchStart   = new Date(ev.event_date).getTime()
  const lockAt       = matchStart - 60 * 60 * 1000   // 1 hora antes
  const nowMs        = Date.now()
  if (nowMs >= lockAt) {
    const minsLeft = Math.max(0, Math.ceil((matchStart - nowMs) / 60_000))
    return NextResponse.json(
      { error: 'pick_locked', message: `Las predicciones se bloquean 1 hora antes del partido. Quedan ${minsLeft} min.` },
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

  // Construye el JSONB final. exactScore se omite si null para mantener
  // el payload limpio (no { pick, exactScore: null }).
  const predictionPayload = exactScore
    ? { pick: body.pick, exactScore }
    : { pick: body.pick }

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

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
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
    return NextResponse.json({ error: error.message }, { status: 500 })
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

  return NextResponse.json({ prediction }, { status: 201 })
}
