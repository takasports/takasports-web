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
  total_points: number   // nombre de la columna SQL; se expone como 'total' en la respuesta JSON
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

  // Leaderboard + check de partidos en curso (para auto-refresh del cliente)
  const [lbResult, liveResult] = await Promise.all([
    sb.rpc('get_ranked_leaderboard', {
      p_sport: sport === 'global' ? null : sport,
      p_limit: limit,
    }),
    // has_live: hay algún evento del deporte en estado 'closed' (en curso)
    sb.from('ranked_events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'closed')
      .eq('sport', sport === 'global' ? 'mundial' : sport),
  ])

  if (lbResult.error) return NextResponse.json({ error: lbResult.error.message }, { status: 500 })

  const entries = (lbResult.data as LeaderboardEntry[] ?? []).map((e, i) => ({
    user_id:      e.user_id,
    display_name: e.display_name,
    avatar_url:   e.avatar_url,
    total:        e.total_points,
    rank:         e.rank ?? i + 1,
  }))

  const has_live = (liveResult.count ?? 0) > 0

  return NextResponse.json({ entries, has_live }, {
    // Si hay partidos en curso, no cachear (datos cambian rápido).
    // En reposo: 2 min de cache + stale-while-revalidate.
    headers: {
      'Cache-Control': has_live
        ? 'no-store'
        : 'public, s-maxage=120, stale-while-revalidate=300',
    },
  })
}
