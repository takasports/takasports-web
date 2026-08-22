// GET /api/ranked/consensus?week=YYYY-MM-DD
//
// Reparto de pronósticos de la comunidad, partido a partido, para una Jornada.
//
// Para qué: entre el jueves que rellenas y el sábado que se juega no pasaba
// absolutamente nada. Saber que el 68% ha puesto al Madrid —y que tú vas
// contra— es un motivo para volver antes de que empiece, y no cuesta ningún
// dato que no tengamos ya.
//
// Es AGREGADO y anónimo: cuenta cuántos eligieron cada opción, nunca quién. El
// cliente además solo lo enseña en los partidos que el usuario YA ha
// pronosticado, para no anclarle la decisión antes de tomarla — esa regla vive
// en la UI porque aquí no sabemos, ni queremos saber, quién pregunta.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { RANKED_FOOTBALL_SPORT } from '@/lib/football-ranked'
import { thisWeekKey } from '@/components/ranked/soccer/jornada'
import { apiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/

export interface ConsensusRow { p1: number; px: number; p2: number; total: number }

export async function GET(req: NextRequest) {
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ weekKey: null, consensus: {} })

  const asked = req.nextUrl.searchParams.get('week')
  // Se valida: llega por URL y va a un filtro por texto.
  const weekKey = asked && WEEK_RE.test(asked) ? asked : thisWeekKey()

  const { data: eventos, error: evErr } = await admin
    .from('ranked_events')
    .select('id')
    .eq('sport', RANKED_FOOTBALL_SPORT)
    .eq('meta->>week_key', weekKey)
  if (evErr) return apiError('server_error', 500)

  const ids = (eventos ?? []).map((e: { id: string }) => e.id)
  if (ids.length === 0) return NextResponse.json({ weekKey, consensus: {} })

  const { data: preds, error } = await admin
    .from('ranked_predictions')
    .select('event_id, prediction')
    .in('event_id', ids)
  if (error) return apiError('server_error', 500)

  const consensus: Record<string, ConsensusRow> = {}
  for (const row of (preds ?? []) as { event_id: string; prediction?: { pick?: string } }[]) {
    const pick = row.prediction?.pick
    if (pick !== '1' && pick !== 'X' && pick !== '2') continue
    const c = consensus[row.event_id] ?? { p1: 0, px: 0, p2: 0, total: 0 }
    if (pick === '1') c.p1++
    else if (pick === 'X') c.px++
    else c.p2++
    c.total++
    consensus[row.event_id] = c
  }

  // Caché corta: cambia con cada pick de cualquiera, pero un desfase de un
  // minuto en un porcentaje no le importa a nadie y evita recontar en cada
  // visita.
  const CACHE = 'public, s-maxage=60, stale-while-revalidate=300'
  return NextResponse.json(
    { weekKey, consensus },
    { headers: { 'Cache-Control': CACHE, 'CDN-Cache-Control': CACHE } },
  )
}
