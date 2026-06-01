// ─────────────────────────────────────────────────────────────────
// Equipment — helpers para el sistema de slots de personalización.
//
// SLOTS (9):
//   Legacy 4 (también equipables con cosmetic desde Fase 3):
//     badge    → chip 16×16 junto al nick en el ranking
//     title    → epíteto bajo el nick
//     frame    → color del borde de la fila (epic+)
//     card_bg  → gradiente del fondo (legendary)
//   Nuevos 5 (Fase 3, SOLO via cosmetic):
//     avatar_frame       → anillo del avatar
//     name_effect        → gradient/glow sobre el nombre
//     corner_sticker     → pegatina decorativa esquina
//     signature_stat     → stat firmado destacado
//     background_pattern → textura overlay sutil
//
// MODO DE OPERACIÓN:
//   Cada fila de quiniela_user_equipment tiene UNO de:
//     · badge_id   → modo legacy, resuelve contra BADGES (código)
//     · cosmetic_id → modo nuevo, resuelve contra tabla `cosmetics`
//
//   El CHECK exactly-one en DB garantiza que solo uno está set.
//
// COMPATIBILIDAD:
//   Toda la UI/render existente lee `UserEquipment` que tiene los
//   slots tradicionales (badge/title/frame/card_bg) + los nuevos.
//   Las filas legacy siguen renderizando igual; las nuevas se hidratan
//   desde el catálogo en DB.
// ─────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { BADGES, type BadgeDef } from './badges'

// Todos los slots posibles
export type EquipSlot =
  | 'badge' | 'title' | 'frame' | 'card_bg'
  | 'avatar_frame' | 'name_effect' | 'corner_sticker'
  | 'signature_stat' | 'background_pattern'

export const EQUIP_SLOTS: EquipSlot[] = [
  'badge', 'title', 'frame', 'card_bg',
  'avatar_frame', 'name_effect', 'corner_sticker',
  'signature_stat', 'background_pattern',
]

// Slots legacy (admiten badge_id) — los 5 nuevos solo aceptan cosmetic_id
export const LEGACY_SLOTS: EquipSlot[] = ['badge', 'title', 'frame', 'card_bg']

// Mapeo slot → cosmetic.type esperado
const SLOT_TO_COSMETIC_TYPE: Record<EquipSlot, string> = {
  badge:              'badge_chip',
  title:              'title',
  frame:              'frame',
  card_bg:            'card_bg',
  avatar_frame:       'avatar_frame',
  name_effect:        'name_effect',
  corner_sticker:     'corner_sticker',
  signature_stat:     'signature_stat',
  background_pattern: 'background_pattern',
}

/** Snapshot del equipamiento activo de un user (todas las shapes que la UI espera). */
export interface UserEquipment {
  // Legacy 4 — incluyen badgeId opcional cuando la fuente es legacy
  badge?:   { badgeId?: string; cosmeticId?: string; emoji: string; color: string; bg: string; name: string }
  title?:   { badgeId?: string; cosmeticId?: string; text: string; color: string }
  frame?:   { badgeId?: string; cosmeticId?: string; color: string }
  card_bg?: { badgeId?: string; cosmeticId?: string; gradient: string }
  // Nuevos 5 — siempre cosmetic-backed
  avatar_frame?:       { cosmeticId: string; color: string; style?: 'solid' | 'gradient' }
  name_effect?:        { cosmeticId: string; gradient: string; glow?: string }
  corner_sticker?:     { cosmeticId: string; iconId: string; color: string }
  signature_stat?:     { cosmeticId: string; key: string; label: string }
  background_pattern?: { cosmeticId: string; pattern: 'dots' | 'lines' | 'stripes' }
}

// ─────────────────────────────────────────────────────────────────
// Resolución de filas
// ─────────────────────────────────────────────────────────────────

interface EquipmentRow {
  user_id?:    string
  slot:        EquipSlot
  badge_id:    string | null
  cosmetic_id: string | null
}

interface CosmeticRowSlim {
  id:    string
  type:  string
  name:  string
  data:  Record<string, unknown>
}

/** Aplica una fila legacy (badge_id) sobre el UserEquipment del user. */
function applyBadgeRow(eq: UserEquipment, slot: EquipSlot, def: BadgeDef): void {
  const badgeId = def.id
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
    // Los nuevos slots NO se equipan con badge legacy
    default:
      break
  }
}

/** Aplica una fila nueva (cosmetic_id) sobre el UserEquipment del user. */
function applyCosmeticRow(eq: UserEquipment, slot: EquipSlot, c: CosmeticRowSlim): void {
  const d = c.data as Record<string, string | undefined>
  const cosmeticId = c.id

  switch (slot) {
    case 'badge':
      // badge_chip cosmetic: tiene icon_id, color, bg, name
      eq.badge = {
        cosmeticId,
        emoji: '',                          // icon_id va por separado, el chip usa BadgeIcon
        color: d.color ?? '#7C3AED',
        bg:    d.bg    ?? 'rgba(124,58,237,0.18)',
        name:  c.name,
      }
      break
    case 'title':
      eq.title = {
        cosmeticId,
        text:  d.text  ?? c.name,
        color: d.color ?? '#7C3AED',
      }
      break
    case 'frame':
      eq.frame = { cosmeticId, color: d.color ?? '#7C3AED' }
      break
    case 'card_bg':
      eq.card_bg = { cosmeticId, gradient: d.gradient ?? '' }
      break
    case 'avatar_frame':
      eq.avatar_frame = {
        cosmeticId,
        color: d.color ?? '#7C3AED',
        style: (d.style as 'solid' | 'gradient' | undefined) ?? 'solid',
      }
      break
    case 'name_effect':
      eq.name_effect = {
        cosmeticId,
        gradient: d.gradient ?? '',
        glow:     d.glow,
      }
      break
    case 'corner_sticker':
      eq.corner_sticker = {
        cosmeticId,
        iconId: d.icon_id ?? 'star',
        color:  d.color   ?? '#fbbf24',
      }
      break
    case 'signature_stat':
      eq.signature_stat = {
        cosmeticId,
        key:   d.key   ?? 'xp',
        label: d.label ?? 'XP',
      }
      break
    case 'background_pattern':
      eq.background_pattern = {
        cosmeticId,
        pattern: (d.pattern as 'dots' | 'lines' | 'stripes' | undefined) ?? 'dots',
      }
      break
  }
}

// ─────────────────────────────────────────────────────────────────
// LECTURA — fetchUserEquipment / fetchEquipmentByUser
// ─────────────────────────────────────────────────────────────────

export async function fetchUserEquipment(
  sb: SupabaseClient,
  userId: string,
): Promise<UserEquipment> {
  const out: UserEquipment = {}
  const { data: rows } = await sb
    .from('quiniela_user_equipment')
    .select('slot, badge_id, cosmetic_id')
    .eq('user_id', userId)
  if (!rows || rows.length === 0) return out

  // Recopilar cosmetic_ids para batch-fetch
  const cosmeticIds = (rows as EquipmentRow[])
    .map(r => r.cosmetic_id).filter((c): c is string => !!c)

  const cosmeticMap = await fetchCosmeticsSlim(sb, cosmeticIds)

  for (const row of rows as EquipmentRow[]) {
    const slot = row.slot
    if (row.cosmetic_id) {
      const c = cosmeticMap.get(row.cosmetic_id)
      if (c) applyCosmeticRow(out, slot, c)
    } else if (row.badge_id) {
      const def = BADGES[row.badge_id]
      if (def) applyBadgeRow(out, slot, def)
    }
  }
  return out
}

export async function fetchEquipmentByUser(
  sb: SupabaseClient,
  userIds: string[],
): Promise<Map<string, UserEquipment>> {
  const out = new Map<string, UserEquipment>()
  if (userIds.length === 0) return out

  const { data: rows } = await sb
    .from('quiniela_user_equipment')
    .select('user_id, slot, badge_id, cosmetic_id')
    .in('user_id', userIds)
  if (!rows) return out

  // Batch-fetch de cosmetics involucradas
  const cosmeticIds = (rows as EquipmentRow[])
    .map(r => r.cosmetic_id).filter((c): c is string => !!c)
  const cosmeticMap = await fetchCosmeticsSlim(sb, cosmeticIds)

  for (const row of rows as EquipmentRow[]) {
    const uid = row.user_id!
    const slot = row.slot
    const eq = out.get(uid) ?? {}

    if (row.cosmetic_id) {
      const c = cosmeticMap.get(row.cosmetic_id)
      if (c) applyCosmeticRow(eq, slot, c)
    } else if (row.badge_id) {
      const def = BADGES[row.badge_id]
      if (def) applyBadgeRow(eq, slot, def)
    }
    out.set(uid, eq)
  }
  return out
}

async function fetchCosmeticsSlim(
  sb: SupabaseClient,
  ids: string[],
): Promise<Map<string, CosmeticRowSlim>> {
  const out = new Map<string, CosmeticRowSlim>()
  if (ids.length === 0) return out
  const { data } = await sb
    .from('cosmetics')
    .select('id, type, name, data')
    .in('id', ids)
    .eq('active', true)
  for (const r of (data ?? []) as CosmeticRowSlim[]) {
    out.set(r.id, r)
  }
  return out
}

// ─────────────────────────────────────────────────────────────────
// VALIDACIÓN — para endpoints de equip
// ─────────────────────────────────────────────────────────────────

/**
 * Valida que un badge legacy se puede equipar en un slot. Legacy path.
 * Devuelve null si OK, o string de error.
 */
export function validateEquip(
  slot: EquipSlot,
  badgeDef: BadgeDef,
  ownedBadgeIds: Set<string>,
): string | null {
  if (!LEGACY_SLOTS.includes(slot)) {
    return 'este slot solo acepta cosméticos (no badges legacy)'
  }
  if (!ownedBadgeIds.has(badgeDef.id)) {
    return 'badge no desbloqueado'
  }
  if (slot === 'badge') return null
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

/**
 * Valida que un cosmetic se puede equipar en un slot.
 *
 * Reglas:
 *   1. El cosmetic debe estar en `ownedCosmeticIds` (el user lo tiene
 *      desbloqueado en user_cosmetic_unlocks).
 *   2. El `type` del cosmetic debe matchear el slot (excepto badge_chip
 *      ↔ slot 'badge', donde 'badge_chip' es lo esperado).
 */
export function validateCosmeticEquip(
  slot: EquipSlot,
  cosmeticType: string,
  cosmeticId: string,
  ownedCosmeticIds: Set<string>,
): string | null {
  if (!ownedCosmeticIds.has(cosmeticId)) {
    return 'cosmético no desbloqueado'
  }
  const expected = SLOT_TO_COSMETIC_TYPE[slot]
  if (!expected) return 'slot inválido'
  if (cosmeticType !== expected) {
    return `este cosmético es de tipo "${cosmeticType}" — el slot "${slot}" espera "${expected}"`
  }
  return null
}
