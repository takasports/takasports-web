// GET /api/quiniela/stats — agregados personales del usuario autenticado.
//
// Lee quiniela_picks del usuario y calcula:
//   · totalStaked / totalWon / net / ROI%
//   · jornadasPlayed (cuántas jornadas selló)
//   · jornadasSettled (cuántas ya cerraron con ganancias acreditadas)
//   · hitRate (% de aciertos sobre picks totales)
//   · bestJornada (la que más coins ganó)
//   · currentStreak (jornadas consecutivas con al menos 1 acierto,
//     contando desde la más reciente hacia atrás)
//   · pleno (cuántos plenos hizo all-time)
//
// Sin sesión devuelve { authed: false }. La UI cae a un mensaje
// invitando a login. Sin Supabase configurado (dev local) también.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

interface StoredBreakdown {
  hits?: number
  pleno?: boolean
  totalPoints?: number
  totalCoins?: number
  totalStake?: number
}
interface StoredPicksRow {
  picks?: unknown[]
  breakdown?: StoredBreakdown
  staked?: boolean
  settled?: boolean
  totalStakeCharged?: number
  totalWon?: number
}

export interface QuinielaStats {
  authed: boolean
  jornadasPlayed: number
  jornadasSettled: number
  totalStaked: number
  totalWon: number
  net: number
  roi: number | null      // null si totalStaked === 0
  totalHits: number
  totalPicks: number
  hitRate: number | null  // null si totalPicks === 0
  plenos: number
  currentStreak: number
  bestJornada: {
    jornada: string
    won: number
    hits: number
    total: number
  } | null
}

const EMPTY_STATS: QuinielaStats = {
  authed: false,
  jornadasPlayed: 0,
  jornadasSettled: 0,
  totalStaked: 0,
  totalWon: 0,
  net: 0,
  roi: null,
  totalHits: 0,
  totalPicks: 0,
  hitRate: null,
  plenos: 0,
  currentStreak: 0,
  bestJornada: null,
}

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(EMPTY_STATS)
  }
  try {
    const sb = await createServerSupabaseClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return NextResponse.json(EMPTY_STATS)

    const { data: rows, error } = await sb
      .from('quiniela_picks')
      .select('jornada, picks, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) {
      return NextResponse.json({ ...EMPTY_STATS, authed: true, error: error.message }, { status: 200 })
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ ...EMPTY_STATS, authed: true })
    }

    let totalStaked = 0
    let totalWon = 0
    let totalHits = 0
    let totalPicks = 0
    let plenos = 0
    let jornadasSettled = 0
    let bestJornada: QuinielaStats['bestJornada'] = null

    for (const row of rows) {
      const stored = (row.picks ?? {}) as StoredPicksRow
      const breakdown = stored.breakdown ?? {}
      const picksArr = Array.isArray(stored.picks) ? stored.picks : []

      // Stake apostado: preferimos totalStakeCharged (lo que efectivamente
      // cobró el RPC), si no, breakdown.totalStake.
      const staked = stored.totalStakeCharged ?? breakdown.totalStake ?? 0
      totalStaked += staked

      // Won: preferimos totalWon (settle definitivo), si no, breakdown.totalCoins.
      // Si la jornada no se ha settled todavía, breakdown.totalCoins puede ser
      // 0 (sin resultados) — eso es correcto, todavía no ganó nada.
      const won = stored.totalWon ?? breakdown.totalCoins ?? 0
      totalWon += won

      totalHits += breakdown.hits ?? 0
      totalPicks += picksArr.length
      if (breakdown.pleno) plenos += 1
      if (stored.settled) jornadasSettled += 1

      if (won > 0 && (!bestJornada || won > bestJornada.won)) {
        bestJornada = {
          jornada: row.jornada as string,
          won,
          hits: breakdown.hits ?? 0,
          total: picksArr.length,
        }
      }
    }

    // Racha actual: contar desde la más reciente hacia atrás mientras
    // haya al menos 1 acierto. rows ya vienen ordenadas desc por created_at.
    let currentStreak = 0
    for (const row of rows) {
      const stored = (row.picks ?? {}) as StoredPicksRow
      const hits = stored.breakdown?.hits ?? 0
      if (hits > 0) currentStreak += 1
      else break
    }

    const net = totalWon - totalStaked
    const roi = totalStaked > 0 ? Math.round((net / totalStaked) * 100) : null
    const hitRate = totalPicks > 0 ? Math.round((totalHits / totalPicks) * 100) : null

    const stats: QuinielaStats = {
      authed: true,
      jornadasPlayed: rows.length,
      jornadasSettled,
      totalStaked,
      totalWon,
      net,
      roi,
      totalHits,
      totalPicks,
      hitRate,
      plenos,
      currentStreak,
      bestJornada,
    }
    return NextResponse.json(stats)
  } catch (e) {
    return NextResponse.json({ ...EMPTY_STATS, error: String(e) }, { status: 200 })
  }
}
