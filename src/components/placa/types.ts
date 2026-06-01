// ─────────────────────────────────────────────────────────────────
// PlacaData — modelo de la placa personal del usuario.
//
// Los 4 slots actuales (badge/title/frame/cardBg) ya existen en DB
// (quiniela_user_equipment). Los slots nuevos (avatarFrame, nameEffect,
// cornerSticker, signatureStat, backgroundPattern, secondaryBadges)
// son propuestas del mockup — irán a la futura tabla `cosmetics` +
// `user_equipment_v2` si se aprueban tras la revisión visual.
// ─────────────────────────────────────────────────────────────────

export type PlacaTier = 'bronze' | 'silver' | 'gold' | 'diamond'

export interface PlacaBadge {
  id: string
  emoji: string
  name: string
  color: string
  bg: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | string
}

export interface PlacaData {
  // ── Identidad ──────────────────────────────────────────────────
  displayName: string
  handle: string                        // sin @, lo pone la UI
  avatarUrl?: string | null
  fallbackInitials?: string

  // ── Progresión ─────────────────────────────────────────────────
  level: number
  levelName: string                     // "Crack", "Maestro", etc.
  tier: PlacaTier                       // derivado de level por defecto

  // ── Slots existentes (DB) ──────────────────────────────────────
  badge?:     PlacaBadge                // chip primario
  title?:     { text: string; color: string }
  frame?:     { color: string }         // borde de la placa
  cardBg?:    { gradient: string }      // fondo base

  // ── Slots propuestos (mockup) ──────────────────────────────────
  avatarFrame?:       { color: string; style?: 'solid' | 'gradient' | 'dashed' }
  nameEffect?:        { gradient?: string; glow?: string }
  cornerSticker?:     { emoji: string; color: string }
  signatureStat?:     { label: string; value: string; emoji?: string }
  backgroundPattern?: 'dots' | 'lines' | 'stripes' | 'none'

  // ── Badges secundarios (hasta 2 bajo el primario) ──────────────
  secondaryBadges?: PlacaBadge[]
}

/**
 * Configuración visual por tier — se aplica automáticamente al render
 * salvo que la placa lo sobrescriba con cosméticos específicos.
 */
export const TIER_CONFIG: Record<PlacaTier, {
  label: string
  primary: string
  glow: string
  ringStyle: string  // gradient para el borde metálico
}> = {
  bronze: {
    label: 'BRONZE',
    primary: '#cd7f32',
    glow:    'rgba(205,127,50,0.35)',
    ringStyle: 'linear-gradient(135deg, #cd7f32 0%, #a06129 50%, #cd7f32 100%)',
  },
  silver: {
    label: 'SILVER',
    primary: '#cbd5e1',
    glow:    'rgba(203,213,225,0.30)',
    ringStyle: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 50%, #e2e8f0 100%)',
  },
  gold: {
    label: 'GOLD',
    primary: '#fbbf24',
    glow:    'rgba(251,191,36,0.40)',
    ringStyle: 'linear-gradient(135deg, #fbbf24 0%, #b45309 50%, #fde68a 100%)',
  },
  diamond: {
    label: 'DIAMOND',
    primary: '#22d3ee',
    glow:    'rgba(34,211,238,0.45)',
    ringStyle: 'linear-gradient(135deg, #22d3ee 0%, #c084fc 33%, #fbbf24 66%, #22d3ee 100%)',
  },
}

export function tierFromLevel(level: number): PlacaTier {
  if (level >= 50) return 'diamond'
  if (level >= 25) return 'gold'
  if (level >= 10) return 'silver'
  return 'bronze'
}
