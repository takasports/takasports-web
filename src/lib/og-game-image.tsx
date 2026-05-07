import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 }

interface GameOgProps {
  emoji: string
  title: string
  description: string
  accentColor: string
}

export function buildGameOgImage({ emoji, title, description, accentColor }: GameOgProps) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#09090F',
          position: 'relative',
          overflow: 'hidden',
          padding: '64px 80px',
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            top: -200,
            left: -150,
            width: 700,
            height: 600,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${accentColor}30 0%, transparent 65%)`,
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -100,
            right: -100,
            width: 500,
            height: 400,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(20,10,60,0.5) 0%, transparent 65%)',
            display: 'flex',
          }}
        />

        {/* TakaSports label */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 'auto',
          }}
        >
          <span style={{ fontSize: 22, color: accentColor, fontWeight: 900, letterSpacing: '0.15em' }}>
            TAKASPORTS
          </span>
          <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.2)' }}>·</span>
          <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>
            JUEGOS
          </span>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 24 }}>
          <div
            style={{
              fontSize: 120,
              lineHeight: 1,
              display: 'flex',
            }}
          >
            {emoji}
          </div>
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              color: '#F0F0FF',
              letterSpacing: '-0.03em',
              lineHeight: 1,
              display: 'flex',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 30,
              color: '#7070A0',
              lineHeight: 1.4,
              maxWidth: 820,
              display: 'flex',
            }}
          >
            {description}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginTop: 32,
          }}
        >
          <div
            style={{
              width: 6,
              height: 36,
              borderRadius: 3,
              background: accentColor,
              display: 'flex',
            }}
          />
          <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em' }}>
            takasportsmedia.com
          </span>
        </div>
      </div>
    ),
    { ...OG_SIZE }
  )
}
