import { ImageResponse } from 'next/og'
import { getCompetition } from '@/lib/calendar-competitions'
import { accentForSport } from '@/lib/sports'

export const alt = 'Calendario de competición — TakaSports'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 3600

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const comp = getCompetition(slug)

  const name       = comp?.displayName ?? 'Calendario deportivo'
  const season     = comp?.seasonLabel ?? ''
  const desc       = comp?.description ?? 'Partidos, horarios y resultados en TakaSports.'
  const sport      = comp?.sport ?? 'Fútbol'
  const accent     = accentForSport(sport)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#09090F',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow top-left */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            left: -80,
            width: 550,
            height: 400,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${accent}28 0%, transparent 65%)`,
            display: 'flex',
          }}
        />
        {/* Glow bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: -60,
            right: -60,
            width: 380,
            height: 380,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${accent}15 0%, transparent 65%)`,
            display: 'flex',
          }}
        />

        {/* Calendar icon top-right decorative */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 50,
            width: 160,
            height: 160,
            borderRadius: 24,
            background: `${accent}10`,
            border: `1.5px solid ${accent}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 72 }}>📅</span>
        </div>

        {/* Content */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '50px 58px',
            width: '78%',
            zIndex: 1,
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#F0F0FF', letterSpacing: '-0.025em' }}>
              TakaSports
            </span>
            <div style={{ width: 5, height: 5, borderRadius: 999, background: accent, display: 'flex' }} />
            <span style={{ fontSize: 15, color: '#50505E', fontWeight: 600 }}>Calendario {sport}</span>
          </div>

          {/* Competition name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                padding: '6px 18px',
                borderRadius: 999,
                background: `${accent}22`,
                border: `1.5px solid ${accent}55`,
                color: accent,
                fontSize: 13,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                width: 'fit-content',
              }}
            >
              TEMPORADA {season}
            </div>
            <div
              style={{
                fontSize: name.length > 25 ? 50 : name.length > 15 ? 60 : 72,
                fontWeight: 900,
                color: '#F5F5FF',
                lineHeight: 1.05,
                letterSpacing: '-0.025em',
              }}
            >
              {name}
            </div>
          </div>

          {/* Description + brand line */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 18, color: '#8888A8', lineHeight: 1.45, maxWidth: 680 }}>
              {desc.length > 120 ? desc.slice(0, 117) + '…' : desc}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 2, background: accent, borderRadius: 2, display: 'flex' }} />
              <span style={{ fontSize: 13, color: accent, fontWeight: 700, letterSpacing: '0.06em' }}>
                TAKASPORTS · TAKASPORTSMEDIA.COM
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
