// GET /api/games/me/all
//
// Resumen agregado de actividad del usuario logueado: racha global +
// mejor score y última partida por juego. Una sola query a Supabase,
// sin N requests desde el cliente.
//
// Sin sesión → todo null. Mismo patrón graceful que /api/games/me.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const GAME_IDS = ['quiniela','crackquiz','mionce','sopacracks','takagrid','strikerrush'] as const
type GameId = typeof GAME_IDS[number]

export interface GameSummary {
  game_id:      GameId
  best_score:   number
  last_score:   number
  last_period:  string
  last_at:      string
  plays:        number
}

export interface MeAllResponse {
  streak: { current: number; best: number; total: number; last_played_date: string | null } | null
  games:  GameSummary[]
}

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function GET(): Promise<NextResponse<MeAllResponse | { error: string }>> {
  if (!hasSupabaseEnv()) return NextResponse.json({ streak: null, games: [] })

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ streak: null, games: [] })

  // Race ambas queries en paralelo: streak (una fila) + plays (todas
  // las del usuario, agregamos en JS — son <=6 juegos x N periodos,
  // tamaño manejable).
  const [streakRes, playsRes] = await Promise.all([
    sb.from('game_streaks')
      .select('current_streak, best_streak, last_played_date, total_plays')
      .eq('user_id', user.id)
      .maybeSingle(),
    sb.from('game_plays')
      .select('game_id, score, period, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  if (streakRes.error) return NextResponse.json({ error: streakRes.error.message }, { status: 500 })
  if (playsRes.error)  return NextResponse.json({ error: playsRes.error.message }, { status: 500 })

  const streak = streakRes.data ? {
    current:          streakRes.data.current_streak,
    best:             streakRes.data.best_streak,
    total:            streakRes.data.total_plays,
    last_played_date: streakRes.data.last_played_date,
  } : null

  // Agregar por game_id: best_score = MAX(score), last_score = score más
  // reciente (rows vienen ordenadas DESC), plays = count.
  const byGame = new Map<GameId, GameSummary>()
  for (const row of playsRes.data ?? []) {
    const gid = row.game_id as GameId
    const existing = byGame.get(gid)
    if (!existing) {
      byGame.set(gid, {
        game_id:     gid,
        best_score:  row.score,
        last_score:  row.score,    // primer row = más reciente
        last_period: row.period,
        last_at:     row.created_at,
        plays:       1,
      })
    } else {
      existing.plays      += 1
      existing.best_score  = Math.max(existing.best_score, row.score)
    }
  }

  return NextResponse.json({
    streak,
    games: Array.from(byGame.values()),
  })
}
