// GET /api/ranked/leaderboard?sport=mundial&limit=50
// Ranking de usuarios por puntos acumulados en un deporte.
// Público — no requiere auth.
//
// Usa la función SQL get_ranked_leaderboard() que hace GROUP BY en Postgres,
// evitando traer todas las filas de point_transactions a memoria JS.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

interface LeaderboardEntry {
  user_id:      string
  display_name: string | null
  avatar_url:   string | null
  total_points: number
  rank:         number
}

export async function GET(req: NextRequest) {
  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return NextResponse.json({ entries: [] })
  }

  const { searchParams } = new URL(req.url)
  const sport = searchParams.get('sport') ?? 'mundial'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  const sb = await createServerSupabaseClient()

  const { data, error } = await sb.rpc('get_ranked_leaderboard', {
    p_sport: sport,
    p_limit: limit,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const entries = (data as LeaderboardEntry[] ?? []).map((e, i) => ({
    user_id:      e.user_id,
    display_name: e.display_name,
    avatar_url:   e.avatar_url,
    total:        e.total_points,
    rank:         e.rank ?? i + 1,
  }))

  return NextResponse.json({ entries }, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
  })
}
