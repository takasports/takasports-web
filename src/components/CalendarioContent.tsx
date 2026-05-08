'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { SportEvent } from '@/lib/types'
import { getCompAccent, getLeagueScore, SPORT_EMOJI, getLiveLabel, isTennis, isCombat, isRacing } from '@/lib/competitions'
import { groupEventsByDate, orderedDateKeys, namesMatch, formatDateLabel, isoToLocalDate } from '@/lib/calendar'
import { getStoredTZ, setStoredTZ, SOURCE_TZ } from '@/lib/timezone'
import TimezoneSelector from '@/components/TimezoneSelector'
import UFCCardModal from '@/components/UFCCardModal'
import FavoritesOnboarding from '@/components/FavoritesOnboarding'

// ── Favorites helpers ──────────────────────────────────────────
function isFavorite(favorites: Set<string>, name: string | null | undefined): boolean {
  if (!name || favorites.size === 0) return false
  const lower = name.toLowerCase()
  for (const fav of favorites) {
    const f = fav.toLowerCase()
    if (lower.includes(f) || f.includes(lower)) return true
  }
  return false
}

function eventHasFavorite(favorites: Set<string>, ev: SportEvent): boolean {
  return isFavorite(favorites, ev.home) || isFavorite(favorites, ev.away)
}

interface RawLiveFixture {
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
  homePhoto?: string
  awayPhoto?: string
  matchRef?: string
  clock?: string
}

interface LiveScore {
  homeGoals: number | null
  awayGoals: number | null
  status: string
  elapsed: number | null
  clock?: string   // current set score for tennis e.g. "4-2"
}

const FINISHED = new Set(['FT', 'Final', 'STATUS_FINAL', 'NS'])

// ─── Hooks ────────────────────────────────────────────────────────────────
function useLiveFixtures() {
  const [fixtures, setFixtures] = useState<RawLiveFixture[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/events/live', { cache: 'no-store' })
      if (!res.ok) return
      const data: RawLiveFixture[] = await res.json()
      setFixtures(data.filter(f => !FINISHED.has(f.status)))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetch_()
    timerRef.current = setInterval(fetch_, 30_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetch_])

  return fixtures
}

function useLiveScores(events: SportEvent[]) {
  const [scores, setScores] = useState<Map<string, LiveScore>>(new Map())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/events/live', { cache: 'no-store' })
      if (!res.ok) return
      const fixtures: RawLiveFixture[] = await res.json()
      const byRef = new Map<string, RawLiveFixture>()
      for (const f of fixtures) if (f.matchRef) byRef.set(f.matchRef, f)
      const next = new Map<string, LiveScore>()
      for (const ev of events) {
        const m = (ev.matchRef && byRef.get(ev.matchRef))
              ?? fixtures.find(f => namesMatch(f.homeTeam, ev.home) && namesMatch(f.awayTeam, ev.away ?? ''))
        if (m) {
          next.set(ev.id, {
            homeGoals: m.homeGoals,
            awayGoals: m.awayGoals,
            status:    m.status,
            elapsed:   m.elapsed,
            clock:     m.clock,
          })
        }
      }
      setScores(next)
    } catch { /* ignore */ }
  }, [events])

  useEffect(() => {
    fetch_()
    timerRef.current = setInterval(fetch_, 30_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetch_])

  return scores
}

// ─── Utilities ────────────────────────────────────────────────────────────
function TeamLogo({ logo, photo, name, size = 24, sport }: { logo?: string; photo?: string; name: string; size?: number; sport?: string }) {
  const [err, setErr] = useState(false)
  const displayPhoto = photo && !err

  if (displayPhoto) {
    return (
      <img src={photo} alt={name} width={size} height={size} onError={() => setErr(true)}
        style={{ width: size, height: size, objectFit: 'cover', borderRadius: '50%', flexShrink: 0 }} />
    )
  }

  if (!logo || err) {
    const tennis = sport ? isTennis(sport) : false
    const combat = sport ? isCombat(sport) : false
    return (
      <div className="flex items-center justify-center rounded-full font-black flex-shrink-0"
        style={{
          width: size, height: size,
          fontSize: size * 0.36,
          background: combat ? 'rgba(212,175,55,0.14)' : tennis ? 'rgba(217,119,6,0.14)' : 'rgba(255,255,255,0.06)',
          color: combat ? '#D4AF37' : tennis ? '#FBBF24' : '#7A7A8E',
          border: combat ? '1px solid rgba(212,175,55,0.25)' : tennis ? '1px solid rgba(251,191,36,0.25)' : 'none',
        }}>
        {combat || tennis ? initials(name) : name.slice(0, 2).toUpperCase()}
      </div>
    )
  }
  return (
    <img src={logo} alt={name} width={size} height={size} onError={() => setErr(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />
  )
}

// Initials from a player name: "Carlos Alcaraz" → "CA", "Heliovaara / Patten" → "HP"
function initials(name: string): string {
  const cleaned = name.replace(/\s*\/\s*/g, ' ').trim()
  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function ReminderButton({ active, onClick, color = '#7C3AED', size = 'md' }: {
  active: boolean; onClick: () => void; color?: string; size?: 'sm' | 'md'
}) {
  const dim = size === 'sm' ? 24 : 28
  const icon = size === 'sm' ? 11 : 13
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick() }}
      className="flex items-center justify-center rounded-md transition-all flex-shrink-0"
      style={{
        width: dim, height: dim,
        background: active ? `${color}1F` : 'rgba(255,255,255,0.04)',
        border: active ? `1px solid ${color}55` : '1px solid rgba(255,255,255,0.06)',
      }}
      aria-label={active ? 'Quitar recordatorio' : 'Recordar'}
    >
      <svg width={icon} height={icon} viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5A4.5 4.5 0 003.5 6v2.5L2 10.5h12L12.5 8.5V6A4.5 4.5 0 008 1.5z"
          stroke={active ? color : '#5A5A6A'} strokeWidth="1.3"
          fill={active ? color : 'none'} fillOpacity={active ? 0.25 : 0} />
      </svg>
    </button>
  )
}

// Truncate-friendly short name (last word for multi-word names)
function shortName(name: string | null | undefined, abbr?: string): string {
  if (!name) return ''
  if (abbr) return abbr
  const words = name.split(' ')
  return words.length > 1 ? words[words.length - 1] : name
}

// Returns "en 2h" / "en 45m" when match is within 12h, null otherwise
function timeUntilLabel(isoDate: string | undefined): string | null {
  if (!isoDate) return null
  const diff = new Date(isoDate).getTime() - Date.now()
  if (diff <= 0 || diff > 12 * 60 * 60 * 1000) return null
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `en ${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `en ${h}h ${m}m` : `en ${h}h`
}

// ─── Hero Card (live ticker) ──────────────────────────────────────────────
interface HeroProps {
  homeTeam: string
  awayTeam: string
  homeAbbr?: string
  awayAbbr?: string
  homeLogo?: string
  awayLogo?: string
  homePhoto?: string
  awayPhoto?: string
  homeScore: number | null
  awayScore: number | null
  status: string
  elapsed: number | null
  sport: string
  comp?: string
  matchRef?: string
  broadcast?: string
  flashing?: boolean
  isReminded: boolean
  onToggleReminder: () => void
}

function LiveHeroCard(p: HeroProps) {
  const compColor = getCompAccent(p.comp ?? '', '#4ade80')
  const tennis = isTennis(p.sport)
  const racing = isRacing(p.sport)
  const liveLabel = getLiveLabel(p.status, p.elapsed, {
    sport: p.sport,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
  })

  const inner = (
    <div
      className={`relative rounded-xl overflow-hidden flex flex-col transition-all hover:brightness-110 ${p.flashing ? 'ts-flash' : ''}`}
      style={{
        width: 300,
        flexShrink: 0,
        background: 'linear-gradient(145deg, rgba(74,222,128,0.10) 0%, rgba(20,30,25,0.85) 60%, rgba(15,15,22,0.9) 100%)',
        border: '1px solid rgba(74,222,128,0.25)',
        boxShadow: '0 0 24px rgba(74,222,128,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Halo animado */}
      <span aria-hidden className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(74,222,128,0.18) 0%, transparent 70%)', filter: 'blur(8px)' }} />

      {/* Header */}
      <div className="relative flex items-center justify-between px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase"
            style={{ background: 'rgba(74,222,128,0.18)', color: '#4ade80', fontFamily: 'var(--font-sport)', letterSpacing: '0.1em' }}>
            <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
            EN VIVO
          </span>
          {tennis && <span className="text-[10px]">🎾</span>}
          <span className="text-[8.5px] font-bold uppercase tracking-wider truncate"
            style={{ color: compColor, fontFamily: 'var(--font-sport)', maxWidth: 140 }}>
            {p.comp}
          </span>
        </div>
        <span className="text-[8.5px] font-black uppercase tabular-nums px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ color: '#4ade80', background: 'rgba(74,222,128,0.10)', fontFamily: 'var(--font-display)' }}>
          {liveLabel}
        </span>
      </div>

      {/* Body: Home — Score — Away */}
      <div className="relative flex items-center px-3.5 py-3 gap-2">
        {/* Home */}
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <TeamLogo logo={p.homeLogo} photo={p.homePhoto} name={p.homeTeam} size={36} sport={p.sport} />
          <span className="text-[10px] font-black truncate w-full text-center" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {shortName(p.homeTeam, p.homeAbbr)}
          </span>
        </div>

        {/* Score */}
        <div className="flex flex-col items-center justify-center flex-shrink-0 px-1 gap-0.5">
          {racing ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-black uppercase tracking-[0.15em]"
                style={{ color: '#4ade80', fontFamily: 'var(--font-sport)' }}>
                🏎 EN CARRERA
              </span>
              <span className="text-[11px] font-bold text-center"
                style={{ color: '#C0C0D4', fontFamily: 'var(--font-sport)', maxWidth: 80 }}>
                {p.comp}
              </span>
            </div>
          ) : (
            <>
              {tennis && (
                <span className="text-[7.5px] font-black uppercase tracking-[0.2em]"
                  style={{ color: '#FBBF24', fontFamily: 'var(--font-sport)' }}>
                  Sets
                </span>
              )}
              <div className="flex items-center gap-2">
                <span className="font-black tabular-nums leading-none"
                  style={{ fontSize: 28, color: '#4ade80', fontFamily: 'var(--font-display)', textShadow: '0 0 12px rgba(74,222,128,0.4)' }}>
                  {p.homeScore ?? 0}
                </span>
                <span className="text-[16px] font-light leading-none" style={{ color: '#3A3A4A' }}>—</span>
                <span className="font-black tabular-nums leading-none"
                  style={{ fontSize: 28, color: '#4ade80', fontFamily: 'var(--font-display)', textShadow: '0 0 12px rgba(74,222,128,0.4)' }}>
                  {p.awayScore ?? 0}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Away */}
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <TeamLogo logo={p.awayLogo} photo={p.awayPhoto} name={p.awayTeam} size={36} sport={p.sport} />
          <span className="text-[10px] font-black truncate w-full text-center" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {shortName(p.awayTeam, p.awayAbbr)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="relative flex items-center justify-between px-3.5 pb-3 pt-1 gap-2 border-t" style={{ borderColor: 'rgba(74,222,128,0.12)' }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[9px] font-semibold uppercase tracking-wider truncate" style={{ color: '#7A8A7E', fontFamily: 'var(--font-sport)' }}>
            {p.matchRef ? 'Ver detalles →' : p.sport}
          </span>
          <BroadcastChip broadcast={p.broadcast} />
        </div>
        <ReminderButton active={p.isReminded} onClick={p.onToggleReminder} color="#4ade80" size="sm" />
      </div>
    </div>
  )

  return p.matchRef
    ? <Link href={`/partido/${p.matchRef}`} className="block no-underline">{inner}</Link>
    : inner
}

// ─── Favorite heart (toggles team in localStorage favorites) ──────────────
function FavoriteHeart({ active, onClick, size = 14 }: {
  active: boolean
  onClick: () => void
  size?: number
}) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick() }}
      className="flex items-center justify-center transition-all flex-shrink-0"
      style={{ width: size + 8, height: size + 8, cursor: 'pointer', background: 'transparent', border: 'none' }}
      aria-label={active ? 'Quitar de favoritos' : 'Añadir a favoritos'}
    >
      <svg width={size} height={size} viewBox="0 0 16 16" fill={active ? '#F472B6' : 'none'}>
        <path d="M8 13.5s-5-3-5-7a3 3 0 015-2 3 3 0 015 2c0 4-5 7-5 7z"
          stroke={active ? '#F472B6' : '#5A5A6A'} strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

// ─── Broadcast chip (where to watch) ──────────────────────────────────────
function BroadcastChip({ broadcast }: { broadcast?: string }) {
  if (!broadcast) return null
  return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide"
      style={{ background: 'rgba(99,102,241,0.10)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.20)', fontFamily: 'var(--font-sport)' }}>
      <span>📺</span>
      <span className="truncate max-w-[80px]">{broadcast}</span>
    </span>
  )
}

// ─── Skeleton row (loading state) ─────────────────────────────────────────
function SkeletonRow() {
  return (
    <div
      className="grid items-center gap-3 px-3 py-2.5 rounded-lg animate-pulse"
      style={{
        gridTemplateColumns: '92px 1fr auto auto',
        background: 'rgba(255,255,255,0.025)',
        borderLeft: '3px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex flex-col gap-1">
        <div style={{ height: 8, width: 36, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }} />
        <div style={{ height: 8, width: 60, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }} />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <div style={{ width: 16, height: 16, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
          <div style={{ height: 10, width: '60%', background: 'rgba(255,255,255,0.07)', borderRadius: 3 }} />
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 16, height: 16, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
          <div style={{ height: 10, width: '50%', background: 'rgba(255,255,255,0.07)', borderRadius: 3 }} />
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div style={{ height: 10, width: 40, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }} />
      </div>
      <div style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.05)', borderRadius: 6 }} />
    </div>
  )
}

// ─── Compact list row (non-live or in TODOS) ──────────────────────────────
function MatchRow({ event, liveScore, isReminded, onToggleReminder, dateLabel, onClickUFC, flashing, isFav, onToggleFav }: {
  event: SportEvent
  liveScore?: LiveScore
  isReminded: boolean
  onToggleReminder: () => void
  dateLabel?: string
  onClickUFC?: (date: string) => void
  flashing?: boolean
  isFav?: boolean
  onToggleFav?: () => void
}) {
  const isLive  = !!liveScore && !FINISHED.has(liveScore.status)
  const isFinal = !!liveScore && (liveScore.status === 'FT' || liveScore.status === 'Final' || liveScore.status === 'STATUS_FINAL') && liveScore.homeGoals !== null
  const showScore = isLive || isFinal
  const compColor = getCompAccent(event.comp, event.accent)
  const accent = isLive ? '#4ade80' : isFinal ? compColor : compColor
  const tennis = isTennis(event.sport)
  const combat = isCombat(event.sport)
  const racing = isRacing(event.sport)
  const eventDate = event.isoDate ? isoToLocalDate(event.isoDate) : null
  const countdown = !isLive && !isFinal ? timeUntilLabel(event.isoDate) : null

  const inner = (
    <div
      className={`grid items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:brightness-125 ${flashing ? 'ts-flash' : ''}`}
      style={{
        gridTemplateColumns: '92px 1fr auto auto',
        background: isLive ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.025)',
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[8px] font-black uppercase tracking-wider truncate" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
          {event.sport.slice(0, 3)}
        </span>
        <span className="text-[8.5px] font-semibold truncate" style={{ color: '#9090A8', fontFamily: 'var(--font-sport)' }}>
          {event.comp}
        </span>
        {event.broadcast && (
          <span className="text-[7.5px] truncate flex items-center gap-0.5" style={{ color: '#A5B4FC', fontFamily: 'var(--font-sport)' }}>
            <span>📺</span>{event.broadcast}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <TeamLogo logo={event.homeLogo} photo={event.homePhoto} name={event.home} size={16} sport={event.sport} />
          <span className="text-[11px] font-bold truncate" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {event.home}
          </span>
          {isFav && <span className="text-[9px]" style={{ color: '#F472B6' }}>♥</span>}
        </div>
        {event.away && (
          <div className="flex items-center gap-1.5 min-w-0">
            <TeamLogo logo={event.awayLogo} photo={event.awayPhoto} name={event.away} size={16} sport={event.sport} />
            <span className="text-[11px] font-bold truncate" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
              {event.away}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-0.5 flex-shrink-0 min-w-[52px]">
        {showScore && liveScore ? (
          racing ? (
            <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#4ade80', fontFamily: 'var(--font-sport)' }}>
              {isLive ? 'LIVE' : 'FIN'}
            </span>
          ) : (
            <>
              {tennis && (
                <span className="text-[7px] font-black uppercase tracking-[0.2em] leading-none"
                  style={{ color: isFinal ? '#9090A8' : '#FBBF24', fontFamily: 'var(--font-sport)' }}>
                  {liveScore.clock ? liveScore.clock : 'Sets'}
                </span>
              )}
              <span className="text-[12px] font-black tabular-nums leading-none"
                style={{ color: isLive ? '#4ade80' : '#C0C0D8', fontFamily: 'var(--font-display)' }}>
                {liveScore.homeGoals ?? 0}
              </span>
              <span className="text-[12px] font-black tabular-nums leading-none"
                style={{ color: isLive ? '#4ade80' : '#C0C0D8', fontFamily: 'var(--font-display)' }}>
                {liveScore.awayGoals ?? 0}
              </span>
            </>
          )
        ) : (
          <>
            {dateLabel && (
              <span className="text-[8px] font-black uppercase tracking-wider leading-none"
                style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                {dateLabel}
              </span>
            )}
            <span className="text-[11px] font-bold tabular-nums leading-none"
              style={{ color: countdown ? '#4ade80' : '#B0B0C8', fontFamily: 'var(--font-display)' }}>
              {countdown ?? event.time}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isLive && liveScore && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase"
            style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', fontFamily: 'var(--font-sport)' }}>
            <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
            {getLiveLabel(liveScore.status, liveScore.elapsed, {
              sport: event.sport,
              homeScore: liveScore.homeGoals,
              awayScore: liveScore.awayGoals,
            })}
          </span>
        )}
        {isFinal && (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#6A6A80', fontFamily: 'var(--font-sport)' }}>
            Final
          </span>
        )}
        {onToggleFav && <FavoriteHeart active={!!isFav} onClick={onToggleFav} />}
        <ReminderButton active={isReminded} onClick={onToggleReminder} color={event.accent} />
      </div>
    </div>
  )

  if (combat && eventDate && onClickUFC) {
    return (
      <div onClick={() => onClickUFC(eventDate)} className="cursor-pointer">
        {inner}
      </div>
    )
  }

  if (event.matchRef)
    return <Link href={`/partido/${event.matchRef}`} className="block no-underline">{inner}</Link>

  if (event.source === 'sanity')
    return <Link href={`/evento/${event.id}`} className="block no-underline">{inner}</Link>

  return inner
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex items-center flex-1" style={{ maxWidth: 280 }}>
      <svg className="absolute left-3 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.3" opacity="0.5" />
        <path d="M8.5 8.5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
      </svg>
      <input
        type="text"
        placeholder="Buscar equipo..."
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-8 pr-3 py-2 rounded-lg text-[11px] font-medium outline-none"
        style={{
          background: value ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.04)',
          border: value ? '1px solid rgba(124,58,237,0.25)' : '1px solid rgba(255,255,255,0.06)',
          color: '#D0D0E8',
          transition: 'all 0.15s ease',
        }}
      />
    </div>
  )
}

function SectionHeader({ icon, label, color, count, hint }: {
  icon: string; label: string; color: string; count?: number; hint?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <span className="text-[12px]">{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-[0.18em]"
        style={{ color, fontFamily: 'var(--font-sport)' }}>
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black"
          style={{ background: `${color}22`, color, fontFamily: 'var(--font-display)' }}>
          {count}
        </span>
      )}
      {hint && (
        <span className="text-[9px] ml-auto" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
          {hint}
        </span>
      )}
    </div>
  )
}

// Horizontal scrollable strip of live hero cards
function LiveHeroStrip({ items }: { items: React.ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    if (!ref.current) return
    ref.current.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scroll-smooth"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((item, i) => <div key={i}>{item}</div>)}
      </div>
      {items.length > 3 && (
        <>
          <button
            onClick={() => scroll('left')}
            className="hidden md:flex items-center justify-center absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full transition-all hover:scale-110"
            style={{
              background: 'rgba(20,20,30,0.85)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
            }}
            aria-label="Anterior"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="#C0C0D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => scroll('right')}
            className="hidden md:flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full transition-all hover:scale-110"
            style={{
              background: 'rgba(20,20,30,0.85)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
            }}
            aria-label="Siguiente"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 6l6 6-6 6" stroke="#C0C0D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}

// Custom calendar dropdown
function CalendarDropdown({ value, eventDays, onChange, onClose, anchorRect }: {
  value: string | null
  eventDays: Set<string>
  onChange: (k: string) => void
  onClose: () => void
  anchorRect: DOMRect | null
}) {
  const today = isoToLocalDate(new Date().toISOString())
  const initMonth = value ?? today

  const [month, setMonth] = useState(() => initMonth.slice(0, 7)) // 'YYYY-MM'

  const DAYS_ES  = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
  const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  const [y, m] = month.split('-').map(Number)

  const firstDay = new Date(Date.UTC(y, m - 1, 1))
  // Monday-first: getUTCDay() → 0=Sun,1=Mon…; convert to Mon-first
  const startOffset = (firstDay.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()

  const prevMonth = () => {
    const d = new Date(Date.UTC(y, m - 2, 1))
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const d = new Date(Date.UTC(y, m, 1))
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  if (typeof window === 'undefined') return null

  const PANEL_W = 252
  const margin = 8
  const top = anchorRect ? anchorRect.bottom + 6 : 80
  let left = anchorRect ? anchorRect.left : margin
  if (left + PANEL_W + margin > window.innerWidth) {
    left = Math.max(margin, window.innerWidth - PANEL_W - margin)
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed z-[9999] rounded-xl p-3"
        style={{
          top,
          left,
          width: PANEL_W,
          background: 'linear-gradient(135deg, rgba(18,18,28,0.98) 0%, rgba(12,12,20,0.99) 100%)',
          border: '1px solid rgba(124,58,237,0.25)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
          backdropFilter: 'blur(12px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prevMonth}
            className="flex items-center justify-center w-6 h-6 rounded-md transition-all hover:brightness-125"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#9090A8' }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 2L4 6l3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span
            className="text-[11px] font-black uppercase tracking-widest"
            style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}
          >
            {MONTHS_ES[m - 1]} {y}
          </span>
          <button
            onClick={nextMonth}
            className="flex items-center justify-center w-6 h-6 rounded-md transition-all hover:brightness-125"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#9090A8' }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 2L8 6l-3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_ES.map(d => (
            <div
              key={d}
              className="text-center text-[8px] font-black uppercase tracking-widest py-0.5"
              style={{ color: '#4A4A5E', fontFamily: 'var(--font-sport)' }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />
            const iso = `${month}-${String(day).padStart(2, '0')}`
            const isToday    = iso === today
            const isSelected = iso === value
            const hasEvents  = eventDays.has(iso)
            const isPast     = iso < today

            return (
              <button
                key={iso}
                onClick={() => { onChange(iso); onClose() }}
                className="relative flex flex-col items-center justify-center rounded-lg transition-all"
                style={{
                  height: 30,
                  background: isSelected
                    ? 'rgba(124,58,237,0.35)'
                    : isToday
                      ? 'rgba(124,58,237,0.12)'
                      : 'transparent',
                  border: isSelected
                    ? '1px solid rgba(124,58,237,0.7)'
                    : isToday
                      ? '1px solid rgba(124,58,237,0.3)'
                      : '1px solid transparent',
                  color: isSelected
                    ? '#E0D0FF'
                    : isPast
                      ? '#3A3A4E'
                      : hasEvents
                        ? '#D0D0F0'
                        : '#6A6A80',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-sport)', lineHeight: 1 }}>
                  {day}
                </span>
                {hasEvents && !isSelected && (
                  <div
                    className="absolute"
                    style={{
                      bottom: 4,
                      width: 3,
                      height: 3,
                      borderRadius: '50%',
                      background: isToday ? '#C4B5FD' : '#7C3AED',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>,
    document.body
  )
}

// Horizontal chips strip to filter by day
function DayChips({ days, value, onChange }: {
  days: { key: string; label: string; count: number }[]
  value: string | null
  onChange: (k: string | null) => void
}) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const calBtnRef = useRef<HTMLButtonElement | null>(null)

  const today = isoToLocalDate(new Date().toISOString())
  const tomorrow = (() => {
    const d = new Date(today + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().split('T')[0]
  })()

  const eventDays = useMemo(() => new Set(days.map(d => d.key)), [days])
  const isCalActive = showCalendar || (value !== null && value !== today && value !== tomorrow)

  const chipStyle = (active: boolean) => ({
    background: active ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
    color: active ? '#C4B5FD' : '#7A7A8E',
    border: active ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)',
    fontFamily: 'var(--font-sport)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  })

  return (
    <div className="flex items-center gap-1.5 pb-1" style={{ position: 'relative' }}>
      {(['Todos', 'Hoy', 'Mañana'] as const).map(label => {
        const key = label === 'Todos' ? null : label === 'Hoy' ? today : tomorrow
        const active = value === key
        return (
          <button
            key={label}
            onClick={() => { onChange(key); setShowCalendar(false) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0"
            style={chipStyle(active)}
          >
            {label}
          </button>
        )
      })}

      <div style={{ position: 'relative' }}>
        <button
          ref={calBtnRef}
          onClick={() => {
            if (calBtnRef.current) setAnchorRect(calBtnRef.current.getBoundingClientRect())
            setShowCalendar(v => !v)
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0"
          style={chipStyle(isCalActive)}
        >
          {isCalActive && value && value !== today && value !== tomorrow
            ? (() => { const d = new Date(value + 'T12:00:00Z'); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}` })()
            : '📅 Calendario'
          }
        </button>

        {showCalendar && (
          <CalendarDropdown
            value={value}
            eventDays={eventDays}
            onChange={v => { onChange(v); setShowCalendar(false) }}
            onClose={() => setShowCalendar(false)}
            anchorRect={anchorRect}
          />
        )}
      </div>
    </div>
  )
}

// ── Past result row (compact, for resultados tab) ─────────────────────────
function PastMatchRow({ event, isFav, onToggleFav }: {
  event: SportEvent
  isFav?: boolean
  onToggleFav?: () => void
}) {
  const compColor = getCompAccent(event.comp, event.accent)
  const hs = event.homeScore
  const as_ = event.awayScore
  const hasScore = hs !== null && hs !== undefined && as_ !== null && as_ !== undefined

  const inner = (
    <div
      className="grid items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:brightness-125"
      style={{
        gridTemplateColumns: '92px 1fr auto auto',
        background: 'rgba(255,255,255,0.025)',
        borderLeft: `3px solid ${compColor}`,
      }}
    >
      {/* Sport / comp / date */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[8px] font-black uppercase tracking-wider truncate" style={{ color: compColor, fontFamily: 'var(--font-sport)' }}>
          {event.sport.slice(0, 3)}
        </span>
        <span className="text-[8.5px] font-semibold truncate" style={{ color: '#9090A8', fontFamily: 'var(--font-sport)' }}>
          {event.comp}
        </span>
        <span className="text-[8px] truncate" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
          {event.date}
        </span>
      </div>

      {/* Teams */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <TeamLogo logo={event.homeLogo} name={event.home} size={16} sport={event.sport} />
          <span className="text-[11px] font-bold truncate" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {event.home}
          </span>
        </div>
        {event.away && (
          <div className="flex items-center gap-1.5 min-w-0">
            <TeamLogo logo={event.awayLogo} name={event.away} size={16} sport={event.sport} />
            <span className="text-[11px] font-bold truncate" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
              {event.away}
            </span>
          </div>
        )}
      </div>

      {/* Score */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0 min-w-[44px]">
        {hasScore ? (
          <>
            <span className="text-[14px] font-black tabular-nums leading-none" style={{ color: '#E0E0F4', fontFamily: 'var(--font-display)' }}>
              {hs}
            </span>
            <span className="text-[14px] font-black tabular-nums leading-none" style={{ color: '#E0E0F4', fontFamily: 'var(--font-display)' }}>
              {as_}
            </span>
          </>
        ) : (
          <span className="text-[11px] font-bold" style={{ color: '#5A5A6A', fontFamily: 'var(--font-display)' }}>–</span>
        )}
      </div>

      {/* FT badge + fav */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#6A6A80', fontFamily: 'var(--font-sport)' }}>
          FT
        </span>
        {onToggleFav && <FavoriteHeart active={!!isFav} onClick={onToggleFav} />}
      </div>
    </div>
  )

  if (event.matchRef)
    return <Link href={`/partido/${event.matchRef}`} className="block no-underline">{inner}</Link>
  return inner
}

// ─── Main ─────────────────────────────────────────────────────────────────
type ViewType = 'destacados' | 'todos' | 'en-vivo' | 'resultados' | 'recordatorios'

export default function CalendarioContent({ events, pastEvents = [] }: { events: SportEvent[]; pastEvents?: SportEvent[] }) {
  const [view, setView] = useState<ViewType>('destacados')
  const [tz, setTz] = useState<string>(SOURCE_TZ)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('Todo')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)   // YYYY-MM-DD or null for all
  const [selectedUFCDate, setSelectedUFCDate] = useState<string | null>(null) // UFC modal date
  const [reminders, setReminders] = useState<Set<string>>(new Set())
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [onlyLive, setOnlyLive] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set())
  const [hasLoaded, setHasLoaded] = useState(false)
  const notifTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const prevScoresRef = useRef<Map<string, string>>(new Map())

  const liveScores = useLiveScores(events)
  const liveFixtures = useLiveFixtures()

  useEffect(() => {
    setTz(getStoredTZ())
    try {
      // ── Reminders / favorites / onboarding ─────────────────────
      const stored = JSON.parse(localStorage.getItem('ts_reminders') ?? '[]')
      setReminders(new Set(stored))
      const favs = JSON.parse(localStorage.getItem('ts_favorites') ?? '[]')
      setFavorites(new Set(favs))
      const onboarded = localStorage.getItem('ts_onboarded')
      if (!onboarded) setShowOnboarding(true)

      // ── Restore prefs: URL takes priority over localStorage ─────
      const params = new URLSearchParams(window.location.search)

      const urlView   = params.get('v') as ViewType | null
      const urlSport  = params.get('sport')
      const urlDate   = params.get('d')

      const savedView  = (localStorage.getItem('ts_cal_view') as ViewType | null)
      const savedSport = localStorage.getItem('ts_cal_sport')

      if (urlView && ['destacados','todos','en-vivo','resultados','recordatorios'].includes(urlView)) {
        setView(urlView)
      } else if (savedView) {
        setView(savedView)
      }

      if (urlSport) setActiveFilter(urlSport)
      else if (savedSport) setActiveFilter(savedSport)

      if (urlDate) setSelectedDate(urlDate)
    } catch { /* ignore */ }
    const timers = notifTimers.current
    return () => timers.forEach(t => clearTimeout(t))
  }, [])

  // ── Sync view/sport/date → URL + localStorage ─────────────────────
  useEffect(() => {
    try {
      localStorage.setItem('ts_cal_view', view)
      localStorage.setItem('ts_cal_sport', activeFilter)
      const params = new URLSearchParams(window.location.search)
      if (view !== 'destacados') params.set('v', view); else params.delete('v')
      if (activeFilter !== 'Todo') params.set('sport', activeFilter); else params.delete('sport')
      if (selectedDate) params.set('d', selectedDate); else params.delete('d')
      const qs = params.toString()
      const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
      window.history.replaceState(null, '', newUrl)
    } catch { /* ignore */ }
  }, [view, activeFilter, selectedDate])

  // Mark first liveScores arrival so we can hide skeletons
  useEffect(() => {
    if (!hasLoaded) {
      const t = setTimeout(() => setHasLoaded(true), 400)
      return () => clearTimeout(t)
    }
  }, [hasLoaded])

  // Detect score changes → trigger flash animation
  useEffect(() => {
    const newFlashes: string[] = []
    liveScores.forEach((score, id) => {
      const sig = `${score.homeGoals}-${score.awayGoals}-${score.status}`
      const prev = prevScoresRef.current.get(id)
      if (prev && prev !== sig) {
        newFlashes.push(id)
      }
      prevScoresRef.current.set(id, sig)
    })
    if (newFlashes.length > 0) {
      setFlashIds(prev => {
        const next = new Set(prev)
        newFlashes.forEach(id => next.add(id))
        return next
      })
      setTimeout(() => {
        setFlashIds(prev => {
          const next = new Set(prev)
          newFlashes.forEach(id => next.delete(id))
          return next
        })
      }, 1500)
    }
  }, [liveScores])

  const toggleFavorite = useCallback((name: string) => {
    if (!name) return
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      localStorage.setItem('ts_favorites', JSON.stringify([...next]))
      return next
    })
  }, [])

  const finishOnboarding = useCallback((selectedTeams: string[]) => {
    const next = new Set(selectedTeams)
    setFavorites(next)
    localStorage.setItem('ts_favorites', JSON.stringify([...next]))
    localStorage.setItem('ts_onboarded', '1')
  }, [])

  const skipOnboarding = useCallback(() => {
    localStorage.setItem('ts_onboarded', '1')
    setShowOnboarding(false)
  }, [])

  // Request browser notification permission on first reminder
  const requestNotifPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }, [])

  // Fire browser notification when reminded match is ≤15 min away
  const scheduleNotif = useCallback((id: string) => {
    const event = events.find(e => e.id === id)
    if (!event?.isoDate) return
    const diff = new Date(event.isoDate).getTime() - Date.now()
    const notifyAt = diff - 10 * 60_000 // 10 min before
    if (notifyAt <= 0 || notifyAt > 24 * 60 * 60_000) return
    const timer = setTimeout(() => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('🔔 Partido próximo — TakaSports', {
          body: `${event.home}${event.away ? ` vs ${event.away}` : ''} empieza en ~10 min`,
          icon: '/favicon.ico',
          tag: id,
        })
      }
    }, notifyAt)
    notifTimers.current.set(id, timer)
  }, [events])

  const toggleReminder = useCallback((id: string) => {
    setReminders(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        const timer = notifTimers.current.get(id)
        if (timer) clearTimeout(timer)
        notifTimers.current.delete(id)
      } else {
        next.add(id)
        requestNotifPermission().then(() => scheduleNotif(id))
      }
      localStorage.setItem('ts_reminders', JSON.stringify([...next]))
      window.dispatchEvent(new CustomEvent('ts-reminders-change'))
      return next
    })
  }, [requestNotifPermission, scheduleNotif])

  const sports = ['Todo', ...new Set([...events, ...pastEvents].map(e => e.sport)).values()]

  const filtered = useMemo(() => {
    const matchesSearch = (e: SportEvent) =>
      !search || namesMatch(e.home, search) || (e.away ? namesMatch(e.away, search) : false)
    const matchesSport = (e: SportEvent) =>
      activeFilter === 'Todo' || e.sport === activeFilter
    const matchesDate = (e: SportEvent) => {
      if (!selectedDate) return true
      if (!e.isoDate) return false
      return isoToLocalDate(e.isoDate) === selectedDate
    }
    const matchesLive = (e: SportEvent) => {
      if (!onlyLive) return true
      const score = liveScores.get(e.id)
      return !!score && !FINISHED.has(score.status)
    }
    return events.filter(e => matchesSport(e) && matchesSearch(e) && matchesDate(e) && matchesLive(e))
  }, [events, search, activeFilter, selectedDate, onlyLive, liveScores])

  // Upcoming events featuring favorite teams (across all dates)
  const favoriteEvents = useMemo(() => {
    if (favorites.size === 0) return []
    const now = Date.now()
    return events
      .filter(e => eventHasFavorite(favorites, e))
      .filter(e => !e.isoDate || new Date(e.isoDate).getTime() >= now - 3 * 60 * 60_000)
      .sort((a, b) => (a.isoDate ?? '').localeCompare(b.isoDate ?? ''))
      .slice(0, 8)
  }, [events, favorites])

  const hasActiveFilters = !!selectedDate || activeFilter !== 'Todo' || !!search || onlyLive
  const clearFilters = useCallback(() => {
    setSelectedDate(null)
    setActiveFilter('Todo')
    setSearch('')
    setOnlyLive(false)
  }, [])

  // Days available with events (for the chip strip) — sport+search aware, not date-filtered
  const availableDays = useMemo(() => {
    const matchesSearch = (e: SportEvent) =>
      !search || namesMatch(e.home, search) || (e.away ? namesMatch(e.away, search) : false)
    const matchesSport = (e: SportEvent) =>
      activeFilter === 'Todo' || e.sport === activeFilter
    const counts: Record<string, number> = {}
    for (const e of events) {
      if (!matchesSport(e) || !matchesSearch(e) || !e.isoDate) continue
      const k = isoToLocalDate(e.isoDate)
      counts[k] = (counts[k] ?? 0) + 1
    }
    const today = isoToLocalDate(new Date().toISOString())
    return Object.keys(counts)
      .filter(k => k >= today)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 14)
      .map(k => ({ key: k, label: formatDateLabel(k), count: counts[k] }))
  }, [events, search, activeFilter])

  const liveEventsInList = useMemo(
    () => filtered.filter(e => liveScores.has(e.id) && !FINISHED.has(liveScores.get(e.id)?.status ?? '')),
    [filtered, liveScores]
  )

  const topUpcoming = useMemo(() => {
    const liveIds = new Set(liveEventsInList.map(e => e.id))
    const list = filtered
      .filter(e => !liveIds.has(e.id))
      .sort((a, b) => {
        if (selectedDate) {
          return (a.isoDate ?? '').localeCompare(b.isoDate ?? '')
        }
        const sA = getLeagueScore(a.comp)
        const sB = getLeagueScore(b.comp)
        if (sA !== sB) return sB - sA
        return (a.isoDate ?? '').localeCompare(b.isoDate ?? '')
      })
    return selectedDate ? list : list.slice(0, 20)
  }, [filtered, liveEventsInList, selectedDate])

  const orphanFixtures = useMemo(() => {
    const LIVE_TO_SPORT: Record<string, string> = {
      soccer: 'Fútbol', basketball: 'NBA', mma: 'UFC',
      racing: 'F1', tennis: 'Tenis', padel: 'Pádel',
    }
    return liveFixtures.filter(f => {
      if (activeFilter !== 'Todo') {
        const mapped = LIVE_TO_SPORT[f.sport.toLowerCase()] ?? f.sport
        if (mapped !== activeFilter) return false
      }
      const matched = liveEventsInList.find(e =>
        namesMatch(e.home, f.homeTeam) && namesMatch(e.away ?? '', f.awayTeam)
      )
      return !matched
    })
  }, [liveFixtures, liveEventsInList, activeFilter])

  const grouped = useMemo(() => groupEventsByDate(filtered), [filtered])
  const orderedDates = useMemo(() => orderedDateKeys(grouped), [grouped])

  const liveCount = liveEventsInList.length + orphanFixtures.length

  const remindedEvents = useMemo(
    () => events.filter(e => reminders.has(e.id)),
    [events, reminders]
  )

  // Filtered past events (sport + search aware)
  const filteredPast = useMemo(() => {
    const matchesSearch = (e: SportEvent) =>
      !search || namesMatch(e.home, search) || (e.away ? namesMatch(e.away, search) : false)
    const matchesSport = (e: SportEvent) =>
      activeFilter === 'Todo' || e.sport === activeFilter
    return pastEvents.filter(e => matchesSport(e) && matchesSearch(e))
  }, [pastEvents, search, activeFilter])

  // Past events grouped by date (most-recent first)
  const pastGrouped = useMemo(() => {
    const groups: Record<string, SportEvent[]> = {}
    for (const e of filteredPast) {
      const k = e.isoDate ? isoToLocalDate(e.isoDate) : e.date
      if (!groups[k]) groups[k] = []
      groups[k].push(e)
    }
    return groups
  }, [filteredPast])

  const pastOrderedDates = useMemo(
    () => Object.keys(pastGrouped).sort((a, b) => b.localeCompare(a)),
    [pastGrouped]
  )

  // UFC events for modal
  const ufcEventsForDate = useMemo(() => {
    if (!selectedUFCDate) return []
    return filtered.filter(e =>
      isCombat(e.sport) &&
      e.isoDate &&
      isoToLocalDate(e.isoDate) === selectedUFCDate
    )
  }, [selectedUFCDate, filtered])

  // Build hero cards
  const liveHeroCards = useMemo(() => {
    const cards: React.ReactNode[] = []
    for (const event of liveEventsInList) {
      const score = liveScores.get(event.id)
      cards.push(
        <LiveHeroCard
          key={event.id}
          homeTeam={event.home}
          awayTeam={event.away ?? ''}
          homeAbbr={event.homeAbbr}
          awayAbbr={event.awayAbbr}
          homeLogo={event.homeLogo}
          awayLogo={event.awayLogo}
          homePhoto={event.homePhoto}
          awayPhoto={event.awayPhoto}
          homeScore={score?.homeGoals ?? 0}
          awayScore={score?.awayGoals ?? 0}
          status={score?.status ?? 'LIVE'}
          elapsed={score?.elapsed ?? null}
          sport={event.sport}
          comp={event.comp}
          matchRef={event.matchRef}
          broadcast={event.broadcast}
          flashing={flashIds.has(event.id)}
          isReminded={reminders.has(event.id)}
          onToggleReminder={() => toggleReminder(event.id)}
        />
      )
    }
    for (const fixture of orphanFixtures) {
      cards.push(
        <LiveHeroCard
          key={fixture.id}
          homeTeam={fixture.homeTeam}
          awayTeam={fixture.awayTeam}
          homeAbbr={fixture.homeAbbr}
          awayAbbr={fixture.awayAbbr}
          homeLogo={fixture.homeLogo}
          awayLogo={fixture.awayLogo}
          homePhoto={fixture.homePhoto}
          awayPhoto={fixture.awayPhoto}
          homeScore={fixture.homeGoals}
          awayScore={fixture.awayGoals}
          status={fixture.status}
          elapsed={fixture.elapsed}
          sport={fixture.sport}
          comp={fixture.comp}
          matchRef={fixture.matchRef}
          isReminded={reminders.has(fixture.id)}
          onToggleReminder={() => toggleReminder(fixture.id)}
        />
      )
    }
    return cards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEventsInList, orphanFixtures, reminders, liveScores])

  return (
    <main className="max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-10 pb-24">
      {/* Header */}
      <div className="relative pt-6 pb-5">
        <div className="absolute -top-8 left-0 w-80 h-48 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 20% 40%, rgba(124,58,237,0.07) 0%, transparent 70%)', filter: 'blur(16px)' }} />

        <div className="relative mb-5">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-2 h-2 rounded-full" style={{ background: '#7C3AED' }} />
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#8E8E9E', fontFamily: 'var(--font-sport)' }}>
              Calendario
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4 mb-1">
            <h1 className="font-black leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', color: '#F8F8FF', letterSpacing: '-0.02em' }}>
              Eventos Deportivos
            </h1>
          </div>
          <p className="text-[11px]" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
            {filtered.length} evento{filtered.length !== 1 ? 's' : ''}
            {liveCount > 0 && <span style={{ color: '#4ade80' }}> · {liveCount} en vivo</span>}
          </p>
        </div>

        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <TimezoneSelector value={tz} onChange={(newTz) => { setTz(newTz); setStoredTZ(newTz) }} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['destacados', 'todos', 'en-vivo', 'resultados', 'recordatorios'] as const).map(tab => {
            const isActive = view === tab
            const isLiveTab = tab === 'en-vivo'
            const isRemTab = tab === 'recordatorios'
            const isPastTab = tab === 'resultados'
            const hasLive = liveCount > 0
            const liveDot = isLiveTab && hasLive
            const greenStyle = isActive && isLiveTab && hasLive
            const remCount = remindedEvents.length
            const remStyle = isActive && isRemTab
            const pastStyle = isActive && isPastTab

            return (
              <button
                key={tab}
                onClick={() => setView(tab)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.18em] transition-all"
                style={{
                  background: isActive
                    ? (greenStyle ? 'rgba(74,222,128,0.18)' : remStyle ? 'rgba(251,191,36,0.14)' : pastStyle ? 'rgba(239,68,68,0.14)' : 'rgba(124,58,237,0.18)')
                    : 'rgba(255,255,255,0.04)',
                  color: isActive
                    ? (greenStyle ? '#4ade80' : remStyle ? '#FBBF24' : pastStyle ? '#FCA5A5' : '#C4B5FD')
                    : '#7A7A8E',
                  border: isActive
                    ? (greenStyle ? '1px solid rgba(74,222,128,0.45)' : remStyle ? '1px solid rgba(251,191,36,0.3)' : pastStyle ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(124,58,237,0.45)')
                    : '1px solid rgba(255,255,255,0.06)',
                  fontFamily: 'var(--font-sport)',
                  cursor: 'pointer',
                  boxShadow: isActive
                    ? (greenStyle ? '0 0 14px rgba(74,222,128,0.18)' : remStyle || pastStyle ? 'none' : '0 0 14px rgba(124,58,237,0.18)')
                    : 'none',
                }}>
                {liveDot && (
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
                )}
                {tab === 'destacados' && 'Destacados'}
                {tab === 'todos' && 'Todos'}
                {tab === 'en-vivo' && `En Vivo${liveCount > 0 ? ` · ${liveCount}` : ''}`}
                {tab === 'resultados' && `Resultados${pastEvents.length > 0 ? ` · ${pastEvents.length}` : ''}`}
                {tab === 'recordatorios' && (
                  <>🔔 {remCount > 0 ? `· ${remCount}` : ''}</>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Day chips + Toolbar (sticky on scroll) */}
      {view !== 'en-vivo' && view !== 'recordatorios' && view !== 'resultados' && (
        <div
          className="mb-4 -mx-4 sm:-mx-6 xl:-mx-10 px-4 sm:px-6 xl:px-10 pt-2 pb-3"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            background: 'linear-gradient(180deg, rgba(10,10,18,0.96) 0%, rgba(10,10,18,0.88) 80%, rgba(10,10,18,0) 100%)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {availableDays.length > 0 && (
            <div className="mb-2.5 overflow-x-auto -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
              <DayChips days={availableDays} value={selectedDate} onChange={setSelectedDate} />
            </div>
          )}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <SearchInput value={search} onChange={setSearch} />
              <button
                onClick={() => setOnlyLive(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0"
                style={{
                  background: onlyLive ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.04)',
                  color: onlyLive ? '#4ade80' : '#7A7A8E',
                  border: onlyLive ? '1px solid rgba(74,222,128,0.45)' : '1px solid rgba(255,255,255,0.06)',
                  fontFamily: 'var(--font-sport)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: onlyLive ? '0 0 12px rgba(74,222,128,0.18)' : 'none',
                }}
              >
                {onlyLive && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4ade80' }} />}
                Solo en vivo
              </button>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0"
                  style={{
                    background: 'rgba(244,63,94,0.10)',
                    color: '#FB7185',
                    border: '1px solid rgba(244,63,94,0.25)',
                    fontFamily: 'var(--font-sport)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ✕ Limpiar
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
              {sports.map(sport => (
                <button
                  key={sport}
                  onClick={() => setActiveFilter(sport)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0"
                  style={{
                    background: activeFilter === sport ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                    color: activeFilter === sport ? '#E0E0F0' : '#5A5A6A',
                    border: activeFilter === sport ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.06)',
                    fontFamily: 'var(--font-sport)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}>
                  {SPORT_EMOJI[sport] || '🏆'} {sport}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {view === 'destacados' && (
        <div className="space-y-7">
          {/* Hero strip de En Vivo */}
          {liveCount > 0 && (
            <section>
              <SectionHeader
                icon="🔴"
                label="En Vivo Ahora"
                color="#4ade80"
                count={liveCount}
                hint={liveCount > 3 ? '← desliza →' : undefined}
              />
              <LiveHeroStrip items={liveHeroCards} />
            </section>
          )}

          {/* Skeleton mientras carga la primera tanda de live data */}
          {!hasLoaded && liveCount === 0 && (
            <section>
              <SectionHeader icon="⏳" label="Cargando…" color="#5A5A6A" />
              <div className="space-y-1.5">
                {[1,2,3].map(i => <SkeletonRow key={i} />)}
              </div>
            </section>
          )}

          {/* Tus equipos favoritos */}
          {favoriteEvents.length > 0 && !onlyLive && !selectedDate && (
            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12px]">♥</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em]"
                    style={{ color: '#F472B6', fontFamily: 'var(--font-sport)' }}>
                    Tus equipos
                  </span>
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black"
                    style={{ background: 'rgba(244,114,182,0.18)', color: '#F472B6', fontFamily: 'var(--font-display)' }}>
                    {favoriteEvents.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowOnboarding(true)}
                  className="text-[9px] font-bold uppercase tracking-widest transition-opacity hover:opacity-70"
                  style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
                >
                  Editar
                </button>
              </div>
              <div className="space-y-1.5">
                {favoriteEvents.slice(0, 5).map(event => {
                  const evDate = event.isoDate ? isoToLocalDate(event.isoDate) : null
                  const today = isoToLocalDate(new Date().toISOString())
                  const dateLabel = evDate && evDate !== today ? formatDateLabel(evDate) : undefined
                  return (
                    <MatchRow
                      key={`fav-${event.id}`}
                      event={event}
                      liveScore={liveScores.get(event.id)}
                      isReminded={reminders.has(event.id)}
                      onToggleReminder={() => toggleReminder(event.id)}
                      dateLabel={dateLabel}
                      onClickUFC={setSelectedUFCDate}
                      flashing={flashIds.has(event.id)}
                      isFav={true}
                      onToggleFav={() => toggleFavorite(event.home)}
                    />
                  )
                })}
              </div>
            </section>
          )}

          {/* Lista de Próximos */}
          {topUpcoming.length > 0 && (
            <section>
              <SectionHeader
                icon="⭐"
                label={selectedDate ? `Partidos · ${formatDateLabel(selectedDate)}` : 'Próximos Destacados'}
                color="#C4B5FD"
                count={topUpcoming.length}
              />
              <div className="space-y-1.5">
                {topUpcoming.map(event => {
                  const evDate = event.isoDate ? isoToLocalDate(event.isoDate) : null
                  const today = isoToLocalDate(new Date().toISOString())
                  const dateLabel = !selectedDate && evDate && evDate !== today ? formatDateLabel(evDate) : undefined
                  const fav = eventHasFavorite(favorites, event)
                  return (
                    <MatchRow
                      key={event.id}
                      event={event}
                      liveScore={liveScores.get(event.id)}
                      isReminded={reminders.has(event.id)}
                      onToggleReminder={() => toggleReminder(event.id)}
                      dateLabel={dateLabel}
                      onClickUFC={setSelectedUFCDate}
                      flashing={flashIds.has(event.id)}
                      isFav={fav}
                      onToggleFav={() => toggleFavorite(event.home)}
                    />
                  )
                })}
              </div>
            </section>
          )}

          {filtered.length === 0 && liveCount === 0 && (
            <div className="text-center py-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="text-[28px] mb-2" style={{ filter: 'grayscale(0.3) opacity(0.6)' }}>
                {search ? '🔍' : activeFilter !== 'Todo' ? (SPORT_EMOJI[activeFilter] || '🏆') : '📅'}
              </p>
              <p style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', fontSize: 13, fontWeight: 600 }}>
                {search
                  ? `Sin resultados para "${search}"`
                  : activeFilter !== 'Todo'
                    ? `No hay eventos de ${activeFilter} en los próximos días`
                    : 'No se encontraron eventos'}
              </p>
              {search && (
                <p className="text-[10px] mt-1.5" style={{ color: '#4A4A5A' }}>Prueba con el nombre del equipo o la competición</p>
              )}
              {!search && activeFilter !== 'Todo' && (
                <p className="text-[10px] mt-1.5" style={{ color: '#4A4A5A' }}>Prueba seleccionando otra fecha o cambia el filtro</p>
              )}
            </div>
          )}
        </div>
      )}

      {view === 'en-vivo' && (
        <div>
          {liveCount === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="text-[24px] mb-2" style={{ filter: 'grayscale(0.4) opacity(0.7)' }}>📺</p>
              <p style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', fontSize: 13, fontWeight: 600 }}>
                No hay partidos en vivo ahora
              </p>
              <p className="text-[10px] mt-1.5" style={{ color: '#4A4A5A' }}>
                Vuelve más tarde o explora los próximos eventos
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {liveHeroCards.map((card, i) => (
                <div key={i} className="contents">{card}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'todos' && (
        <div className="space-y-5">
          {/* Live strip at top of TODOS view */}
          {liveCount > 0 && !selectedDate && (
            <section>
              <SectionHeader icon="🔴" label="En Vivo" color="#4ade80" count={liveCount} hint={liveCount > 3 ? '← desliza →' : undefined} />
              <LiveHeroStrip items={liveHeroCards} />
            </section>
          )}

          {orderedDates.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="text-[28px] mb-2" style={{ filter: 'grayscale(0.3) opacity(0.6)' }}>
                {search ? '🔍' : activeFilter !== 'Todo' ? (SPORT_EMOJI[activeFilter] || '🏆') : '📅'}
              </p>
              <p style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', fontSize: 13, fontWeight: 600 }}>
                {search
                  ? `Sin resultados para "${search}"`
                  : activeFilter !== 'Todo'
                    ? `No hay eventos de ${activeFilter} en los próximos días`
                    : 'No se encontraron eventos'}
              </p>
              {search && (
                <p className="text-[10px] mt-1.5" style={{ color: '#4A4A5A' }}>Prueba con el nombre del equipo o la competición</p>
              )}
              {!search && activeFilter !== 'Todo' && (
                <p className="text-[10px] mt-1.5" style={{ color: '#4A4A5A' }}>Prueba seleccionando otra fecha o cambia el filtro</p>
              )}
            </div>
          ) : (
            orderedDates.map(dateKey => (
              <section key={dateKey}>
                <SectionHeader
                  icon="📅"
                  label={formatDateLabel(dateKey)}
                  color="#C4B5FD"
                  count={grouped[dateKey]?.length || 0}
                />
                <div className="space-y-1.5">
                  {grouped[dateKey]?.map(event => (
                    <MatchRow
                      key={event.id}
                      event={event}
                      liveScore={liveScores.get(event.id)}
                      isReminded={reminders.has(event.id)}
                      onToggleReminder={() => toggleReminder(event.id)}
                      onClickUFC={setSelectedUFCDate}
                      flashing={flashIds.has(event.id)}
                      isFav={eventHasFavorite(favorites, event)}
                      onToggleFav={() => toggleFavorite(event.home)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {view === 'recordatorios' && (
        <div className="space-y-5">
          {remindedEvents.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="text-[28px] mb-3" style={{ filter: 'opacity(0.5)' }}>🔔</p>
              <p style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', fontSize: 13, fontWeight: 600 }}>
                No tienes recordatorios activos
              </p>
              <p className="text-[10px] mt-1.5" style={{ color: '#4A4A5A' }}>
                Pulsa 🔔 en cualquier partido para recordarlo
              </p>
            </div>
          ) : (
            <section>
              <SectionHeader icon="🔔" label="Mis Recordatorios" color="#FBBF24" count={remindedEvents.length} />
              <div className="space-y-1.5">
                {remindedEvents.map(event => {
                  const evDate = event.isoDate ? isoToLocalDate(event.isoDate) : null
                  const today = isoToLocalDate(new Date().toISOString())
                  const dateLabel = evDate && evDate !== today ? formatDateLabel(evDate) : undefined
                  return (
                    <MatchRow
                      key={event.id}
                      event={event}
                      liveScore={liveScores.get(event.id)}
                      isReminded={true}
                      onToggleReminder={() => toggleReminder(event.id)}
                      dateLabel={dateLabel}
                      onClickUFC={setSelectedUFCDate}
                      flashing={flashIds.has(event.id)}
                      isFav={eventHasFavorite(favorites, event)}
                      onToggleFav={() => toggleFavorite(event.home)}
                    />
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {view === 'resultados' && (
        <div className="space-y-5">
          {/* Compact sport + search toolbar */}
          <div
            className="-mx-4 sm:-mx-6 xl:-mx-10 px-4 sm:px-6 xl:px-10 pt-2 pb-3 mb-1"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 30,
              background: 'linear-gradient(180deg, rgba(10,10,18,0.96) 0%, rgba(10,10,18,0.88) 80%, rgba(10,10,18,0) 100%)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <SearchInput value={search} onChange={setSearch} />
              <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                {sports.map(sport => (
                  <button
                    key={sport}
                    onClick={() => setActiveFilter(sport)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0"
                    style={{
                      background: activeFilter === sport ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                      color: activeFilter === sport ? '#E0E0F0' : '#5A5A6A',
                      border: activeFilter === sport ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.06)',
                      fontFamily: 'var(--font-sport)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}>
                    {SPORT_EMOJI[sport] || '🏆'} {sport}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {pastOrderedDates.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="text-[28px] mb-2" style={{ filter: 'grayscale(0.3) opacity(0.6)' }}>📋</p>
              <p style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', fontSize: 13, fontWeight: 600 }}>
                No hay resultados recientes
              </p>
              <p className="text-[10px] mt-1.5" style={{ color: '#4A4A5A' }}>Los resultados de los últimos 10 días aparecen aquí</p>
            </div>
          ) : (
            pastOrderedDates.map(dateKey => (
              <section key={dateKey}>
                <SectionHeader
                  icon="📋"
                  label={formatDateLabel(dateKey)}
                  color="#FCA5A5"
                  count={pastGrouped[dateKey]?.length || 0}
                />
                <div className="space-y-1.5">
                  {pastGrouped[dateKey]?.map(event => (
                    <PastMatchRow
                      key={event.id}
                      event={event}
                      isFav={eventHasFavorite(favorites, event)}
                      onToggleFav={() => toggleFavorite(event.home)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {/* UFC Card Modal */}
      {selectedUFCDate && (
        <UFCCardModal
          date={selectedUFCDate}
          events={ufcEventsForDate}
          liveScores={liveScores}
          reminders={reminders}
          onToggleReminder={toggleReminder}
          onClose={() => setSelectedUFCDate(null)}
        />
      )}

      {/* Favorites onboarding (first visit) */}
      {showOnboarding && (
        <FavoritesOnboarding
          onClose={skipOnboarding}
          onSave={(teams) => { finishOnboarding(teams); setShowOnboarding(false) }}
        />
      )}
    </main>
  )
}
