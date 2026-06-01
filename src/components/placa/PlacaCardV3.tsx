'use client'

// ─────────────────────────────────────────────────────────────────
// PlacaCardV3 — vertical, dirección "más 2K".
//
// Iteración tras feedback "más personalizada e integrada + más 2K":
//   · Silueta con cortes asimétricos (no rectángulo plano):
//     · Top-right cortado a 45° (diagonal cut)
//     · Bottom-left cortado a 45°
//     Esto da un perfil de card 2K distintivo sin necesidad de imagen.
//   · Tipografía hero "dorsal de camiseta": apellido GIGANTE como
//     número de jersey, primer nombre más pequeño arriba.
//   · Avatar HEXAGONAL con clip-path, arte vectorial del deporte
//     favorito como fondo (red de portería, aro, octágono…).
//   · Tier stamp metálico arriba con efecto embossed.
//   · LVL en un rombo geométrico, no en una caja rectangular.
//   · Stat panel parallelogram con foil overlay.
//   · Title chevron banner — apunta hacia adelante como en cromos.
//   · Foil holográfico paralax al cursor (mantenido de V2).
//   · Tilt 3D ligero al hover (mantenido de V2).
//
// Filosofía: cada cosmético cambia algo VISUAL importante, no solo
// colores. La placa de un Leyenda no es la de un Rookie con más
// brillo — es estructuralmente más rica.
// ─────────────────────────────────────────────────────────────────

import { useRef, useCallback } from 'react'
import { TIER_CONFIG, type PlacaData } from './types'

interface Props {
  placa: PlacaData
  sportAccent?: string
  /** Tipo de arte de fondo según el deporte favorito del user. */
  sportArt?: 'futbol' | 'basket' | 'f1' | 'ufc' | 'tenis' | 'rugby' | 'none'
  interactive?: boolean
}

// Conic-gradient holográfico
const HOLO_GRADIENT = `conic-gradient(
  from 90deg at var(--mx, 50%) var(--my, 50%),
  #ff79c6 0deg, #ffb86c 50deg, #f1fa8c 100deg,
  #50fa7b 150deg, #8be9fd 200deg, #bd93f9 250deg,
  #ff79c6 300deg, #ff5555 360deg
)`

// Arte vectorial del deporte — fondo detrás del avatar
function sportArtSVG(sport: Props['sportArt'], color: string): string | null {
  const c = color
  switch (sport) {
    case 'futbol':
      return `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
          <g stroke="${c}" stroke-width="1.2" opacity="0.18">
            <rect x="20" y="50" width="160" height="110" rx="2"/>
            <line x1="20" y1="80" x2="180" y2="80"/>
            <line x1="20" y1="110" x2="180" y2="110"/>
            <line x1="20" y1="140" x2="180" y2="140"/>
            <line x1="50" y1="50" x2="50" y2="160"/>
            <line x1="100" y1="50" x2="100" y2="160"/>
            <line x1="150" y1="50" x2="150" y2="160"/>
          </g>
        </svg>
      `)}`
    case 'basket':
      return `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
          <g stroke="${c}" stroke-width="1.2" opacity="0.20" stroke-linecap="round">
            <path d="M 30 200 Q 100 50 170 200"/>
            <path d="M 50 200 Q 100 80 150 200"/>
            <circle cx="100" cy="200" r="40"/>
            <line x1="60" y1="200" x2="140" y2="200"/>
          </g>
        </svg>
      `)}`
    case 'f1':
      return `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
          <g stroke="${c}" stroke-width="1.4" opacity="0.18" stroke-linecap="round">
            <path d="M 0 130 Q 60 60 100 100 T 200 70"/>
            <path d="M 0 150 Q 60 80 100 120 T 200 90"/>
          </g>
          <g fill="${c}" opacity="0.10">
            <rect x="160" y="20" width="8" height="8"/><rect x="176" y="20" width="8" height="8"/>
            <rect x="168" y="28" width="8" height="8"/><rect x="184" y="28" width="8" height="8"/>
            <rect x="160" y="36" width="8" height="8"/><rect x="176" y="36" width="8" height="8"/>
          </g>
        </svg>
      `)}`
    case 'ufc':
      return `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
          <g stroke="${c}" stroke-width="1.4" opacity="0.20">
            <polygon points="100,30 160,65 160,135 100,170 40,135 40,65"/>
            <polygon points="100,55 138,75 138,125 100,145 62,125 62,75"/>
          </g>
        </svg>
      `)}`
    case 'tenis':
      return `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
          <g stroke="${c}" stroke-width="1.2" opacity="0.18">
            <rect x="30" y="40" width="140" height="130"/>
            <line x1="30" y1="105" x2="170" y2="105"/>
            <line x1="100" y1="60" x2="100" y2="150"/>
            <rect x="50" y="60" width="100" height="45"/>
            <rect x="50" y="105" width="100" height="45"/>
          </g>
        </svg>
      `)}`
    case 'rugby':
      return `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
          <g stroke="${c}" stroke-width="1.4" opacity="0.18">
            <ellipse cx="100" cy="100" rx="65" ry="35" transform="rotate(-25 100 100)"/>
            <line x1="55" y1="125" x2="145" y2="75" />
            <line x1="65" y1="135" x2="135" y2="65" />
          </g>
        </svg>
      `)}`
    default:
      return null
  }
}

// Noise texture
const NOISE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3"/>
    <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0"/></filter>
    <rect width="100%" height="100%" filter="url(#n)"/>
  </svg>
`)}`

export function PlacaCardV3({ placa, sportAccent, sportArt = 'futbol', interactive = true }: Props) {
  const tier = TIER_CONFIG[placa.tier]
  const accent = sportAccent ?? tier.primary
  const ref = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  const foilOpacity: Record<typeof placa.tier, number> = {
    bronze:  0.10, silver:  0.20, gold:    0.34, diamond: 0.55,
  }
  const foilStrength = foilOpacity[placa.tier]

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
      el.style.setProperty('--ry', `${(x - 0.5) * 10}deg`)
      el.style.setProperty('--rx', `${(0.5 - y) * 10}deg`)
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

  // Dimensiones — más alto, 3:4.3
  const width = 340
  const height = 480

  // Cosméticos
  const cardBg = placa.cardBg?.gradient
    ?? `linear-gradient(160deg, #0F0820 0%, #1A0F2E 55%, #06060E 100%)`
  const frameColor = placa.frame?.color ?? tier.primary
  const titleText = placa.title?.text
  const titleColor = placa.title?.color ?? tier.primary

  const initials = (placa.fallbackInitials
    ?? placa.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)
    ?? '?').toUpperCase()

  // Nombre dividido — el apellido es el héroe (como un dorsal)
  const nameParts = placa.displayName.trim().split(/\s+/)
  const firstName = nameParts.length > 1 ? nameParts[0] : ''
  const surname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0]

  const surnameStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontWeight: 900,
    letterSpacing: '-0.04em',
    lineHeight: 0.82,
    textTransform: 'uppercase',
    color: '#F0F0F8',
    margin: 0,
    fontSize: 54,
  }
  if (placa.nameEffect?.gradient) {
    surnameStyle.backgroundImage = placa.nameEffect.gradient
    surnameStyle.WebkitBackgroundClip = 'text'
    surnameStyle.WebkitTextFillColor = 'transparent'
    surnameStyle.backgroundClip = 'text'
    surnameStyle.filter = `drop-shadow(0 2px 12px ${tier.glow})`
  } else {
    surnameStyle.textShadow = `0 2px 0 rgba(0,0,0,0.55), 0 0 18px ${tier.glow}`
  }

  // Silueta con cortes asimétricos — el sello visual de V3
  const CLIP_PATH = `polygon(
    0 0,
    calc(100% - 28px) 0,
    100% 28px,
    100% 100%,
    32px 100%,
    0 calc(100% - 32px)
  )`

  const sportSvg = sportArtSVG(sportArt, accent)

  return (
    <div
      style={{
        position: 'relative',
        width, height,
        // Perspective wrapper sin transform — el child lleva el tilt
        perspective: 1200,
      }}
    >
      <div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="placa-v3 relative select-none"
        style={{
          width, height,
          background: cardBg,
          clipPath: CLIP_PATH,
          // tilt 3D
          transform: `rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))`,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.14s ease-out',
          // doble glow exterior — uno tier, otro sport
          filter: `drop-shadow(0 0 24px ${tier.glow}) drop-shadow(0 12px 28px rgba(0,0,0,0.6))`,
          color: '#E8E8F0',
          fontFamily: 'var(--font-sport)',
        } as React.CSSProperties}
      >
        {/* L0. Borde foil — segundo elemento clipped que actúa como borde */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            background: tier.ringStyle,
            opacity: 0.5,
            clipPath: CLIP_PATH,
            // Crear "borde" usando otro clip más pequeño superpuesto
          }}
        />
        <div
          style={{
            position: 'absolute', inset: 2,
            background: cardBg,
            clipPath: `polygon(
              0 0,
              calc(100% - 27px) 0,
              100% 27px,
              100% 100%,
              31px 100%,
              0 calc(100% - 31px)
            )`,
          }}
        />

        {/* L1. SPORT ART BACKDROP (tras el avatar) */}
        {sportSvg && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 70, left: 0, right: 0,
              height: 280,
              backgroundImage: `url("${sportSvg}")`,
              backgroundPosition: 'center',
              backgroundSize: '90% auto',
              backgroundRepeat: 'no-repeat',
              opacity: 0.65,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* L2. Noise textura */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url("${NOISE_SVG}")`,
            opacity: 0.6,
            mixBlendMode: 'overlay',
            pointerEvents: 'none',
          }}
        />

        {/* L3. Sport stripe vertical izquierda */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: 28, bottom: 32, left: 0,
            width: 4,
            background: `linear-gradient(180deg, ${accent} 0%, ${accent}55 50%, ${accent} 100%)`,
            boxShadow: `0 0 14px ${accent}`,
          }}
        />

        {/* ── CONTENIDO ────────────────────────────────────────── */}
        <div
          style={{
            position: 'relative', zIndex: 2,
            padding: '18px 22px 22px 22px',
            height: '100%',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* TIER STAMP — header metálico */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px',
              background: `linear-gradient(135deg, ${tier.primary}25 0%, ${tier.primary}08 50%, ${tier.primary}25 100%)`,
              border: `1px solid ${tier.primary}55`,
              borderRadius: 2,
              boxShadow: `inset 0 1px 0 ${tier.primary}55, inset 0 -1px 0 rgba(0,0,0,0.4)`,
            }}
          >
            <span style={{
              fontFamily: 'var(--font-headline)',
              fontSize: 11,
              letterSpacing: '0.32em',
              color: tier.primary,
              textShadow: `0 1px 0 rgba(0,0,0,0.6), 0 0 10px ${tier.glow}`,
              fontWeight: 400,
            }}>
              {tier.label}
            </span>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 11, fontWeight: 900,
              color: '#F0F0F8',
              letterSpacing: '0.06em',
              opacity: 0.85,
            }}>
              {placa.levelName?.toUpperCase()}
            </span>
          </div>

          {/* AVATAR — hexagonal con LVL diamante a la derecha */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 20, marginBottom: 14,
          }}>
            {/* Hexagonal avatar */}
            <div style={{ position: 'relative', width: 84, height: 96 }}>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute', inset: -10,
                  background: `radial-gradient(circle, ${tier.glow} 0%, transparent 60%)`,
                  filter: 'blur(8px)',
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
                    position: 'absolute', inset: 3,
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
                        fontSize: 30, fontWeight: 900,
                        color: tier.primary,
                        textShadow: `0 0 10px ${tier.glow}`,
                      }}>
                        {initials}
                      </span>
                    )
                  }
                </div>
              </div>
            </div>

            {/* LVL DIAMANTE */}
            <div style={{ position: 'relative', width: 76, height: 76 }}>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute', inset: -6,
                  background: `radial-gradient(circle, ${tier.glow} 0%, transparent 65%)`,
                  filter: 'blur(6px)',
                }}
              />
              <div
                style={{
                  position: 'absolute', inset: 0,
                  clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                  background: tier.ringStyle,
                }}
              >
                <div
                  style={{
                    position: 'absolute', inset: 3,
                    clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                    background: `radial-gradient(circle, ${tier.primary}22 0%, #0A0612 70%)`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <span style={{
                    fontFamily: 'var(--font-headline)',
                    fontSize: 8, fontWeight: 400,
                    letterSpacing: '0.2em',
                    color: tier.primary, opacity: 0.7,
                    marginBottom: -2,
                  }}>
                    LVL
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 900,
                      fontSize: 32,
                      lineHeight: 0.9,
                      letterSpacing: '-0.04em',
                      backgroundImage: `linear-gradient(135deg, ${tier.primary} 0%, #fff 45%, ${tier.primary} 55%, ${tier.primary} 100%)`,
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      filter: `drop-shadow(0 0 8px ${tier.glow})`,
                    }}
                  >
                    {placa.level}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* HERO NAME — apellido como dorsal */}
          <div style={{ marginBottom: 4 }}>
            {firstName && (
              <p style={{
                fontFamily: 'var(--font-headline)',
                fontSize: 13,
                letterSpacing: '0.28em',
                color: '#9090B0',
                margin: 0,
                fontWeight: 400,
                textTransform: 'uppercase',
              }}>
                {firstName}
              </p>
            )}
            <h2 style={surnameStyle}>
              {surname}
            </h2>
          </div>

          {/* TITLE CHEVRON BANNER */}
          {titleText && (
            <div
              style={{
                position: 'relative',
                alignSelf: 'flex-start',
                marginTop: 4,
                padding: '4px 16px 4px 10px',
                background: `linear-gradient(90deg, ${titleColor}30 0%, transparent 100%)`,
                clipPath: 'polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)',
                borderLeft: `2px solid ${titleColor}`,
              }}
            >
              <span style={{
                fontFamily: 'var(--font-headline)',
                fontSize: 12,
                letterSpacing: '0.22em',
                color: titleColor,
                fontWeight: 400,
                textTransform: 'uppercase',
                textShadow: `0 0 10px ${titleColor}80`,
              }}>
                {titleText}
              </span>
            </div>
          )}

          {/* STAT PANEL — parallelogram con foil */}
          <div style={{ position: 'relative', marginTop: 14 }}>
            <div
              style={{
                position: 'relative',
                padding: '10px 14px',
                clipPath: 'polygon(4% 0, 100% 0, 96% 100%, 0 100%)',
                background: `linear-gradient(135deg, ${tier.primary}1A 0%, rgba(0,0,0,0.4) 50%, ${tier.primary}1A 100%)`,
                overflow: 'hidden',
              }}
            >
              {/* Foil interno del stat panel */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute', inset: 0,
                  background: HOLO_GRADIENT,
                  opacity: foilStrength * 0.6,
                  mixBlendMode: 'color-dodge',
                  pointerEvents: 'none',
                }}
              />
              <div style={{
                position: 'relative',
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: 10,
                zIndex: 2,
              }}>
                <StatCell label="ACTOS" value={String(placa.signatureStat?.value ?? '—')} tierPrimary={tier.primary} />
                <StatCell label="LOGROS" value={String(1 + (placa.secondaryBadges?.length ?? 0))} tierPrimary={tier.primary} />
                <StatCell label="TIER" value={tier.label.slice(0, 3)} tierPrimary={tier.primary} />
              </div>
            </div>
          </div>

          {/* BADGES ROW */}
          {(placa.badge || (placa.secondaryBadges && placa.secondaryBadges.length > 0)) && (
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              {placa.badge && (
                <div
                  title={placa.badge.name}
                  style={{
                    width: 32, height: 32,
                    background: placa.badge.bg,
                    border: `1.5px solid ${placa.badge.color}`,
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                    boxShadow: `0 0 12px ${placa.badge.color}55`,
                  }}
                >
                  {placa.badge.emoji}
                </div>
              )}
              {(placa.secondaryBadges ?? []).slice(0, 3).map((b, i) => (
                <div
                  key={i}
                  title={b.name}
                  style={{
                    width: 22, height: 22,
                    background: b.bg,
                    border: `1px solid ${b.color}99`,
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11,
                  }}
                >
                  {b.emoji}
                </div>
              ))}
            </div>
          )}

          {/* FOOTER */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: 12,
              borderTop: `1px solid ${frameColor}25`,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            }}
          >
            <span style={{
              fontFamily: 'var(--font-sport)',
              fontSize: 11, fontWeight: 700,
              color: '#6A6A88', letterSpacing: '0.02em',
            }}>
              @{placa.handle}
            </span>
            <span style={{
              fontFamily: 'var(--font-headline)',
              fontSize: 12, fontWeight: 400,
              letterSpacing: '0.32em',
              color: accent, opacity: 0.7,
            }}>
              TAKA
            </span>
          </div>
        </div>

        {/* HOLO FOIL global */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            background: HOLO_GRADIENT,
            opacity: foilStrength,
            mixBlendMode: 'color-dodge',
            pointerEvents: 'none',
            filter: 'blur(1px) saturate(1.4)',
            zIndex: 3,
          }}
        />
        {/* SPARKLE cursor */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.25) 0%, transparent 22%)',
            mixBlendMode: 'screen',
            pointerEvents: 'none',
            opacity: placa.tier === 'diamond' ? 1 : placa.tier === 'gold' ? 0.8 : placa.tier === 'silver' ? 0.5 : 0.25,
            zIndex: 4,
          }}
        />

        {/* CORNER STICKER — encajado en el corte top-right (diecut) */}
        {placa.cornerSticker && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 6, right: 6,
              width: 34, height: 34,
              background: `radial-gradient(circle, ${placa.cornerSticker.color} 0%, ${placa.cornerSticker.color}77 65%, transparent 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17,
              filter: `drop-shadow(0 4px 8px ${placa.cornerSticker.color}aa)`,
              zIndex: 6,
              transform: 'rotate(8deg)',
            }}
          >
            {placa.cornerSticker.emoji}
          </div>
        )}
      </div>
    </div>
  )
}

// ── StatCell pequeña ──────────────────────────────────────────
function StatCell({ label, value, tierPrimary }: {
  label: string; value: string; tierPrimary: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <span style={{
        fontFamily: 'var(--font-headline)',
        fontSize: 8, fontWeight: 400,
        letterSpacing: '0.22em',
        color: '#7A7A92',
        textTransform: 'uppercase',
        marginBottom: 2,
      }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 22,
          lineHeight: 0.9,
          letterSpacing: '-0.02em',
          backgroundImage: `linear-gradient(135deg, ${tierPrimary} 0%, #fff 50%, ${tierPrimary} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {value}
      </span>
    </div>
  )
}
