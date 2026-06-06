'use client'

import { useState } from 'react'
import type { RankingEntry } from '@/lib/rankings'
import { getDisplayScore, getEffectiveTrend, trendIcon, scoreColor, SPORT_EMOJI } from '@/lib/rankings-ui'
import { getSportStyle } from '@/lib/sports'
import BadgePill from './BadgePill'
import PlayerAvatar from './PlayerAvatar'
import ScoreBreakdown from './ScoreBreakdown'
import ScoreSparkline from './ScoreSparkline'
import Link from 'next/link'
import FavoriteToggle from './FavoriteToggle'
import { CrownIcon } from '@/components/icons/GameIcons'

export default function TopOneRow({ entry, showSportEmoji = false }: { entry: RankingEntry; showSportEmoji?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const displayScore = getDisplayScore(entry)
  const trend = trendIcon(getEffectiveTrend(entry))
  const scoreDiff = entry.scorePrev !== undefined ? displayScore - entry.scorePrev : null
  const sc = scoreColor(displayScore)
  const sportAccent = entry.sport ? getSportStyle(entry.sport).accent : '#7C3AED'
  const sportEmoji = entry.sport ? SPORT_EMOJI[entry.sport] : null
  const avatarEmoji = (entry.emoji && entry.emoji !== entry.country)
    ? entry.emoji
    : (entry.sport ? (SPORT_EMOJI[entry.sport] ?? '🏅') : '🏅')
  const canExpand = !!entry.factors

  return (
    <div className="relative rounded-2xl overflow-hidden transition-all"
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
          <span className="leading-none inline-flex" style={{ marginTop: -2, color: '#facc15' }}><CrownIcon size={16} /></span>
        </div>
        <div className="relative flex-shrink-0">
          <div className="flex items-center justify-center rounded-2xl text-2xl overflow-hidden"
            style={{ width: 52, height: 52, background: `${sportAccent}18`, border: `2px solid ${sportAccent}35`, boxShadow: `0 4px 20px ${sportAccent}28` }}>
            <PlayerAvatar src={entry.image} alt={entry.name} fallback={avatarEmoji} size={52} rounded="2xl" />
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
        {scoreDiff !== null && (
          <div className="hidden md:flex flex-shrink-0" title={`Anterior: ${entry.scorePrev?.toFixed(1)} → Ahora: ${displayScore.toFixed(1)}`}>
            <ScoreSparkline prev={entry.scorePrev} now={displayScore} width={56} height={22} />
          </div>
        )}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 mb-0.5">
            <FavoriteToggle entryId={entry.id} size={16} />
            <Link
              href={`/rankings/comparar?a=${encodeURIComponent(entry.id)}`}
              title="Comparar con otra entry"
              aria-label="Comparar con otra entry"
              className="inline-flex items-center justify-center w-6 h-6 rounded-md transition-all hover:brightness-150"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#7A7A92', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12 }}
            >
              ⚖
            </Link>
          </div>
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
          {canExpand && (
            <button
              onClick={() => setExpanded(s => !s)}
              className="mt-1 px-2 py-0.5 rounded-md transition-all hover:brightness-150"
              style={{
                background: expanded ? `${sportAccent}22` : 'rgba(255,255,255,0.04)',
                color: expanded ? sportAccent : '#7A7A92',
                border: `1px solid ${expanded ? sportAccent + '40' : 'rgba(255,255,255,0.08)'}`,
                fontFamily: 'var(--font-sport)',
                fontSize: 9,
                letterSpacing: '0.1em',
              }}
              aria-expanded={expanded}
            >
              {expanded ? '▴ DESGLOSE' : '▾ DESGLOSE'}
            </button>
          )}
        </div>
      </div>
      {expanded && entry.factors && (
        <div className="px-5 pb-4" style={{ borderTop: `1px solid ${sportAccent}1A` }}>
          <ScoreBreakdown entry={entry} />
        </div>
      )}
    </div>
  )
}
