// ─────────────────────────────────────────────────────────────────
// BadgeIcon — set de iconos custom para badges, stickers y elementos
// decorativos de la placa.
//
// Estilo:
//   · Line-art geométrico, trazo 1.7-2px
//   · Sin curvas innecesarias — ángulos rectos y diagonales 45°
//     para encajar con la silueta angular de la PlacaCardV3
//   · Monocromático: usa `currentColor`, el padre controla el color
//   · viewBox 24×24 estándar
//   · Sin emojis nativos en ningún lado
//
// Cuándo agregar un icono nuevo: lo coordinas con el catálogo de
// badges. El `id` debe matchear con BADGES[id] del catálogo, así
// el render automático funciona en cualquier lugar de la web.
// ─────────────────────────────────────────────────────────────────

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }

function Svg({ size = 24, strokeWidth = 1.7, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      shapeRendering="geometricPrecision"
      {...rest}
    >
      {children}
    </svg>
  )
}

// ── Iconos individuales ──────────────────────────────────────────

const IconSignature = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 20 L 17 6" />
    <path d="M13 8 L 18 13" />
    <path d="M17 6 L 20 3 L 21 4 L 18 7 Z" fill="currentColor" stroke="none" />
    <path d="M3 20 L 8 19" />
  </Svg>
)

const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12 L 7 7 L 17 7 L 22 12 L 17 17 L 7 17 Z" />
    <circle cx="12" cy="12" r="3.2" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
)

const IconEyeStars = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 13 L 7 9 L 17 9 L 21 13 L 17 17 L 7 17 Z" />
    <circle cx="12" cy="13" r="2.5" />
    <circle cx="12" cy="13" r="0.9" fill="currentColor" stroke="none" />
    <path d="M5 4 L 6 6 L 8 4 L 6 2 Z" fill="currentColor" stroke="none" />
    <path d="M18 3 L 19 5 L 21 3 L 19 1 Z" fill="currentColor" stroke="none" />
    <path d="M21 7 L 22 9 L 23 7 L 22 5 Z" fill="currentColor" stroke="none" />
  </Svg>
)

const IconTarget = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" />
    <rect x="7" y="7" width="10" height="10" />
    <rect x="10" y="10" width="4" height="4" fill="currentColor" stroke="none" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
  </Svg>
)

const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="2" width="20" height="20" />
    <path d="M6 12 L 11 17 L 18 8" />
  </Svg>
)

const IconDice = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 5 L 12 2 L 21 5 L 21 19 L 12 22 L 3 19 Z" />
    <path d="M3 5 L 12 9 L 21 5" />
    <path d="M12 9 L 12 22" />
    <circle cx="7" cy="11" r="1" fill="currentColor" stroke="none" />
    <circle cx="7" cy="15" r="1" fill="currentColor" stroke="none" />
    <circle cx="17" cy="11" r="1" fill="currentColor" stroke="none" />
    <circle cx="17" cy="17" r="1" fill="currentColor" stroke="none" />
  </Svg>
)

const IconCoins = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="12" cy="6" rx="8" ry="2.5" />
    <path d="M4 6 L 4 11 Q 4 13.5 12 13.5 Q 20 13.5 20 11 L 20 6" />
    <path d="M4 11 L 4 18 Q 4 20.5 12 20.5 Q 20 20.5 20 18 L 20 11" />
  </Svg>
)

const IconFlame = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2 L 6 11 L 9 13 L 4 22 L 12 17 L 20 22 L 15 13 L 18 11 Z" />
    <path d="M10 17 L 12 13 L 14 17" />
  </Svg>
)

const IconFlameBig = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 1 L 4 12 L 8 14 L 2 23 L 12 18 L 22 23 L 16 14 L 20 12 Z" />
    <path d="M9 18 L 12 13 L 15 18 Z" fill="currentColor" stroke="none" />
  </Svg>
)

const IconBurst = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 1 L 14 7 L 20 4 L 17 10 L 23 12 L 17 14 L 20 20 L 14 17 L 12 23 L 10 17 L 4 20 L 7 14 L 1 12 L 7 10 L 4 4 L 10 7 Z" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
  </Svg>
)

const IconCrown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 18 L 5 7 L 9 12 L 12 5 L 15 12 L 19 7 L 21 18 Z" />
    <line x1="3" y1="21" x2="21" y2="21" />
    <circle cx="12" cy="9" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="6" cy="11" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="18" cy="11" r="0.8" fill="currentColor" stroke="none" />
  </Svg>
)

const IconTrophy = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 3 L 17 3 L 17 9 Q 17 14 12 14 Q 7 14 7 9 Z" />
    <path d="M10 14 L 10 18 L 14 18 L 14 14" />
    <path d="M7 21 L 17 21" />
    <path d="M11 18 L 11 21 L 13 21 L 13 18" />
    <path d="M7 4 L 4 4 L 4 8 L 7 8" />
    <path d="M17 4 L 20 4 L 20 8 L 17 8" />
  </Svg>
)

const IconMedal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2 L 6 8 L 12 13 L 18 8 L 16 2" />
    <circle cx="12" cy="17" r="5" />
    <path d="M10 15 L 14 15 L 11 19 L 14 19" />
  </Svg>
)

const IconGlobe = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <ellipse cx="12" cy="12" rx="4" ry="10" />
    <line x1="12" y1="2" x2="12" y2="22" />
  </Svg>
)

const IconDiamond = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2 L 22 9 L 12 22 L 2 9 Z" />
    <path d="M2 9 L 22 9" />
    <path d="M8 9 L 12 2 L 16 9" />
    <path d="M8 9 L 12 22 L 16 9" />
  </Svg>
)

const IconStar = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2 L 14.5 9.5 L 22 10 L 16 15 L 18 22 L 12 18 L 6 22 L 8 15 L 2 10 L 9.5 9.5 Z" />
  </Svg>
)

const IconWolf = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8 L 7 4 L 9 7 L 12 5 L 15 7 L 17 4 L 20 8 L 18 16 L 14 19 L 10 19 L 6 16 Z" />
    <circle cx="9" cy="11" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="15" cy="11" r="0.9" fill="currentColor" stroke="none" />
    <path d="M11 14 L 12 16 L 13 14" />
  </Svg>
)

const IconLightning = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 2 L 5 13 L 11 13 L 9 22 L 18 11 L 12 11 Z" fill="currentColor" stroke="none" />
  </Svg>
)

const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2 L 4 5 L 4 13 Q 4 19 12 22 Q 20 19 20 13 L 20 5 Z" />
    <path d="M9 12 L 11 14 L 15 9" />
  </Svg>
)

// ── Registry ────────────────────────────────────────────────────

type IconComponent = (p: IconProps) => React.ReactElement

const ICONS: Record<string, IconComponent> = {
  // Catálogo de badges actual
  nuevo_fichaje:                IconSignature,
  rookie_crack:                 IconStar,
  taker_inicial:                IconTarget,
  primera_prediccion:           IconEye,
  primera_prediccion_correcta:  IconCheck,
  first_bet:                    IconDice,
  first_win:                    IconCoins,
  pleno_jornada:                IconTarget,
  oraculo:                      IconEye,
  high_roller:                  IconDiamond,
  underdog:                     IconWolf,
  racha_3:                      IconFlame,
  racha_5:                      IconFlameBig,
  racha_dias_3:                 IconFlame,
  racha_dias_7:                 IconFlameBig,
  racha_dias_30:                IconBurst,
  top_3_weekly:                 IconMedal,
  champion_weekly:              IconCrown,
  profeta_mundial_2026:         IconEyeStars,
  mundialista_2026:             IconGlobe,
  top3_mundial_2026:            IconTrophy,
  // Genéricos para stickers de placa
  trophy:                       IconTrophy,
  crown:                        IconCrown,
  shield:                       IconShield,
  lightning:                    IconLightning,
  diamond:                      IconDiamond,
  flame:                        IconFlame,
  star:                         IconStar,
  globe:                        IconGlobe,
  eye:                          IconEye,
  target:                       IconTarget,
}

// Fallback icon — círculo con interrogación implícita
const IconFallback = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <line x1="8" y1="8" x2="16" y2="16" />
    <line x1="16" y1="8" x2="8" y2="16" />
  </Svg>
)

// ── Componente público ───────────────────────────────────────────

interface BadgeIconProps {
  /** ID del badge (matchea con BADGES[id]) o nombre del icono genérico. */
  id: string
  size?: number
  strokeWidth?: number
  color?: string
  className?: string
  style?: React.CSSProperties
}

export function BadgeIcon({ id, size = 24, strokeWidth, color, className, style }: BadgeIconProps) {
  const Comp = ICONS[id] ?? IconFallback
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color ?? 'currentColor',
        lineHeight: 0,
        ...style,
      }}
    >
      <Comp size={size} strokeWidth={strokeWidth} />
    </span>
  )
}

export function hasBadgeIcon(id: string): boolean {
  return id in ICONS
}
