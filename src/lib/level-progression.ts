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
