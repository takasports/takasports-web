'use client'

import { useEffect, useRef, useState } from 'react'
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

// Compact match summary that sticks to the top of the viewport once the
// full hero scoreboard scrolls out of view. Plays well with the global
// header (h-14, sticky top:0) by sitting at top: 56px.
export function StickyScoreBar(props: Props) {
  const { homeLogo, awayLogo, homeAbbr, awayAbbr, homeScore, awayScore, statusLabel, live, hasScore } = props
  const [visible, setVisible] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0, rootMargin: '-56px 0px 0px 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinelRef} aria-hidden style={{ height: 1, marginTop: -1 }} />
      <div
        aria-hidden={!visible}
        className="transition-opacity duration-200"
        style={{
          position: 'fixed',
          top: 56,
          left: 0,
          right: 0,
          zIndex: 30,
          padding: '8px 16px',
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          background: 'rgba(9,9,15,0.92)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
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
          <div className="flex flex-col items-center flex-shrink-0 min-w-[80px]">
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
    </>
  )
}
