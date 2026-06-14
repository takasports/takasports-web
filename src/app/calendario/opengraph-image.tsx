import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'TakaSports — Calendario'
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
        {/* Blue glow */}
        <div
          style={{
            position: 'absolute',
            top: -160,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 900,
            height: 550,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(6,182,212,0.28) 0%, transparent 65%)',
            display: 'flex',
          }}
        />
        {/* Purple pocket */}
        <div
          style={{
            position: 'absolute',
            bottom: -100,
            left: -60,
            width: 500,
            height: 400,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 65%)',
            display: 'flex',
          }}
        />

        {/* Icon */}
        <div style={{ fontSize: 90, zIndex: 1, marginBottom: 14 }}>📅</div>

        {/* Title */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: '#F0F0FF',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            zIndex: 1,
          }}
        >
          CALENDARIO
        </div>

        {/* Subtitle */}
        <div
          style={{
            marginTop: 14,
            fontSize: 26,
            color: '#06b6d4',
            fontWeight: 700,
            letterSpacing: '0.08em',
            zIndex: 1,
          }}
        >
          PARTIDOS HOY · CALENDARIO · RESULTADOS EN VIVO
        </div>

        {/* Day cards */}
        <div style={{ display: 'flex', gap: 14, marginTop: 44, zIndex: 1 }}>
          {['HOY', 'MÑN', '+7D'].map((label, i) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 28px',
                borderRadius: 14,
                background: i === 0 ? 'rgba(6,182,212,0.22)' : 'rgba(255,255,255,0.04)',
                border: i === 0 ? '1.5px solid rgba(6,182,212,0.5)' : '1px solid rgba(255,255,255,0.08)',
                fontSize: 22,
                fontWeight: 800,
                color: i === 0 ? '#06b6d4' : '#5A5A7A',
                letterSpacing: '0.08em',
              }}
            >
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
