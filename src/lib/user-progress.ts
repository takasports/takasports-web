// ─────────────────────────────────────────────────────────────────
// User progress — FUENTE ÚNICA del XP y nivel de un usuario.
//
// La placa pública (/api/placa/[userId]) y el perfil propio
// (/api/quiniela/me) muestran SIEMPRE el mismo nivel usando este módulo.
//
// F4·T5: XP = suma de puntos positivos del ledger (point_transactions).
// Las insignias YA están dentro de esa suma (cada una acredita +50 puntos
// reales al desbloquearse, source='badge'), así que NO se suman aparte.
// Seguimos contando badgesCount para mostrarlo, pero no altera el XP.
// ─────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { computeXp, computeLevel, type LevelInfo } from './levels'

export interface UserProgress {
  lifetimePts: number   // suma de puntos positivos del ledger
  badgesCount: number   // insignias distintas desbloqueadas (informativo)
  xp: number            // XP total = puntos lifetime (insignias incluidas vía su +50)
  level: LevelInfo      // nivel + progreso derivados del XP
}

/**
 * Parte PURA: dados los importes positivos del ledger y los ids de
 * insignia del usuario, deriva su XP y nivel. Testeable sin BD.
 * Los puntos de insignia (+50) ya llegan dentro de `ptAmounts`; `badgeIds`
 * solo aporta el conteo informativo.
 */
export function userProgressFrom(ptAmounts: number[], badgeIds: string[]): UserProgress {
  const lifetimePts = ptAmounts.reduce((sum, a) => sum + (a ?? 0), 0)
  const badgesCount = new Set(badgeIds).size
  const xp = computeXp(lifetimePts)
  return { lifetimePts, badgesCount, xp, level: computeLevel(xp) }
}

/**
 * Lee de la BD el XP y nivel canónicos de un usuario. Sirve tanto con el
 * cliente de servicio (placa pública, cualquier userId) como con el
 * cliente de sesión (perfil propio, RLS acota a las filas del usuario).
 */
export async function fetchUserProgress(
  client: SupabaseClient,
  userId: string,
): Promise<UserProgress> {
  const [ptRes, badgeRes] = await Promise.all([
    client.from('point_transactions').select('amount').eq('user_id', userId).gt('amount', 0),
    client.from('quiniela_badges').select('badge_id').eq('user_id', userId),
  ])
  return userProgressFrom(
    (ptRes.data ?? []).map((r) => r.amount as number),
    (badgeRes.data ?? []).map((r) => r.badge_id as string),
  )
}
