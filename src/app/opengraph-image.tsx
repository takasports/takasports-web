import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'TakaSports — Noticias deportivas'
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
            top: -180,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 900,
            height: 500,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(124,58,237,0.35) 0%, transparent 65%)',
            display: 'flex',
          }}
        />
        {/* Indigo pocket bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: -120,
            right: -100,
            width: 500,
            height: 400,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(20,10,60,0.5) 0%, transparent 65%)',
            display: 'flex',
          }}
        />

        {/* Logo + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, zIndex: 1 }}>
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: 22,
              background: 'rgba(124,58,237,0.2)',
              border: '2px solid rgba(124,58,237,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 54,
            }}
          >
            ⚡
          </div>
          <span
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: '#F0F0FF',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            TakaSports
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 28,
            fontSize: 32,
            color: '#8080A0',
            letterSpacing: '0.02em',
            zIndex: 1,
          }}
        >
          Fútbol · Baloncesto · F1 · UFC · Tenis · Rugby
        </div>

        {/* Sport pills row */}
        <div
          style={{
            display: 'flex',
            gap: 14,
            marginTop: 48,
            zIndex: 1,
          }}
        >
          {[
            { emoji: '⚽', label: 'LaLiga', color: '#22c55e' },
            { emoji: '🏀', label: 'Baloncesto', color: '#f97316' },
            { emoji: '🏎️', label: 'F1', color: '#ef4444' },
            { emoji: '🥊', label: 'UFC', color: '#7C3AED' },
            { emoji: '🎾', label: 'Tenis', color: '#eab308' },
          ].map(({ emoji, label, color }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 999,
                background: `${color}18`,
                border: `1px solid ${color}40`,
                fontSize: 22,
                color: '#D0D0F0',
              }}
            >
              <span>{emoji}</span>
              <span style={{ fontWeight: 700, color }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Domain watermark */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            right: 48,
            fontSize: 18,
            color: 'rgba(255,255,255,0.18)',
            letterSpacing: '0.05em',
          }}
        >
          takasportsmedia.com
        </div>
      </div>
    ),
    { ...size }
  )
}
