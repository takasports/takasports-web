// Rareza de TakaGrid: qué eligió la comunidad en cada celda del grid del día.
// Lo consume el resultado de la partida para decir "solo el 4% eligió a este".
//
// Lectura pública y cacheada: no expone quién eligió qué, solo el reparto
// agregado por celda. La agregación vive en @/lib/takagrid-heatmap (pura y
// testeada); aquí solo se lee la tabla.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { aggregateTakagridHeatmap } from '@/lib/takagrid-heatmap'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const period = new URL(req.url).searchParams.get('period')
  if (!period || !/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: 'period (YYYY-MM-DD) required' }, { status: 400 })
  }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ period, totalPlays: 0, byCell: {} })

  const { data, error } = await admin
    .from('game_plays')
    .select('payload')
    .eq('game_id', 'takagrid')
    .eq('period', period)
    .limit(5000)

  if (error || !data) {
    return NextResponse.json({ period, totalPlays: 0, byCell: {}, error: 'query_failed' })
  }

  const { byCell, totalPlays } = aggregateTakagridHeatmap(data)

  return NextResponse.json(
    { period, totalPlays, byCell },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' } },
  )
}
