// POST /api/games/missions/claim  { mission_id, period }
//
// Acredita los PUNTOS reales de una misión completada (F4·T5). El monto lo fija
// el SERVIDOR desde missions-catalog (el cliente solo dice qué misión, nunca
// cuántos puntos). La RPC award_mission_points es idempotente por
// usuario+misión+periodo y aplica el tope diario (MISSION_DAILY_CAP).
//
// Anti-trampa: (1) la misión debe ser la ACTIVA de hoy/esta semana (selección
// determinista, misma seed que el cliente); (2) el completado se verifica contra
// game_plays (partidas reales, con techo antifraude) para las 6 misiones que se
// pueden; las 2 de conteo ("juega N veces") confían en el cliente porque
// game_plays deduplica por periodo — el tope diario acota el abuso.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { readJson } from '@/lib/api-utils'
import { captureException } from '@/lib/monitoring'
import { madridDayISO, madridWeekISO } from '@/lib/taka-time'
import {
  TEMPLATES,
  activeDailyIds,
  activeWeeklyIds,
  MISSION_DAILY_CAP,
  type MissionTemplate,
} from '@/lib/missions-catalog'

interface ClaimBody {
  mission_id: string
  period: string
}

interface GamePlayRow {
  game_id: string
  period: string
  score: number
  payload: { solved?: unknown } | null
}

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/** Verifica el completado contra las partidas reales (game_plays). */
function isCompleted(tpl: MissionTemplate, rows: GamePlayRow[], dayKey: string, weekKey: string): boolean {
  const v = tpl.verify
  if (v.via === 'client') return true

  const find = (gameId: string, periodKey: string) =>
    rows.find(r => r.game_id === gameId && r.period === periodKey)

  switch (v.via) {
    case 'exists': {
      const key = v.periodType === 'daily' ? dayKey : weekKey
      return !!find(v.gameId, key)
    }
    case 'score': {
      const key = v.periodType === 'daily' ? dayKey : weekKey
      const row = find(v.gameId, key)
      return !!row && typeof row.score === 'number' && row.score >= v.min
    }
    case 'takagrid-solved': {
      const solvedVal = find('takagrid', dayKey)?.payload?.solved
      const arr = Array.isArray(solvedVal) ? (solvedVal as unknown[]) : []
      return arr.filter(Boolean).length >= v.solved
    }
    case 'all-four': {
      return (
        !!find('crackquiz', dayKey) &&
        !!find('takagrid', dayKey) &&
        !!find('mionce', weekKey) &&
        !!find('sopacracks', weekKey)
      )
    }
    default:
      return false
  }
}

export async function POST(req: NextRequest) {
  const parsed = await readJson<ClaimBody>(req)
  if ('error' in parsed) return parsed.error
  const body = parsed.data
  try {
    const missionId = body?.mission_id
    const period = body?.period
    if (!missionId || typeof missionId !== 'string' || !TEMPLATES[missionId]) {
      return NextResponse.json({ error: 'invalid mission_id' }, { status: 400 })
    }
    if (!period || typeof period !== 'string') {
      return NextResponse.json({ error: 'period required' }, { status: 400 })
    }
    if (!hasSupabaseEnv()) {
      return NextResponse.json({ awarded: 0, persisted: false })
    }

    const tpl = TEMPLATES[missionId]
    const dayKey = madridDayISO()
    const weekKey = madridWeekISO()

    // El periodo reclamado debe ser el ACTUAL (nada de días/semanas viejos).
    const expectedPeriod = tpl.period === 'daily' ? dayKey : weekKey
    if (period !== expectedPeriod) {
      return NextResponse.json({ awarded: 0, reason: 'stale_period' })
    }
    // La misión debe estar ACTIVA en este periodo (selección determinista).
    const activeIds = tpl.period === 'daily' ? activeDailyIds(dayKey) : activeWeeklyIds(weekKey)
    if (!activeIds.includes(missionId)) {
      return NextResponse.json({ awarded: 0, reason: 'not_active' })
    }

    // Auth: cookie (web). La app nativa usará su propio camino (Bearer) en su fase.
    const { supabase: sb, user } = await supabaseForRequest(req)
    if (!user) {
      return NextResponse.json({ awarded: 0, reason: 'no_session' })
    }

    const rl = await checkRateLimit({
      bucket: 'missions_claim',
      key: `${getClientIp(req)}:${user.id}`,
      windowSeconds: 60,
      max: 20,
    })
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
      )
    }

    // Verificar completado contra las partidas reales del usuario (RLS: self-read).
    const { data, error: readErr } = await sb
      .from('game_plays')
      .select('game_id, period, score, payload')
      .eq('user_id', user.id)
      .in('period', [dayKey, weekKey])
    if (readErr) {
      return NextResponse.json({ awarded: 0, reason: 'read_error' })
    }
    const rows = (data ?? []) as GamePlayRow[]
    if (!isCompleted(tpl, rows, dayKey, weekKey)) {
      return NextResponse.json({ awarded: 0, reason: 'not_completed' })
    }

    // Acreditar (idempotente + tope en la RPC). Monto = catálogo del servidor.
    const admin = adminSupabase()
    if (!admin) {
      return NextResponse.json({ awarded: 0, persisted: false })
    }
    const { data: credited, error: awardErr } = await admin.rpc('award_mission_points', {
      p_mission_id: missionId,
      p_period: period,
      p_amount: tpl.reward,
      p_user_id: user.id,
      p_daily_cap: MISSION_DAILY_CAP,
    })
    if (awardErr) {
      captureException(awardErr, { route: 'missions/claim', missionId })
      return NextResponse.json({ awarded: 0 })
    }

    return NextResponse.json({ awarded: typeof credited === 'number' ? credited : 0 })
  } catch (err) {
    captureException(err, { route: 'missions/claim' })
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
