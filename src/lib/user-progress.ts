// ─────────────────────────────────────────────────────────────────
// User progress — FUENTE ÚNICA del XP y nivel de un usuario.
//
// La placa pública (/api/placa/[userId]) y el perfil propio
// (/api/quiniela/me) deben mostrar SIEMPRE el mismo nivel. Antes cada
// ruta calculaba el XP por su cuenta (la placa reimplementaba la fórmula
// a mano y contaba TODAS las filas de insignias; el perfil usaba
// computeXp con las insignias que resolvían a definición) → podían
// divergir. Este módulo centraliza el cálculo para que no vuelva a pasar.
//
// XP = suma de puntos positivos (point_transactions.amount > 0)
//      + XP_PER_BADGE por cada insignia DISTINTA desbloqueada.
// La insignia cuenta por haberse ganado (una fila), no por que el código
// tenga su definición: un fallo de catálogo no debe borrar XP ya ganado.
// ─────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { computeXp, computeLevel, type LevelInfo } from './levels'

export interface UserProgress {
  lifetimePts: number   // suma de puntos positivos del ledger
  badgesCount: number   // insignias distintas desbloqueadas
  xp: number            // XP total (puntos + bonus por insignias)
  level: LevelInfo      // nivel + progreso derivados del XP
}

/**
 * Parte PURA: dados los importes positivos del ledger y los ids de
 * insignia del usuario, deriva su XP y nivel. Testeable sin BD.
 */
export function userProgressFrom(ptAmounts: number[], badgeIds: string[]): UserProgress {
  const lifetimePts = ptAmounts.reduce((sum, a) => sum + (a ?? 0), 0)
  const badgesCount = new Set(badgeIds).size
  const xp = computeXp({ lifetimePts, badgesCount })
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
