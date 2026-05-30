// GET  /api/ranked/predictions?sport=mundial
//      → mis predicciones para ese deporte  {event_id → prediction_row}
// POST /api/ranked/predictions
//      body: { event_id, pick: '1'|'X'|'2' }
//      → inserta/retorna la predicción (solo si el evento está open)
//
// Requiere auth en ambos métodos.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

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
    .select('id, status')
    .eq('id', body.event_id)
    .single()

  if (!event) return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  if ((event as { status: string }).status !== 'open') {
    return NextResponse.json({ error: 'event_closed', status: (event as { status: string }).status }, { status: 409 })
  }

  // Verificar que NO hay predicción previa (no se puede cambiar)
  const { data: existing } = await sb
    .from('ranked_predictions')
    .select('id')
    .eq('user_id', user.id)
    .eq('event_id', body.event_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'already_predicted' }, { status: 409 })
  }

  // Insertar predicción
  const { data: prediction, error } = await sb
    .from('ranked_predictions')
    .insert({
      user_id:   user.id,
      event_id:  body.event_id,
      prediction: { pick: body.pick },
    })
    .select()
    .single()

  if (error) {
    // 23505 = unique_violation: la DB tiene UNIQUE(user_id, event_id).
    // Si dos requests simultáneos pasan el check "already_predicted" y ambos
    // intentan insertar, uno fallará con 23505. Devolvemos 409 en vez de 500.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'already_predicted' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ prediction }, { status: 201 })
}
