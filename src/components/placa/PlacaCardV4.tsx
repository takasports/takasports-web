'use client'

// ─────────────────────────────────────────────────────────────────
// PlacaCardV4 — versión LIMPIA y consolidada (la definitiva).
//
// Tras feedback "los puntos de personalización no están bien definidos
// y es poco intuitivo": se reduce de 9 slots a 5 claros, cada uno
// cambia UNA cosa visible:
//
//   1. MARCO   (frame)        → borde de la placa, sube con el nivel
//   2. FONDO   (card_bg)      → color/gradiente interior
//   3. ANILLO  (avatar_frame) → aro alrededor del avatar
//   4. NOMBRE  (name_effect)  → color/degradado del nombre
//   5. TÍTULO  (title)        → epíteto bajo el nombre
//
// Estética dirección 1 (editorial limpia): sin foil holográfico, sin
// stickers, sin stat-panel, sin badges secundarios, sin cromado
// agresivo. El nombre es el protagonista. Textura de fondo MUY sutil
// (dots) como parte del look, no como slot.
//
// Tilt 3D opcional (interactive) muy leve, sin foil paralax.
// ─────────────────────────────────────────────────────────────────

import { useRef, useCallback } from 'react'
import { TIER_CONFIG, type PlacaData } from './types'

interface Props {
  placa: PlacaData
  interactive?: boolean
}

export function PlacaCardV4({ placa, interactive = true }: Props) {
  const tier = TIER_CONFIG[placa.tier]
  const ref = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      el.style.setProperty('--ry', `${(x - 0.5) * 5}deg`)
      el.style.setProperty('--rx', `${(0.5 - y) * 5}deg`)
      // Posición del cursor (0-100%) para el brillo holográfico del foil.
      el.style.setProperty('--mx', `${x * 100}%`)
      el.style.setProperty('--my', `${y * 100}%`)
    })
  }, [interactive])

  const onLeave = useCallback(() => {
    const el = ref.current; if (!el) return
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--mx', '50%')
    el.style.setProperty('--my', '50%')
  }, [])

  const width = 300, height = 430

  const frameColor = placa.frame?.color ?? tier.primary
  const cardBg = placa.cardBg?.gradient
    ?? `linear-gradient(160deg, #17171f 0%, #0c0c13 100%)`
  const titleText  = placa.title?.text
  const titleColor = placa.title?.color ?? tier.primary
  const ringColor  = placa.avatarFrame?.color ?? frameColor
  const ringGradient = placa.avatarFrame?.style === 'gradient'

  // Foil holográfico — recompensa premium SOLO para tiers altos (gold/diamond).
  // Los tiers bronze/silver conservan el look editorial limpio. La lámina sigue
  // al cursor (--mx/--my) y al tilt; 0 KB (puro CSS, mix-blend-mode).
  const isPremium = placa.tier === 'gold' || placa.tier === 'diamond'
  const foilBand = placa.tier === 'diamond'
    ? 'linear-gradient(115deg, transparent 16%, rgba(34,211,238,0.40) 30%, rgba(192,132,252,0.34) 43%, rgba(251,191,36,0.38) 56%, rgba(34,211,238,0.32) 69%, transparent 84%)'
    : 'linear-gradient(115deg, transparent 22%, rgba(253,230,138,0.34) 38%, rgba(251,191,36,0.40) 50%, rgba(180,83,9,0.26) 62%, transparent 80%)'

  const initials = (placa.fallbackInitials
    ?? placa.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)
    ?? '?').toUpperCase()

  const parts = placa.displayName.trim().split(/\s+/)
  const firstName = parts.length > 1 ? parts[0] : ''
  const surname   = parts.length > 1 ? parts.slice(1).join(' ') : parts[0]

  // Efecto del nombre (slot 4)
  const nameStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontWeight: 900,
    fontSize: surname.length > 9 ? 38 : 46,
    lineHeight: 0.9,
    letterSpacing: '-0.02em',
    textTransform: 'uppercase',
    color: '#F0F0F8',
    margin: 0,
  }
  if (placa.nameEffect?.gradient) {
    nameStyle.backgroundImage = placa.nameEffect.gradient
    nameStyle.WebkitBackgroundClip = 'text'
    nameStyle.WebkitTextFillColor = 'transparent'
    nameStyle.backgroundClip = 'text'
    if (placa.nameEffect.glow) nameStyle.filter = `drop-shadow(0 0 10px ${placa.nameEffect.glow})`
  }

  return (
    <div style={{ perspective: 1000, width, height }}>
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{
          position: 'relative',
          width, height,
          background: cardBg,
          border: `2px solid ${frameColor}`,
          borderRadius: 16,
          boxShadow: `0 24px 60px rgba(0,0,0,0.6), 0 0 22px ${frameColor}22`,
          padding: '24px 22px',
          color: '#E8E8F0',
          fontFamily: 'var(--font-sport)',
          transform: 'rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))',
          transition: 'transform 0.15s ease-out',
          transformStyle: 'preserve-3d',
          overflow: 'hidden',
        } as React.CSSProperties}
      >
        {/* Textura de fondo sutil (parte del look, no slot) */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 2, borderRadius: 14,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1.5px)',
          backgroundSize: '13px 13px',
          pointerEvents: 'none',
        }} />
        {/* Luz superior leve */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
          background: `linear-gradient(180deg, ${frameColor}0F 0%, transparent 100%)`,
          pointerEvents: 'none',
        }} />

        {/* Foil holográfico (gold/diamond) — bajo el contenido para no tapar el
            texto; la lámina iridiscente + el brillo siguen al cursor. */}
        {isPremium && interactive && (
          <div aria-hidden="true" className="placa-foil" style={{
            position: 'absolute', inset: 2, borderRadius: 14, pointerEvents: 'none',
            mixBlendMode: 'color-dodge',
            backgroundImage: `radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.45) 0%, transparent 42%), ${foilBand}`,
            backgroundSize: '180% 180%, 230% 100%',
            backgroundPosition: 'var(--mx,50%) var(--my,50%), var(--mx,50%) 0',
          } as React.CSSProperties} />
        )}

        {/* Tier band */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            color: tier.primary, fontSize: 11, letterSpacing: '0.3em', fontWeight: 800,
            fontFamily: 'var(--font-headline)',
          }}>
            {tier.label}
          </span>
          <span style={{ color: '#7a7a92', fontSize: 11, letterSpacing: '0.1em', fontWeight: 700 }}>
            {placa.levelName?.toUpperCase()}
          </span>
        </div>

        {/* Avatar con anillo (slot 3) */}
        <div style={{ position: 'relative', width: 88, height: 88, marginTop: 26 }}>
          <div aria-hidden="true" style={{
            position: 'absolute', inset: -6, borderRadius: '50%',
            background: `radial-gradient(circle, ${tier.glow} 0%, transparent 65%)`,
            filter: 'blur(7px)',
          }} />
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: ringGradient
              ? `conic-gradient(from 0deg, ${ringColor}, ${tier.primary}, ${ringColor})`
              : ringColor,
            padding: 3,
          }}>
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: '#0a0612', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {placa.avatarUrl
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={placa.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 900, color: ringColor }}>{initials}</span>}
            </div>
          </div>
        </div>

        {/* Nombre protagonista (slot 4) */}
        <div style={{ position: 'relative', marginTop: 24 }}>
          {firstName && (
            <p style={{
              color: '#8a8aa0', fontSize: 13, letterSpacing: '0.22em',
              margin: 0, fontWeight: 400, textTransform: 'uppercase',
              fontFamily: 'var(--font-headline)',
            }}>{firstName}</p>
          )}
          <h2 style={nameStyle}>{surname}</h2>
        </div>

        {/* Título (slot 5) */}
        {titleText && (
          <div style={{
            position: 'relative', marginTop: 14, alignSelf: 'flex-start',
            display: 'inline-block',
            background: `${titleColor}18`,
            border: `1px solid ${titleColor}40`,
            padding: '4px 12px', borderRadius: 5,
          }}>
            <span style={{
              color: titleColor, fontSize: 12, letterSpacing: '0.16em',
              fontWeight: 700, textTransform: 'uppercase',
            }}>{titleText}</span>
          </div>
        )}

        {/* Footer: handle · nivel + TAKA */}
        <div style={{
          position: 'absolute', bottom: 20, left: 22, right: 22,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        }}>
          <span style={{ color: '#6a6a88', fontSize: 12, fontWeight: 700 }}>
            @{placa.handle} · NVL {placa.level}
          </span>
          <span style={{
            color: tier.primary, fontSize: 12, letterSpacing: '0.3em',
            opacity: 0.65, fontWeight: 400, fontFamily: 'var(--font-headline)',
          }}>TAKA</span>
        </div>
      </div>
    </div>
  )
}
