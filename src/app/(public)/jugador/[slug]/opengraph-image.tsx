import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Jugador en TakaSports'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function humanize(slug: string): string {
  return decodeURIComponent(slug)
    .split('-')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const name = humanize(slug)
  const accent = '#8B5CF6'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#06060A',
          padding: 64,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -200,
            left: -200,
            width: 800,
            height: 800,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${accent}40 0%, transparent 70%)`,
            display: 'flex',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 1 }}>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.18em', color: accent, textTransform: 'uppercase' }}>
            Jugador · TakaSports
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', zIndex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 100,
                fontWeight: 900,
                color: '#F8F8FF',
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                display: 'flex',
                flexWrap: 'wrap',
              }}
            >
              {name}
            </div>
            <div style={{ fontSize: 30, color: '#8A8AA0', marginTop: 18, display: 'flex' }}>
              Perfil, estadísticas e Índice Taka
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '0.2em', color: '#5A5A72', textTransform: 'uppercase' }}>
            takasportsmedia.com
          </span>
        </div>
      </div>
    ),
    { ...size },
  )
}
