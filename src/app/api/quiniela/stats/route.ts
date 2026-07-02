// GET /api/quiniela/stats — agregados personales del usuario autenticado.
//
// Lee quiniela_picks del usuario y calcula:
//   · totalWon (puntos ganados, acumulado en las jornadas jugadas)
//   · jornadasPlayed (cuántas jornadas selló)
//   · jornadasSettled (cuántas ya cerraron con puntos acreditados)
//   · hitRate (% de aciertos sobre picks totales)
//   · bestJornada (la que más puntos ganó)
//   · currentStreak (jornadas consecutivas con al menos 1 acierto,
//     contando desde la más reciente hacia atrás)
//   · pleno (cuántos plenos hizo all-time)
//
// Modelo SIN apuestas: nada de stake / neto / ROI (retirados en T5).
// Sin sesión devuelve { authed: false }. La UI cae a un mensaje
// invitando a login. Sin Supabase configurado (dev local) también.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { apiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

interface StoredBreakdown {
  hits?: number
  pleno?: boolean
  totalPoints?: number
  totalCoins?: number
}
interface StoredPicksRow {
  picks?: unknown[]
  breakdown?: StoredBreakdown
  staked?: boolean
  settled?: boolean
  totalWon?: number
}

export interface QuinielaStats {
  authed: boolean
  jornadasPlayed: number
  jornadasSettled: number
  totalWon: number
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
  totalWon: 0,
  totalHits: 0,
  totalPicks: 0,
  hitRate: null,
  plenos: 0,
  currentStreak: 0,
  bestJornada: null,
}

export async function GET(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(EMPTY_STATS)
  }
  try {
    const { supabase: sb, user } = await supabaseForRequest(req)
    if (!user) return NextResponse.json(EMPTY_STATS)

    const { data: rows, error } = await sb
      .from('quiniela_picks')
      .select('jornada, picks, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) {
      return apiError('request_failed', 200, { ...EMPTY_STATS, authed: true })
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ ...EMPTY_STATS, authed: true })
    }

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

    const hitRate = totalPicks > 0 ? Math.round((totalHits / totalPicks) * 100) : null

    const stats: QuinielaStats = {
      authed: true,
      jornadasPlayed: rows.length,
      jornadasSettled,
      totalWon,
      totalHits,
      totalPicks,
      hitRate,
      plenos,
      currentStreak,
      bestJornada,
    }
    return NextResponse.json(stats)
  } catch (e) {
    return apiError('request_failed', 200, { ...EMPTY_STATS })
  }
}
