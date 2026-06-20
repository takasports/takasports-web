import { ImageResponse } from 'next/og'

// Tarjeta social por etiqueta. Antes los ~834 /tag declaraban
// twitter:card=summary_large_image SIN og:image ni twitter:image → al
// compartirlas salía una tarjeta rota/en blanco. Con este archivo, la
// convención de Next.js rellena og:image y twitter:image de cada tag. (Fix A3 SEO)
export const runtime = 'edge'
export const alt = 'Etiqueta en TakaSports'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params
  const decoded = decodeURIComponent(tag)
  const accent = '#38BDF8'
  // El hashtag se reduce de tamaño cuando la etiqueta es larga, para no desbordar.
  const label = `#${decoded}`
  const fontSize = label.length > 22 ? 64 : label.length > 14 ? 84 : 104

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
            Etiqueta · TakaSports
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', zIndex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize,
                fontWeight: 900,
                color: '#F8F8FF',
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                display: 'flex',
                flexWrap: 'wrap',
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 30, color: '#8A8AA0', marginTop: 18, display: 'flex' }}>
              Noticias, análisis y cobertura deportiva
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
