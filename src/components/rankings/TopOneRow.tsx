'use client'

import type { RankingEntry } from '@/lib/rankings'
import { getDisplayScore, getEffectiveTrend, trendIcon, scoreColor, SPORT_EMOJI } from '@/lib/rankings-ui'
import { getSportStyle } from '@/lib/sports'
import BadgePill from './BadgePill'

export default function TopOneRow({ entry, showSportEmoji = false }: { entry: RankingEntry; showSportEmoji?: boolean }) {
  const displayScore = getDisplayScore(entry)
  const trend = trendIcon(getEffectiveTrend(entry))
  const scoreDiff = entry.scorePrev !== undefined ? displayScore - entry.scorePrev : null
  const sc = scoreColor(displayScore)
  const sportAccent = entry.sport ? getSportStyle(entry.sport).accent : '#7C3AED'
  const sportEmoji = entry.sport ? SPORT_EMOJI[entry.sport] : null
  const avatarEmoji = (entry.emoji && entry.emoji !== entry.country)
    ? entry.emoji
    : (entry.sport ? (SPORT_EMOJI[entry.sport] ?? '🏅') : '🏅')

  return (
    <div className="relative rounded-2xl overflow-hidden transition-all hover:brightness-105"
      style={{
        background: `linear-gradient(135deg, ${sportAccent}14 0%, rgba(9,9,15,0.95) 60%)`,
        border: `1px solid ${sportAccent}35`,
        boxShadow: `0 8px 32px ${sportAccent}18`,
        borderLeft: `4px solid ${sportAccent}`,
      }}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
          <span className="font-black tabular-nums leading-none"
            style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#facc15', opacity: 0.9 }}>
            1
          </span>
          <span className="text-sm leading-none" style={{ marginTop: -2 }}>👑</span>
        </div>
        <div className="relative flex-shrink-0">
          <div className="flex items-center justify-center rounded-2xl text-2xl overflow-hidden"
            style={{ width: 52, height: 52, background: `${sportAccent}18`, border: `2px solid ${sportAccent}35`, boxShadow: `0 4px 20px ${sportAccent}28` }}>
            {entry.image
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={entry.image} alt={entry.name} className="w-full h-full object-cover" />
              : avatarEmoji}
          </div>
          {entry.country && (
            <span className="absolute -bottom-1 -right-1 text-sm leading-none">{entry.country}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-black"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 2vw, 1.25rem)', color: '#F8F8FF', letterSpacing: '-0.01em' }}>
              {entry.name}
            </span>
            {showSportEmoji && sportEmoji && <span className="text-sm leading-none" title={entry.sport ?? ''}>{sportEmoji}</span>}
            {entry.badge && <BadgePill text={entry.badge} />}
          </div>
          <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
            {entry.subtitle}
          </p>
          {entry.insight && (
            <p className="text-[11px] leading-relaxed line-clamp-1 hidden sm:block"
              style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
              {entry.insight}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className="font-black tabular-nums"
            style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: sc, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {displayScore.toFixed(1)}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-semibold" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>/ 100</span>
            {scoreDiff !== null && (
              <span className="text-[9px] tabular-nums font-bold"
                style={{ color: scoreDiff >= 0 ? '#22c55e' : '#f87171', fontFamily: 'var(--font-display)' }}>
                {scoreDiff >= 0 ? '+' : ''}{scoreDiff.toFixed(1)}
              </span>
            )}
            <div className="relative group">
              <span className="text-sm font-black" style={{ color: trend.color }}>{trend.icon}</span>
              {entry.trendReason && (
                <div className="absolute right-0 bottom-full mb-2 w-52 px-2.5 py-2 rounded-lg pointer-events-none z-20
                  opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{ background: '#12121E', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  <p className="text-[10px] leading-relaxed" style={{ color: '#A0A0B8', fontFamily: 'var(--font-sport)' }}>
                    {entry.trendReason}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
