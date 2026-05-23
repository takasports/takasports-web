// GET /api/quiniela/leaderboard?jornada=X&limit=20[&mode=ranked|legacy]
//
// Ranking de jugadores en una jornada concreta.
//
// MODO RANKED (default) — para el modo «Ranked» (Liga General):
//   · Score = MONEDAS reales ganadas por el usuario en esa jornada.
//   · Fuente: quiniela_picks.picks.breakdown.totalCoins (lo escribe
//     /api/quiniela/score server-side, autoritativo).
//   · JOIN con profiles para display_name; fallback a "Jugador-XXXXXX".
//   · Top N ordenado por monedas desc, desempate por hits desc.
//
// MODO LEGACY (opt-in) — proxy histórico por pickCount:
//   · Solo expuesto por compatibilidad con clientes viejos.
//   · Sin jornada o sin sesión Ranked, lo usa como último recurso.
//
// Shape de respuesta (estable, no cambia desde la versión anterior):
//   { entries: [{ nickname, score, total, captainUsed, isMe? }], mode }
//
// Notas:
//   · Sin Supabase configurado → { entries: [] } (UI maneja vacío).
//   · El campo `synthetic` se ha eliminado: el endpoint nunca lo
//     emitía pero la UI lo defaulteaba a true (bug que mostraba
//     «Datos de demostración» con datos reales). El cliente debe
//     considerar ausente = false.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'

export interface LeaderboardEntry {
  nickname: string
  score: number          // ranked: monedas | legacy: pickCount
  total: number          // ranked: hits  | legacy: 10 (placeholder)
  captainUsed: boolean
  isMe?: boolean
}

interface PickBreakdown {
  totalCoins?: number
  hits?: number
  exacts?: number
  pleno?: boolean
}
interface StoredPicks {
  picks?: unknown
  breakdown?: PickBreakdown
}

export async function GET(req: NextRequest) {
  const jornada = req.nextUrl.searchParams.get('jornada') ?? ''
  const limit   = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('limit') ?? '10', 10), 1), 50)
  const mode    = (req.nextUrl.searchParams.get('mode') ?? 'ranked').toLowerCase()

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ entries: [], mode })
  }
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ entries: [], mode })

  try {
    // ── MODO RANKED ────────────────────────────────────────────────
    // Solo si hay jornada; sin ella no podemos filtrar picks Ranked.
    if (mode === 'ranked' && jornada) {
      const { data: rows, error } = await admin
        .from('quiniela_picks')
        .select('user_id, picks')
        .eq('jornada', jornada)
      if (error) throw error
      if (!rows || rows.length === 0) {
        return NextResponse.json({ entries: [], mode: 'ranked' })
      }

      // Profile lookup en una sola query.
      const userIds = [...new Set(rows.map(r => r.user_id as string))]
      const { data: profileRows } = await admin
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds)
      const nameById = new Map<string, string>()
      for (const p of profileRows ?? []) {
        const name = (p.display_name as string | null)?.trim()
        if (name) nameById.set(p.id as string, name)
      }

      const entries: LeaderboardEntry[] = rows
        .map(r => {
          const stored = (r.picks ?? {}) as StoredPicks
          const b = stored.breakdown ?? {}
          const uid = r.user_id as string
          return {
            nickname: nameById.get(uid) ?? `Jugador-${uid.slice(0, 6)}`,
            score: b.totalCoins ?? 0,
            total: b.hits ?? 0,
            captainUsed: false,
          }
        })
        // Score desc (monedas), desempate por hits (total) desc.
        .sort((a, b) => b.score - a.score || b.total - a.total)
        .slice(0, limit)

      return NextResponse.json({ entries, mode: 'ranked' })
    }

    // ── MODO LEGACY (fallback) ─────────────────────────────────────
    // Proxy por pickCount agregando todas las ligas privadas. Mantenido
    // por compatibilidad con clientes viejos. NO refleja aciertos.
    const { data, error } = await admin
      .from('quiniela_league_members')
      .select('user_id, nickname, picks, captain_idx')
      .filter('picks', 'neq', '{}')
    if (error) throw error
    if (!data || data.length === 0) {
      return NextResponse.json({ entries: [], mode: 'legacy' })
    }

    const byUser = new Map<string, { nickname: string; pickCount: number; captainUsed: boolean }>()
    for (const row of data) {
      const picksObj = row.picks as Record<string, string>
      const pickCount = Object.keys(picksObj).length
      const uid = row.user_id as string
      const existing = byUser.get(uid)
      if (!existing || pickCount > existing.pickCount) {
        byUser.set(uid, {
          nickname: row.nickname as string,
          pickCount,
          captainUsed: row.captain_idx != null,
        })
      }
    }
    const entries: LeaderboardEntry[] = [...byUser.values()]
      .sort((a, b) => b.pickCount - a.pickCount)
      .slice(0, limit)
      .map(u => ({ nickname: u.nickname, score: u.pickCount, total: 10, captainUsed: u.captainUsed }))

    return NextResponse.json({ entries, mode: 'legacy' })
  } catch (e) {
    console.error('[leaderboard]', e)
    return NextResponse.json({ entries: [], mode })
  }
}
