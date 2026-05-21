'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { SportEvent } from '@/lib/types'
import { getCompAccent, getLeagueScore, getEventHighlightScore, SPORT_EMOJI, getLiveLabel, isTennis, isCombat, isRacing } from '@/lib/competitions'
import { isSplitBroadcast } from '@/lib/broadcasts'
import { groupEventsByDate, orderedDateKeys, namesMatch, formatDateLabel, isoToLocalDate } from '@/lib/calendar'
import { getStoredTZ, setStoredTZ, SOURCE_TZ, convertEventTime } from '@/lib/timezone'
import TimezoneSelector from '@/components/TimezoneSelector'
import UFCCardModal from '@/components/UFCCardModal'
import FavoritesOnboarding from '@/components/FavoritesOnboarding'
import { SearchIcon, CalendarIcon, TvIcon, BellIcon, ClipboardIcon, SportIcon, TrophyIcon, LiveDotIcon, TennisIcon, F1Icon } from '@/components/icons/GameIcons'

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
// Helper: ejecuta `tick` cada `ms` solo cuando la pestaña está visible.
// Al volver de oculto-a-visible hace un fetch inmediato.
function useVisiblePolling(tick: () => void, ms: number) {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => { if (!timer) timer = setInterval(tick, ms) }
    const stop  = () => { if (timer) { clearInterval(timer); timer = null } }
    const onVis = () => {
      if (typeof document === 'undefined') return
      if (document.visibilityState === 'visible') { tick(); start() } else { stop() }
    }
    tick()
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') start()
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis)
    }
  }, [tick, ms])
}

function useLiveFixtures() {
  const [fixtures, setFixtures] = useState<RawLiveFixture[]>([])

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/events/live', { cache: 'no-store' })
      if (!res.ok) return
      const data: RawLiveFixture[] = await res.json()
      setFixtures(data.filter(f => !FINISHED.has(f.status)))
    } catch { /* ignore */ }
  }, [])

  useVisiblePolling(fetch_, 30_000)

  return fixtures
}

function useLiveScores(events: SportEvent[]) {
  const [scores, setScores] = useState<Map<string, LiveScore>>(new Map())

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

  useVisiblePolling(fetch_, 30_000)

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
  const dim = size === 'sm' ? 28 : 34
  const icon = size === 'sm' ? 12 : 14
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
          {tennis && <span style={{ color: '#d97706' }}><TennisIcon size={10} /></span>}
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
              <span className="text-[9px] font-black uppercase tracking-[0.15em] inline-flex items-center gap-1"
                style={{ color: '#4ade80', fontFamily: 'var(--font-sport)' }}>
                <F1Icon size={11} /> EN CARRERA
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
function FavoriteHeart({ active, onClick, size = 16 }: {
  active: boolean
  onClick: () => void
  size?: number
}) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick() }}
      className="flex items-center justify-center transition-all flex-shrink-0"
      style={{ width: 34, height: 34, cursor: 'pointer', background: 'transparent', border: 'none' }}
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
  const split = isSplitBroadcast(broadcast)
  return (
    <span
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide"
      style={{
        background: split ? 'rgba(251,191,36,0.08)' : 'rgba(99,102,241,0.10)',
        color:      split ? '#D4A017'               : '#A5B4FC',
        border:     split ? '1px solid rgba(251,191,36,0.22)' : '1px solid rgba(99,102,241,0.20)',
        fontFamily: 'var(--font-sport)',
      }}
      title={split ? 'Los derechos de emisión están repartidos entre varios canales' : undefined}
    >
      <span className="inline-flex items-center"><TvIcon size={11} /></span>
      <span className="truncate max-w-[110px]">{broadcast}</span>
    </span>
  )
}

// ─── Skeleton row (loading state) ─────────────────────────────────────────
function SkeletonRow() {
  return (
    <div
      className="grid items-center gap-3 px-3 py-2.5 rounded-lg animate-pulse"
      style={{
        gridTemplateColumns: '1fr auto auto',
        background: 'rgba(255,255,255,0.025)',
        borderLeft: '3px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.08)', borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ height: 11, width: '55%', background: 'rgba(255,255,255,0.07)', borderRadius: 3 }} />
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.08)', borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ height: 11, width: '45%', background: 'rgba(255,255,255,0.07)', borderRadius: 3 }} />
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div style={{ height: 10, width: 40, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }} />
      </div>
      <div style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.05)', borderRadius: 6 }} />
    </div>
  )
}

// ─── Competition sub-header ───────────────────────────────────────────────
function CompGroupHeader({ comp, accent, count, first }: { comp: string; accent: string; count: number; first?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 px-1 pb-2 ${first ? 'pt-1' : 'pt-4'}`}>
      <span className="block flex-shrink-0 rounded-sm" style={{ width: 3, height: 14, background: accent, boxShadow: `0 0 8px ${accent}66` }} />
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] truncate flex-1" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
        {comp}
      </span>
      <span className="text-[9px] font-bold tabular-nums px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ background: `${accent}14`, color: accent, border: `1px solid ${accent}30`, fontFamily: 'var(--font-sport)' }}>
        {count}
      </span>
    </div>
  )
}

// Inline strip of 5 W/D/L chips for a team's recent form. Renders nothing
// if the list is empty.
function FormStrip({ form, align = 'start' }: { form: ('W'|'D'|'L')[]; align?: 'start' | 'end' }) {
  if (!form || form.length === 0) return null
  const color = (r: 'W'|'D'|'L') => r === 'W' ? '#22C55E' : r === 'D' ? '#EAB308' : '#EF4444'
  // Show in chronological order: oldest first → most recent on the side closest to the logo.
  const ordered = align === 'end' ? [...form].reverse() : [...form].reverse()
  return (
    <div className={`mt-1.5 flex gap-1 ${align === 'end' ? 'justify-end' : ''}`}>
      {ordered.map((r, i) => (
        <span key={i} className="size-2 rounded-sm" style={{ background: color(r) }} title={r} />
      ))}
    </div>
  )
}

// Renders the upgraded "Tus equipos" section: a horizontal row of team
// chips (each with the team's next match countdown), an editable header,
// and the full list of upcoming events involving any favorited team. Long
// lists collapse to 8 by default with a "Ver más" toggle.
function FavoritesSection({
  favoriteEvents, favorites, liveScores, reminders, flashIds, recentForms, tz,
  toggleReminder, toggleFavorite, setSelectedUFCDate, onEdit, filterActive, chipsOnly,
}: {
  favoriteEvents: SportEvent[]
  favorites: Set<string>
  liveScores: Map<string, LiveScore>
  reminders: Set<string>
  flashIds: Set<string>
  recentForms: Record<string, ('W'|'D'|'L')[]>
  tz: string
  toggleReminder: (id: string) => void
  toggleFavorite: (name: string) => void
  setSelectedUFCDate: (d: string | null) => void
  onEdit: () => void
  filterActive: boolean
  chipsOnly?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const VISIBLE = 8

  // For each favorite team find their next upcoming event (favoriteEvents
  // is already sorted by isoDate ascending — see useMemo upstream).
  // Cuando hay un filtro activo (deporte/búsqueda), ocultamos los equipos
  // que no tienen ningún partido en el filtro actual: no tiene sentido
  // mostrar 'Sin partidos' para un equipo de NBA cuando filtras Fútbol.
  const teamNext = useMemo(() => {
    const out: Array<{ team: string; next: SportEvent | null }> = []
    for (const team of favorites) {
      const lower = team.toLowerCase()
      const match = favoriteEvents.find(ev =>
        ev.home.toLowerCase().includes(lower)
        || (ev.away?.toLowerCase().includes(lower) ?? false)
      ) ?? null
      if (filterActive && !match) continue
      out.push({ team, next: match })
    }
    // Sort: teams with a next match first (closest first), then no-match teams.
    return out.sort((a, b) => {
      if (a.next && !b.next) return -1
      if (!a.next && b.next) return 1
      if (a.next && b.next) return (a.next.isoDate ?? '').localeCompare(b.next.isoDate ?? '')
      return a.team.localeCompare(b.team)
    })
  }, [favorites, favoriteEvents, filterActive])

  const visibleEvents = expanded ? favoriteEvents : favoriteEvents.slice(0, VISIBLE)

  return (
    <section>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px]" style={{ color: '#F472B6' }}>♥</span>
          <span className="text-[10px] font-black uppercase tracking-[0.18em]"
            style={{ color: '#F472B6', fontFamily: 'var(--font-sport)' }}>
            Tus equipos
          </span>
          <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[9px] font-black tabular-nums"
            style={{ background: 'rgba(244,114,182,0.18)', color: '#F472B6', fontFamily: 'var(--font-sport)' }}>
            {favoriteEvents.length}
          </span>
        </div>
        <button
          onClick={onEdit}
          className="text-[9px] font-bold uppercase tracking-widest transition-opacity hover:opacity-70"
          style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
        >
          Editar
        </button>
      </div>

      {/* Team chips: cada equipo favorito con su próximo partido o estado */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 mb-3 scrollbar-hide">
        {teamNext.map(({ team, next }) => {
          const countdown = next?.isoDate ? timeUntilLabel(next.isoDate) : null
          const nextDate = next?.isoDate ? isoToLocalDate(next.isoDate) : null
          const today = isoToLocalDate(new Date().toISOString())
          const isToday = nextDate === today
          const subtitle = next
            ? (countdown ?? (isToday ? `Hoy · ${next.time}` : formatDateLabel(nextDate ?? '') + ' · ' + next.time))
            : 'Sin partidos'
          return (
            <div
              key={team}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{
                background: next ? 'rgba(244,114,182,0.08)' : 'rgba(255,255,255,0.025)',
                border: next ? '1px solid rgba(244,114,182,0.22)' : '1px solid rgba(255,255,255,0.05)',
              }}
              title={team}
            >
              <div className="flex flex-col">
                <span className="text-[11px] font-bold leading-tight truncate max-w-[120px]"
                  style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
                  {team}
                </span>
                <span className="text-[9px] tabular-nums mt-0.5 truncate max-w-[120px]"
                  style={{ color: next ? '#F472B6' : '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
                  {subtitle}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {!chipsOnly && (
        <>
          <div className="space-y-1.5">
            {visibleEvents.map(event => {
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
                  formHome={recentForms[event.home]}
                  formAway={event.away ? recentForms[event.away] : undefined}
                  showComp
                  tz={tz}
                />
              )
            })}
          </div>

          {favoriteEvents.length > VISIBLE && (
            <div className="flex justify-center mt-3">
              <button
                onClick={() => setExpanded(v => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.16em] transition-all"
                style={{
                  color: '#F472B6',
                  background: 'rgba(244,114,182,0.10)',
                  border: '1px solid rgba(244,114,182,0.28)',
                  fontFamily: 'var(--font-sport)',
                  cursor: 'pointer',
                }}
              >
                {expanded ? 'Ver menos' : `Ver ${favoriteEvents.length - VISIBLE} más`}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
                  <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

// ─── Compact list row (non-live or in TODOS) ──────────────────────────────
function MatchRow({ event, liveScore, isReminded, onToggleReminder, dateLabel, onClickUFC, flashing, isFav, onToggleFav, formHome, formAway, showComp, tz }: {
  event: SportEvent
  liveScore?: LiveScore
  isReminded: boolean
  onToggleReminder: () => void
  dateLabel?: string
  onClickUFC?: (date: string) => void
  flashing?: boolean
  isFav?: boolean
  onToggleFav?: () => void
  formHome?: ('W'|'D'|'L')[]
  formAway?: ('W'|'D'|'L')[]
  showComp?: boolean
  tz?: string
}) {
  // Convert event time (Madrid source) to user's selected timezone. If tz is
  // not provided or matches source, returns the original string. Falls back
  // gracefully on parse errors inside the helper.
  const displayTime = tz && tz !== SOURCE_TZ ? convertEventTime(event.time, tz) : event.time
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

  const hasVs = !!event.away
  const liveLabel = isLive && liveScore ? getLiveLabel(liveScore.status, liveScore.elapsed, {
    sport: event.sport,
    homeScore: liveScore.homeGoals,
    awayScore: liveScore.awayGoals,
  }) : ''

  const scoreBlock = (
    <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0 min-w-[88px] px-2">
      {showComp && event.comp && (
        <span className="text-[8px] font-black uppercase tracking-[0.16em] truncate max-w-[110px] mb-0.5"
          style={{ color: compColor, fontFamily: 'var(--font-sport)' }}>
          {event.comp}
        </span>
      )}
      {showScore && liveScore ? (
        racing ? (
          <span className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: isLive ? '#EF4444' : '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
            {isLive ? 'LIVE' : 'FIN'}
          </span>
        ) : (
          <>
            {isLive ? (
              <span className="flex items-center gap-1.5 leading-none">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EF4444', animation: 'live-pulse 1.6s ease-out infinite' }} />
                <span className="text-[10px] font-black uppercase tracking-[0.14em] tabular-nums" style={{ color: '#EF4444', fontFamily: 'var(--font-sport)' }}>
                  {liveLabel || 'LIVE'}
                </span>
              </span>
            ) : (
              <span className="text-[9px] font-black uppercase tracking-[0.14em] leading-none" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                Final
              </span>
            )}
            {tennis && liveScore.clock && (
              <span className="text-[8px] font-bold uppercase tracking-[0.16em] leading-none"
                style={{ color: isLive ? '#FBBF24' : '#9090A8', fontFamily: 'var(--font-sport)' }}>
                {liveScore.clock}
              </span>
            )}
            <span className="flex items-center gap-2 leading-none tabular-nums font-black"
              style={{ fontSize: 24, color: isLive ? '#EBEBF5' : '#C0C0D8', fontFamily: 'var(--font-sport)' }}>
              <span>{liveScore.homeGoals ?? 0}</span>
              <span style={{ color: '#38384A', fontWeight: 400 }}>·</span>
              <span>{liveScore.awayGoals ?? 0}</span>
            </span>
          </>
        )
      ) : (
        <>
          {dateLabel && (
            <span className="text-[9px] font-black uppercase tracking-[0.14em] leading-none"
              style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
              {dateLabel}
            </span>
          )}
          <span className="text-[20px] font-bold tabular-nums leading-none"
            style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {displayTime}
          </span>
          {hasVs && (
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] leading-none" style={{ color: '#38384A', fontFamily: 'var(--font-sport)' }}>vs</span>
          )}
          {isFav && countdown && (
            <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black tabular-nums uppercase tracking-wider"
              style={{
                background: 'rgba(244,114,182,0.12)',
                color: '#F472B6',
                border: '1px solid rgba(244,114,182,0.3)',
                fontFamily: 'var(--font-sport)',
              }}
              title="Tu equipo juega pronto">
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M6 4v2.5l1.5 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              {countdown}
            </span>
          )}
        </>
      )}
      {event.broadcast && (
        <div className="mt-0.5"><BroadcastChip broadcast={event.broadcast} /></div>
      )}
    </div>
  )

  const actions = (
    <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
      {onToggleFav && <FavoriteHeart active={!!isFav} onClick={onToggleFav} />}
      <ReminderButton active={isReminded} onClick={onToggleReminder} color={event.accent} />
    </div>
  )

  const inner = (
    <div
      className={`relative grid items-center gap-2 px-3 py-3 rounded-lg transition-all ${flashing ? 'ts-flash' : ''}`}
      style={{
        gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
        background: isLive ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.025)',
        borderLeft: `3px solid ${accent}`,
        border: '1px solid rgba(255,255,255,0.04)',
        borderLeftWidth: 3,
        borderLeftColor: accent,
      }}
    >
      {actions}

      {/* Home (or solo entity) */}
      <div className="flex items-center gap-2.5 min-w-0 justify-end text-right pr-1">
        <div className="min-w-0 flex flex-col items-end">
          <span className="text-[13px] font-bold truncate max-w-full" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {event.home}
          </span>
          {isFav && <span className="text-[9px] mt-0.5" style={{ color: '#F472B6' }}>♥</span>}
          {hasVs && formHome && <FormStrip form={formHome} align="end" />}
        </div>
        <TeamLogo logo={event.homeLogo} photo={event.homePhoto} name={event.home} size={32} sport={event.sport} />
      </div>

      {scoreBlock}

      {/* Away (vs match) or sport vignette (solo event) — mantiene la simetría */}
      {hasVs ? (
        <div className="flex items-center gap-2.5 min-w-0 pl-1 pr-[72px] sm:pr-1">
          <TeamLogo logo={event.awayLogo} photo={event.awayPhoto} name={event.away!} size={32} sport={event.sport} />
          <div className="min-w-0">
            <span className="text-[13px] font-bold truncate block" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
              {event.away}
            </span>
            {formAway && <FormStrip form={formAway} align="start" />}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0 pl-1 pr-[72px] sm:pr-1 opacity-60">
          <span className="inline-flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 32, height: 32, background: `${compColor}14`, border: `1px solid ${compColor}28`, color: compColor }}>
            {racing ? <F1Icon size={16} /> : tennis ? <TennisIcon size={16} /> : <SportIcon sport={event.sport} size={16} />}
          </span>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] truncate block"
              style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
              {racing ? 'Carrera' : tennis ? 'Individual' : combat ? 'Cartelera' : 'Evento'}
            </span>
            {event.comp && (
              <span className="text-[9px] truncate block mt-0.5"
                style={{ color: compColor, fontFamily: 'var(--font-sport)' }}>
                {event.comp}
              </span>
            )}
          </div>
        </div>
      )}
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
    <div className="relative flex items-center flex-1" style={{ maxWidth: 220, minWidth: 100 }}>
      <svg className="absolute left-2.5 pointer-events-none" width="11" height="11" viewBox="0 0 12 12" fill="none">
        <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.3" opacity="0.4" />
        <path d="M8.5 8.5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.4" />
      </svg>
      <input
        type="text"
        placeholder="Buscar…"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-7 py-1.5 rounded-lg text-[11px] font-medium outline-none"
        style={{
          paddingRight: value ? 28 : 8,
          background: value ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.04)',
          border: value ? '1px solid rgba(124,58,237,0.25)' : '1px solid rgba(255,255,255,0.06)',
          color: '#D0D0E8',
          transition: 'all 0.15s ease',
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 flex items-center justify-center w-4 h-4 rounded-full transition-opacity hover:opacity-70"
          style={{ background: 'rgba(255,255,255,0.12)', color: '#A0A0B8', border: 'none', cursor: 'pointer', fontSize: 9 }}
          aria-label="Limpiar búsqueda"
        >
          ✕
        </button>
      )}
    </div>
  )
}

function formatDateSubtitle(localDate: string): string {
  if (localDate === 'unknown') return ''
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const d = new Date(localDate + 'T12:00:00Z')
  return `${days[d.getUTCDay()]}, ${d.getUTCDate()} de ${months[d.getUTCMonth()]}`
}

// Day separator — prominent header for each date in the events list.
function DaySeparator({ dateKey, count, tone = 'upcoming' }: {
  dateKey: string
  count: number
  tone?: 'upcoming' | 'past'
}) {
  const today = isoToLocalDate(new Date().toISOString())
  const isToday = dateKey === today
  const accent = tone === 'past' ? '#FCA5A5' : isToday ? '#C4B5FD' : '#7C3AED'
  const subtitle = formatDateSubtitle(dateKey)
  const label = formatDateLabel(dateKey)

  return (
    <div className="relative pt-7 pb-4 mb-3">
      {/* Top divider — grueso para marcar bien el cambio de día */}
      <div className="absolute top-0 left-0 right-0" style={{ height: 2, background: 'linear-gradient(90deg, rgba(124,58,237,0.32) 0%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.04) 100%)' }} />
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="block flex-shrink-0 rounded-sm" style={{ width: 3, height: 18, background: accent, boxShadow: `0 0 10px ${accent}55` }} />
          <div className="min-w-0">
            <h2 className="font-black leading-none uppercase tracking-[0.18em]"
              style={{ fontFamily: 'var(--font-sport)', fontSize: 14, color: '#F0F0FA' }}>
              {label}
            </h2>
            {subtitle && (
              <p className="text-[10px] mt-1 capitalize tracking-wide" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <span className="flex items-center justify-center min-w-[26px] h-[22px] px-2 rounded-full text-[10px] font-black tabular-nums flex-shrink-0"
          style={{ background: `${accent}1a`, color: accent, border: `1px solid ${accent}33`, fontFamily: 'var(--font-sport)' }}>
          {count}
        </span>
      </div>
    </div>
  )
}

function SectionHeader({ icon, label, color, count, hint }: {
  icon: React.ReactNode; label: string; color: string; count?: number; hint?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <span className="inline-flex items-center" style={{ color }}>{icon}</span>
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
            : (<><CalendarIcon size={11} /> Calendario</>)
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

  const hasVs = !!event.away
  const racing = isRacing(event.sport)
  const tennis = isTennis(event.sport)
  const combat = isCombat(event.sport)
  const inner = (
    <div
      className="relative grid items-center gap-2 px-3 py-3 rounded-lg transition-all"
      style={{
        gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderLeftWidth: 3,
        borderLeftColor: compColor,
      }}
    >
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        {onToggleFav && <FavoriteHeart active={!!isFav} onClick={onToggleFav} />}
      </div>

      {/* Home (or solo entity) */}
      <div className="flex items-center gap-2.5 min-w-0 justify-end text-right pr-1">
        <div className="min-w-0 flex flex-col items-end">
          <span className="text-[13px] font-bold truncate max-w-full" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {event.home}
          </span>
        </div>
        <TeamLogo logo={event.homeLogo} name={event.home} size={32} sport={event.sport} />
      </div>

      <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0 min-w-[88px] px-2">
        <span className="text-[9px] font-black uppercase tracking-[0.18em] leading-none" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
          FT
        </span>
        {hasScore ? (
          <span className="flex items-center gap-2 leading-none tabular-nums font-black"
            style={{ fontSize: 22, color: '#C0C0D8', fontFamily: 'var(--font-sport)' }}>
            <span>{hs}</span>
            <span style={{ color: '#38384A', fontWeight: 400 }}>·</span>
            <span>{as_}</span>
          </span>
        ) : (
          <span className="text-[14px] font-bold" style={{ color: '#5A5A6A' }}>–</span>
        )}
      </div>

      {hasVs ? (
        <div className="flex items-center gap-2.5 min-w-0 pl-1 pr-10 sm:pr-1">
          <TeamLogo logo={event.awayLogo} name={event.away!} size={32} sport={event.sport} />
          <span className="text-[13px] font-bold truncate" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {event.away}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0 pl-1 pr-10 sm:pr-1 opacity-60">
          <span className="inline-flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 32, height: 32, background: `${compColor}14`, border: `1px solid ${compColor}28`, color: compColor }}>
            {racing ? <F1Icon size={16} /> : tennis ? <TennisIcon size={16} /> : <SportIcon sport={event.sport} size={16} />}
          </span>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] truncate block"
              style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
              {racing ? 'Carrera' : tennis ? 'Individual' : combat ? 'Cartelera' : 'Evento'}
            </span>
            {event.comp && (
              <span className="text-[9px] truncate block mt-0.5"
                style={{ color: compColor, fontFamily: 'var(--font-sport)' }}>
                {event.comp}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )

  if (event.matchRef)
    return <Link href={`/partido/${event.matchRef}`} className="block no-underline">{inner}</Link>
  return inner
}

// ─── Main ─────────────────────────────────────────────────────────────────
type ViewType = 'destacados' | 'todos' | 'en-vivo' | 'resultados' | 'recordatorios'

type FormResult = 'W' | 'D' | 'L'

export default function CalendarioContent({ events, pastEvents = [], recentForms = {}, initialTz = SOURCE_TZ }: {
  events: SportEvent[]
  pastEvents?: SportEvent[]
  recentForms?: Record<string, FormResult[]>
  initialTz?: string
}) {
  // Default tab = Calendario (todos): entras a la lista con separadores por
  // día. Default chip = 'Destacados': filtra la lista a los top 4 por día.
  const [view, setView] = useState<ViewType>('todos')
  const [tz, setTz] = useState<string>(initialTz)
  const [searchRaw, setSearchRaw] = useState('')
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('Destacados')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)   // YYYY-MM-DD or null for all
  const [selectedUFCDate, setSelectedUFCDate] = useState<string | null>(null) // UFC modal date
  const [reminders, setReminders] = useState<Set<string>>(new Set())
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [onlyLive, setOnlyLive] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set())
  const [hasLoaded, setHasLoaded] = useState(false)
  // Histórico extendido (pestaña Resultados) — busca/pagina contra /api/events/past
  const [pastRange, setPastRange] = useState<'10d' | '30d' | '90d' | 'all'>('10d')
  const [extraPast, setExtraPast] = useState<SportEvent[]>([])
  const [pastNextCursor, setPastNextCursor] = useState<string | null>(null)
  const [pastLoading, setPastLoading] = useState(false)
  const [pastError, setPastError] = useState<string | null>(null)
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

      // Migración v3: la primera vez que un usuario carga después del
      // rediseño con chip Destacados, forzamos los nuevos defaults para
      // que vea realmente la nueva entrada. Si no hacemos esto, su antiguo
      // ts_cal_view='destacados' (Inicio) o ts_cal_sport='Todo' los llevan
      // al estado viejo y nunca ven el chip nuevo.
      const v3Migrated = localStorage.getItem('ts_cal_v3_chip') === '1'
      if (!v3Migrated) {
        localStorage.removeItem('ts_cal_view')
        localStorage.removeItem('ts_cal_sport')
        localStorage.setItem('ts_cal_v3_chip', '1')
      }

      const savedView  = v3Migrated ? (localStorage.getItem('ts_cal_view') as ViewType | null) : null
      const savedSport = v3Migrated ? localStorage.getItem('ts_cal_sport') : null

      // Legacy aliases: 'en-vivo' e 'destacados' (Inicio) fueron absorbidos
      // por el chip Destacados dentro del tab Calendario. Cualquier URL o
      // localStorage que apunte a esos valores cae a 'todos' (Calendario).
      const normalizedView: ViewType | null =
        (urlView === 'en-vivo' || urlView === 'destacados') ? 'todos' : urlView
      if (normalizedView && ['todos','resultados','recordatorios'].includes(normalizedView)) {
        setView(normalizedView)
      } else if (savedView && savedView !== ('en-vivo' as ViewType) && savedView !== ('destacados' as ViewType)) {
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

  // Debounce search input — avoid filtering on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw), 220)
    return () => clearTimeout(t)
  }, [searchRaw])

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

  // Destacados es un chip especial — no es un deporte sino un modo curado
  // que limita a los top 4 partidos por día por prestigio de liga + favoritos.
  const sports = ['Destacados', 'Todo', ...new Set([...events, ...pastEvents].map(e => e.sport)).values()]

  // Count events per sport for the current view (upcoming events). Used in the
  // sport filter chips so the user sees how many events each category has.
  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ev of events) {
      counts[ev.sport] = (counts[ev.sport] ?? 0) + 1
    }
    counts['Todo'] = events.length
    return counts
  }, [events])

  const filtered = useMemo(() => {
    const matchesSearch = (e: SportEvent) =>
      !search
        || namesMatch(e.home, search)
        || (e.away ? namesMatch(e.away, search) : false)
        || namesMatch(e.comp, search)
        || namesMatch(e.sport, search)
    const matchesSport = (e: SportEvent) =>
      activeFilter === 'Todo' || activeFilter === 'Destacados' || e.sport === activeFilter
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

  const hasActiveFilters = !!selectedDate || activeFilter !== 'Todo' || !!searchRaw || onlyLive
  const clearFilters = useCallback(() => {
    setSelectedDate(null)
    setActiveFilter('Todo')
    setSearchRaw('')
    setSearch('')
    setOnlyLive(false)
  }, [])

  // Days available with events (for the chip strip) — sport+search aware, not date-filtered
  const availableDays = useMemo(() => {
    const matchesSearch = (e: SportEvent) =>
      !search
        || namesMatch(e.home, search)
        || (e.away ? namesMatch(e.away, search) : false)
        || namesMatch(e.comp, search)
        || namesMatch(e.sport, search)
    const matchesSport = (e: SportEvent) =>
      activeFilter === 'Todo' || activeFilter === 'Destacados' || e.sport === activeFilter
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

  // Inferimos los deportes que le interesan al usuario a partir de sus
  // equipos favoritos: cada deporte donde aparece al menos un evento
  // con un equipo favorito. Si el usuario filtró por deporte, respetamos
  // el filtro y solo devolvemos ese.
  const favoriteSports = useMemo(() => {
    if (activeFilter !== 'Todo') return new Set<string>([activeFilter])
    if (favorites.size === 0) return new Set<string>()
    const set = new Set<string>()
    for (const ev of events) {
      if (eventHasFavorite(favorites, ev)) set.add(ev.sport)
    }
    return set
  }, [events, favorites, activeFilter])

  // Listado único de destacados para la pestaña Inicio.
  // Mezcla en una sola lista corta priorizando: favoritos del usuario →
  // top de sus deportes favoritos → top general. Sin duplicar IDs y
  // excluyendo lo que ya está en vivo (que vive en la franja superior).
  // El cap (~12) evita la sensación de scroll infinito al entrar.
  const destacadosFeed = useMemo(() => {
    if (selectedDate) return topUpcoming
    const liveIds = new Set(liveEventsInList.map(e => e.id))
    const seen = new Set<string>()
    const out: SportEvent[] = []
    const CAP = 12
    const add = (events: SportEvent[], maxN: number) => {
      let n = 0
      for (const ev of events) {
        if (out.length >= CAP || n >= maxN) break
        if (seen.has(ev.id) || liveIds.has(ev.id)) continue
        seen.add(ev.id)
        out.push(ev)
        n++
      }
    }
    // 1. Favoritos primero (proximidad temporal)
    add(favoriteEvents, 4)
    // 2. Top de cada deporte favorito (2 por deporte)
    for (const sport of favoriteSports) {
      add(topUpcoming.filter(e => e.sport === sport), 2)
    }
    // 3. Top general — rellenar hasta el cap
    add(topUpcoming, CAP - out.length)
    return out
  }, [favoriteEvents, favoriteSports, topUpcoming, liveEventsInList, selectedDate])

  const orphanFixtures = useMemo(() => {
    const LIVE_TO_SPORT: Record<string, string> = {
      soccer: 'Fútbol', basketball: 'Baloncesto', mma: 'UFC',
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

  // Si el chip Destacados está activo, en la vista Calendario se muestran
  // solo los top 4 partidos por día. Criterio combinado:
  //   1. Favoritos del usuario primero (siempre)
  //   2. Highlight score: prestigio de liga + boost por marquee team
  //      (+2), fase final/semifinal/cuartos (+4/+3/+2), live (+1.5),
  //      prime time 18-23h Madrid (+0.5)
  //   3. Empate → hora más temprana
  const filteredForGrouping = useMemo(() => {
    if (activeFilter !== 'Destacados') return filtered
    const byDay = new Map<string, SportEvent[]>()
    for (const ev of filtered) {
      const day = ev.isoDate ? isoToLocalDate(ev.isoDate) : 'unknown'
      const arr = byDay.get(day) ?? []
      arr.push(ev)
      byDay.set(day, arr)
    }
    const scoreFor = (ev: SportEvent) => {
      const live = liveScores.has(ev.id) && !FINISHED.has(liveScores.get(ev.id)?.status ?? '')
      return getEventHighlightScore({
        comp: ev.comp,
        home: ev.home,
        away: ev.away,
        stage: ev.stage,
        isoDate: ev.isoDate,
        isLive: live,
      })
    }
    const out: SportEvent[] = []
    for (const evs of byDay.values()) {
      const sorted = [...evs].sort((a, b) => {
        const aFav = eventHasFavorite(favorites, a) ? 1 : 0
        const bFav = eventHasFavorite(favorites, b) ? 1 : 0
        if (aFav !== bFav) return bFav - aFav
        const sA = scoreFor(a)
        const sB = scoreFor(b)
        if (sA !== sB) return sB - sA
        return (a.isoDate ?? '').localeCompare(b.isoDate ?? '')
      })
      out.push(...sorted.slice(0, 4))
    }
    return out
  }, [filtered, activeFilter, favorites, liveScores])

  const grouped = useMemo(() => groupEventsByDate(filteredForGrouping), [filteredForGrouping])
  const orderedDates = useMemo(() => orderedDateKeys(grouped), [grouped])

  const liveCount = liveEventsInList.length + orphanFixtures.length

  const remindedEvents = useMemo(
    () => events.filter(e => reminders.has(e.id)),
    [events, reminders]
  )

  // Histórico: 10d usa lo que entró por SSR; rangos mayores cargan desde la API.
  const useExtendedPast = pastRange !== '10d'
  const pastSource = useExtendedPast ? extraPast : pastEvents

  // Fetch del histórico extendido cuando cambia rango / deporte / búsqueda.
  useEffect(() => {
    if (!useExtendedPast) {
      setExtraPast([])
      setPastNextCursor(null)
      setPastError(null)
      return
    }
    let cancelled = false
    const ctrl = new AbortController()
    const debounce = setTimeout(async () => {
      const params = new URLSearchParams()
      const days = pastRange === '30d' ? 30 : pastRange === '90d' ? 90 : 365 * 3
      const fromDate = new Date(Date.now() - days * 86_400_000)
      params.set('from', fromDate.toISOString())
      params.set('limit', '60')
      if (activeFilter && activeFilter !== 'Todo') params.set('sport', activeFilter)
      if (search.trim()) params.set('q', search.trim())
      setPastLoading(true)
      setPastError(null)
      try {
        const res = await fetch(`/api/events/past?${params.toString()}`, { signal: ctrl.signal })
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json() as { events: SportEvent[]; nextCursor: string | null }
        if (cancelled) return
        setExtraPast(data.events ?? [])
        setPastNextCursor(data.nextCursor ?? null)
      } catch (err) {
        if (cancelled || (err as Error).name === 'AbortError') return
        setPastError('No se pudo cargar el histórico')
        setExtraPast([])
        setPastNextCursor(null)
      } finally {
        if (!cancelled) setPastLoading(false)
      }
    }, 250)
    return () => { cancelled = true; ctrl.abort(); clearTimeout(debounce) }
  }, [useExtendedPast, pastRange, activeFilter, search])

  const loadMorePast = useCallback(async () => {
    if (!pastNextCursor || pastLoading) return
    const params = new URLSearchParams()
    const days = pastRange === '30d' ? 30 : pastRange === '90d' ? 90 : 365 * 3
    const fromDate = new Date(Date.now() - days * 86_400_000)
    params.set('from', fromDate.toISOString())
    params.set('cursor', pastNextCursor)
    params.set('limit', '60')
    if (activeFilter && activeFilter !== 'Todo') params.set('sport', activeFilter)
    if (search.trim()) params.set('q', search.trim())
    setPastLoading(true)
    try {
      const res = await fetch(`/api/events/past?${params.toString()}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json() as { events: SportEvent[]; nextCursor: string | null }
      setExtraPast(prev => {
        const seen = new Set(prev.map(e => e.id))
        const fresh = (data.events ?? []).filter(e => !seen.has(e.id))
        return [...prev, ...fresh]
      })
      setPastNextCursor(data.nextCursor ?? null)
    } catch {
      setPastError('No se pudo cargar más')
    } finally {
      setPastLoading(false)
    }
  }, [pastNextCursor, pastLoading, pastRange, activeFilter, search])

  // Filtered past events (sport + search aware)
  const filteredPast = useMemo(() => {
    const matchesSearch = (e: SportEvent) =>
      !search
        || namesMatch(e.home, search)
        || (e.away ? namesMatch(e.away, search) : false)
        || namesMatch(e.comp, search)
        || namesMatch(e.sport, search)
    const matchesSport = (e: SportEvent) =>
      activeFilter === 'Todo' || activeFilter === 'Destacados' || e.sport === activeFilter
    return pastSource.filter(e => matchesSport(e) && matchesSearch(e))
  }, [pastSource, search, activeFilter])

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
    <main className="max-w-[1280px] mx-auto px-4 sm:px-4 sm:px-6 xl:px-10 pb-24">
      {/* Header */}
      <div className="relative pt-6 pb-5">
        <div className="absolute -top-8 left-0 w-80 h-48 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 20% 40%, rgba(124,58,237,0.07) 0%, transparent 70%)', filter: 'blur(16px)' }} />

        <div className="relative mb-5">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="block rounded-sm" style={{ width: 3, height: 14, background: '#7C3AED', boxShadow: '0 0 8px rgba(124,58,237,0.5)' }} />
            <span className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: '#8E8E9E', fontFamily: 'var(--font-sport)' }}>
              Sección
            </span>
          </div>
          <h1 className="font-black leading-none uppercase tracking-[0.02em]"
            style={{ fontFamily: 'var(--font-headline)', fontSize: 'clamp(2.2rem, 6vw, 3.2rem)', color: '#F8F8FF' }}>
            Calendario
          </h1>
          <p className="text-[11px] mt-2 flex items-center gap-1.5 flex-wrap" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
            <span className="tabular-nums">{filtered.length}</span>
            <span>evento{filtered.length !== 1 ? 's' : ''}</span>
            {liveCount > 0 && (
              <>
                <span style={{ color: '#38384A' }}>·</span>
                <span className="inline-flex items-center gap-1 tabular-nums" style={{ color: '#EF4444' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EF4444', animation: 'live-pulse 1.6s ease-out infinite' }} />
                  {liveCount} en vivo
                </span>
              </>
            )}
          </p>
        </div>

        {/* Timezone — compacto en mobile, completo en sm+ */}
        <div className="flex items-center gap-3 mb-3 sm:mb-5">
          <TimezoneSelector value={tz} onChange={(newTz) => { setTz(newTz); setStoredTZ(newTz) }} compact />
        </div>

        {/* Tabs — 3 principales + botón de alertas */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1"
            style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
            {/* Inicio eliminado: el chip 'Destacados' dentro de Calendario
                cumple su rol. Solo quedan Calendario y Resultados. */}
            {(['todos', 'resultados'] as const).map(tab => {
              const isActive = view === tab
              const isPastTab = tab === 'resultados'
              const pastStyle = isActive && isPastTab
              return (
                <button
                  key={tab}
                  onClick={() => setView(tab)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.18em] transition-all flex-shrink-0"
                  style={{
                    scrollSnapAlign: 'start',
                    background: isActive
                      ? (pastStyle ? 'rgba(239,68,68,0.14)' : 'rgba(124,58,237,0.18)')
                      : 'rgba(255,255,255,0.04)',
                    color: isActive
                      ? (pastStyle ? '#FCA5A5' : '#C4B5FD')
                      : '#7A7A8E',
                    border: isActive
                      ? (pastStyle ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(124,58,237,0.45)')
                      : '1px solid rgba(255,255,255,0.06)',
                    fontFamily: 'var(--font-sport)',
                    cursor: 'pointer',
                    boxShadow: isActive && !pastStyle ? '0 0 14px rgba(124,58,237,0.18)' : 'none',
                  }}>
                  {tab === 'todos' && (
                    <>
                      Calendario
                      {liveCount > 0 && (
                        <span className="inline-flex items-center gap-1 ml-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EF4444', animation: 'live-pulse 1.6s ease-out infinite' }} />
                          <span className="tabular-nums" style={{ color: isActive ? '#FCA5A5' : '#EF4444' }}>{liveCount}</span>
                        </span>
                      )}
                    </>
                  )}
                  {tab === 'resultados' && `Resultados${pastSource.length > 0 ? ` · ${pastSource.length}` : ''}`}
                </button>
              )
            })}
          </div>
          {/* Alertas — botón icono auxiliar */}
          {(() => {
            const isActive = view === 'recordatorios'
            const remCount = remindedEvents.length
            return (
              <button
                onClick={() => setView(isActive ? 'destacados' : 'recordatorios')}
                aria-label="Alertas"
                title="Mis recordatorios"
                className="relative flex items-center justify-center rounded-full flex-shrink-0 transition-all"
                style={{
                  width: 36, height: 36,
                  background: isActive ? 'rgba(251,191,36,0.16)' : 'rgba(255,255,255,0.04)',
                  border: isActive ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  color: isActive ? '#FBBF24' : '#7A7A8E',
                  cursor: 'pointer',
                }}>
                <BellIcon size={14} />
                {remCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center text-[9px] font-black tabular-nums rounded-full"
                    style={{ minWidth: 16, height: 16, padding: '0 4px', background: '#FBBF24', color: '#0a0a12', border: '1px solid var(--bg-base)', fontFamily: 'var(--font-sport)' }}>
                    {remCount}
                  </span>
                )}
              </button>
            )
          })()}
        </div>
      </div>

      {/* Day chips + Toolbar (sticky on scroll) */}
      {view !== 'en-vivo' && view !== 'recordatorios' && view !== 'resultados' && (
        <div
          className="mb-4 -mx-4 sm:-mx-6 xl:-mx-10 px-4 sm:px-4 sm:px-6 xl:px-10 pt-2 pb-3"
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
            <div className="mb-2.5">
              <DayChips days={availableDays} value={selectedDate} onChange={setSelectedDate} />
            </div>
          )}
          {/* Toolbar — single scrollable row on mobile, two-row layout on sm+ */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
            <SearchInput value={searchRaw} onChange={setSearchRaw} />
            {/* Divider */}
            <div className="flex-shrink-0 w-px h-4" style={{ background: 'rgba(255,255,255,0.08)' }} />
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
              En vivo
            </button>
            {hasActiveFilters && (
              <>
                <div className="flex-shrink-0 w-px h-4" style={{ background: 'rgba(255,255,255,0.08)' }} />
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
              </>
            )}
          </div>

          {/* Sport categories — Destacados es una pastilla resaltada,
              el resto tabs de texto plano con subrayado púrpura al activo.
              Mask en el borde derecho indica que hay scroll horizontal. */}
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-px -mx-1 px-1 scrollbar-hide"
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              maskImage: 'linear-gradient(to right, #000 0, #000 calc(100% - 24px), transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, #000 0, #000 calc(100% - 24px), transparent 100%)',
            }}>
            {sports.map(sport => {
              const active = activeFilter === sport
              const isDestacados = sport === 'Destacados'
              if (isDestacados) {
                return (
                  <button
                    key={sport}
                    onClick={() => setActiveFilter(sport)}
                    className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-black uppercase tracking-[0.12em] transition-all flex-shrink-0"
                    style={{
                      color: active ? '#fff' : '#C4B5FD',
                      background: active ? '#7C3AED' : 'rgba(124,58,237,0.16)',
                      border: active ? '1px solid #A78BFA' : '1px solid rgba(124,58,237,0.4)',
                      fontFamily: 'var(--font-sport)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: active ? '0 0 16px rgba(124,58,237,0.5)' : 'none',
                      marginBottom: 6,
                    }}>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                      <path d="M6 1l1.5 3.2 3.5.5-2.5 2.4.6 3.4L6 8.9 2.9 10.5l.6-3.4L1 4.7l3.5-.5L6 1z" />
                    </svg>
                    {sport}
                  </button>
                )
              }
              return (
                <button
                  key={sport}
                  onClick={() => setActiveFilter(sport)}
                  className="relative px-3 py-2.5 text-[13px] font-semibold transition-colors flex-shrink-0"
                  style={{
                    color: active ? '#F0F0FA' : '#7A7A8E',
                    fontFamily: 'var(--font-sport)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    background: 'transparent',
                    border: 'none',
                  }}>
                  {sport}
                  {active && (
                    <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full"
                      style={{ background: '#7C3AED', boxShadow: '0 0 8px rgba(124,58,237,0.5)' }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Content */}
      {view === 'destacados' && (
        <div className="space-y-7">
          {/* 1. En Vivo Ahora — siempre arriba si hay vivos */}
          {liveCount > 0 && (
            <section>
              <SectionHeader
                icon={<LiveDotIcon size={8} />}
                label="En Vivo Ahora"
                color="#EF4444"
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

          {/* 2. CTA para usuarios nuevos sin favoritos */}
          {favorites.size === 0 && filtered.length > 0 && !onlyLive && (
            <section
              className="rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4"
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.14) 0%, rgba(244,114,182,0.08) 100%)',
                border: '1px solid rgba(124,58,237,0.28)',
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em]"
                    style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}>
                    Personaliza tu Inicio
                  </span>
                </div>
                <p className="text-[14px] leading-snug font-bold mb-1" style={{ color: '#F0F0FA', fontFamily: 'var(--font-sport)' }}>
                  Elige tus equipos favoritos y verás aquí sus próximos partidos, formaciones recientes y aviso cuando estén por jugar.
                </p>
                <p className="text-[11px]" style={{ color: '#8E8E9E', fontFamily: 'var(--font-sport)' }}>
                  Lleva 30 segundos · puedes cambiarlo cuando quieras.
                </p>
              </div>
              <button
                onClick={() => setShowOnboarding(true)}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.16em] transition-all"
                style={{
                  background: '#7C3AED', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.12)',
                  fontFamily: 'var(--font-sport)', cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(124,58,237,0.35)',
                }}
              >
                ♥ Elegir equipos
              </button>
            </section>
          )}

          {/* 3. Estado de tus equipos — solo los chips para tener visibilidad
              rápida; los partidos se mezclan en el feed unificado de abajo. */}
          {favorites.size > 0 && !onlyLive && !selectedDate && (
            <FavoritesSection
              favoriteEvents={favoriteEvents}
              favorites={favorites}
              liveScores={liveScores}
              reminders={reminders}
              flashIds={flashIds}
              recentForms={recentForms}
              tz={tz}
              toggleReminder={toggleReminder}
              toggleFavorite={toggleFavorite}
              setSelectedUFCDate={setSelectedUFCDate}
              onEdit={() => setShowOnboarding(true)}
              filterActive={activeFilter !== 'Todo' || !!search}
              chipsOnly
            />
          )}

          {/* 4. Partidos destacados — listado único curado, máximo 12 */}
          {destacadosFeed.length > 0 && (
            <section>
              <SectionHeader
                icon="⭐"
                label={selectedDate
                  ? `Partidos · ${formatDateLabel(selectedDate)}`
                  : favorites.size > 0
                    ? 'Para ti'
                    : 'Partidos destacados'}
                color="#C4B5FD"
                count={destacadosFeed.length}
              />
              <div className="space-y-1.5">
                {destacadosFeed.map(event => {
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
                      formHome={recentForms[event.home]}
                      formAway={event.away ? recentForms[event.away] : undefined}
                      showComp
                      tz={tz}
                    />
                  )
                })}
              </div>
              {!selectedDate && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={() => setView('todos')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.16em] transition-all"
                    style={{
                      color: '#C4B5FD',
                      background: 'rgba(124,58,237,0.12)',
                      border: '1px solid rgba(124,58,237,0.32)',
                      fontFamily: 'var(--font-sport)',
                      cursor: 'pointer',
                    }}
                  >
                    Ver toda la agenda
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              )}
            </section>
          )}

          {filtered.length === 0 && liveCount === 0 && (
            <div className="text-center py-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="mb-2 flex justify-center" style={{ color: '#5A5A6A' }}>
                {search
                  ? <SearchIcon size={32} />
                  : activeFilter !== 'Todo'
                    ? <SportIcon sport={activeFilter} size={32} />
                    : <CalendarIcon size={32} />}
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
              <p className="mb-2 flex justify-center" style={{ color: '#5A5A6A' }}><TvIcon size={28} /></p>
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
        <div className="space-y-10">
          {/* Live strip at top of TODOS view */}
          {liveCount > 0 && !selectedDate && (
            <section>
              <SectionHeader icon={<LiveDotIcon size={8} />} label="En Vivo" color="#4ade80" count={liveCount} hint={liveCount > 3 ? '← desliza →' : undefined} />
              <LiveHeroStrip items={liveHeroCards} />
            </section>
          )}

          {orderedDates.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="mb-2 flex justify-center" style={{ color: '#5A5A6A' }}>
                {search
                  ? <SearchIcon size={32} />
                  : (activeFilter !== 'Todo' && activeFilter !== 'Destacados')
                    ? <SportIcon sport={activeFilter} size={32} />
                    : <CalendarIcon size={32} />}
              </p>
              <p style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', fontSize: 13, fontWeight: 600 }}>
                {search
                  ? `Sin resultados para "${search}"`
                  : (activeFilter !== 'Todo' && activeFilter !== 'Destacados')
                    ? `No hay eventos de ${activeFilter} en los próximos días`
                    : 'No se encontraron eventos'}
              </p>
              {search && (
                <p className="text-[10px] mt-1.5" style={{ color: '#4A4A5A' }}>Prueba con el nombre del equipo o la competición</p>
              )}
              {!search && (activeFilter !== 'Todo' && activeFilter !== 'Destacados') && (
                <p className="text-[10px] mt-1.5" style={{ color: '#4A4A5A' }}>Prueba seleccionando otra fecha o cambia el filtro</p>
              )}
            </div>
          ) : (
            orderedDates.map(dateKey => {
              const dayEvents = grouped[dateKey] ?? []
              // Group by competition, preserving order of first appearance
              const compOrder: string[] = []
              const byComp: Record<string, typeof dayEvents> = {}
              for (const ev of dayEvents) {
                if (!byComp[ev.comp]) { byComp[ev.comp] = []; compOrder.push(ev.comp) }
                byComp[ev.comp].push(ev)
              }
              return (
                <section key={dateKey}>
                  <DaySeparator dateKey={dateKey} count={dayEvents.length} />
                  {compOrder.map((comp, compIdx) => {
                    const compEvents = byComp[comp]
                    const accent = getCompAccent(comp, compEvents[0]?.accent)
                    return (
                      <div key={comp} className="mb-2 relative">
                        <CompGroupHeader comp={comp} accent={accent} count={compEvents.length} first={compIdx === 0} />
                        <div className="space-y-1.5">
                          {compEvents.map(event => (
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
                              formHome={recentForms[event.home]}
                              formAway={event.away ? recentForms[event.away] : undefined}
                              tz={tz}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </section>
              )
            })
          )}

          {/* CTA — invitar a ver toda la agenda cuando estamos en modo Destacados */}
          {activeFilter === 'Destacados' && orderedDates.length > 0 && filtered.length > filteredForGrouping.length && (
            <div className="flex flex-col items-center gap-1.5 pt-2">
              <p className="text-[11px]" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                Mostrando los 4 más destacados por día
              </p>
              <button
                onClick={() => setActiveFilter('Todo')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.16em] transition-all"
                style={{
                  color: '#C4B5FD',
                  background: 'rgba(124,58,237,0.12)',
                  border: '1px solid rgba(124,58,237,0.32)',
                  fontFamily: 'var(--font-sport)',
                  cursor: 'pointer',
                }}
              >
                Ver toda la agenda ({filtered.length})
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {view === 'recordatorios' && (
        <div className="space-y-5">
          {remindedEvents.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="mb-3 flex justify-center" style={{ color: '#FBBF24', opacity: 0.6 }}><BellIcon size={32} /></p>
              <p style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', fontSize: 13, fontWeight: 600 }}>
                No tienes recordatorios activos
              </p>
              <p className="text-[10px] mt-1.5 flex items-center justify-center gap-1" style={{ color: '#4A4A5A' }}>
                Pulsa <BellIcon size={10} /> en cualquier partido para recordarlo
              </p>
            </div>
          ) : (
            <section>
              <SectionHeader icon={<BellIcon size={12} />} label="Mis Recordatorios" color="#FBBF24" count={remindedEvents.length} />
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
                      formHome={recentForms[event.home]}
                      formAway={event.away ? recentForms[event.away] : undefined}
                      tz={tz}
                    />
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {view === 'resultados' && (
        <div className="space-y-10">
          {/* Compact sport + search toolbar */}
          <div
            className="-mx-4 sm:-mx-6 xl:-mx-10 px-4 sm:px-4 sm:px-6 xl:px-10 pt-2 pb-3 mb-1"
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
              <SearchInput value={searchRaw} onChange={setSearchRaw} />
              <div className="flex items-center gap-1 overflow-x-auto pb-px -mx-1 px-1 scrollbar-hide"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {sports.map(sport => {
                  const active = activeFilter === sport
                  return (
                    <button
                      key={sport}
                      onClick={() => setActiveFilter(sport)}
                      className="relative px-3 py-2.5 text-[13px] font-semibold transition-colors flex-shrink-0"
                      style={{
                        color: active ? '#F0F0FA' : '#7A7A8E',
                        fontFamily: 'var(--font-sport)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        background: 'transparent',
                        border: 'none',
                      }}>
                      {sport}
                      {active && (
                        <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full"
                          style={{ background: '#7C3AED', boxShadow: '0 0 8px rgba(124,58,237,0.5)' }} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
            {/* Rango temporal */}
            <div className="flex items-center gap-2 mt-2.5 overflow-x-auto pb-0.5 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
              <span className="text-[9px] font-black uppercase tracking-widest flex-shrink-0" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
                Rango
              </span>
              {([
                { id: '10d', label: '10 días' },
                { id: '30d', label: '1 mes' },
                { id: '90d', label: '3 meses' },
                { id: 'all', label: 'Histórico' },
              ] as const).map(opt => {
                const active = pastRange === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => setPastRange(opt.id)}
                    className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0"
                    style={{
                      background: active ? 'rgba(252,165,165,0.14)' : 'rgba(255,255,255,0.03)',
                      color: active ? '#FCA5A5' : '#5A5A6A',
                      border: active ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.06)',
                      fontFamily: 'var(--font-sport)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}>
                    {opt.label}
                  </button>
                )
              })}
              {pastLoading && (
                <span className="text-[9px] flex-shrink-0" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                  cargando…
                </span>
              )}
            </div>
            {pastError && (
              <p className="text-[10px] mt-1.5" style={{ color: '#FCA5A5', fontFamily: 'var(--font-sport)' }}>
                {pastError}
              </p>
            )}
          </div>

          {pastOrderedDates.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="mb-2 flex justify-center" style={{ color: '#5A5A6A' }}><ClipboardIcon size={32} /></p>
              <p style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', fontSize: 13, fontWeight: 600 }}>
                {pastLoading
                  ? 'Buscando resultados…'
                  : search
                    ? `Sin resultados para "${search}"`
                    : activeFilter !== 'Todo'
                      ? `Sin ${activeFilter} en los últimos ${pastRange === '10d' ? '10 días' : pastRange === '30d' ? '30 días' : pastRange === '90d' ? '90 días' : '3 años'}`
                      : `Sin resultados en los últimos ${pastRange === '10d' ? '10 días' : pastRange === '30d' ? '30 días' : pastRange === '90d' ? '90 días' : '3 años'}`}
              </p>
              {!pastLoading && (
                <div className="mt-3 flex flex-col gap-1.5 items-center">
                  {pastRange !== 'all' && (
                    <button onClick={() => setPastRange('all')}
                      className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(124,58,237,0.12)', color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.32)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}>
                      Ampliar a histórico completo
                    </button>
                  )}
                  {(search || activeFilter !== 'Todo') && (
                    <button onClick={clearFilters}
                      className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.04)', color: '#7A7A8E', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}>
                      ✕ Quitar filtros
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            pastOrderedDates.map(dateKey => {
              const dayEvents = pastGrouped[dateKey] ?? []
              const compOrder: string[] = []
              const byComp: Record<string, typeof dayEvents> = {}
              for (const ev of dayEvents) {
                if (!byComp[ev.comp]) { byComp[ev.comp] = []; compOrder.push(ev.comp) }
                byComp[ev.comp].push(ev)
              }
              return (
                <section key={dateKey}>
                  <DaySeparator dateKey={dateKey} count={dayEvents.length} tone="past" />
                  {compOrder.map((comp, compIdx) => {
                    const compEvents = byComp[comp]
                    const accent = getCompAccent(comp, compEvents[0]?.accent)
                    return (
                      <div key={comp} className="mb-2 relative">
                        <CompGroupHeader comp={comp} accent={accent} count={compEvents.length} first={compIdx === 0} />
                        <div className="space-y-1.5">
                          {compEvents.map(event => (
                            <PastMatchRow
                              key={event.id}
                              event={event}
                              isFav={eventHasFavorite(favorites, event)}
                              onToggleFav={() => toggleFavorite(event.home)}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </section>
              )
            })
          )}

          {useExtendedPast && pastNextCursor && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMorePast}
                disabled={pastLoading}
                className="px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.18em] transition-all"
                style={{
                  background: 'rgba(124,58,237,0.14)',
                  color: '#C4B5FD',
                  border: '1px solid rgba(124,58,237,0.35)',
                  fontFamily: 'var(--font-sport)',
                  cursor: pastLoading ? 'wait' : 'pointer',
                  opacity: pastLoading ? 0.6 : 1,
                }}>
                {pastLoading ? 'Cargando…' : 'Cargar más resultados'}
              </button>
            </div>
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
