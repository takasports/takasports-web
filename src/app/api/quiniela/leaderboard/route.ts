// GET /api/quiniela/leaderboard?jornada=X&limit=20
// Devuelve el top N de usuarios por puntos en una jornada concreta.
// Fuente: quiniela_league_members (picks persistidos con scores).
// Fallback: datos sintéticos si Supabase no está configurado.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'

export interface LeaderboardEntry {
  nickname: string
  score: number
  total: number
  captainUsed: boolean
  isMe?: boolean
}

function syntheticBoard(jornada: string, total: number, limit: number): LeaderboardEntry[] {
  const NAMES = ['Carlos M.','Adrián M.','Ana L.','Cristina H.','Sergio F.','Pablo R.','Laura V.','Miguel Á.','Elena S.','David T.']
  const seed = jornada.split('').reduce((s, c, i) => s + c.charCodeAt(0) * (i + 2), 0)
  return NAMES.slice(0, limit).map((nickname, i) => {
    const raw = (seed * (i + 5) * 13 + i * 97) % 100
    const score = Math.max(0, Math.round((raw / 100) * total) - i)
    return { nickname, score, total, captainUsed: i < 3 }
  }).sort((a, b) => b.score - a.score)
}

export async function GET(req: NextRequest) {
  const jornada = req.nextUrl.searchParams.get('jornada') ?? ''
  const limit   = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '10', 10), 50)

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Return synthetic data so the UI is never empty in dev
    return NextResponse.json({ entries: syntheticBoard(jornada, 10, limit), synthetic: true })
  }

  try {
    const admin = adminSupabase()
    if (!admin) return NextResponse.json({ entries: syntheticBoard(jornada, 10, limit), synthetic: true })

    // Fetch all members with scores for this jornada from all leagues
    // We aggregate across leagues by user_id and take their best score
    const { data, error } = await admin
      .from('quiniela_league_members')
      .select('user_id, nickname, picks, exact_scores, captain_idx, updated_at')
      .filter('picks', 'neq', '{}')

    if (error) throw error

    if (!data || data.length === 0) {
      return NextResponse.json({ entries: syntheticBoard(jornada, 10, limit), synthetic: true })
    }

    // Group by user_id, keep entry with highest pick count
    const byUser = new Map<string, { nickname: string; pickCount: number; captainUsed: boolean }>()
    for (const row of data) {
      const picks = row.picks as Record<string, string>
      const pickCount = Object.keys(picks).length
      const existing = byUser.get(row.user_id)
      if (!existing || pickCount > existing.pickCount) {
        byUser.set(row.user_id, {
          nickname: row.nickname,
          pickCount,
          captainUsed: row.captain_idx != null,
        })
      }
    }

    // Convert to entries — we don't have real scores stored per-member yet,
    // so we use pickCount as proxy until server scoring lands
    const entries: LeaderboardEntry[] = [...byUser.values()]
      .sort((a, b) => b.pickCount - a.pickCount)
      .slice(0, limit)
      .map(u => ({
        nickname: u.nickname,
        score: u.pickCount,
        total: 10,
        captainUsed: u.captainUsed,
      }))

    return NextResponse.json({ entries, synthetic: entries.length === 0 })
  } catch (e) {
    console.error('[leaderboard]', e)
    return NextResponse.json({ entries: syntheticBoard(jornada, 10, limit), synthetic: true })
  }
}
