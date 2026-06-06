'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { RankingEntry } from '@/lib/rankings'
import { getDisplayScore, getEffectiveTrend, trendIcon, scoreColor, SPORT_EMOJI } from '@/lib/rankings-ui'
import { getSportStyle } from '@/lib/sports'
import BadgePill from './BadgePill'
import PlayerAvatar from './PlayerAvatar'
import ScoreBreakdown from './ScoreBreakdown'
import ScoreSparkline from './ScoreSparkline'
import FavoriteToggle from './FavoriteToggle'
import { SportIcon } from '@/components/icons/GameIcons'
import SocialHandles from './SocialHandles'

export default function RankRow({
  entry, showSportEmoji = false, typeTag,
}: {
  entry: RankingEntry; showSportEmoji?: boolean; typeTag?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const displayScore = getDisplayScore(entry)
  const trend = trendIcon(getEffectiveTrend(entry))
  const scoreDiff = entry.scorePrev !== undefined ? displayScore - entry.scorePrev : null
  const sc = scoreColor(displayScore)
  const sportAccent = entry.sport ? getSportStyle(entry.sport).accent : '#7C3AED'
  const avatarEmoji = (entry.emoji && entry.emoji !== entry.country)
    ? entry.emoji
    : (entry.sport ? (SPORT_EMOJI[entry.sport] ?? '🏅') : '🏅')
  const canExpand = !!entry.factors || !!entry.insight

  return (
    <div
      className="rounded-xl overflow-hidden transition-all hover:brightness-110"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `3px solid ${sportAccent}` }}
    >
      <div
        className={`flex items-center gap-3 px-4 py-2.5 ${canExpand ? 'cursor-pointer' : ''}`}
        onClick={() => canExpand && setExpanded(s => !s)}
      >
        <div className="flex flex-col items-center w-7 flex-shrink-0">
          <span className="font-black tabular-nums text-sm leading-none"
            style={{ fontFamily: 'var(--font-display)', color: '#8B8BA8' }}>
            {entry.rank}
          </span>
          {entry._globalRank !== undefined && entry._globalRank !== entry.rank && (
            <span className="text-[8px] tabular-nums leading-none mt-0.5"
              style={{ color: '#3A3A52', fontFamily: 'var(--font-display)' }}
              title="Rank global">
              #{entry._globalRank}
            </span>
          )}
        </div>
        <div className="relative flex-shrink-0">
          <div className="flex items-center justify-center rounded-xl text-lg overflow-hidden"
            style={{ width: 36, height: 36, background: `${sportAccent}12`, border: `1px solid ${sportAccent}20` }}>
            <PlayerAvatar src={entry.image} alt={entry.name} fallback={avatarEmoji} size={36} rounded="xl" />
          </div>
          {entry.country && (
            <span className="absolute -bottom-1 -right-1 text-[11px] leading-none">{entry.country}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 overflow-hidden">
            <Link
              href={`/rankings/${entry.id}`}
              onClick={e => e.stopPropagation()}
              className="text-sm font-bold truncate hover:brightness-125 transition-all"
              style={{ color: '#D0D0E0', fontFamily: 'var(--font-sport)' }}
            >
              {entry.name}
            </Link>
            {showSportEmoji && entry.sport && (
              <span className="leading-none flex-shrink-0 inline-flex items-center" title={entry.sport} style={{ color: sportAccent }}>
                <SportIcon sport={entry.sport} size={13} />
              </span>
            )}
            {typeTag && (
              <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)', fontFamily: 'var(--font-sport)' }}>
                {typeTag}
              </span>
            )}
            {entry.badge && <BadgePill text={entry.badge} />}
            {entry.editorialNote && <EditorialNoteChip note={entry.editorialNote} />}
          </div>
          <p className="text-[10px] truncate" style={{ color: '#4A4A5E', fontFamily: 'var(--font-sport)' }}>
            {entry.subtitle}
          </p>
          {/* Insight inline en mobile (en desktop se muestra en columna separada abajo) */}
          {entry.insight && (
            <p
              className="xl:hidden text-[11px] mt-1 line-clamp-2"
              style={{ color: '#6A6A82', fontFamily: 'var(--font-sport)', lineHeight: 1.35 }}
            >
              {entry.insight}
            </p>
          )}
        </div>
        {entry.insight && (
          <p className="hidden xl:block text-[11px] flex-shrink-0 max-w-[220px] line-clamp-1"
            style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
            {entry.insight}
          </p>
        )}
        {/* Sparkline siempre visible cuando hay scorePrev — también en mobile */}
        {scoreDiff !== null && (
          <div className="flex flex-shrink-0" title={`Anterior: ${entry.scorePrev?.toFixed(1)} → Ahora: ${displayScore.toFixed(1)}`}>
            <ScoreSparkline prev={entry.scorePrev} now={displayScore} />
          </div>
        )}
        {entry.handles && (
          <div className="hidden sm:flex flex-shrink-0">
            <SocialHandles handles={entry.handles} />
          </div>
        )}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
            <FavoriteToggle entryId={entry.id} size={16} />
          </div>
          <Link
            href={`/rankings/comparar?a=${encodeURIComponent(entry.id)}`}
            onClick={(e) => e.stopPropagation()}
            title="Comparar con otra entry"
            aria-label="Comparar con otra entry"
            className="hidden sm:inline-flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 transition-all hover:brightness-150"
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: '#5A5A72',
              border: '1px solid rgba(255,255,255,0.07)',
              fontSize: 12,
            }}
          >
            ⚖
          </Link>
          <div className="flex flex-col items-end">
            <span className="font-black tabular-nums text-lg leading-none"
              style={{ fontFamily: 'var(--font-display)', color: sc }}>
              {displayScore.toFixed(1)}
            </span>
            {scoreDiff !== null && (
              <span className="text-[9px] tabular-nums leading-none mt-0.5"
                style={{ color: scoreDiff >= 0 ? '#22c55e' : '#f87171', fontFamily: 'var(--font-display)' }}>
                {scoreDiff >= 0 ? '+' : ''}{scoreDiff.toFixed(1)}
              </span>
            )}
          </div>
          <div className="relative group w-5 flex-shrink-0">
            <span className="text-xs font-black block text-center" style={{ color: trend.color }}>
              {trend.icon}
            </span>
            {entry.trendReason && (
              <div className="absolute right-0 bottom-full mb-2 w-48 px-2.5 py-2 rounded-lg pointer-events-none z-20
                opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{ background: '#12121E', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                <p className="text-[10px] leading-relaxed" style={{ color: '#A0A0B8', fontFamily: 'var(--font-sport)' }}>
                  {entry.trendReason}
                </p>
              </div>
            )}
          </div>
          {canExpand && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(s => !s) }}
              className="hidden sm:flex items-center justify-center w-6 h-6 rounded-md transition-all hover:brightness-150"
              style={{
                background: expanded ? `${sportAccent}22` : 'rgba(255,255,255,0.04)',
                color: expanded ? sportAccent : '#5A5A72',
                border: `1px solid ${expanded ? sportAccent + '40' : 'rgba(255,255,255,0.07)'}`,
                fontFamily: 'var(--font-sport)',
                fontSize: 10,
              }}
              title={expanded ? 'Ocultar desglose' : 'Ver desglose del score'}
              aria-label={expanded ? 'Ocultar desglose' : 'Ver desglose del score'}
            >
              {expanded ? '▴' : '▾'}
            </button>
          )}
        </div>
      </div>
      {expanded && entry.insight && (
        <div className="xl:hidden px-4 pb-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-[11px] leading-relaxed pt-2.5" style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
            {entry.insight}
          </p>
        </div>
      )}
      {expanded && entry.factors && (
        <div className="px-4 pb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <ScoreBreakdown entry={entry} />
        </div>
      )}
    </div>
  )
}

// Chip de "Nota editorial": indica al lector que esta posición tiene un ajuste
// editorial documentado (transparencia del Índice Taka). Click/tap o hover
// muestra la razón. En mobile usa toggle controlado; en desktop, hover.
function EditorialNoteChip({ note }: { note: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex flex-shrink-0">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label="Ver nota editorial"
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 7px',
          borderRadius: 'var(--radius-full)',
          background: 'rgba(124,58,237,0.12)',
          border: '1px solid rgba(124,58,237,0.3)',
          color: 'var(--purple-light)',
          fontFamily: 'var(--font-sport)',
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        <span aria-hidden="true">✎</span>
        <span>Nota</span>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full mt-1.5 z-30 w-60 px-2.5 py-2 rounded-lg pointer-events-none"
          style={{
            background: '#12121E',
            border: '1px solid rgba(124,58,237,0.35)',
            boxShadow: 'var(--shadow-modal)',
            color: '#D0D0E0',
            fontFamily: 'var(--font-sport)',
            fontSize: 11,
            lineHeight: 1.45,
          }}
        >
          {note}
        </span>
      )}
    </span>
  )
}
