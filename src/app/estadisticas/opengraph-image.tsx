import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'TakaSports — Estadísticas en vivo'
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
        {/* Green glow top */}
        <div
          style={{
            position: 'absolute',
            top: -180,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 950,
            height: 580,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(34,197,94,0.30) 0%, transparent 65%)',
            display: 'flex',
          }}
        />
        {/* Orange pocket */}
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            right: -60,
            width: 480,
            height: 400,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 65%)',
            display: 'flex',
          }}
        />

        {/* Live dot */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 20px',
            background: 'rgba(34,197,94,0.16)',
            border: '1.5px solid rgba(34,197,94,0.4)',
            borderRadius: 9999,
            marginBottom: 28,
            zIndex: 1,
          }}
        >
          <div style={{ width: 14, height: 14, borderRadius: 9999, background: '#4ade80', display: 'flex' }} />
          <div style={{ fontSize: 22, color: '#86efac', fontWeight: 800, letterSpacing: '0.18em' }}>
            EN VIVO
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 110,
            fontWeight: 900,
            color: '#F0F0FF',
            letterSpacing: '-0.045em',
            lineHeight: 1,
            zIndex: 1,
          }}
        >
          ESTADÍSTICAS
        </div>

        {/* Subtitle */}
        <div
          style={{
            marginTop: 18,
            fontSize: 28,
            color: '#9090C0',
            fontWeight: 600,
            letterSpacing: '0.04em',
            zIndex: 1,
            textAlign: 'center',
            maxWidth: 900,
          }}
        >
          Fútbol · NBA · F1 · Tenis · UFC · MotoGP · Mundial 2026
        </div>

        {/* Sport chips */}
        <div style={{ display: 'flex', gap: 14, marginTop: 40, zIndex: 1, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1000 }}>
          {[
            { emoji: '⚽', label: 'LaLiga · UCL' },
            { emoji: '🏀', label: 'NBA' },
            { emoji: '🏎️', label: 'F1' },
            { emoji: '🎾', label: 'ATP/WTA' },
            { emoji: '🥊', label: 'UFC' },
            { emoji: '🏍️', label: 'MotoGP' },
            { emoji: '🌍', label: 'Mundial 2026' },
          ].map(({ emoji, label }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 18,
                fontWeight: 700,
                color: '#C0C0E0',
              }}
            >
              <span style={{ fontSize: 22 }}>{emoji}</span>
              {label}
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
            color: 'rgba(255,255,255,0.20)',
            letterSpacing: '0.05em',
            display: 'flex',
          }}
        >
          takasportsmedia.com/estadisticas
        </div>
      </div>
    ),
    { ...size },
  )
}
