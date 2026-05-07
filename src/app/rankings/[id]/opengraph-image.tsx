import { ImageResponse } from 'next/og'
import { findEntryById } from '@/lib/rankings-search'
import { calcScore, type RankingEntry } from '@/lib/rankings'
import { getSportStyle } from '@/lib/sports'

export const runtime = 'edge'
export const alt = 'Índice Taka — TakaSports'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const SPORT_EMOJI: Record<string, string> = {
  futbol: '⚽', baloncesto: '🏀', formula1: '🏎️', tenis: '🎾',
  ufc: '🥊', wwe: '🤼', contenido: '✍️',
}

function getDisplayScore(entry: RankingEntry): number {
  return entry.factors ? calcScore(entry.factors, entry.editorialBoost) : entry.score
}
function scoreColor(score: number): string {
  if (score >= 95) return '#22c55e'
  if (score >= 90) return '#86efac'
  if (score >= 85) return '#f59e0b'
  if (score >= 80) return '#f97316'
  if (score >= 75) return '#fb923c'
  return '#f87171'
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const entry = findEntryById(id)
  const score = entry ? getDisplayScore(entry) : 0
  const accent = entry?.sport ? getSportStyle(entry.sport).accent : '#7C3AED'
  const sportEmoji = entry?.sport ? SPORT_EMOJI[entry.sport] ?? '🏅' : '🏅'
  const avatar = entry?.emoji && entry.emoji !== entry.country ? entry.emoji : sportEmoji
  const sc = scoreColor(score)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          background: '#06060A',
          padding: 64,
          position: 'relative',
        }}
      >
        {/* Glow accent */}
        <div style={{
          position: 'absolute', top: -200, left: -200,
          width: 800, height: 800, borderRadius: 9999,
          background: `radial-gradient(circle, ${accent}40 0%, transparent 70%)`,
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -150, right: -150,
          width: 600, height: 600, borderRadius: 9999,
          background: `radial-gradient(circle, ${sc}25 0%, transparent 70%)`,
          display: 'flex',
        }} />

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 1 }}>
          <span style={{
            fontSize: 22, fontWeight: 900, letterSpacing: '0.18em',
            color: accent, textTransform: 'uppercase',
          }}>
            #{entry?.rank ?? '?'} · Índice Taka
          </span>
        </div>

        {/* Body — flex grow */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 40,
          marginTop: 32, zIndex: 1,
        }}>
          {/* Avatar */}
          <div style={{
            width: 220, height: 220, borderRadius: 32,
            background: `${accent}25`, border: `4px solid ${accent}60`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 130, flexShrink: 0,
          }}>
            {avatar}
          </div>

          {/* Texto */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 84, fontWeight: 900, color: '#F8F8FF',
              lineHeight: 1, letterSpacing: '-0.03em',
              display: 'flex', flexWrap: 'wrap',
            }}>
              {entry?.name ?? 'Entry no encontrada'}
            </div>
            <div style={{
              fontSize: 30, color: '#8A8AA0', marginTop: 16,
              display: 'flex',
            }}>
              {entry?.subtitle ?? '—'}
            </div>
          </div>
        </div>

        {/* Score bar */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          marginTop: 24, zIndex: 1,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontSize: 18, fontWeight: 900, letterSpacing: '0.2em',
              color: '#5A5A72', textTransform: 'uppercase',
            }}>
              takasportsmedia.com
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{
              fontSize: 160, fontWeight: 900, color: sc,
              lineHeight: 1, letterSpacing: '-0.04em',
            }}>
              {score.toFixed(1)}
            </span>
            <span style={{ fontSize: 28, color: '#5A5A72', fontWeight: 700 }}>
              / 100
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
