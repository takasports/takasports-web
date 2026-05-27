// GET /api/quiniela/leaderboard?jornada=X&limit=20[&mode=ranked|legacy][&tournament=mundial2026]
//
// Ranking de jugadores. Tres modos:
//
// MODO RANKED + jornada (default) — Liga General de una jornada concreta:
//   · Score = MONEDAS reales ganadas por el usuario en esa jornada.
//   · Fuente: quiniela_picks.picks.breakdown.totalCoins.
//   · Top N ordenado por monedas desc, desempate por hits desc.
//
// MODO TOURNAMENT — ranking acumulado a través de TODAS las jornadas
// del torneo (e.g. Mundial 2026). Filtro por prefijo en la label
// de jornada (las jornadas del Mundial empiezan con "Mundial · …",
// generado por buildJornadaLabel cuando QUINIELA_MUNDIAL está activo).
//   · tournament=mundial2026 → filtra jornadas LIKE "Mundial%".
//   · Score = suma de totalCoins a lo largo del torneo.
//   · total = jornadas jugadas (para mostrar "X jornadas").
//
// MODO LEGACY (opt-in) — proxy histórico por pickCount.
//
// Shape de respuesta:
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
import { selectDisplayBadges } from '@/lib/badges'

export interface LeaderboardBadge {
  id: string
  name: string
  emoji: string
  color: string
  bg: string
  rarity: string
}

export interface LeaderboardEntry {
  nickname: string
  score: number          // ranked: monedas | legacy: pickCount
  total: number          // ranked: hits  | legacy: 10 (placeholder)
  captainUsed: boolean
  isMe?: boolean
  /** Hasta 3 badges (los más prestigiosos) para mostrar junto al nick. */
  badges?: LeaderboardBadge[]
}

// Helper compartido: fetch badges para un set de userIds y devuelve
// un Map<userId, LeaderboardBadge[]>. Filtra IDs desconocidos y
// limita a 3 por user (los más prestigiosos según selectDisplayBadges).
async function fetchBadgesByUser(
  admin: ReturnType<typeof adminSupabase>,
  userIds: string[],
): Promise<Map<string, LeaderboardBadge[]>> {
  const out = new Map<string, LeaderboardBadge[]>()
  if (!admin || userIds.length === 0) return out
  const { data } = await admin
    .from('quiniela_badges')
    .select('user_id, badge_id')
    .in('user_id', userIds)
  if (!data) return out
  const byUser = new Map<string, string[]>()
  for (const row of data) {
    const uid = row.user_id as string
    const list = byUser.get(uid) ?? []
    list.push(row.badge_id as string)
    byUser.set(uid, list)
  }
  for (const [uid, ids] of byUser.entries()) {
    const defs = selectDisplayBadges(ids, 3)
    out.set(uid, defs.map(d => ({
      id: d.id, name: d.name, emoji: d.emoji,
      color: d.color, bg: d.bg, rarity: d.rarity,
    })))
  }
  return out
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

// Prefijo en la columna `jornada` que identifica al torneo.
// Las jornadas del Mundial se generan con buildJornadaLabel y
// empiezan SIEMPRE con "Mundial" (skin "Copa 2026" auto-detectado).
const TOURNAMENT_PREFIXES: Record<string, string> = {
  mundial2026: 'Mundial',
}

export async function GET(req: NextRequest) {
  const jornada = req.nextUrl.searchParams.get('jornada') ?? ''
  const limit   = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('limit') ?? '10', 10), 1), 50)
  const mode    = (req.nextUrl.searchParams.get('mode') ?? 'ranked').toLowerCase()
  const tournament = req.nextUrl.searchParams.get('tournament')?.toLowerCase() ?? ''

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ entries: [], mode })
  }
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ entries: [], mode })

  try {
    // ── MODO TOURNAMENT ────────────────────────────────────────────
    // Ranking acumulado a través de TODAS las jornadas del torneo.
    // Score = suma de totalCoins ganados; total = jornadas jugadas.
    const tournamentPrefix = TOURNAMENT_PREFIXES[tournament]
    if (tournamentPrefix) {
      const { data: rows, error } = await admin
        .from('quiniela_picks')
        .select('user_id, picks, jornada')
        .ilike('jornada', `${tournamentPrefix}%`)
      if (error) throw error
      if (!rows || rows.length === 0) {
        return NextResponse.json({ entries: [], mode: 'tournament', tournament })
      }

      // Agregamos por user_id sumando totalCoins.
      const byUser = new Map<string, { coins: number; jornadas: number; hits: number }>()
      for (const r of rows) {
        const stored = (r.picks ?? {}) as StoredPicks
        const b = stored.breakdown ?? {}
        const uid = r.user_id as string
        const prev = byUser.get(uid) ?? { coins: 0, jornadas: 0, hits: 0 }
        prev.coins += b.totalCoins ?? 0
        prev.hits += b.hits ?? 0
        prev.jornadas += 1
        byUser.set(uid, prev)
      }

      // Profile lookup en una sola query.
      const userIds = [...byUser.keys()]
      const [{ data: profileRows }, badgesByUser] = await Promise.all([
        admin.from('profiles').select('id, display_name').in('id', userIds),
        fetchBadgesByUser(admin, userIds),
      ])
      const nameById = new Map<string, string>()
      for (const p of profileRows ?? []) {
        const name = (p.display_name as string | null)?.trim()
        if (name) nameById.set(p.id as string, name)
      }

      const entries: LeaderboardEntry[] = [...byUser.entries()]
        .map(([uid, agg]) => ({
          nickname: nameById.get(uid) ?? `Jugador-${uid.slice(0, 6)}`,
          score: agg.coins,
          total: agg.jornadas,  // jornadas jugadas
          captainUsed: false,
          badges: badgesByUser.get(uid) ?? [],
        }))
        .sort((a, b) => b.score - a.score || b.total - a.total)
        .slice(0, limit)

      return NextResponse.json({ entries, mode: 'tournament', tournament })
    }

    // ── MODO SEASON ───────────────────────────────────────────────
    // Ranking acumulado de TODAS las jornadas de clubes (NO Mundial)
    // — equivalente al modo tournament pero al revés: agrega todo
    // EXCEPTO las jornadas de torneos especiales.
    //
    // Permite a un user que entra a la jornada 5 ver SU ranking de
    // temporada incluso sin estar en el TOP 10 semanal. Anti-frustración
    // de onboarding tardío.
    if (mode === 'season') {
      // Construimos la condición "NO empieza con prefijo de ningún
      // tournament conocido". Por ahora solo Mundial, pero está abierto
      // a expandirse (Eurocopa, Copa América, etc.).
      const excludePrefixes = Object.values(TOURNAMENT_PREFIXES)
      let query = admin.from('quiniela_picks').select('user_id, picks, jornada')
      for (const prefix of excludePrefixes) {
        query = query.not('jornada', 'ilike', `${prefix}%`)
      }
      const { data: rows, error } = await query
      if (error) throw error
      if (!rows || rows.length === 0) {
        return NextResponse.json({ entries: [], mode: 'season' })
      }

      const byUser = new Map<string, { coins: number; jornadas: number; hits: number }>()
      for (const r of rows) {
        const stored = (r.picks ?? {}) as StoredPicks
        const b = stored.breakdown ?? {}
        const uid = r.user_id as string
        const prev = byUser.get(uid) ?? { coins: 0, jornadas: 0, hits: 0 }
        prev.coins += b.totalCoins ?? 0
        prev.hits += b.hits ?? 0
        prev.jornadas += 1
        byUser.set(uid, prev)
      }

      const userIds = [...byUser.keys()]
      const [{ data: profileRows }, badgesByUser] = await Promise.all([
        admin.from('profiles').select('id, display_name').in('id', userIds),
        fetchBadgesByUser(admin, userIds),
      ])
      const nameById = new Map<string, string>()
      for (const p of profileRows ?? []) {
        const name = (p.display_name as string | null)?.trim()
        if (name) nameById.set(p.id as string, name)
      }

      const entries: LeaderboardEntry[] = [...byUser.entries()]
        .map(([uid, agg]) => ({
          nickname: nameById.get(uid) ?? `Jugador-${uid.slice(0, 6)}`,
          score: agg.coins,
          total: agg.jornadas,
          captainUsed: false,
          badges: badgesByUser.get(uid) ?? [],
        }))
        .sort((a, b) => b.score - a.score || b.total - a.total)
        .slice(0, limit)

      return NextResponse.json({ entries, mode: 'season' })
    }

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

      // Profile lookup + badges en paralelo.
      const userIds = [...new Set(rows.map(r => r.user_id as string))]
      const [{ data: profileRows }, badgesByUser] = await Promise.all([
        admin.from('profiles').select('id, display_name').in('id', userIds),
        fetchBadgesByUser(admin, userIds),
      ])
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
            badges: badgesByUser.get(uid) ?? [],
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
