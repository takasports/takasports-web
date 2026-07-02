// Agrega los plays diarios de CrackQuiz para devolver el % de aciertos por
// pregunta. Lo consume el ResultScreen para pintar "el X% de la comunidad
// también acertó". Si no hay service-role disponible (dev local sin
// SUPABASE_SERVICE_ROLE_KEY), devuelve estructura vacía.
//
// El acierto NO se toma del flag `correct` del cliente (falsificable): se
// recalcula en servidor contra la respuesta oficial del día — ver
// aggregateCrackquizHeatmap (lib/crackquiz-heatmap.ts).

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { aggregateCrackquizHeatmap } from '@/lib/crackquiz-heatmap'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const period = new URL(req.url).searchParams.get('period')
  if (!period || !/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: 'period (YYYY-MM-DD) required' }, { status: 400 })
  }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ period, totalPlays: 0, byQuestion: {} })

  const { data, error } = await admin
    .from('game_plays')
    .select('payload')
    .eq('game_id', 'crackquiz')
    .eq('period', period)
    .limit(5000)

  if (error || !data) {
    return NextResponse.json({ period, totalPlays: 0, byQuestion: {}, error: error?.message })
  }

  const { byQuestion, totalPlays } = aggregateCrackquizHeatmap(period, data)

  return NextResponse.json(
    { period, totalPlays, byQuestion },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' } },
  )
}
