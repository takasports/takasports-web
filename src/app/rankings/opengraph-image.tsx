import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'TakaSports — Rankings'
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
        {/* Gold glow */}
        <div
          style={{
            position: 'absolute',
            top: -180,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 1000,
            height: 600,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(234,179,8,0.3) 0%, transparent 65%)',
            display: 'flex',
          }}
        />
        {/* Purple pocket bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: -100,
            right: -80,
            width: 500,
            height: 400,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 65%)',
            display: 'flex',
          }}
        />

        {/* Trophy */}
        <div style={{ fontSize: 90, zIndex: 1, marginBottom: 12 }}>🏆</div>

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
          RANKINGS
        </div>

        {/* Subtitle */}
        <div
          style={{
            marginTop: 12,
            fontSize: 26,
            color: '#eab308',
            fontWeight: 700,
            letterSpacing: '0.12em',
            zIndex: 1,
          }}
        >
          ÍNDICE TAKA · JUGADORES · CLUBES · ENTRENADORES
        </div>

        {/* Position row */}
        <div style={{ display: 'flex', gap: 20, marginTop: 44, zIndex: 1 }}>
          {[
            { pos: '01', color: '#eab308' },
            { pos: '02', color: '#94a3b8' },
            { pos: '03', color: '#cd7c2f' },
          ].map(({ pos, color }) => (
            <div
              key={pos}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 72,
                height: 72,
                borderRadius: 16,
                background: `${color}18`,
                border: `2px solid ${color}50`,
                fontSize: 30,
                fontWeight: 900,
                color,
              }}
            >
              {pos}
            </div>
          ))}
        </div>

        {/* Brand */}
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
