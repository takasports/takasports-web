'use client'

// ─────────────────────────────────────────────────────────────────
// LeaderboardBadgeChip — chip 16×16 que se renderiza junto al nick
// de un usuario en los leaderboards públicos (quiniela, ranked, games).
//
// Acepta tanto un LeaderboardBadge (del catálogo) como un equipment.badge
// (del slot equipado). Soporta tooltip nativo (title).
// ─────────────────────────────────────────────────────────────────

import type { LeaderboardBadge, LeaderboardEquipment } from '@/lib/leaderboard-badges'

type ChipBadge =
  | LeaderboardBadge
  | NonNullable<LeaderboardEquipment['badge']>

interface Props {
  badge: ChipBadge | null | undefined
  size?: number
}

export function LeaderboardBadgeChip({ badge, size = 16 }: Props) {
  if (!badge) return null
  const name = 'name' in badge && badge.name ? badge.name : ''
  return (
    <span
      title={name}
      aria-label={name}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: 4,
        background: badge.bg, border: `1px solid ${badge.color}`,
        fontSize: Math.max(8, size - 7), lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {badge.emoji}
    </span>
  )
}

/**
 * Renderiza el chip "principal" (equipped > primer auto) seguido de hasta
 * `extraLimit` chips adicionales si NO hay equipped (para no saturar cuando
 * el user ya eligió uno).
 */
export function LeaderboardBadgesRow({
  badges,
  equippedBadge,
  extraLimit = 2,
  size = 16,
}: {
  badges?: LeaderboardBadge[]
  equippedBadge?: LeaderboardEquipment['badge']
  extraLimit?: number
  size?: number
}) {
  const primary = equippedBadge ?? badges?.[0]
  if (!primary) return null
  const extras = !equippedBadge && badges && badges.length > 1
    ? badges.slice(1, 1 + extraLimit)
    : []
  return (
    <span className="inline-flex items-center gap-0.5 flex-shrink-0">
      <LeaderboardBadgeChip badge={primary} size={size} />
      {extras.map(b => <LeaderboardBadgeChip key={b.id} badge={b} size={size} />)}
    </span>
  )
}

/** Epíteto (title equipado) bajo el nick. */
export function LeaderboardTitleLine({
  title,
  size = 9,
}: {
  title?: LeaderboardEquipment['title']
  size?: number
}) {
  if (!title) return null
  return (
    <p
      className="font-black truncate"
      style={{
        color: title.color,
        fontFamily: 'var(--font-sport)',
        opacity: 0.85,
        fontSize: size,
        lineHeight: 1.2,
        marginTop: 1,
      }}
    >
      {title.text}
    </p>
  )
}
