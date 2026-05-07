'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { SPORT_EMOJI, getSportColor, getLiveLabel } from '@/lib/competitions'

interface LiveFixture {
  id: string
  homeTeam: string
  awayTeam: string
  homeGoals: number | null
  awayGoals: number | null
  status: string
  elapsed: number | null
  sport: string
  comp?: string
  homeAbbr?: string
  awayAbbr?: string
  homeLogo?: string
  awayLogo?: string
  matchRef?: string
}

interface UpcomingEvent {
  id: string
  homeTeam: string
  awayTeam: string | null
  time: string
  dateLabel: string
  sport: string
  comp: string
  homeLogo?: string
  awayLogo?: string
  homeAbbr?: string
  awayAbbr?: string
}

const FINISHED = new Set(['FT', 'NS', 'FINAL', 'STATUS_FINAL', 'STATUS_SCHEDULED'])

function TeamLogo({ logo, name, size = 14 }: { logo?: string; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  if (logo && !err) {
    return (
      <img
        src={logo}
        alt={name}
        width={size}
        height={size}
        onError={() => setErr(true)}
        style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
      />
    )
  }
  return null
}

function short(name: string | null | undefined, abbr?: string): string {
  if (!name) return ''
  if (abbr) return abbr
  // fallback: first word up to 4 chars
  return name.split(' ')[0].slice(0, 4)
}

export default function LiveStrip() {
  const [liveFixtures, setLiveFixtures] = useState<LiveFixture[]>([])
  const [upcoming, setUpcoming]         = useState<UpcomingEvent[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch('/api/events/live', { cache: 'no-store' })
      if (!res.ok) return
      const all: LiveFixture[] = await res.json()
      const live = all.filter(f => !FINISHED.has(f.status))
      const seen = new Set<string>()
      setLiveFixtures(live.filter(f => {
        const k = f.id || `${f.homeTeam}|${f.awayTeam}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      }))
    } catch { /* ignore */ }
  }, [])

  const fetchUpcoming = useCallback(async () => {
    try {
      const res = await fetch('/api/events/upcoming', { cache: 'no-store' })
      if (!res.ok) return
      setUpcoming(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchLive()
    fetchUpcoming()
  }, [fetchLive, fetchUpcoming])

  const isLiveRef = useRef(false)
  useEffect(() => {
    const wasLive = isLiveRef.current
    const nowLive = liveFixtures.length > 0
    isLiveRef.current = nowLive
    if (wasLive === nowLive && timerRef.current) return
    if (timerRef.current) clearInterval(timerRef.current)
    const interval = nowLive ? 30_000 : 300_000
    timerRef.current = setInterval(() => { fetchLive(); fetchUpcoming() }, interval)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [liveFixtures.length, fetchLive, fetchUpcoming])

  const isLive = liveFixtures.length > 0

  return (
    <div
      className="w-full"
      style={{ background: 'rgba(9,9,15,0.92)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="max-w-[1440px] mx-auto px-6 xl:px-10">
        <div className="flex items-center h-10 gap-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>

          {/* Label pill */}
          <div
            className="flex items-center gap-1.5 flex-shrink-0 px-2 py-0.5 rounded"
            style={isLive
              ? { background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)' }
              : { background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }
            }
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
              style={{
                background: isLive ? '#4ade80' : '#7C3AED',
                boxShadow: isLive ? '0 0 6px #4ade80' : '0 0 6px #7C3AED',
              }}
            />
            <span
              className="text-[8px] font-black uppercase tracking-[0.2em]"
              style={{ color: isLive ? '#4ade80' : '#9B6DB5', fontFamily: 'var(--font-sport)' }}
            >
              {isLive ? 'En Vivo' : 'Próximo'}
            </span>
          </div>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

          {/* Events */}
          <div className="flex items-center gap-1 overflow-x-auto flex-1" style={{ scrollbarWidth: 'none' }}>
            {isLive
              ? liveFixtures.map((fix, i) => {
                  const col = getSportColor(fix.sport)
                  const inner = (
                    <div className="flex items-center gap-1.5">
                      <TeamLogo logo={fix.homeLogo} name={fix.homeTeam} size={14} />
                      <span className="text-[10px] font-semibold" style={{ color: '#B0B0C8', fontFamily: 'var(--font-sport)' }}>
                        {short(fix.homeTeam, fix.homeAbbr)}
                      </span>
                      <span className="font-black tabular-nums text-[11px]"
                        style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                        {fix.homeGoals ?? 0} – {fix.awayGoals ?? 0}
                      </span>
                      <span className="text-[10px] font-semibold" style={{ color: '#B0B0C8', fontFamily: 'var(--font-sport)' }}>
                        {short(fix.awayTeam, fix.awayAbbr)}
                      </span>
                      <TeamLogo logo={fix.awayLogo} name={fix.awayTeam} size={14} />
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                        style={{ color: col, background: `${col}14`, border: `1px solid ${col}30`, fontFamily: 'var(--font-sport)' }}>
                        {getLiveLabel(fix.status, fix.elapsed)}
                      </span>
                    </div>
                  )
                  return (
                    <div key={fix.id} className="flex items-center gap-3 flex-shrink-0">
                      {i > 0 && <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.07)', flexShrink: 0, display: 'inline-block' }} />}
                      {fix.matchRef
                        ? <Link href={`/partido/${fix.matchRef}`} className="hover:opacity-80 transition-opacity">{inner}</Link>
                        : inner
                      }
                    </div>
                  )
                })
              : upcoming.slice(0, 5).map((ev, i) => {
                  const col = getSportColor(ev.sport)
                  return (
                    <div key={ev.id} className="flex items-center gap-3 flex-shrink-0">
                      {i > 0 && <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.07)', flexShrink: 0, display: 'inline-block' }} />}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{SPORT_EMOJI[ev.sport] ?? '🏆'}</span>
                        <TeamLogo logo={ev.homeLogo} name={ev.homeTeam} size={13} />
                        <span className="text-[10px] font-semibold" style={{ color: '#8A8AA0', fontFamily: 'var(--font-sport)' }}>
                          {ev.awayTeam
                            ? `${short(ev.homeTeam, ev.homeAbbr)} vs ${short(ev.awayTeam, ev.awayAbbr)}`
                            : ev.homeTeam}
                        </span>
                        <TeamLogo logo={ev.awayLogo} name={ev.awayTeam ?? ''} size={13} />
                        <span className="text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded"
                          style={{ color: col, background: `${col}12`, border: `1px solid ${col}25`, fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}>
                          {ev.time}
                        </span>
                        <span className="text-[9px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
                          {ev.dateLabel}
                        </span>
                      </div>
                    </div>
                  )
                })
            }
          </div>

          {/* CTA */}
          <div className="ml-auto flex-shrink-0">
            <Link href="/calendario" className="flex items-center gap-1 transition-opacity hover:opacity-70" style={{ textDecoration: 'none' }}>
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#3A3A5A', fontFamily: 'var(--font-sport)' }}>
                Ver agenda
              </span>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M2 4.5h5M4.5 2.5l2 2-2 2" stroke="#3A3A5A" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
