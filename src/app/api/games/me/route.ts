// GET /api/games/me?game=...&period=...
// Devuelve la partida del usuario en el periodo + su posición en el ranking
// y el total de jugadores. Si no hay sesión → todo null.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'

const GAME_IDS = ['quiniela', 'crackquiz', 'mionce', 'sopacracks', 'takagrid', 'strikerrush'] as const
type GameId = typeof GAME_IDS[number]

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const game   = url.searchParams.get('game')
  const period = url.searchParams.get('period')
  if (!game || !period) {
    return NextResponse.json({ error: 'game and period required' }, { status: 400 })
  }
  if (!GAME_IDS.includes(game as GameId)) {
    return NextResponse.json({ error: 'invalid game_id' }, { status: 400 })
  }
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ play: null, position: null, total: 0 })
  }

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ play: null, position: null, total: 0, reason: 'no_session' })
  }

  // Lecturas con service_role: la vista y el conteo cross-user de "total
  // jugadores" no dependen del acceso anónimo (cerrado a nivel BD). El filtro
  // .eq('user_id') sigue acotando la fila propia. Fallback a la sesión en dev
  // sin SUPABASE_SERVICE_ROLE_KEY.
  const reader = adminSupabase() ?? sb

  const [{ data: row }, { count }] = await Promise.all([
    reader.from('v_game_leaderboard')
      .select('score, duration_ms, position, created_at')
      .eq('game_id', game)
      .eq('period', period)
      .eq('user_id', user.id)
      .maybeSingle(),
    reader.from('game_plays')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', game)
      .eq('period', period),
  ])

  return NextResponse.json({
    play:     row ? { score: row.score, duration_ms: row.duration_ms, created_at: row.created_at } : null,
    position: row?.position ?? null,
    total:    count ?? 0,
  })
}
