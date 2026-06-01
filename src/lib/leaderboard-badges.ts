// ─────────────────────────────────────────────────────────────────
// Leaderboard badges — helper compartido entre endpoints que devuelven
// rankings de usuarios (/api/quiniela/leaderboard, /api/ranked/leaderboard,
// /api/games/leaderboard).
//
// Devuelve hasta 3 badges por user, ordenados por rareza (legendary →
// common), resolviendo metadata contra el catálogo de código + special
// badges en DB.
// ─────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { BADGES, type BadgeDef } from './badges'
import { fetchSpecialBadgeDefs } from './special-badges'

export interface LeaderboardBadge {
  id: string
  name: string
  emoji: string
  color: string
  bg: string
  rarity: string
}

export interface LeaderboardEquipment {
  badge?:   { emoji: string; color: string; bg: string; name: string }
  title?:   { text: string; color: string }
  frame?:   { color: string }
  card_bg?: { gradient: string }
}

const RARITY_ORDER: Record<string, number> = {
  legendary: 0, epic: 1, rare: 2, common: 3,
}

/**
 * Fetch badges para un set de userIds. Devuelve Map<userId, LeaderboardBadge[]>
 * con hasta 3 entradas por user (los más prestigiosos). Filtra IDs desconocidos
 * y mezcla catálogo de código + special badges en DB.
 *
 * Diseñado para usarse con admin client (service role) pero también funciona con
 * cliente de user (la tabla quiniela_badges tiene SELECT público).
 */
export async function fetchBadgesByUser(
  sb: SupabaseClient | null | undefined,
  userIds: string[],
  limit = 3,
): Promise<Map<string, LeaderboardBadge[]>> {
  const out = new Map<string, LeaderboardBadge[]>()
  if (!sb || userIds.length === 0) return out

  const { data } = await sb
    .from('quiniela_badges')
    .select('user_id, badge_id')
    .in('user_id', userIds)
  if (!data) return out

  const byUser = new Map<string, string[]>()
  const allIds = new Set<string>()
  for (const row of data) {
    const uid = row.user_id as string
    const bid = row.badge_id as string
    const list = byUser.get(uid) ?? []
    list.push(bid)
    allIds.add(bid)
    byUser.set(uid, list)
  }

  // Resolver special badges (IDs no presentes en el catálogo de código).
  const unknownIds = [...allIds].filter(id => !BADGES[id])
  const specialDefs = unknownIds.length > 0
    ? await fetchSpecialBadgeDefs(sb, unknownIds)
    : new Map<string, BadgeDef>()

  const resolveDef = (id: string): BadgeDef | null =>
    BADGES[id] ?? specialDefs.get(id) ?? null

  for (const [uid, ids] of byUser.entries()) {
    const defs = ids
      .map(resolveDef)
      .filter((d): d is BadgeDef => d != null)
      .sort((a, b) => (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9))
      .slice(0, limit)
    out.set(uid, defs.map(d => ({
      id: d.id, name: d.name, emoji: d.emoji,
      color: d.color, bg: d.bg, rarity: d.rarity,
    })))
  }
  return out
}
