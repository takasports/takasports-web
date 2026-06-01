'use client'

// ─────────────────────────────────────────────────────────────────
// CosmeticPreview — mini visual de un cosmético en el vestidor.
// Cada tipo se previsualiza de forma distinta para que el usuario
// entienda QUÉ está mirando antes de equiparlo.
// ─────────────────────────────────────────────────────────────────

import { BadgeIcon, hasBadgeIcon } from '@/components/icons/badges/BadgeIcon'

export interface CosmeticForPreview {
  id:    string
  type:  string
  name:  string
  data:  Record<string, unknown>
}

interface Props {
  cosmetic: CosmeticForPreview
  /** Si está locked se renderiza desaturado. */
  locked?: boolean
  size?:   number   // tamaño del swatch (default 56)
}

export function CosmeticPreview({ cosmetic, locked = false, size = 56 }: Props) {
  const d = cosmetic.data as Record<string, string | undefined>
  const opacity = locked ? 0.35 : 1
  const filter  = locked ? 'grayscale(0.8)' : 'none'

  const wrap = (children: React.ReactNode) => (
    <div
      style={{
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 10,
        opacity, filter,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  )

  switch (cosmetic.type) {
    case 'title': {
      const color = d.color ?? '#7C3AED'
      return wrap(
        <div style={{
          padding: '4px 8px', borderRadius: 4,
          background: `${color}18`,
          border: `1px solid ${color}55`,
          fontFamily: 'var(--font-headline)',
          fontSize: 9, letterSpacing: '0.16em',
          color, textTransform: 'uppercase',
          textAlign: 'center', maxWidth: size - 4,
        }}>
          {d.text ?? cosmetic.name}
        </div>
      )
    }

    case 'frame': {
      const color = d.color ?? '#7C3AED'
      return wrap(
        <div style={{
          width: size - 12, height: size - 12,
          borderRadius: 6,
          border: `3px solid ${color}`,
          boxShadow: `0 0 14px ${color}50`,
          background: 'rgba(255,255,255,0.02)',
        }} />
      )
    }

    case 'card_bg': {
      return wrap(
        <div style={{
          width: size - 8, height: size - 8,
          borderRadius: 6,
          background: d.gradient ?? '#0A0612',
          border: '1px solid rgba(255,255,255,0.08)',
        }} />
      )
    }

    case 'avatar_frame': {
      const color = d.color ?? '#7C3AED'
      const isGradient = d.style === 'gradient'
      return wrap(
        <div style={{
          width: size - 14, height: size - 14, borderRadius: '50%',
          background: isGradient
            ? `conic-gradient(from 0deg, ${color}, #7C3AED, ${color})`
            : color,
          padding: 3,
        }}>
          <div style={{
            width: '100%', height: '100%',
            borderRadius: '50%',
            background: '#0A0612',
          }} />
        </div>
      )
    }

    case 'name_effect': {
      return wrap(
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 900,
          fontSize: 22, letterSpacing: '-0.02em',
          backgroundImage: d.gradient ?? 'linear-gradient(135deg, #fff, #ccc)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: d.glow ? `drop-shadow(0 0 8px ${d.glow})` : undefined,
        }}>
          Aa
        </span>
      )
    }

    case 'corner_sticker': {
      const color = d.color ?? '#fbbf24'
      const iconId = d.icon_id ?? 'star'
      return wrap(
        <div style={{
          width: size - 16, height: size - 16,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}, ${color}33 70%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, transform: 'rotate(8deg)',
        }}>
          {hasBadgeIcon(iconId)
            ? <BadgeIcon id={iconId} size={size - 22} strokeWidth={1.8} />
            : <span style={{ fontSize: size - 22 }}>★</span>}
        </div>
      )
    }

    case 'signature_stat': {
      return wrap(
        <div style={{
          padding: '6px 8px',
          borderRadius: 4,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.10)',
          textAlign: 'center',
        }}>
          <p style={{
            fontFamily: 'var(--font-headline)',
            fontSize: 7, color: '#7A7A92',
            letterSpacing: '0.2em', margin: 0,
            textTransform: 'uppercase',
          }}>
            {d.label ?? 'STAT'}
          </p>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 14, fontWeight: 900,
            color: '#F0F0F8', margin: '2px 0 0',
            letterSpacing: '-0.02em',
          }}>
            42
          </p>
        </div>
      )
    }

    case 'background_pattern': {
      const pattern = d.pattern ?? 'dots'
      const patternBg =
        pattern === 'dots'   ? 'radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1.5px)' :
        pattern === 'lines'  ? 'repeating-linear-gradient(135deg, rgba(255,255,255,0.10) 0 1px, transparent 1px 6px)' :
                               'repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 10px)'
      return wrap(
        <div style={{
          width: size - 8, height: size - 8,
          borderRadius: 6,
          backgroundImage: patternBg,
          backgroundSize: pattern === 'dots' ? '8px 8px' : 'auto',
          background: 'linear-gradient(135deg, #1a1a24, #0a0a12)',
          border: '1px solid rgba(255,255,255,0.08)',
        }} />
      )
    }

    case 'badge_chip':
    default: {
      const color = d.color ?? '#7C3AED'
      const bg = d.bg ?? `${color}22`
      const iconId = d.icon_id ?? cosmetic.id
      return wrap(
        <div style={{
          width: size - 16, height: size - 16,
          borderRadius: 6,
          background: bg,
          border: `1px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>
          {hasBadgeIcon(iconId)
            ? <BadgeIcon id={iconId} size={size - 28} strokeWidth={1.8} />
            : <span style={{ fontSize: size - 30 }}>★</span>}
        </div>
      )
    }
  }
}
