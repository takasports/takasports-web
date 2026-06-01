'use client'

// ─────────────────────────────────────────────────────────────────
// PlacaCardV2 — diseño editorial-holográfico.
//
// Inspiración doble:
//   · Editorial deportivo brutalista (portada Marca, cromos clásicos)
//     → tipografía gigante condensada, asimetría, stripe deportiva,
//       stats al pie como línea de cromo.
//   · Foil holográfico TCG (Pokemon/Topps premium)
//     → conic-gradient iridescente con paralax al cursor sobre tier
//       y LVL number, tilt 3D ligero en hover.
//
// Filosofía: la personalización NO es ornamental. Los cosméticos
// cambian REALMENTE cómo se siente la card (treatment del nombre,
// intensidad del foil, color del stripe, posición de elementos).
//
// Layout (asimétrico):
//   ┃ [sport stripe vertical, lado izquierdo, full-height]
//   ┃ ─────────────────────────────────────────────
//   ┃   [title-tag arriba-izquierda]    [badge tr]
//   ┃        ┌───────┐
//   ┃        │ AVATAR│ ← desplazado a izquierda
//   ┃        └───────┘
//   ┃   NOMBRE                     ← gigante, condensado
//   ┃   GIGANTE
//   ┃   ─── (foil divider)
//   ┃   LVL · ACIERTOS · POSICIÓN  ← stat line
//   ┃   42    47          #2
//   ┃   @handle                  TAKA
//
// ─────────────────────────────────────────────────────────────────

import { useRef, useCallback } from 'react'
import { TIER_CONFIG, type PlacaData } from './types'

interface Props {
  placa: PlacaData
  /** Color de stripe izquierda — corresponde al deporte favorito del user.
   *  Por defecto usa el accent del tier. */
  sportAccent?: string
  /** Habilita tilt 3D + foil paralax al pasar el cursor. */
  interactive?: boolean
}

// Conic-gradient holográfico — el corazón del efecto foil.
const HOLO_GRADIENT = `conic-gradient(
  from 90deg at var(--mx, 50%) var(--my, 50%),
  #ff79c6 0deg,
  #ffb86c 50deg,
  #f1fa8c 100deg,
  #50fa7b 150deg,
  #8be9fd 200deg,
  #bd93f9 250deg,
  #ff79c6 300deg,
  #ff5555 360deg
)`

// SVG noise — añadido como data URI para sensación de textura papel
const NOISE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3"/>
      <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#n)"/>
  </svg>
`)}`

// SVG líneas de cancha sutiles — overlay vectorial
function fieldLines(color: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="420" viewBox="0 0 320 420" fill="none">
      <g stroke="${color}" stroke-width="0.6" opacity="0.10">
        <circle cx="160" cy="-40" r="120"/>
        <circle cx="160" cy="460" r="120"/>
        <line x1="0" y1="210" x2="320" y2="210"/>
      </g>
    </svg>
  `)}`
}

export function PlacaCardV2({ placa, sportAccent, interactive = true }: Props) {
  const tier = TIER_CONFIG[placa.tier]
  const accent = sportAccent ?? tier.primary
  const ref = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  // Intensidad del foil por tier — bronze casi mate, diamond máximo.
  const foilOpacity: Record<typeof placa.tier, number> = {
    bronze:  0.12,
    silver:  0.22,
    gold:    0.35,
    diamond: 0.55,
  }
  const foilStrength = foilOpacity[placa.tier]

  // Tilt + foil parallax (solo si interactive)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      el.style.setProperty('--mx', `${x * 100}%`)
      el.style.setProperty('--my', `${y * 100}%`)
      el.style.setProperty('--ry', `${(x - 0.5) * 8}deg`)
      el.style.setProperty('--rx', `${(0.5 - y) * 8}deg`)
    })
  }, [interactive])

  const handleMouseLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--mx', '50%')
    el.style.setProperty('--my', '50%')
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--rx', '0deg')
  }, [])

  // Dimensiones — ratio 3:4 más editorial
  const width  = 320
  const height = 440

  // ── Cosmetic resolution ───────────────────────────────────────
  const cardBg = placa.cardBg?.gradient
    ?? `linear-gradient(160deg, #0F0820 0%, #1A0F2E 55%, #06060E 100%)`
  const frameColor = placa.frame?.color ?? tier.primary
  const titleText  = placa.title?.text
  const titleColor = placa.title?.color ?? tier.primary

  const initials = (placa.fallbackInitials
    ?? placa.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)
    ?? '?').toUpperCase()

  // Nombre — separar en líneas si tiene espacios (efecto editorial)
  const nameParts = placa.displayName.trim().split(/\s+/)
  const nameLine1 = nameParts[0] ?? ''
  const nameLine2 = nameParts.slice(1).join(' ')
  const hasTwoLines = nameLine2.length > 0

  // Tratamiento del nombre por nameEffect
  const nameStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontWeight: 900,
    letterSpacing: '-0.03em',
    lineHeight: 0.88,
    textTransform: 'uppercase',
    color: '#F0F0F8',
    margin: 0,
  }
  if (placa.nameEffect?.gradient) {
    nameStyle.backgroundImage = placa.nameEffect.gradient
    nameStyle.WebkitBackgroundClip = 'text'
    nameStyle.WebkitTextFillColor = 'transparent'
    nameStyle.backgroundClip = 'text'
  }

  return (
    <div
      ref={ref}
      className="placa-v2 relative select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        width, height,
        borderRadius: 14,
        background: cardBg,
        border: `1px solid ${frameColor}38`,
        boxShadow: `
          0 0 0 1px rgba(255,255,255,0.04) inset,
          0 24px 60px rgba(0,0,0,0.55),
          0 0 28px ${tier.glow}
        `,
        overflow: 'hidden',
        perspective: 1000,
        transformStyle: 'preserve-3d',
        // tilt
        transform: `perspective(1000px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))`,
        transition: 'transform 0.12s ease-out',
        color: '#E8E8F0',
        fontFamily: 'var(--font-sport)',
      } as React.CSSProperties}
    >
      {/* ── L0. CAPA SPORT-THEMED BG (field lines + tint) ──────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("${fieldLines(accent)}")`,
          backgroundSize: 'cover',
          opacity: 0.7,
          pointerEvents: 'none',
        }}
      />
      {/* ── L1. NOISE PAPER TEXTURE ────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("${NOISE_SVG}")`,
          opacity: 0.5,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />
      {/* ── L2. VIGNETTE radial darker corners ─────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── L3. SPORT STRIPE vertical izquierda ────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: 0, bottom: 0, left: 0,
          width: 5,
          background: `linear-gradient(180deg, ${accent} 0%, ${accent}88 50%, ${accent} 100%)`,
          boxShadow: `0 0 12px ${accent}80`,
        }}
      />

      {/* ── L4. CONTENIDO ─────────────────────────────────────── */}
      <div
        style={{
          position: 'relative', zIndex: 2,
          padding: '20px 22px 18px 26px',
          height: '100%',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* TOP ROW: title-tag (izq) + badge primario (der) */}
        <div className="flex items-start justify-between" style={{ gap: 8 }}>
          {titleText ? (
            <span
              style={{
                fontFamily: 'var(--font-headline)',
                fontSize: 11,
                letterSpacing: '0.18em',
                color: titleColor,
                background: `${titleColor}10`,
                border: `1px solid ${titleColor}40`,
                padding: '3px 8px',
                borderRadius: 3,
                textTransform: 'uppercase',
                fontWeight: 400,
                lineHeight: 1.2,
                maxWidth: 200,
              }}
            >
              {titleText}
            </span>
          ) : <span style={{ height: 22 }} />}

          {placa.badge && (
            <div
              title={placa.badge.name}
              style={{
                width: 30, height: 30,
                borderRadius: 7,
                background: placa.badge.bg,
                border: `1px solid ${placa.badge.color}80`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15,
                boxShadow: `0 0 14px ${placa.badge.color}45`,
                flexShrink: 0,
              }}
            >
              {placa.badge.emoji}
            </div>
          )}
        </div>

        {/* AVATAR — alineado izquierda */}
        <div style={{ marginTop: 18, marginBottom: 16 }}>
          <div
            style={{
              position: 'relative',
              width: 64, height: 64,
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute', inset: -6,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${tier.glow} 0%, transparent 65%)`,
                filter: 'blur(6px)',
              }}
            />
            <div
              style={{
                position: 'absolute', inset: 0,
                borderRadius: '50%',
                background: placa.avatarFrame?.style === 'gradient'
                  ? `conic-gradient(from 0deg, ${placa.avatarFrame?.color ?? tier.primary}, ${tier.primary}, ${placa.avatarFrame?.color ?? tier.primary})`
                  : (placa.avatarFrame?.color ?? tier.primary),
                padding: 2.5,
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
                      fontSize: 22, fontWeight: 900,
                      color: tier.primary,
                      textShadow: `0 0 8px ${tier.glow}`,
                    }}>
                      {initials}
                    </span>
                  )
                }
              </div>
            </div>
          </div>
        </div>

        {/* NOMBRE — gigante, condensado, asimétrico */}
        <div style={{ flex: 1 }}>
          <h2
            style={{
              ...nameStyle,
              fontSize: hasTwoLines ? 44 : 50,
            }}
          >
            {nameLine1}
          </h2>
          {hasTwoLines && (
            <h2
              style={{
                ...nameStyle,
                fontSize: 44,
                opacity: 0.92,
                marginTop: -3,
              }}
            >
              {nameLine2}
            </h2>
          )}

          {/* Secondary badges en línea bajo el nombre */}
          {placa.secondaryBadges && placa.secondaryBadges.length > 0 && (
            <div style={{ display: 'flex', gap: 5, marginTop: 12 }}>
              {placa.secondaryBadges.slice(0, 3).map((b, i) => (
                <span
                  key={i}
                  title={b.name}
                  style={{
                    width: 18, height: 18,
                    borderRadius: 4,
                    background: b.bg,
                    border: `1px solid ${b.color}90`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, lineHeight: 1,
                  }}
                >
                  {b.emoji}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* DIVIDER FOIL — línea horizontal con shimmer */}
        <div
          aria-hidden="true"
          style={{
            position: 'relative',
            height: 1,
            margin: '12px 0 12px',
            background: `linear-gradient(90deg, transparent 0%, ${frameColor}60 30%, ${tier.primary} 50%, ${frameColor}60 70%, transparent 100%)`,
          }}
        />

        {/* STAT LINE — 3 columnas tipo cromo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          {/* LVL — siempre presente, FOIL TREATMENT */}
          <StatCell
            label="LVL"
            value={String(placa.level)}
            tierName={placa.levelName}
            foil
            tierPrimary={tier.primary}
            tierGlow={tier.glow}
          />
          {/* signature stat slot 1 */}
          {placa.signatureStat ? (
            <StatCell
              label={placa.signatureStat.label}
              value={placa.signatureStat.value}
              tierPrimary={tier.primary}
              tierGlow={tier.glow}
            />
          ) : (
            <StatCell label="XP" value="—" tierPrimary={tier.primary} tierGlow={tier.glow} muted />
          )}
          {/* badges count or filler */}
          <StatCell
            label="LOGROS"
            value={String(1 + (placa.secondaryBadges?.length ?? 0))}
            tierPrimary={tier.primary}
            tierGlow={tier.glow}
          />
        </div>

        {/* FOOTER — handle + TAKA */}
        <div className="flex items-end justify-between" style={{ marginTop: 'auto' }}>
          <span style={{
            fontFamily: 'var(--font-sport)',
            fontSize: 10, fontWeight: 700,
            color: '#6A6A88',
            letterSpacing: '0.02em',
          }}>
            @{placa.handle}
          </span>
          <span style={{
            fontFamily: 'var(--font-headline)',
            fontSize: 11, fontWeight: 400,
            letterSpacing: '0.3em',
            color: accent,
            opacity: 0.55,
          }}>
            TAKA
          </span>
        </div>
      </div>

      {/* ── L5. HOLO FOIL OVERLAY (la salsa secreta) ───────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: HOLO_GRADIENT,
          opacity: foilStrength,
          mixBlendMode: 'color-dodge',
          pointerEvents: 'none',
          filter: 'blur(1px) saturate(1.3)',
          transition: 'opacity 0.18s',
          zIndex: 3,
        }}
      />
      {/* ── L6. FOIL highlight cursor spot (sparkle) ───────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.20) 0%, transparent 25%)',
          mixBlendMode: 'screen',
          pointerEvents: 'none',
          opacity: placa.tier === 'diamond' ? 1 : placa.tier === 'gold' ? 0.75 : placa.tier === 'silver' ? 0.45 : 0.25,
          zIndex: 4,
        }}
      />
      {/* ── L7. CORNER STICKER (top-right, encima de todo) ─────── */}
      {placa.cornerSticker && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -8, right: -8,
            width: 38, height: 38,
            background: `radial-gradient(circle, ${placa.cornerSticker.color} 0%, ${placa.cornerSticker.color}66 70%, transparent 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
            transform: 'rotate(14deg)',
            filter: `drop-shadow(0 4px 10px ${placa.cornerSticker.color}aa)`,
            zIndex: 5,
          }}
        >
          {placa.cornerSticker.emoji}
        </div>
      )}
    </div>
  )
}

// ── StatCell — celda de la línea de stats ──────────────────────
function StatCell({
  label, value, tierName, foil, tierPrimary, tierGlow, muted,
}: {
  label: string
  value: string
  tierName?: string
  foil?: boolean
  tierPrimary: string
  tierGlow: string
  muted?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{
        fontFamily: 'var(--font-headline)',
        fontSize: 9, fontWeight: 400,
        letterSpacing: '0.18em',
        color: '#6A6A88',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 22,
          lineHeight: 1,
          color: muted ? '#4A4A6A' : (foil ? tierPrimary : '#F0F0F8'),
          letterSpacing: '-0.02em',
          textShadow: foil ? `0 0 12px ${tierGlow}, 0 1px 0 rgba(0,0,0,0.5)` : undefined,
          // El "foil" del LVL — gradiente metálico simulado
          backgroundImage: foil
            ? `linear-gradient(135deg, ${tierPrimary} 0%, #fff 45%, ${tierPrimary} 55%, ${tierPrimary} 100%)`
            : undefined,
          WebkitBackgroundClip: foil ? 'text' : undefined,
          WebkitTextFillColor: foil ? 'transparent' : undefined,
          backgroundClip: foil ? 'text' : undefined,
        }}
      >
        {value}
      </span>
      {tierName && (
        <span style={{
          fontSize: 8, fontWeight: 800,
          color: tierPrimary,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: 0.75,
          marginTop: 1,
        }}>
          {tierName}
        </span>
      )}
    </div>
  )
}
