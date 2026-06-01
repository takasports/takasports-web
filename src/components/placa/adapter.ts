// ─────────────────────────────────────────────────────────────────
// PlacaData adapter — convierte la respuesta del endpoint
// /api/cosmetics/me (UserEquipment shape) + datos de level + datos
// de identidad → PlacaData consumible por PlacaCardV3.
//
// Esto desacopla:
//   · El backend devuelve UserEquipment con todos los slots reales.
//   · El componente visual de la placa consume PlacaData, que es la
//     shape "renderizada" (badges con full meta, gradients ya resueltos,
//     etc.).
//
// El adapter es donde:
//   · Resolvemos signature_stat (key → valor live).
//   · Decidimos secondaryBadges (de la lista de badges del user).
//   · Calculamos tier desde level.
// ─────────────────────────────────────────────────────────────────

import type { PlacaData, PlacaBadge } from './types'
import { tierFromLevel } from './types'
import type { LeaderboardBadge } from '@/lib/leaderboard-badges'

/** Shape mínima del UserEquipment tal y como la sirve /api/cosmetics/me. */
export interface ApiEquipment {
  badge?:   { badgeId?: string; cosmeticId?: string; emoji: string; color: string; bg: string; name: string }
  title?:   { badgeId?: string; cosmeticId?: string; text: string; color: string }
  frame?:   { badgeId?: string; cosmeticId?: string; color: string }
  card_bg?: { badgeId?: string; cosmeticId?: string; gradient: string }
  avatar_frame?:       { cosmeticId: string; color: string; style?: 'solid' | 'gradient' }
  name_effect?:        { cosmeticId: string; gradient: string; glow?: string }
  corner_sticker?:     { cosmeticId: string; iconId: string; color: string }
  signature_stat?:     { cosmeticId: string; key: string; label: string }
  background_pattern?: { cosmeticId: string; pattern: 'dots' | 'lines' | 'stripes' }
}

export interface BuildPlacaInput {
  displayName: string
  handle:      string
  avatarUrl?:  string | null
  fallbackInitials?: string

  // Progresión
  level:       number
  levelName:   string
  xp?:         number

  // Equipment del user
  equipment?:  ApiEquipment

  // Lista de badges del user (para secondary chips si no hay equipado uno)
  badges?:     LeaderboardBadge[]

  // Live values para signature_stat (key → value mostrado)
  liveStats?:  Record<string, string | number>
}

/**
 * Construye la PlacaData lista para renderizar la PlacaCardV3.
 */
export function buildPlacaData(input: BuildPlacaInput): PlacaData {
  const eq = input.equipment ?? {}

  // Badge primario — equipped > primer badge auto
  let badge: PlacaBadge | undefined
  if (eq.badge) {
    badge = {
      id:    eq.badge.cosmeticId ?? eq.badge.badgeId ?? 'badge_chip',
      iconId: eq.badge.badgeId ?? undefined,   // si viene de badge legacy, el iconId matchea
      emoji: eq.badge.emoji,
      name:  eq.badge.name,
      color: eq.badge.color,
      bg:    eq.badge.bg,
      rarity: 'rare',  // no la sabemos sin lookup extra; placa la usa solo cosmético
    }
  } else if (input.badges?.[0]) {
    const b = input.badges[0]
    badge = {
      id: b.id, iconId: b.id, emoji: b.emoji, name: b.name,
      color: b.color, bg: b.bg, rarity: b.rarity,
    }
  }

  // Secondary chips — siguientes badges del user (omitimos el que ya es primario)
  const primaryId = badge?.id
  const secondaryBadges: PlacaBadge[] = (input.badges ?? [])
    .filter(b => b.id !== primaryId)
    .slice(0, 2)
    .map(b => ({
      id: b.id, iconId: b.id, emoji: b.emoji, name: b.name,
      color: b.color, bg: b.bg, rarity: b.rarity,
    }))

  // Signature stat — resolver value desde liveStats
  let signatureStat: PlacaData['signatureStat']
  if (eq.signature_stat) {
    const key = eq.signature_stat.key
    const raw = input.liveStats?.[key]
    if (raw !== undefined) {
      signatureStat = {
        label: eq.signature_stat.label,
        value: String(raw),
      }
    }
  }

  // Background pattern — del cosmetic
  const backgroundPattern = eq.background_pattern?.pattern ?? 'none'

  const tier = tierFromLevel(input.level)

  return {
    displayName: input.displayName,
    handle:      input.handle,
    avatarUrl:   input.avatarUrl ?? null,
    fallbackInitials: input.fallbackInitials,
    level:       input.level,
    levelName:   input.levelName,
    tier,

    badge,
    title:   eq.title   ? { text: eq.title.text, color: eq.title.color }   : undefined,
    frame:   eq.frame   ? { color: eq.frame.color }                        : undefined,
    cardBg:  eq.card_bg ? { gradient: eq.card_bg.gradient }                : undefined,

    avatarFrame: eq.avatar_frame
      ? { color: eq.avatar_frame.color, style: eq.avatar_frame.style }
      : undefined,
    nameEffect: eq.name_effect
      ? { gradient: eq.name_effect.gradient, glow: eq.name_effect.glow }
      : undefined,
    cornerSticker: eq.corner_sticker
      ? { iconId: eq.corner_sticker.iconId, color: eq.corner_sticker.color }
      : undefined,
    signatureStat,
    backgroundPattern: backgroundPattern as PlacaData['backgroundPattern'],

    secondaryBadges: secondaryBadges.length > 0 ? secondaryBadges : undefined,
  }
}
