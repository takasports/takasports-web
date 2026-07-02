import { ImageResponse } from 'next/og'
import { accentForSport, getSportLabel } from '@/lib/sports'

export const runtime = 'edge'
export const alt = 'TakaSports — Noticias deportivas'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const SPORT_EMOJI: Record<string, string> = {
  futbol:     '⚽',
  baloncesto: '🏀',
  formula1:   '🏎️',
  ufc:        '🥊',
  tenis:      '🎾',
  wwe:        '🎤',
  rugby:      '🏉',
}

export default async function Image({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params
  const cfg = {
    label: getSportLabel(sport).toUpperCase(),
    emoji: SPORT_EMOJI[sport] ?? '🏟️',
    color: accentForSport(sport),
  }

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
        {/* Sport glow */}
        <div
          style={{
            position: 'absolute',
            top: -150,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 1100,
            height: 650,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${cfg.color}35 0%, transparent 65%)`,
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -120,
            right: -60,
            width: 500,
            height: 400,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${cfg.color}18 0%, transparent 65%)`,
            display: 'flex',
          }}
        />

        <div style={{ fontSize: 100, zIndex: 1, marginBottom: 16 }}>{cfg.emoji}</div>

        <div
          style={{
            fontSize: 110,
            fontWeight: 900,
            color: '#F0F0FF',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            zIndex: 1,
          }}
        >
          {cfg.label}
        </div>

        <div
          style={{
            marginTop: 18,
            fontSize: 28,
            color: cfg.color,
            fontWeight: 700,
            letterSpacing: '0.1em',
            zIndex: 1,
          }}
        >
          NOTICIAS · RESULTADOS · ANÁLISIS
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            zIndex: 1,
          }}
        >
          <div style={{ width: 30, height: 2, background: cfg.color, borderRadius: 2, display: 'flex' }} />
          <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.05em' }}>
            TAKASPORTS
          </span>
          <div style={{ width: 30, height: 2, background: cfg.color, borderRadius: 2, display: 'flex' }} />
        </div>
      </div>
    ),
    { ...size },
  )
}
