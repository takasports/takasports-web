// ─────────────────────────────────────────────────────────────────
// Equipment — helpers para el sistema de slots de personalización.
//
// Slots disponibles:
//   badge    → ícono chip 16×16 junto al nick en el ranking
//   title    → epíteto bajo el nick ("El Oráculo")
//   frame    → color del borde de la fila entera (epic+)
//   card_bg  → gradiente del fondo de la fila (legendary only)
//
// Flujo:
//   1. User desbloquea badge → automáticamente tiene acceso a los
//      ítems que ese badge otorga según su rareza.
//   2. User equipa desde BadgesModal → POST /api/quiniela/me/equip.
//   3. Leaderboard lee quiniela_user_equipment y renderiza el
//      equipamiento de CADA usuario públicamente.
//
// Restricciones:
//   · Solo se puede equipar un ítem que ya se desbloqueó.
//   · Equipar un nuevo slot desplaza al anterior (1 activo por slot).
//   · Un badge que no tenga unlocks.title no puede equiparse en
//     el slot 'title' — la API lo rechaza.
// ─────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { BADGES, type BadgeDef } from './badges'

export type EquipSlot = 'badge' | 'title' | 'frame' | 'card_bg'
export const EQUIP_SLOTS: EquipSlot[] = ['badge', 'title', 'frame', 'card_bg']

/** Snapshot del equipamiento activo de un user. */
export interface UserEquipment {
  badge?:   { badgeId: string; emoji: string; color: string; bg: string; name: string }
  title?:   { badgeId: string; text: string; color: string }
  frame?:   { badgeId: string; color: string }
  card_bg?: { badgeId: string; gradient: string }
}

/**
 * Lee el equipamiento activo de un user desde quiniela_user_equipment.
 * Resuelve los ítems contra el catálogo para tener los valores finales.
 * Silencia errores — un fallo de equipamiento nunca rompe el ranking.
 */
export async function fetchUserEquipment(
  sb: SupabaseClient,
  userId: string,
): Promise<UserEquipment> {
  const out: UserEquipment = {}
  const { data } = await sb
    .from('quiniela_user_equipment')
    .select('slot, badge_id')
    .eq('user_id', userId)
  if (!data) return out

  for (const row of data) {
    const slot = row.slot as EquipSlot
    const badgeId = row.badge_id as string
    const def = BADGES[badgeId]
    if (!def) continue  // badge_id huérfano, ignorar

    switch (slot) {
      case 'badge':
        out.badge = { badgeId, emoji: def.emoji, color: def.color, bg: def.bg, name: def.name }
        break
      case 'title':
        if (def.unlocks?.title) {
          out.title = { badgeId, text: def.unlocks.title, color: def.color }
        }
        break
      case 'frame':
        if (def.unlocks?.frameColor) {
          out.frame = { badgeId, color: def.unlocks.frameColor }
        }
        break
      case 'card_bg':
        if (def.unlocks?.cardBg) {
          out.card_bg = { badgeId, gradient: def.unlocks.cardBg }
        }
        break
    }
  }
  return out
}

/**
 * Lee el equipamiento de múltiples users en una sola query.
 * Usado por leaderboard/route.ts para batch-fetchear sin N+1.
 */
export async function fetchEquipmentByUser(
  sb: SupabaseClient,
  userIds: string[],
): Promise<Map<string, UserEquipment>> {
  const out = new Map<string, UserEquipment>()
  if (userIds.length === 0) return out

  const { data } = await sb
    .from('quiniela_user_equipment')
    .select('user_id, slot, badge_id')
    .in('user_id', userIds)
  if (!data) return out

  for (const row of data) {
    const uid = row.user_id as string
    const slot = row.slot as EquipSlot
    const badgeId = row.badge_id as string
    const def = BADGES[badgeId]
    if (!def) continue

    const eq = out.get(uid) ?? {}
    switch (slot) {
      case 'badge':
        eq.badge = { badgeId, emoji: def.emoji, color: def.color, bg: def.bg, name: def.name }
        break
      case 'title':
        if (def.unlocks?.title) {
          eq.title = { badgeId, text: def.unlocks.title, color: def.color }
        }
        break
      case 'frame':
        if (def.unlocks?.frameColor) {
          eq.frame = { badgeId, color: def.unlocks.frameColor }
        }
        break
      case 'card_bg':
        if (def.unlocks?.cardBg) {
          eq.card_bg = { badgeId, gradient: def.unlocks.cardBg }
        }
        break
    }
    out.set(uid, eq)
  }
  return out
}

/**
 * Valida que el user puede equipar un badge en un slot determinado.
 * Devuelve null si es válido, o un string de error si no.
 */
export function validateEquip(
  slot: EquipSlot,
  badgeDef: BadgeDef,
  ownedBadgeIds: Set<string>,
): string | null {
  if (!ownedBadgeIds.has(badgeDef.id)) {
    return 'badge no desbloqueado'
  }
  if (slot === 'badge') return null  // cualquier badge se puede equipar en slot badge

  if (slot === 'title') {
    if (!badgeDef.unlocks?.title) return 'este badge no incluye un título equipable'
    return null
  }
  if (slot === 'frame') {
    if (!badgeDef.unlocks?.frameColor) return 'este badge requiere rareza epic o superior para desbloquear frame'
    return null
  }
  if (slot === 'card_bg') {
    if (!badgeDef.unlocks?.cardBg) return 'este badge requiere rareza legendary para desbloquear card_bg'
    return null
  }
  return 'slot inválido'
}
