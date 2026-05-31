import { ImageResponse } from 'next/og'
import { parseResultSlug, formatJornadaFromSlug } from '@/lib/porra-result-slug'

export const runtime = 'edge'
export const alt = 'Mi porra de TakaSports'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Params { slug: string }

export default async function Image({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const parsed = parseResultSlug(slug)
  const jornada = parsed?.jornadaSlug
    ? formatJornadaFromSlug(parsed.jornadaSlug).toUpperCase()
    : 'PREDICCIONES'

  const hits = parsed?.hits ?? 0
  const total = parsed?.total ?? 0
  const totalWon = parsed?.totalWon ?? 0

  const ratio = total > 0 ? hits / total : 0
  const great = totalWon >= 100 || ratio >= 0.75
  const good = !great && (totalWon > 0 || ratio >= 0.4)

  const accent = great ? '#22C55E' : good ? '#F97316' : '#7C3AED'
  const emoji = great ? '🔥' : good ? '✅' : '🎯'

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
        {/* Halo de color según tono */}
        <div
          style={{
            position: 'absolute',
            top: -200,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 1000,
            height: 600,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${accent}55 0%, transparent 65%)`,
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -180,
            right: -120,
            width: 600,
            height: 500,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(124,58,237,0.35) 0%, transparent 65%)',
            display: 'flex',
          }}
        />

        {/* Brand strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            position: 'absolute',
            top: 56,
            left: 64,
          }}
        >
          <div
            style={{
              width: 14, height: 14, borderRadius: 7,
              background: accent,
              display: 'flex',
            }}
          />
          <span style={{
            color: '#fff',
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: 4,
          }}>
            PREDICCIONES · TAKASPORTS
          </span>
        </div>

        {/* Jornada label */}
        <span
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 6,
            marginBottom: 16,
          }}
        >
          {emoji}  {jornada}
        </span>

        {/* Score gigante */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            color: '#fff',
            fontWeight: 900,
            lineHeight: 1,
            margin: '0 0 24px',
          }}
        >
          <span style={{ fontSize: 240 }}>{hits}</span>
          <span style={{ fontSize: 120, color: 'rgba(255,255,255,0.32)' }}>
            /{total}
          </span>
        </div>

        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            color: accent,
            fontSize: 44,
            fontWeight: 900,
            letterSpacing: 4,
            padding: '12px 28px',
            borderRadius: 14,
            background: `${accent}1a`,
            border: `2px solid ${accent}55`,
          }}
        >
          +{totalWon} PTS
        </span>

        {/* Footer */}
        <span
          style={{
            position: 'absolute',
            bottom: 56,
            color: 'rgba(255,255,255,0.45)',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 4,
          }}
        >
          JUEGA GRATIS · TAKASPORTSMEDIA.COM/PREDICCIONES
        </span>
      </div>
    ),
    { ...size },
  )
}
