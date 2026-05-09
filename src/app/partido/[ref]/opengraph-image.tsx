import { ImageResponse } from 'next/og'
import type { MatchDetail } from '@/app/api/match/[ref]/route'
import { SITE_URL } from '@/lib/constants'

export const runtime = 'edge'
export const alt = 'Partido — TakaSports'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const SPORT_COLOR: Record<string, string> = {
  soccer: '#22c55e', football: '#22c55e',
  basketball: '#f97316',
  'formula-1': '#ef4444', racing: '#ef4444',
  tennis: '#eab308',
  mma: '#7C3AED', ufc: '#7C3AED',
}

async function fetchMatch(ref: string): Promise<MatchDetail | null> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? SITE_URL
    const res = await fetch(`${base}/api/match/${ref}`, { next: { revalidate: 60 } })
    return res.ok ? res.json() : null
  } catch {
    return null
  }
}

export default async function Image({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const match = await fetchMatch(ref)

  const color = match ? (SPORT_COLOR[match.sport] ?? '#7C3AED') : '#7C3AED'
  const home = match?.homeTeam ?? '—'
  const away = match?.awayTeam ?? '—'
  const hasScore = match?.homeScore != null && match?.awayScore != null
  const league = match?.leagueLabel ?? 'TakaSports'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: '#09090F', position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Glow */}
        <div style={{
          position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)',
          width: 1400, height: 800, borderRadius: 9999,
          background: `radial-gradient(circle, ${color}30 0%, transparent 60%)`,
          display: 'flex',
        }} />

        {/* League label */}
        <div style={{
          position: 'absolute', top: 36, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 22, fontWeight: 700, color: color,
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>{league}</span>
        </div>

        {/* Teams + Score */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 0, paddingTop: 40,
        }}>
          {/* Home */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            {match?.homeLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={match.homeLogo} width={100} height={100}
                style={{ objectFit: 'contain' }} alt={home} />
            )}
            <span style={{
              fontSize: home.length > 14 ? 32 : 44, fontWeight: 900,
              color: '#F0F0FF', textAlign: 'center', lineHeight: 1.1,
              maxWidth: 340,
            }}>{home}</span>
          </div>

          {/* Score / VS */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            minWidth: 160, gap: 8,
          }}>
            {hasScore ? (
              <span style={{
                fontSize: 80, fontWeight: 900, color: '#F0F0FF',
                letterSpacing: '-0.04em', lineHeight: 1,
              }}>
                {match!.homeScore}–{match!.awayScore}
              </span>
            ) : (
              <span style={{ fontSize: 52, fontWeight: 900, color: '#3A3A52' }}>vs</span>
            )}
            {match?.statusLabel && (
              <span style={{
                fontSize: 16, fontWeight: 700, color: color,
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>{match.statusLabel}</span>
            )}
          </div>

          {/* Away */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            {match?.awayLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={match.awayLogo} width={100} height={100}
                style={{ objectFit: 'contain' }} alt={away} />
            )}
            <span style={{
              fontSize: away.length > 14 ? 32 : 44, fontWeight: 900,
              color: '#F0F0FF', textAlign: 'center', lineHeight: 1.1,
              maxWidth: 340,
            }}>{away}</span>
          </div>
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
