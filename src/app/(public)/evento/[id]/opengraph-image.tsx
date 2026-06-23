import { ImageResponse } from 'next/og'
import { sanityClient, eventDetailQuery } from '@/lib/sanity'
import { accentForSport } from '@/lib/sports'

export const runtime = 'edge'
export const alt = 'Evento deportivo — TakaSports'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const SPORT_EMOJI: Record<string, string> = {
  futbol: '⚽', baloncesto: '🏀', formula1: '🏎️',
  tenis: '🎾', ufc: '🥊', wwe: '🎤', rugby: '🏉',
}

interface EventBasic { sport: string; home: string; away?: string; competition?: { name: string } }

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event: EventBasic | null = await sanityClient.fetch(eventDetailQuery, { id }).catch(() => null)

  const sport = event?.sport ?? 'futbol'
  const color = accentForSport(sport)
  const emoji = SPORT_EMOJI[sport] ?? '🏟️'
  const home = event?.home ?? '—'
  const away = event?.away
  const league = event?.competition?.name ?? sport.toUpperCase()

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: '#09090F', position: 'relative', overflow: 'hidden',
      }}>
        {/* Glow */}
        <div style={{
          position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)',
          width: 1400, height: 800, borderRadius: 9999,
          background: `radial-gradient(circle, ${color}28 0%, transparent 60%)`,
          display: 'flex',
        }} />

        {/* League */}
        <div style={{
          position: 'absolute', top: 36, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 28 }}>{emoji}</span>
          <span style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {league}
          </span>
        </div>

        {/* Teams */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          paddingTop: 40, gap: 0,
        }}>
          {away ? (
            <>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <span style={{
                  fontSize: home.length > 16 ? 36 : 52, fontWeight: 900, color: '#F0F0FF',
                  textAlign: 'center', lineHeight: 1.1, maxWidth: 380,
                }}>{home}</span>
              </div>
              <span style={{ fontSize: 44, fontWeight: 900, color: '#2A2A40', minWidth: 100, textAlign: 'center' }}>vs</span>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <span style={{
                  fontSize: away.length > 16 ? 36 : 52, fontWeight: 900, color: '#F0F0FF',
                  textAlign: 'center', lineHeight: 1.1, maxWidth: 380,
                }}>{away}</span>
              </div>
            </>
          ) : (
            <span style={{
              fontSize: home.length > 20 ? 48 : 70, fontWeight: 900, color: '#F0F0FF',
              textAlign: 'center', lineHeight: 1.1, maxWidth: 900,
            }}>{home}</span>
          )}
        </div>

        {/* Footer */}
        <div style={{
          position: 'absolute', bottom: 32, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 30, height: 2, background: color, borderRadius: 2, display: 'flex' }} />
          <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.06em' }}>
            TAKASPORTS
          </span>
          <div style={{ width: 30, height: 2, background: color, borderRadius: 2, display: 'flex' }} />
        </div>
      </div>
    ),
    { ...size },
  )
}
