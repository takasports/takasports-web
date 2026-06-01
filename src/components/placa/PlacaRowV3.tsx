'use client'

// ─────────────────────────────────────────────────────────────────
// PlacaRowV3 — versión horizontal compacta de la placa.
//
// Pensada para sustituir las filas actuales del ranking: 460×88, con
// el mismo lenguaje visual de V3 (cortes asimétricos, foil, hexagonal
// avatar, LVL diamante) pero adaptado a un row layout.
//
// Estructura (izq → der):
//   [#rank chevron] [hex avatar] [name + title] [badges] [LVL] [score]
//
// Tilt y paralax DESACTIVADOS — son filas de un listado, no queremos
// jitter en scroll ni 50 rotaciones simultáneas. Foil estático con
// gradient diagonal (no cursor-paralax) para que cada fila se sienta
// premium sin ser distractora.
// ─────────────────────────────────────────────────────────────────

import { TIER_CONFIG, type PlacaData } from './types'
import { BadgeIcon, hasBadgeIcon } from '@/components/icons/badges/BadgeIcon'

interface Props {
  placa: PlacaData
  rank: number
  /** Puntos/score que muestra al final de la fila. */
  score: number
  /** Etiqueta corta del score ("pts", "aciertos", etc.). */
  scoreLabel?: string
  sportAccent?: string
}

const HOLO_GRADIENT_FLAT = `linear-gradient(120deg,
  #ff79c688 0%, #ffb86c66 20%, #f1fa8c66 40%,
  #50fa7b66 60%, #8be9fd66 80%, #bd93f988 100%
)`

export function PlacaRowV3({ placa, rank, score, scoreLabel = 'pts', sportAccent }: Props) {
  const tier = TIER_CONFIG[placa.tier]
  const accent = sportAccent ?? tier.primary

  const foilOpacity: Record<typeof placa.tier, number> = {
    bronze: 0.03, silver: 0.06, gold: 0.13, diamond: 0.22,
  }
  const foilStrength = foilOpacity[placa.tier]

  // Default obsidiana con luz desde arriba — elevada sobre la página
  const cardBg = placa.cardBg?.gradient
    ?? `linear-gradient(135deg, #1C1C26 0%, #14141C 50%, #0A0A12 100%)`
  const frameColor = placa.frame?.color ?? tier.primary
  const titleText = placa.title?.text
  const titleColor = placa.title?.color ?? tier.primary

  const initials = (placa.fallbackInitials
    ?? placa.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)
    ?? '?').toUpperCase()

  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

  // Silueta horizontal con cortes asimétricos
  const CLIP_PATH = `polygon(
    0 0,
    calc(100% - 18px) 0,
    100% 18px,
    100% 100%,
    18px 100%,
    0 calc(100% - 18px)
  )`

  // Surname destacado, primer nombre arriba pequeño
  const parts = placa.displayName.trim().split(/\s+/)
  const firstName = parts.length > 1 ? parts[0] : ''
  const surname = parts.length > 1 ? parts.slice(1).join(' ') : parts[0]

  const surnameStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontWeight: 900,
    fontSize: 22,
    letterSpacing: '-0.025em',
    lineHeight: 1,
    textTransform: 'uppercase',
    color: '#F0F0F8',
    margin: 0,
  }
  if (placa.nameEffect?.gradient) {
    surnameStyle.backgroundImage = placa.nameEffect.gradient
    surnameStyle.WebkitBackgroundClip = 'text'
    surnameStyle.WebkitTextFillColor = 'transparent'
    surnameStyle.backgroundClip = 'text'
  }

  return (
    <div
      className="placa-row-v3 relative"
      style={{
        width: '100%',
        maxWidth: 600,
        height: 88,
        background: cardBg,
        clipPath: CLIP_PATH,
        filter: `drop-shadow(0 8px 20px rgba(0,0,0,0.7)) drop-shadow(0 0 14px ${tier.glow})`,
        position: 'relative',
        color: '#E8E8F0',
        fontFamily: 'var(--font-sport)',
      }}
    >
      {/* Borde foil */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: tier.ringStyle, opacity: 0.5,
          clipPath: CLIP_PATH,
        }}
      />
      <div
        style={{
          position: 'absolute', inset: 1.5,
          background: cardBg,
          clipPath: `polygon(
            0 0,
            calc(100% - 17px) 0,
            100% 17px,
            100% 100%,
            17px 100%,
            0 calc(100% - 17px)
          )`,
        }}
      />

      {/* Sport stripe vertical izquierda */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: 8, bottom: 8, left: 0,
          width: 3,
          background: `linear-gradient(180deg, ${accent} 0%, ${accent}55 50%, ${accent} 100%)`,
          boxShadow: `0 0 10px ${accent}`,
          zIndex: 2,
        }}
      />

      {/* Luz interior desde arriba — depth */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '55%',
          background: `linear-gradient(180deg, rgba(255,255,255,0.045) 0%, transparent 100%)`,
          pointerEvents: 'none',
          zIndex: 2,
          clipPath: CLIP_PATH,
        }}
      />

      {/* Holo foil estático diagonal — overlay blend (refinado) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: HOLO_GRADIENT_FLAT,
          opacity: foilStrength,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
          zIndex: 3,
          clipPath: CLIP_PATH,
        }}
      />

      {/* CONTENIDO */}
      <div
        style={{
          position: 'relative', zIndex: 4,
          display: 'flex', alignItems: 'center',
          height: '100%',
          padding: '0 18px 0 14px',
          gap: 14,
        }}
      >
        {/* RANK */}
        <div style={{
          minWidth: 30, textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 900, fontSize: medal ? 22 : 18,
          color: rank <= 3 ? tier.primary : '#6A6A88',
          textShadow: rank <= 3 ? `0 0 10px ${tier.glow}` : undefined,
        }}>
          {medal ?? `#${rank}`}
        </div>

        {/* AVATAR hex */}
        <div style={{ position: 'relative', width: 56, height: 64, flexShrink: 0 }}>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: -6,
              background: `radial-gradient(circle, ${tier.glow} 0%, transparent 60%)`,
              filter: 'blur(5px)',
            }}
          />
          <div
            style={{
              position: 'absolute', inset: 0,
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              background: placa.avatarFrame?.style === 'gradient'
                ? `conic-gradient(from 30deg, ${placa.avatarFrame?.color ?? tier.primary}, ${tier.primary}, ${placa.avatarFrame?.color ?? tier.primary})`
                : (placa.avatarFrame?.color ?? tier.primary),
            }}
          >
            <div
              style={{
                position: 'absolute', inset: 2,
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                background: '#0A0612',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {placa.avatarUrl
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={placa.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 18, fontWeight: 900,
                    color: tier.primary,
                  }}>
                    {initials}
                  </span>
                )
              }
            </div>
          </div>
        </div>

        {/* IDENTITY */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {firstName && (
            <p style={{
              fontFamily: 'var(--font-headline)',
              fontSize: 9, letterSpacing: '0.24em',
              color: '#7A7A92', margin: 0, fontWeight: 400,
              textTransform: 'uppercase', lineHeight: 1,
            }}>
              {firstName}
            </p>
          )}
          <h3 style={surnameStyle} className="truncate">
            {surname}
          </h3>
          {titleText && (
            <p style={{
              fontFamily: 'var(--font-headline)',
              fontSize: 9, letterSpacing: '0.18em',
              color: titleColor, margin: '2px 0 0', fontWeight: 400,
              textTransform: 'uppercase',
              textShadow: `0 0 8px ${titleColor}80`,
              opacity: 0.9,
            }} className="truncate">
              {titleText}
            </p>
          )}
        </div>

        {/* BADGES MINI */}
        {placa.badge && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <div
              title={placa.badge.name}
              style={{
                width: 26, height: 26,
                background: placa.badge.bg,
                border: `1px solid ${placa.badge.color}`,
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 8px ${placa.badge.color}55`,
                color: placa.badge.color,
              }}
            >
              {hasBadgeIcon(placa.badge.iconId ?? placa.badge.id) ? (
                <BadgeIcon id={placa.badge.iconId ?? placa.badge.id} size={13} strokeWidth={1.7} />
              ) : (
                <span style={{ fontSize: 11 }}>{placa.badge.emoji}</span>
              )}
            </div>
            {(placa.secondaryBadges ?? []).slice(0, 1).map((b, i) => (
              <div
                key={i}
                title={b.name}
                style={{
                  width: 22, height: 22,
                  background: b.bg,
                  border: `1px solid ${b.color}99`,
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: b.color,
                }}
              >
                {hasBadgeIcon(b.iconId ?? b.id) ? (
                  <BadgeIcon id={b.iconId ?? b.id} size={11} strokeWidth={1.6} />
                ) : (
                  <span style={{ fontSize: 9 }}>{b.emoji}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* LVL diamante mini */}
        <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
          <div
            style={{
              position: 'absolute', inset: 0,
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              background: tier.ringStyle,
            }}
          >
            <div
              style={{
                position: 'absolute', inset: 2,
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                background: `radial-gradient(circle, ${tier.primary}25 0%, #0A0612 75%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 18,
                  lineHeight: 1,
                  backgroundImage: `linear-gradient(135deg, ${tier.primary} 0%, #fff 50%, ${tier.primary} 100%)`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: `drop-shadow(0 0 4px ${tier.glow})`,
                }}
              >
                {placa.level}
              </span>
            </div>
          </div>
        </div>

        {/* SCORE */}
        <div style={{
          minWidth: 60, textAlign: 'right',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900, fontSize: 22,
            color: tier.primary,
            textShadow: `0 0 10px ${tier.glow}`,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {score.toLocaleString('es-ES')}
          </span>
          <span style={{
            fontFamily: 'var(--font-headline)',
            fontSize: 9, fontWeight: 400,
            letterSpacing: '0.22em',
            color: '#6A6A88',
            textTransform: 'uppercase',
            marginTop: 2,
          }}>
            {scoreLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
