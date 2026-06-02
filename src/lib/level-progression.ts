// ─────────────────────────────────────────────────────────────────
// Level progression — wrapper que recompone XP/Level y otorga
// cualquier cosmético por nivel que el user todavía no tenga.
//
// Diseño: idempotente y barato. Llamado desde rutas que pueden
// haber cambiado XP del user (settle quiniela, score ranked, etc.)
// después del awarding de puntos.
//
// El cómputo de XP requiere:
//   1. Sum positivo de point_transactions (lifetime puntos Taka)
//   2. Count de quiniela_badges (cada badge da +200 XP)
//
// Es dos queries por llamada — aceptable porque solo se invoca
// post-acción importante (no en cada page-load).
// ─────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { computeLevel, XP_PER_BADGE } from './levels'
import { unlockCosmeticsForLevel } from './cosmetics'

export interface LevelProgressionResult {
  level:        number
  xp:           number
  newCosmetics: string[]   // ids de cosméticos recién desbloqueados
}

/**
 * Batch: computa el nivel de varios users de una vez (para leaderboards).
 * Devuelve Map<userId, { level, levelName, xp }>.
 *
 * Dos queries totales (no por user):
 *   1. sum(amount) positivos de point_transactions agrupado por user
 *   2. count de quiniela_badges agrupado por user
 *
 * No otorga cosméticos — es solo lectura (read-only display).
 */
export async function fetchLevelsByUser(
  sb: SupabaseClient,
  userIds: string[],
): Promise<Map<string, { level: number; levelName: string; xp: number }>> {
  const out = new Map<string, { level: number; levelName: string; xp: number }>()
  if (userIds.length === 0) return out

  const [ptRes, badgeRes] = await Promise.all([
    sb.from('point_transactions').select('user_id, amount').in('user_id', userIds).gt('amount', 0),
    sb.from('quiniela_badges').select('user_id').in('user_id', userIds),
  ])

  const ptByUser = new Map<string, number>()
  for (const r of ptRes.data ?? []) {
    const uid = r.user_id as string
    ptByUser.set(uid, (ptByUser.get(uid) ?? 0) + ((r.amount as number) ?? 0))
  }
  const badgeCountByUser = new Map<string, number>()
  for (const r of badgeRes.data ?? []) {
    const uid = r.user_id as string
    badgeCountByUser.set(uid, (badgeCountByUser.get(uid) ?? 0) + 1)
  }

  for (const uid of userIds) {
    const xp = (ptByUser.get(uid) ?? 0) + (badgeCountByUser.get(uid) ?? 0) * XP_PER_BADGE
    const info = computeLevel(xp)
    out.set(uid, { level: info.current.level, levelName: info.current.name, xp })
  }
  return out
}

/**
 * Recompone XP del user, calcula su nivel actual y otorga cualquier
 * cosmético por nivel que todavía no tenga. Fire-and-forget seguro.
 *
 * Devuelve {} silencioso si algo falla — no propaga errores.
 */
export async function processLevelProgression(
  sb: SupabaseClient,
  userId: string,
): Promise<LevelProgressionResult> {
  const empty: LevelProgressionResult = { level: 1, xp: 0, newCosmetics: [] }
  if (!userId) return empty

  try {
    // 1) Lifetime points (suma de point_transactions positivas)
    const { data: ptRows } = await sb
      .from('point_transactions')
      .select('amount')
      .eq('user_id', userId)
      .gt('amount', 0)
    const lifetimePts = (ptRows ?? []).reduce(
      (sum, t) => sum + ((t.amount as number) ?? 0), 0,
    )

    // 2) Badge count
    const { count: badgeCount } = await sb
      .from('quiniela_badges')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const xp = lifetimePts + (badgeCount ?? 0) * XP_PER_BADGE
    const info = computeLevel(xp)
    const level = info.current.level

    // 3) Otorga cosméticos por nivel — idempotente
    const newCosmetics = await unlockCosmeticsForLevel(sb, userId, level)

    return { level, xp, newCosmetics }
  } catch (err) {
    console.warn('[processLevelProgression] failed', { userId, err: (err as Error)?.message })
    return empty
  }
}
