// POST /api/games/plays — registra una partida (idempotente por user+game+period)
// GET  /api/games/plays?game=...&period=... — partida propia (requiere auth)
//
// El insert va vía RPC record_game_play (security definer + cap antifraude).
// Si Supabase no está configurado, devuelve { persisted: false } sin error
// para preservar el modo invitado / dev local.
//
// Adicional (Bloque cross-game puntos): tras un record_game_play OK, si el
// juego está en POINTS_ENABLED_GAMES, llamamos award_game_coins para
// acreditar puntos al Ranked. La llamada va en try/catch — si la RPC
// no existe (migración 033 no aplicada) o falla, el play sigue
// persistido y solo no se acreditan puntos (awarded: 0).

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { POINTS_ENABLED_GAMES, pointsFor, type GameId as PointsGameId } from '@/lib/game-points'

const GAME_IDS = ['quiniela', 'crackquiz', 'mionce', 'sopacracks', 'takagrid', 'strikerrush'] as const
type GameId = typeof GAME_IDS[number]

interface PlayBody {
  game_id: GameId
  period: string
  score: number
  payload?: Record<string, unknown>
  duration_ms?: number
}

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as PlayBody
    if (!body?.game_id || !GAME_IDS.includes(body.game_id)) {
      return NextResponse.json({ error: 'invalid game_id' }, { status: 400 })
    }
    if (!body?.period || typeof body.period !== 'string') {
      return NextResponse.json({ error: 'period required' }, { status: 400 })
    }
    if (typeof body.score !== 'number' || body.score < 0 || body.score > 10000) {
      return NextResponse.json({ error: 'score out of range' }, { status: 400 })
    }

    if (!hasSupabaseEnv()) {
      return NextResponse.json({ persisted: false })
    }

    const sb = await createServerSupabaseClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) {
      // Modo invitado: aceptamos y devolvemos sin persistir (cliente cae a localStorage)
      return NextResponse.json({ persisted: false, reason: 'no_session' })
    }

    const { data, error } = await sb.rpc('record_game_play', {
      p_game_id:     body.game_id,
      p_period:      body.period,
      p_score:       Math.floor(body.score),
      p_payload:     body.payload ?? {},
      p_duration_ms: body.duration_ms ?? null,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ── Cross-game puntos ──────────────────────────────────────────
    // Solo para juegos en la whitelist. Defensivo: si la RPC no existe
    // (migración 033 sin aplicar) o falla, devolvemos awarded:0 y el
    // play sigue persistido normalmente — la UI no se rompe.
    let awarded = 0
    if (POINTS_ENABLED_GAMES.has(body.game_id as PointsGameId)) {
      const amount = pointsFor(body.game_id as PointsGameId, body.score, body.payload)
      if (amount > 0) {
        try {
          const admin = adminSupabase()
          if (admin) {
            const { data: credited, error: pointsErr } = await admin.rpc('award_game_coins', {
              p_game_id: body.game_id,
              p_amount:  amount,
              p_period:  body.period,
              p_user_id: user.id,
            })
            if (!pointsErr && typeof credited === 'number') awarded = credited
          }
        } catch { /* RPC ausente o error transitorio — sin puntos, todo lo demás OK */ }
      }
    }

    return NextResponse.json({ persisted: true, play: data, awarded })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
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
    return NextResponse.json({ play: null })
  }

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ play: null, reason: 'no_session' })

  const { data, error } = await sb
    .from('game_plays')
    .select('game_id, period, score, payload, duration_ms, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('game_id', game)
    .eq('period', period)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ play: data })
}
