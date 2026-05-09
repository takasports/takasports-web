'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { RankingEntry } from '@/lib/rankings'
import { getDisplayScore, getEffectiveTrend, trendIcon, scoreColor, SPORT_EMOJI } from '@/lib/rankings-ui'
import { getSportStyle } from '@/lib/sports'
import BadgePill from './BadgePill'

export default function RankRow({
  entry, showSportEmoji = false, typeTag,
}: {
  entry: RankingEntry; showSportEmoji?: boolean; typeTag?: string
}) {
  const [showInsight, setShowInsight] = useState(false)
  const [imgOk, setImgOk] = useState(true)
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
    <div
      className="rounded-xl overflow-hidden transition-all hover:brightness-110"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `3px solid ${sportAccent}` }}
    >
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
        onClick={() => entry.insight && setShowInsight(s => !s)}
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
            {entry.image && imgOk
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={entry.image} alt={entry.name} className="w-full h-full object-cover" onError={() => setImgOk(false)} />
              : avatarEmoji}
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
            {showSportEmoji && sportEmoji && (
              <span className="text-xs leading-none flex-shrink-0" title={entry.sport ?? ''}>{sportEmoji}</span>
            )}
            {typeTag && (
              <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)', fontFamily: 'var(--font-sport)' }}>
                {typeTag}
              </span>
            )}
            {entry.badge && <BadgePill text={entry.badge} />}
          </div>
          <p className="text-[10px] truncate" style={{ color: '#4A4A5E', fontFamily: 'var(--font-sport)' }}>
            {entry.subtitle}
          </p>
        </div>
        {entry.insight && (
          <p className="hidden xl:block text-[11px] flex-shrink-0 max-w-[260px] line-clamp-1"
            style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
            {entry.insight}
          </p>
        )}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
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
          <Link
            href={`/rankings/comparar?a=${entry.id}`}
            onClick={e => e.stopPropagation()}
            className="hidden sm:flex items-center justify-center w-6 h-6 rounded-md transition-all hover:brightness-150"
            style={{
              background: 'rgba(34,211,238,0.08)',
              color: '#67e8f9',
              border: '1px solid rgba(34,211,238,0.2)',
              fontFamily: 'var(--font-sport)',
              fontSize: 11,
            }}
            title={`Comparar ${entry.name} con otro`}
          >
            ⚖
          </Link>
        </div>
      </div>
      {showInsight && entry.insight && (
        <div className="xl:hidden px-4 pb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-[11px] leading-relaxed pt-2.5" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
            {entry.insight}
          </p>
        </div>
      )}
      {showInsight && entry.factors && (
        <div className="px-4 pb-3 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-[8px] font-black uppercase tracking-[0.15em] mb-2 pt-2"
            style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
            Desglose Índice Taka
          </p>
          <div className="flex flex-col gap-1.5">
            {([
              { key: 'rendimiento', label: 'Rendimiento', pct: '40%', color: '#22c55e' },
              { key: 'contexto',    label: 'Contexto',    pct: '20%', color: '#60a5fa' },
              { key: 'mediatico',   label: 'Mediático',   pct: '25%', color: '#f59e0b' },
              { key: 'narrativa',   label: 'Narrativa',   pct: '15%', color: '#c084fc' },
            ] as const).map(({ key, label, pct, color }) => {
              const val = entry.factors![key]
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[9px] w-[72px] flex-shrink-0 leading-none"
                    style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                    {label} <span style={{ color: '#3A3A4A' }}>{pct}</span>
                  </span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-1 rounded-full" style={{ width: `${val}%`, background: color, opacity: 0.75 }} />
                  </div>
                  <span className="text-[9px] tabular-nums w-6 text-right flex-shrink-0"
                    style={{ color: '#5A5A72', fontFamily: 'var(--font-display)' }}>
                    {val}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-2.5 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            {(() => {
              const base = Math.round((
                entry.factors!.rendimiento * 0.40 +
                entry.factors!.contexto    * 0.20 +
                entry.factors!.mediatico   * 0.25 +
                entry.factors!.narrativa   * 0.15
              ) * 10) / 10
              const boost = entry.editorialBoost ?? 0
              const total = Math.round(Math.max(0, Math.min(100, base + boost)) * 10) / 10
              return (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
                      Base objetiva
                    </span>
                    <span className="text-[9px] tabular-nums font-bold"
                      style={{ color: '#5A5A72', fontFamily: 'var(--font-display)' }}>
                      {base.toFixed(1)}
                    </span>
                  </div>
                  {boost !== 0 && (
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[9px] leading-snug flex-1"
                        style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
                        📌 Ajuste editorial
                        {entry.editorialNote && (
                          <span className="block" style={{ color: '#2A2A42' }}>&ldquo;{entry.editorialNote}&rdquo;</span>
                        )}
                      </span>
                      <span className="text-[9px] tabular-nums font-bold flex-shrink-0"
                        style={{ color: boost > 0 ? '#22c55e' : '#f87171', fontFamily: 'var(--font-display)' }}>
                        {boost > 0 ? '+' : ''}{boost.toFixed(1)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="text-[9px] font-black uppercase tracking-wider"
                      style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                      Índice Taka
                    </span>
                    <span className="text-[10px] tabular-nums font-black"
                      style={{ color: scoreColor(total), fontFamily: 'var(--font-display)' }}>
                      {total.toFixed(1)}
                    </span>
                  </div>
                </div>
              )
            })()}
          </div>
          <div className="mt-3 pt-2 flex justify-end" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <Link
              href={`/rankings/${entry.id}`}
              onClick={e => e.stopPropagation()}
              className="text-[10px] font-black uppercase tracking-widest transition-all hover:brightness-150"
              style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)' }}
            >
              Ver perfil →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
