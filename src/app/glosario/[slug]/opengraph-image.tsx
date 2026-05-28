import { ImageResponse } from 'next/og'
import { getGlosarioTerm } from '@/lib/glosario-terms'

export const alt = 'Glosario deportivo — TakaSports'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
// Los términos del glosario cambian poco — cache 24h.
export const revalidate = 86400

const SPORT_COLORS: Record<string, string> = {
  futbol:     '#22c55e',
  baloncesto: '#f97316',
  f1:         '#ef4444',
  tenis:      '#eab308',
  ufc:        '#7C3AED',
  general:    '#7C3AED',
}

const SPORT_LABEL: Record<string, string> = {
  futbol:     'FÚTBOL',
  baloncesto: 'BALONCESTO',
  f1:         'FÓRMULA 1',
  tenis:      'TENIS',
  ufc:        'UFC',
  general:    'DEPORTE',
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const term = getGlosarioTerm(slug)

  const termName = term?.term ?? 'Glosario deportivo'
  const summary  = term?.summary ?? 'Glosario deportivo de TakaSports'
  const sport    = term?.sport ?? 'general'
  const accent   = SPORT_COLORS[sport] ?? '#7C3AED'
  const sportTag = SPORT_LABEL[sport] ?? sport.toUpperCase()

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
        {/* Accent glow top-left */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            left: -60,
            width: 600,
            height: 420,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${accent}30 0%, transparent 65%)`,
            display: 'flex',
          }}
        />
        {/* Accent glow bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${accent}18 0%, transparent 65%)`,
            display: 'flex',
          }}
        />

        {/* Grid subtle lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(${accent}08 1px, transparent 1px), linear-gradient(90deg, ${accent}08 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
            display: 'flex',
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '50px 58px',
            width: '100%',
            zIndex: 1,
          }}
        >
          {/* Brand top */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#F0F0FF', letterSpacing: '-0.025em' }}>
              TakaSports
            </span>
            <div style={{ width: 5, height: 5, borderRadius: 999, background: accent, display: 'flex' }} />
            <span style={{ fontSize: 15, color: '#50505E', fontWeight: 600 }}>Glosario deportivo</span>
          </div>

          {/* Term name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
                letterSpacing: '0.1em',
                width: 'fit-content',
              }}
            >
              {sportTag} · ¿QUÉ ES?
            </div>
            <div
              style={{
                fontSize: termName.length > 35 ? 48 : termName.length > 25 ? 56 : 66,
                fontWeight: 900,
                color: '#F5F5FF',
                lineHeight: 1.05,
                letterSpacing: '-0.025em',
              }}
            >
              {termName}
            </div>
          </div>

          {/* Summary + brand line */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 19, color: '#8888A8', lineHeight: 1.45, maxWidth: 860 }}>
              {summary.length > 145 ? summary.slice(0, 142) + '…' : summary}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
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
