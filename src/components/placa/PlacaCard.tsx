'use client'

// ─────────────────────────────────────────────────────────────────
// PlacaCard — la placa personal del usuario.
//
// Es un objeto identitario tipo "card de jugador 2K": una tarjeta
// vertical que reúne TODOS los cosméticos equipados del user en
// una sola pieza visual. Es lo que otros ven en perfil público y
// (más adelante) en versiones compactas en el ranking.
//
// Layout (top → bottom):
//   1. Tier band — tier_metal + level
//   2. Corner sticker (top-right, opcional)
//   3. Avatar zone — avatar + avatar_frame + tier glow
//   4. Identity zone — display_name (name_effect) + title
//   5. Primary badge row — 1 badge grande + hasta 2 secundarios
//   6. Signature stat — un stat firmado
//   7. Footer — handle + watermark Taka
//
// El componente acepta `size` para dos tamaños canónicos:
//   · 'full' (~280×420)  → perfil propio, vista pública del jugador
//   · 'compact' (~180×260) → ranking (mockup, no se usa todavía)
//
// 100% CSS, sin assets pesados — los gradientes y patrones son
// procedurales para que se pueda generar la placa al vuelo y
// exportarla como imagen vía /api/og en el futuro.
// ─────────────────────────────────────────────────────────────────

import { TIER_CONFIG, type PlacaData } from './types'

interface Props {
  placa: PlacaData
  size?: 'full' | 'compact'
}

// Patrones procedurales (background overlay)
function patternBackground(kind: PlacaData['backgroundPattern']): string | undefined {
  if (!kind || kind === 'none') return undefined
  switch (kind) {
    case 'dots':
      return `radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`
    case 'lines':
      return `repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 10px)`
    case 'stripes':
      return `repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 14px)`
  }
}

export function PlacaCard({ placa, size = 'full' }: Props) {
  const tier   = TIER_CONFIG[placa.tier]
  const isFull = size === 'full'

  // Dimensiones canónicas (aspect ratio 2:3, como una card de jugador)
  const width  = isFull ? 280 : 180
  const height = isFull ? 420 : 260

  // Escalado uniforme para que la compact se vea igual de proporcionada
  const scale  = isFull ? 1 : 0.62

  const frameColor   = placa.frame?.color ?? tier.primary
  const bgGradient   = placa.cardBg?.gradient
    ?? `linear-gradient(165deg, #0F0820 0%, #1A0F2E 50%, #0A0612 100%)`
  const patternBg    = patternBackground(placa.backgroundPattern)
  const avatarRing   = placa.avatarFrame?.color ?? tier.primary
  const initials     = (placa.fallbackInitials
    ?? placa.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)
    ?? '?').toUpperCase()

  // name_effect — un gradiente o glow sobre el display_name
  const nameStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontWeight: 900,
    letterSpacing: '-0.02em',
    lineHeight: 1.05,
    fontSize: 22 * scale,
    color: '#F0F0F8',
  }
  if (placa.nameEffect?.gradient) {
    nameStyle.background = placa.nameEffect.gradient
    nameStyle.WebkitBackgroundClip = 'text'
    nameStyle.WebkitTextFillColor  = 'transparent'
    nameStyle.backgroundClip = 'text'
  }
  if (placa.nameEffect?.glow) {
    nameStyle.textShadow = `0 0 10px ${placa.nameEffect.glow}`
  }

  return (
    <div
      className="placa-card relative select-none"
      style={{
        width,
        height,
        borderRadius: 18 * scale,
        // Capa 1 (deepest): cardBg + pattern overlay
        background: patternBg
          ? `${patternBg}, ${bgGradient}`
          : bgGradient,
        backgroundSize: placa.backgroundPattern === 'dots' ? '14px 14px' : undefined,
        // Capa 2: borde metálico tier + frame del user
        border: `2px solid transparent`,
        backgroundOrigin: 'border-box',
        // Capa 3: glow exterior del tier
        boxShadow: `
          0 0 0 1px ${frameColor}50 inset,
          0 0 28px ${tier.glow},
          0 18px 50px rgba(0,0,0,0.55)
        `,
        overflow: 'hidden',
        fontFamily: 'var(--font-sport)',
        color: '#E8E8F0',
      }}
    >
      {/* Marco interior con gradient tier (anillo metálico simulado) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, borderRadius: 18 * scale,
          padding: 2,
          background: tier.ringStyle,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          pointerEvents: 'none',
          opacity: 0.6,
        }}
      />

      {/* ── 1. TIER BAND ──────────────────────────────────────── */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: `${10 * scale}px ${14 * scale}px`,
          background: `linear-gradient(180deg, ${tier.primary}22 0%, transparent 100%)`,
          borderBottom: `1px solid ${frameColor}25`,
        }}
      >
        <span
          style={{
            fontSize: 9 * scale, fontWeight: 900,
            letterSpacing: '0.18em',
            color: tier.primary,
            textShadow: `0 0 8px ${tier.glow}`,
          }}
        >
          {tier.label}
        </span>
        <div
          className="flex items-center"
          style={{ gap: 4 * scale }}
        >
          <span style={{ fontSize: 8 * scale, color: '#8080A0', fontWeight: 800, letterSpacing: '0.1em' }}>LVL</span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16 * scale, fontWeight: 900,
              color: tier.primary,
              lineHeight: 1,
            }}
          >
            {placa.level}
          </span>
          <span
            style={{
              fontSize: 9 * scale, fontWeight: 800,
              color: '#A0A0B8', marginLeft: 4 * scale, letterSpacing: '0.04em',
            }}
          >
            · {placa.levelName}
          </span>
        </div>
      </div>

      {/* ── 2. CORNER STICKER (top-right) ─────────────────────── */}
      {placa.cornerSticker && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 38 * scale,
            right: 12 * scale,
            width: 28 * scale, height: 28 * scale,
            borderRadius: '50%',
            background: `${placa.cornerSticker.color}22`,
            border: `1px solid ${placa.cornerSticker.color}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14 * scale,
            transform: 'rotate(8deg)',
            boxShadow: `0 4px 12px ${placa.cornerSticker.color}45`,
            zIndex: 3,
          }}
        >
          {placa.cornerSticker.emoji}
        </div>
      )}

      {/* ── 3. AVATAR ZONE ────────────────────────────────────── */}
      <div
        className="flex flex-col items-center"
        style={{ paddingTop: 18 * scale, paddingBottom: 6 * scale }}
      >
        {/* Tier glow halo */}
        <div
          style={{
            position: 'relative',
            width: 96 * scale, height: 96 * scale,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: -8 * scale,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${tier.glow} 0%, transparent 70%)`,
              filter: 'blur(8px)',
            }}
          />
          {/* Avatar frame ring */}
          <div
            style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              background: placa.avatarFrame?.style === 'gradient'
                ? `conic-gradient(${avatarRing} 0deg, ${tier.primary} 180deg, ${avatarRing} 360deg)`
                : avatarRing,
              padding: 3 * scale,
            }}
          >
            <div
              style={{
                width: '100%', height: '100%',
                borderRadius: '50%',
                background: '#0A0612',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {placa.avatarUrl
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={placa.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 32 * scale, fontWeight: 900,
                    color: tier.primary,
                  }}>
                    {initials}
                  </span>
                )
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. IDENTITY ZONE ──────────────────────────────────── */}
      <div
        className="flex flex-col items-center text-center"
        style={{ padding: `0 ${14 * scale}px`, marginTop: 4 * scale }}
      >
        <span style={nameStyle} className="truncate" >
          {placa.displayName}
        </span>
        {placa.title && (
          <p
            style={{
              fontFamily: 'var(--font-sport)',
              fontSize: 10 * scale, fontWeight: 900,
              letterSpacing: '0.04em',
              color: placa.title.color,
              opacity: 0.95,
              marginTop: 2 * scale,
              textTransform: 'uppercase',
              textShadow: `0 0 8px ${placa.title.color}55`,
            }}
          >
            {placa.title.text}
          </p>
        )}
      </div>

      {/* ── 5. PRIMARY BADGE ROW ──────────────────────────────── */}
      {(placa.badge || (placa.secondaryBadges && placa.secondaryBadges.length > 0)) && (
        <div
          className="flex items-center justify-center"
          style={{
            marginTop: 12 * scale,
            gap: 6 * scale,
          }}
        >
          {placa.badge && (
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 38 * scale, height: 38 * scale,
                borderRadius: 10 * scale,
                background: placa.badge.bg,
                border: `1.5px solid ${placa.badge.color}`,
                fontSize: 20 * scale,
                boxShadow: `0 0 18px ${placa.badge.color}40, inset 0 0 12px ${placa.badge.color}25`,
              }}
              title={placa.badge.name}
            >
              {placa.badge.emoji}
            </div>
          )}
          {(placa.secondaryBadges ?? []).slice(0, 2).map((b, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 26 * scale, height: 26 * scale,
                borderRadius: 7 * scale,
                background: b.bg,
                border: `1px solid ${b.color}80`,
                fontSize: 12 * scale,
              }}
            >
              {b.emoji}
            </div>
          ))}
        </div>
      )}

      {/* ── 6. SIGNATURE STAT ─────────────────────────────────── */}
      {placa.signatureStat && (
        <div
          className="flex flex-col items-center text-center"
          style={{
            position: 'absolute',
            bottom: 38 * scale,
            left: 14 * scale,
            right: 14 * scale,
            padding: `${8 * scale}px ${10 * scale}px`,
            background: 'rgba(0,0,0,0.30)',
            border: `1px solid ${tier.primary}30`,
            borderRadius: 10 * scale,
            backdropFilter: 'blur(6px)',
          }}
        >
          <span style={{
            fontSize: 8 * scale, fontWeight: 800,
            letterSpacing: '0.16em',
            color: '#7A7A92', textTransform: 'uppercase',
          }}>
            {placa.signatureStat.label}
          </span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16 * scale, fontWeight: 900,
            color: tier.primary,
            marginTop: 1 * scale,
            textShadow: `0 0 8px ${tier.glow}`,
          }}>
            {placa.signatureStat.emoji && <span style={{ marginRight: 4 * scale }}>{placa.signatureStat.emoji}</span>}
            {placa.signatureStat.value}
          </span>
        </div>
      )}

      {/* ── 7. FOOTER ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between"
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          padding: `${8 * scale}px ${14 * scale}px`,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.45) 0%, transparent 100%)',
          borderTop: `1px solid ${frameColor}20`,
        }}
      >
        <span style={{
          fontFamily: 'var(--font-sport)',
          fontSize: 9 * scale, fontWeight: 700,
          color: '#7A7A92',
        }}>
          @{placa.handle}
        </span>
        <span style={{
          fontSize: 8 * scale, fontWeight: 900,
          letterSpacing: '0.22em',
          color: tier.primary,
          opacity: 0.5,
        }}>
          TAKA
        </span>
      </div>
    </div>
  )
}
