// ─────────────────────────────────────────────────────────────────
// Level progression — wrapper que recompone XP/Level y otorga
// cualquier cosmético por nivel que el user todavía no tenga.
//
// Diseño: idempotente y barato. Llamado desde rutas que pueden haber
// cambiado los puntos del user (settle quiniela, score ranked, desbloqueo
// de insignia, etc.) después del awarding.
//
// F4·T5: XP = suma positiva de point_transactions (puntos Taka lifetime).
// Las insignias YA están dentro de esa suma (+50 al desbloquearse), así que
// no se cuentan aparte. Una query por llamada.
// ─────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { computeLevel } from './levels'
import { unlockCosmeticsForLevel } from './cosmetics'

export interface LevelProgressionResult {
  level:        number
  xp:           number
  newCosmetics: string[]   // ids de cosméticos recién desbloqueados
}

/**
 * Batch: computa el nivel de varios users de una vez (para leaderboards).
 * Devuelve Map<userId, { level, levelName, xp }>. Una sola query.
 * No otorga cosméticos — es solo lectura (read-only display).
 */
export async function fetchLevelsByUser(
  sb: SupabaseClient,
  userIds: string[],
): Promise<Map<string, { level: number; levelName: string; xp: number }>> {
  const out = new Map<string, { level: number; levelName: string; xp: number }>()
  if (userIds.length === 0) return out

  const ptRes = await sb
    .from('point_transactions')
    .select('user_id, amount')
    .in('user_id', userIds)
    .gt('amount', 0)

  const ptByUser = new Map<string, number>()
  for (const r of ptRes.data ?? []) {
    const uid = r.user_id as string
    ptByUser.set(uid, (ptByUser.get(uid) ?? 0) + ((r.amount as number) ?? 0))
  }

  for (const uid of userIds) {
    const xp = ptByUser.get(uid) ?? 0
    const info = computeLevel(xp)
    out.set(uid, { level: info.current.level, levelName: info.current.name, xp })
  }
  return out
}

/**
 * Recompone el XP del user, calcula su nivel actual y otorga cualquier
 * cosmético por nivel que todavía no tenga. Fire-and-forget seguro.
 *
 * Devuelve un resultado vacío silencioso si algo falla — no propaga errores.
 */
export async function processLevelProgression(
  sb: SupabaseClient,
  userId: string,
): Promise<LevelProgressionResult> {
  const empty: LevelProgressionResult = { level: 1, xp: 0, newCosmetics: [] }
  if (!userId) return empty

  try {
    // Lifetime points (suma de point_transactions positivas). Incluye ya los
    // +50 de cada insignia (source='badge').
    const { data: ptRows } = await sb
      .from('point_transactions')
      .select('amount')
      .eq('user_id', userId)
      .gt('amount', 0)
    const lifetimePts = (ptRows ?? []).reduce(
      (sum, t) => sum + ((t.amount as number) ?? 0), 0,
    )

    const info = computeLevel(lifetimePts)
    const level = info.current.level

    // Otorga cosméticos por nivel — idempotente
    const newCosmetics = await unlockCosmeticsForLevel(sb, userId, level)

    return { level, xp: lifetimePts, newCosmetics }
  } catch (err) {
    console.warn('[processLevelProgression] failed', { userId, err: (err as Error)?.message })
    return empty
  }
}
