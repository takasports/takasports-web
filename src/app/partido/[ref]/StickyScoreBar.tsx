'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface Props {
  homeLogo?: string
  awayLogo?: string
  homeAbbr?: string
  awayAbbr?: string
  homeScore?: number | null
  awayScore?: number | null
  statusLabel: string
  live: boolean
  hasScore: boolean
}

// Compact match summary designed to live inside a sticky container next to
// the MatchTabs tab bar. It collapses to 0 height when the hero scoreboard
// is still in view and expands when the user scrolls past it. Detection is
// based on a `[data-match-hero]` element in the DOM.
export function StickyScoreBar(props: Props) {
  const { homeLogo, awayLogo, homeAbbr, awayAbbr, homeScore, awayScore, statusLabel, live, hasScore } = props
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const hero = document.querySelector<HTMLElement>('[data-match-hero]')
    if (!hero) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        // Hero is "passed" when its bottom is above the sticky offset (56px)
        setVisible(!entry.isIntersecting && entry.boundingClientRect.bottom < 80)
      },
      { rootMargin: '-56px 0px 0px 0px', threshold: 0 }
    )
    obs.observe(hero)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      aria-hidden={!visible}
      style={{
        overflow: 'hidden',
        maxHeight: visible ? 56 : 0,
        opacity: visible ? 1 : 0,
        transition: 'max-height 220ms ease, opacity 180ms ease, margin 220ms ease',
        marginBottom: visible ? 8 : 0,
      }}
    >
      <div className="flex items-center justify-between gap-3 py-1.5">
        {/* Home */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
          <span className="text-[11px] font-bold truncate" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {homeAbbr ?? '—'}
          </span>
          {homeLogo
            ? <Image src={homeLogo} alt={homeAbbr ?? ''} width={22} height={22} unoptimized style={{ objectFit: 'contain' }} />
            : <div style={{ width: 22, height: 22, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />}
        </div>

        {/* Center: score + status */}
        <div className="flex flex-col items-center flex-shrink-0 min-w-[84px]">
          {live && (
            <span className="flex items-center gap-1 leading-none">
              <span className="w-1 h-1 rounded-full" style={{ background: '#EF4444', animation: 'live-pulse 1.6s ease-out infinite' }} />
              <span className="text-[9px] font-black uppercase tracking-[0.14em] tabular-nums" style={{ color: '#EF4444', fontFamily: 'var(--font-sport)' }}>
                {statusLabel}
              </span>
            </span>
          )}
          {hasScore ? (
            <span className="font-black tabular-nums flex items-center gap-1.5 leading-none mt-0.5"
              style={{ color: '#F0F0FA', fontFamily: 'var(--font-headline)', fontSize: 22 }}>
              <span>{homeScore}</span>
              <span style={{ color: '#38384A', fontWeight: 400 }}>·</span>
              <span>{awayScore}</span>
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
              {statusLabel}
            </span>
          )}
        </div>

        {/* Away */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {awayLogo
            ? <Image src={awayLogo} alt={awayAbbr ?? ''} width={22} height={22} unoptimized style={{ objectFit: 'contain' }} />
            : <div style={{ width: 22, height: 22, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />}
          <span className="text-[11px] font-bold truncate" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {awayAbbr ?? '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
