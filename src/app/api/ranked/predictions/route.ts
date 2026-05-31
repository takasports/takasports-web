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

  // ── Cambio de pick (el evento sigue open) ────────────────────────
  // Si ya hay predicción y el partido aún no ha empezado, permitimos
  // actualizarla. Los badges NO se re-disparan en actualizaciones.
  if (existing) {
    const { data: updated, error: updateErr } = await sb
      .from('ranked_predictions')
      .update({ prediction: { pick: body.pick } })
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
      prediction: { pick: body.pick },
    })
    .select()
    .single()

  if (error) {
    // 23505 = unique_violation: race condition entre dos requests simultáneos.
    // Reintentamos como update (el pick ya quedó guardado por el otro request).
    if (error.code === '23505') {
      const { data: fallback } = await sb
        .from('ranked_predictions')
        .update({ prediction: { pick: body.pick } })
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
