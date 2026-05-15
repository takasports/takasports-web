// GET /api/games/leaderboard?game=...&period=...&limit=50
// Lectura pública. Cache ISR vía Cache-Control para no martillar Supabase.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const GAME_IDS = ['quiniela', 'crackquiz', 'mionce', 'sopacracks', 'takagrid', 'strikerrush'] as const
type GameId = typeof GAME_IDS[number]

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const game   = url.searchParams.get('game')
  const period = url.searchParams.get('period')
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200)

  if (!game || !period) {
    return NextResponse.json({ error: 'game and period required' }, { status: 400 })
  }
  if (!GAME_IDS.includes(game as GameId)) {
    return NextResponse.json({ error: 'invalid game_id' }, { status: 400 })
  }
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ entries: [], total: 0 })
  }

  const sb = await createServerSupabaseClient()

  const { data, error } = await sb
    .from('v_game_leaderboard')
    .select('user_id, score, duration_ms, created_at, display_name, avatar_url, position')
    .eq('game_id', game)
    .eq('period', period)
    .order('position', { ascending: true })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { entries: data ?? [], total: data?.length ?? 0 },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
  )
}
