import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'TakaSports — Noticias'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090F',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Purple glow top-center */}
        <div
          style={{
            position: 'absolute',
            top: -200,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 1000,
            height: 600,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 65%)',
            display: 'flex',
          }}
        />
        {/* Cyan accent bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: -100,
            left: -80,
            width: 500,
            height: 400,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 65%)',
            display: 'flex',
          }}
        />

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 1, marginBottom: 24 }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: '#A78BFA', letterSpacing: '-0.02em' }}>
            TakaSports
          </span>
        </div>

        {/* Main heading */}
        <div
          style={{
            fontSize: 100,
            fontWeight: 900,
            color: '#F0F0FF',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            zIndex: 1,
          }}
        >
          NOTICIAS
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 20,
            fontSize: 28,
            color: '#6060808',
            letterSpacing: '0.01em',
            zIndex: 1,
          }}
        >
          Toda la actualidad deportiva · Actualizado al minuto
        </div>

        {/* Sport pills */}
        <div style={{ display: 'flex', gap: 12, marginTop: 44, zIndex: 1 }}>
          {[
            { emoji: '⚽', label: 'Fútbol', color: '#22c55e' },
            { emoji: '🏀', label: 'NBA', color: '#f97316' },
            { emoji: '🏎️', label: 'F1', color: '#ef4444' },
            { emoji: '🥊', label: 'UFC', color: '#7C3AED' },
            { emoji: '🎾', label: 'Tenis', color: '#eab308' },
            { emoji: '🎤', label: 'WWE', color: '#dc2626' },
          ].map(({ emoji, label, color }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 18px',
                borderRadius: 999,
                background: `${color}18`,
                border: `1px solid ${color}40`,
                fontSize: 20,
                color: '#D0D0F0',
              }}
            >
              <span>{emoji}</span>
              <span style={{ fontWeight: 700, color, fontSize: 18 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Domain */}
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            right: 48,
            fontSize: 17,
            color: 'rgba(255,255,255,0.18)',
            letterSpacing: '0.05em',
          }}
        >
          takasportsmedia.com
        </div>
      </div>
    ),
    { ...size },
  )
}
