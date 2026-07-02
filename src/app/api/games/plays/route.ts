// POST /api/games/plays — registra una partida (idempotente por user+game+period)
// GET  /api/games/plays?game=...&period=... — partida propia (requiere auth)
//
// El insert va vía RPC record_game_play (security definer + cap antifraude).
// Si Supabase no está configurado, devuelve { persisted: false } sin error
// para preservar el modo invitado / dev local.
//
// Adicional (Bloque cross-game puntos): tras un record_game_play OK, si el
// juego está en POINTS_ENABLED_GAMES, llamamos award_game_points (migr. 065:
// idempotente por user+game+period, mejor-marca-gana, service_role-only) para
// acreditar la tarifa a la Liga Taka. La llamada va en try/catch — si la RPC
// no existe o falla, el play sigue persistido y solo no se acreditan puntos
// (awarded: 0).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { POINTS_ENABLED_GAMES, pointsFor, type GameId as PointsGameId } from '@/lib/game-points'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { readJson } from '@/lib/api-utils'
import { captureException } from '@/lib/monitoring'

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
  const parsed = await readJson<PlayBody>(req)
  if ('error' in parsed) return parsed.error
  const body = parsed.data
  try {
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

    // Auth: acepta cookie (web) o Authorization: Bearer (takasports-app).
    const { supabase: sb, user } = await supabaseForRequest(req)
    if (!user) {
      // Modo invitado: aceptamos y devolvemos sin persistir (cliente cae a localStorage)
      return NextResponse.json({ persisted: false, reason: 'no_session' })
    }

    // Freno anti-abuso por usuario: registrar partidas escribe en BD y acredita
    // puntos a la Liga Taka. Generoso para uso normal, corta scripts.
    const rl = await checkRateLimit({
      bucket: 'games_plays',
      key: `${getClientIp(req)}:${user.id}`,
      windowSeconds: 60,
      max: 30,
    })
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
      )
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

    // ── Cross-game puntos (Liga Taka) ──────────────────────────────
    // Solo para juegos en la whitelist. Defensivo: si la RPC no existe
    // o falla, devolvemos awarded:0 y el play sigue persistido
    // normalmente — la UI no se rompe.
    let awarded = 0
    if (POINTS_ENABLED_GAMES.has(body.game_id as PointsGameId)) {
      // pointsFor valida y acota internamente cada campo del payload a su
      // dominio real (GAME_LIMITS) antes de derivar la tarifa → un parte
      // manipulado (correct>total, total gigante, tipos raros) nunca infla.
      const amount = pointsFor(body.game_id as PointsGameId, body.score, body.payload)
      if (amount > 0) {
        try {
          const admin = adminSupabase()
          if (admin) {
            const { data: credited, error: pointsErr } = await admin.rpc('award_game_points', {
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
    captureException(err, { route: 'games/plays' })
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
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

  const { supabase: sb, user } = await supabaseForRequest(req)
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
