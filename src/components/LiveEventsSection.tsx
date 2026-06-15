'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import type { SportEvent } from '@/lib/types'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { getCompAccent, getLiveLabel } from '@/lib/competitions'
import { TvIcon } from '@/components/icons/GameIcons'
import { toProxyUrl } from '@/lib/image-url'
import { isoToLocalDate } from '@/lib/calendar'

// ── Live scores ────────────────────────────────────────────────────
interface LiveScore {
  homeGoals: number | null
  awayGoals: number | null
  status: string
  elapsed: number | null
  homeLogo?: string
  awayLogo?: string
  matchRef?: string
}

const FINISHED = new Set(['FT', 'Final', 'FINAL', 'FINAL_PEN', 'FINAL_AET', 'STATUS_FINAL', 'NS', 'STATUS_SCHEDULED',
  'POST_GAME', 'END_OF_REGULATION',
  'ABANDONED', 'WALKOVER', 'RETIRED', 'CANCELED', 'POSTPONED', 'SUSPENDED'])

function normalize(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}
function namesMatch(a: string, b: string) {
  const na = normalize(a), nb = normalize(b)
  return na === nb || na.includes(nb) || nb.includes(na)
}


type FixtureRaw = {
  homeTeam: string; awayTeam: string
  homeGoals: number | null; awayGoals: number | null
  status: string; elapsed: number | null
  homeLogo?: string; awayLogo?: string; id?: string
}

function useLiveScores(events: SportEvent[]): Map<string, LiveScore> {
  const [scores, setScores] = useState<Map<string, LiveScore>>(new Map())

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/events/live', { cache: 'no-store' })
      if (!res.ok) return
      const fixtures: FixtureRaw[] = await res.json()
      const next = new Map<string, LiveScore>()
      for (const ev of events) {
        if (!ev.away) continue
        const m = fixtures.find(f => namesMatch(f.homeTeam, ev.home) && namesMatch(f.awayTeam, ev.away!))
        if (m) next.set(ev.id, {
          homeGoals: m.homeGoals, awayGoals: m.awayGoals,
          status: m.status, elapsed: m.elapsed,
          homeLogo: m.homeLogo, awayLogo: m.awayLogo,
        })
      }
      setScores(next)
    } catch { /* ignore */ }
  }, [events])

  // Polling pausado mientras la pestaña está oculta.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => { if (!timer) timer = setInterval(fetch_, 60_000) }
    const stop  = () => { if (timer) { clearInterval(timer); timer = null } }
    const onVis = () => {
      if (typeof document === 'undefined') return
      if (document.visibilityState === 'visible') { fetch_(); start() } else { stop() }
    }
    fetch_()
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') start()
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis)
    }
  }, [fetch_])

  return scores
}

// ── Icons ──────────────────────────────────────────────────────────
function BellIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5A4.5 4.5 0 003.5 6v2.5L2 10.5h12L12.5 8.5V6A4.5 4.5 0 008 1.5z"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
        fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.3 : 0} />
      <path d="M6.5 10.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function TeamLogo({ logo, name, size = 22 }: { logo?: string; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  if (!logo || err) {
    return (
      <span className="flex items-center justify-center rounded-full text-[9px] font-black flex-shrink-0"
        style={{ width: size, height: size, background: 'rgba(255,255,255,0.06)', color: '#666' }}>
        {name.slice(0, 2).toUpperCase()}
      </span>
    )
  }
  // El escudo se ve a ~34px pero ESPN lo sirve a 500px (~220 KB PNG). Lo pasamos
  // por el proxy a un tamaño acorde (WebP ~4 KB) + lazy/async para no robar
  // ancho de banda a la carga inicial (LCP).
  const src = logo.startsWith('http') ? `${toProxyUrl(logo)}&w=${Math.round(size * 2)}` : logo
  return (
    <img src={src} alt={name} width={size} height={size} loading="lazy" decoding="async" onError={() => setErr(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />
  )
}

// Countdown legible "en 2h 15m" / "en 45m" / "en 12s" cuando falta poco.
// Devuelve null si no aplica (sin fecha, faltan >12h, ya empezó, o en directo).
function useCountdown(isoDate: string | undefined, isLive: boolean): string | null {
  const [label, setLabel] = useState<string | null>(null)
  useEffect(() => {
    if (!isoDate || isLive) { setLabel(null); return }
    const target = new Date(isoDate).getTime()
    if (!Number.isFinite(target)) { setLabel(null); return }
    const compute = () => {
      const diff = target - Date.now()
      if (diff <= 0 || diff > 12 * 3600_000) { setLabel(null); return }
      const h = Math.floor(diff / 3600_000)
      const m = Math.floor((diff % 3600_000) / 60_000)
      if (h > 0) setLabel(`en ${h}h ${m}m`)
      else if (m > 0) setLabel(`en ${m}m`)
      else setLabel(`en ${Math.max(1, Math.floor(diff / 1000))}s`)
    }
    compute()
    const t = setInterval(compute, 60_000)
    return () => clearInterval(t)
  }, [isoDate, isLive])
  return label
}

// ── EventCard ──────────────────────────────────────────────────────
function EventCard({ event, liveScore }: { event: SportEvent; liveScore?: LiveScore }) {
  const [reminded, setReminded] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return (JSON.parse(localStorage.getItem('ts_reminders') ?? '[]') as string[]).includes(event.id) }
    catch { return false }
  })

  // Score flash animation when goals change
  const [scoreFlash, setScoreFlash] = useState(false)
  const prevGoals = useRef<{ h: number | null; a: number | null } | null>(null)
  useEffect(() => {
    if (!liveScore) return
    const prev = prevGoals.current
    if (prev !== null && (prev.h !== liveScore.homeGoals || prev.a !== liveScore.awayGoals)) {
      setScoreFlash(true)
      const t = setTimeout(() => setScoreFlash(false), 2000)
      return () => clearTimeout(t)
    }
    prevGoals.current = { h: liveScore.homeGoals, a: liveScore.awayGoals }
  }, [liveScore?.homeGoals, liveScore?.awayGoals]) // eslint-disable-line

  const toggleReminder = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setReminded((prev: boolean) => {
      const next = !prev
      try {
        const saved: string[] = JSON.parse(localStorage.getItem('ts_reminders') ?? '[]')
        localStorage.setItem('ts_reminders', JSON.stringify(
          next ? [...saved.filter(id => id !== event.id), event.id] : saved.filter(id => id !== event.id)
        ))
        window.dispatchEvent(new CustomEvent('ts-reminders-change'))
      } catch { /* ignore */ }
      return next
    })
  }

  const compColor  = getCompAccent(event.comp, event.accent)
  const isLive     = !!liveScore && !FINISHED.has(liveScore.status)
  const scoreStr   = liveScore != null ? `${liveScore.homeGoals ?? 0} – ${liveScore.awayGoals ?? 0}` : null
  const homeLogo   = liveScore?.homeLogo ?? event.homeLogo
  const awayLogo   = liveScore?.awayLogo ?? event.awayLogo
  const matchRef   = event.matchRef
  const showLogos  = !!event.away && !!(homeLogo || awayLogo)

  // Countdown: tic-tac client-side cuando faltan <12h y no está en directo
  const countdown = useCountdown(event.isoDate, isLive)
  // Versión para lectores de pantalla: "Empieza en 2 horas y 15 minutos"
  const countdownAria = (() => {
    if (!countdown) return null
    const h = countdown.match(/(\d+)h/)?.[1]
    const m = countdown.match(/(\d+)m\b/)?.[1]
    const s = countdown.match(/(\d+)s\b/)?.[1]
    const parts: string[] = []
    if (h) parts.push(`${h} ${h === '1' ? 'hora' : 'horas'}`)
    if (m) parts.push(`${m} ${m === '1' ? 'minuto' : 'minutos'}`)
    if (s) parts.push(`${s} ${s === '1' ? 'segundo' : 'segundos'}`)
    return parts.length ? `Empieza en ${parts.join(' y ')}` : null
  })()
  // Píldoras secundarias: stage (jornada/ronda) y broadcast (canal)
  const hasMeta = !!(event.stage || event.broadcast)

  const card = (
    <div
      className="group/card relative flex-shrink-0 overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5"
      style={{
        width: 'clamp(198px, 56vw, 228px)',
        borderRadius: 16,
        background: isLive
          ? 'linear-gradient(160deg, rgba(74,222,128,0.10) 0%, var(--bg-card) 58%)'
          : `linear-gradient(165deg, ${compColor}14 0%, var(--bg-card) 52%)`,
        border: isLive ? '1px solid rgba(74,222,128,0.25)' : `1px solid ${compColor}22`,
        borderTop: `2.5px solid ${isLive ? '#4ade80' : compColor}`,
        boxShadow: isLive ? '0 6px 26px rgba(74,222,128,0.12)' : '0 6px 24px rgba(0,0,0,0.32)',
        cursor: matchRef ? 'pointer' : 'default',
      }}
    >
      {/* Glow decorativo por color de competición */}
      <div aria-hidden className="absolute pointer-events-none opacity-70"
        style={{ top: -28, right: -28, width: 110, height: 110, borderRadius: '50%',
          background: `radial-gradient(circle, ${isLive ? 'rgba(74,222,128,0.18)' : compColor + '22'} 0%, transparent 70%)` }} />
      <div className="relative px-4 pt-3.5 pb-4 flex flex-col gap-2.5">

        {/* Sport + competition */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {(event.date === 'Hoy' || isLive) && (
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
                style={{ background: isLive ? '#4ade80' : compColor }} />
            )}
            <span className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: isLive ? '#4ade80' : event.accent, fontFamily: 'var(--font-sport)' }}>
              {event.sport}
            </span>
          </div>
          <span className="text-[8px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${compColor}18`, color: compColor, border: `1px solid ${compColor}35` }}>
            {event.comp}
          </span>
        </div>

        {/* Matchup with logos */}
        {showLogos ? (
          <div className="flex items-center gap-2 py-0.5">
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <TeamLogo logo={homeLogo} name={event.home} size={34} />
              <p className="font-black text-center leading-tight w-full text-[11px] truncate"
                style={{ color: '#F0F0F5', fontFamily: 'var(--font-sport)' }}>
                {event.homeAbbr ?? event.home.split(' ').slice(-1)[0]}
              </p>
            </div>
            <span className="flex-shrink-0 flex items-center justify-center text-[8px] font-black rounded-full"
              style={{ width: 20, height: 20, color: compColor, background: `${compColor}1a`, border: `1px solid ${compColor}33`, fontFamily: 'var(--font-display)' }}>
              VS
            </span>
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <TeamLogo logo={awayLogo} name={event.away!} size={34} />
              <p className="font-black text-center leading-tight w-full text-[11px] truncate"
                style={{ color: '#C0C0D4', fontFamily: 'var(--font-sport)' }}>
                {event.awayAbbr ?? event.away!.split(' ').slice(-1)[0]}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <p className="font-black leading-tight"
              style={{ color: '#F0F0F5', fontFamily: 'var(--font-sport)', fontSize: 14 }}>
              {event.home}
            </p>
            {event.away ? (
              <p className="font-semibold leading-tight" style={{ color: '#C0C0D4', fontFamily: 'var(--font-sport)', fontSize: 13 }}>
                vs {event.away}
              </p>
            ) : (
              <p className="leading-tight" style={{ color: '#3A3A4A', fontSize: 11 }}>&nbsp;</p>
            )}
          </div>
        )}

        {/* Meta secundaria: stage + broadcast */}
        {hasMeta && !isLive && (
          <div className="flex items-center gap-1.5 flex-wrap -mt-0.5">
            {event.stage && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: '#8A8AA0',
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontFamily: 'var(--font-sport)',
                  letterSpacing: '0.02em',
                }}>
                {event.stage}
              </span>
            )}
            {event.broadcast && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1 truncate max-w-full"
                style={{
                  background: 'rgba(99,102,241,0.07)',
                  color: '#A5B4FC',
                  border: '1px solid rgba(99,102,241,0.18)',
                  fontFamily: 'var(--font-sport)',
                }}
                title={event.broadcast}>
                <span aria-hidden style={{ color: '#A5B4FC' }}><TvIcon size={10} /></span>
                <span className="truncate">{event.broadcast}</span>
              </span>
            )}
          </div>
        )}

        {/* Score / time row */}
        {isLive && scoreStr ? (
          <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors duration-700"
            style={{
              background: scoreFlash ? 'rgba(74,222,128,0.22)' : 'rgba(74,222,128,0.07)',
              border: `1px solid ${scoreFlash ? 'rgba(74,222,128,0.5)' : 'rgba(74,222,128,0.18)'}`,
            }}>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: '#4ade80' }} />
              <span className="font-black tabular-nums"
                style={{ color: scoreFlash ? '#86efac' : '#4ade80', fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: '0.04em', transition: 'color 0.7s' }}>
                {scoreStr}
              </span>
              <span className="text-[9px] font-black" style={{ color: '#22a86a', fontFamily: 'var(--font-sport)' }}>
                {getLiveLabel(liveScore.status, liveScore.elapsed)}
              </span>
            </div>
            <button onClick={toggleReminder} title="Recordatorio"
              className="flex items-center justify-center w-6 h-6 rounded-md transition-all"
              style={{ background: reminded ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)', color: reminded ? '#4ade80' : 'var(--text-muted)', border: reminded ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}>
              <BellIcon filled={reminded} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-1.5">
              {countdown ? (
                <span className="text-[10px] font-black uppercase tracking-wider"
                  aria-label={countdownAria ?? undefined}
                  style={{ color: event.accent, fontFamily: 'var(--font-sport)' }}>
                  {countdown}
                </span>
              ) : (
                <>
                  <span className="text-[10px] font-semibold" style={{ color: '#7A7A8E' }}>{event.date}</span>
                  <span className="text-[9px]" style={{ color: '#3A3A4A' }}>·</span>
                  <span className="font-black"
                    style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: '0.03em' }}>
                    {event.time}
                  </span>
                </>
              )}
            </div>
            <button onClick={toggleReminder} title={reminded ? 'Quitar recordatorio' : 'Recordar evento'}
              className="flex items-center justify-center w-6 h-6 rounded-md transition-all"
              style={{ background: reminded ? `${event.accent}22` : 'rgba(255,255,255,0.05)', color: reminded ? event.accent : 'var(--text-muted)', border: reminded ? `1px solid ${event.accent}35` : '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}>
              <BellIcon filled={reminded} />
            </button>
          </div>
        )}

      </div>
    </div>
  )

  return matchRef
    ? <Link href={`/partido/${matchRef}`} style={{ textDecoration: 'none' }}>{card}</Link>
    : card
}

// ── Client-side upcoming refresh ───────────────────────────────────
const SPORT_LABELS: Record<string, string> = {
  soccer: 'Fútbol', basketball: 'Baloncesto', racing: 'F1', mma: 'UFC', tennis: 'Tenis',
}
const SPORT_ACCENTS: Record<string, string> = {
  soccer: '#22c55e', basketball: '#f59e0b', racing: '#ef4444', mma: '#f97316', tennis: '#d97706',
}

interface UpcomingRaw {
  id: string; homeTeam: string; awayTeam: string | null; time: string; dateLabel: string
  sport: string; comp: string; matchRef?: string
  homeLogo?: string; awayLogo?: string; homeAbbr?: string; awayAbbr?: string
  isoDate?: string; broadcast?: string
}

function convertUpcoming(items: UpcomingRaw[]): SportEvent[] {
  return items.map(ev => ({
    id: ev.id,
    home: ev.homeTeam,
    away: ev.awayTeam,
    sport: SPORT_LABELS[ev.sport] ?? ev.sport,
    comp: ev.comp,
    date: ev.dateLabel,
    time: ev.time,
    accent: SPORT_ACCENTS[ev.sport] ?? '#7C3AED',
    matchRef: ev.matchRef,
    homeLogo: ev.homeLogo,
    awayLogo: ev.awayLogo,
    homeAbbr: ev.homeAbbr,
    awayAbbr: ev.awayAbbr,
    isoDate: ev.isoDate,
    broadcast: ev.broadcast,
  }))
}

// ── Main component ─────────────────────────────────────────────────
type EventFilter = 'destacados' | 'hoy' | 'mis-equipos'

export default function LiveEventsSection({
  preview = true,
  events: eventsProp,
}: {
  preview?: boolean
  events?: SportEvent[]
}) {
  // Start with server-rendered events, refresh client-side after 5 min
  const [events, setEvents] = useState<SportEvent[]>(eventsProp ?? [])

  // Filtro del bloque: destacados (por defecto) · hoy · mis equipos (favoritos).
  const [filter, setFilter] = useState<EventFilter>('destacados')
  // Lista amplia (todos los deportes) que se carga BAJO DEMANDA al usar un
  // filtro, para no pedir datos extra en la carga inicial (no toca el LCP).
  const [fullEvents, setFullEvents] = useState<SportEvent[] | null>(null)
  const [fullLoading, setFullLoading] = useState(false)
  // Equipos favoritos (navegador + cuenta), también bajo demanda.
  const [favTeams, setFavTeams] = useState<string[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const res = await fetch('/api/events/upcoming', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const raw: UpcomingRaw[] = await res.json()
        if (!cancelled) setEvents(convertUpcoming(raw.slice(0, 8)))
      } catch { /* ignore */ }
    }
    // Refresh once after 5 minutes to fix stale date labels in long sessions
    const timer = setTimeout(refresh, 5 * 60_000)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])

  // Carga la lista amplia (todos los deportes) la 1ª vez que se usa un filtro.
  useEffect(() => {
    if (filter === 'destacados' || fullEvents !== null || fullLoading) return
    let cancelled = false
    setFullLoading(true)
    fetch('/api/events/upcoming', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : []))
      .then((raw: UpcomingRaw[]) => { if (!cancelled) setFullEvents(convertUpcoming((raw ?? []).slice(0, 60))) })
      .catch(() => { if (!cancelled) setFullEvents([]) })
      .finally(() => { if (!cancelled) setFullLoading(false) })
    return () => { cancelled = true }
  }, [filter, fullEvents, fullLoading])

  // Carga los equipos favoritos la 1ª vez que se entra en "mis equipos".
  useEffect(() => {
    if (filter !== 'mis-equipos' || favTeams !== null) return
    let cancelled = false
    let local: string[] = []
    try { const v = JSON.parse(localStorage.getItem('ts_favorites') ?? '[]'); local = Array.isArray(v) ? v : [] }
    catch { /* ignore */ }
    setFavTeams(local)   // pinta lo local al instante
    fetch('/api/rankings/favorites', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : { favorites: [] }))
      .then((j: { favorites?: { entry_id: string }[] }) => {
        if (cancelled) return
        const cloud = (j.favorites ?? []).map(f => f.entry_id)
          .filter(id => id.startsWith('team:')).map(id => id.slice(5))
        setFavTeams([...new Set([...local, ...cloud])])
      })
      .catch(() => { /* nos quedamos con lo local */ })
    return () => { cancelled = true }
  }, [filter, favTeams])

  // Eventos a mostrar según el filtro.
  const displayEvents = useMemo<SportEvent[]>(() => {
    if (filter === 'destacados') return events
    const base = fullEvents ?? []
    if (filter === 'hoy') {
      const today = isoToLocalDate(new Date().toISOString())
      return base.filter(ev => ev.isoDate && isoToLocalDate(ev.isoDate) === today)
    }
    const favs = (favTeams ?? []).filter(Boolean)
    if (favs.length === 0) return []
    return base.filter(ev =>
      favs.some(t => (ev.home && namesMatch(t, ev.home)) || (ev.away && namesMatch(t, ev.away)))
    )
  }, [filter, events, fullEvents, favTeams])

  const liveScores = useLiveScores(displayEvents)
  const containerRef = useScrollReveal()

  // Estado de carga / vacío del filtro activo (mensaje honesto por caso).
  const showLoading = filter !== 'destacados' && fullLoading && displayEvents.length === 0
  const noFavs = (favTeams ?? []).length === 0
  const emptyTitle =
    filter === 'hoy' ? 'Hoy no juega nadie'
    : filter === 'mis-equipos' ? (noFavs ? 'Aún no sigues equipos' : 'Tus equipos no juegan pronto')
    : 'Sin eventos próximos'
  const emptySub =
    filter === 'hoy' ? 'Mira el calendario completo.'
    : filter === 'mis-equipos' ? (noFavs ? 'Marca tus equipos con ❤ en el calendario.' : 'Vuelve pronto — añadimos partidos a diario.')
    : 'Vuelve pronto — los partidos asoman día a día.'

  return (
    <section ref={containerRef} className="pt-4 pb-0" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.16), rgba(124,58,237,0.06))', border: '1px solid rgba(124,58,237,0.28)' }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="#A78BFA" strokeWidth="1.4" />
              <path d="M6 3.5v2.8l1.5 1.5" stroke="#A78BFA" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <h2 className="section-label" style={{ color: '#C4B5FD', fontSize: 13 }}>Calendario</h2>
          </div>
          {displayEvents.length > 0 && (
            <>
              <span className="text-[10px]" style={{ color: '#3A3A4A' }}>·</span>
              <span className="text-[11px]" style={{ color: '#4A4A5A', fontFamily: 'var(--font-sport)' }}>
                {displayEvents.length} {filter === 'mis-equipos' ? 'de tus equipos' : filter === 'hoy' ? 'hoy' : 'próximos eventos'}
              </span>
            </>
          )}
        </div>
        {preview && (
          <Link href="/calendario" className="text-[11px] font-semibold transition-opacity hover:opacity-70"
            style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}>
            Ver todos →
          </Link>
        )}
      </div>

      {/* Selector: destacados (por defecto) / hoy / mis equipos (favoritos) */}
      <div role="tablist" aria-label="Filtrar eventos" className="flex items-center gap-1.5 mb-4">
        {([
          ['destacados', 'Destacados'],
          ['hoy', 'Hoy'],
          ['mis-equipos', 'Mis equipos'],
        ] as [EventFilter, string][]).map(([key, label]) => {
          const active = filter === key
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(key)}
              className="text-[11px] font-bold px-3 py-1 rounded-full transition-colors"
              style={{
                background: active ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
                color: active ? '#C4B5FD' : '#9090B0',
                border: active ? '1px solid rgba(124,58,237,0.50)' : '1px solid rgba(255,255,255,0.10)',
                fontFamily: 'var(--font-sport)',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Cargando la lista al cambiar de filtro */}
      {showLoading ? (
        <div className="rounded-2xl px-5 py-6 flex items-center gap-3"
          style={{ background: 'rgba(124,58,237,0.04)', border: '1px dashed rgba(124,58,237,0.18)' }}>
          <span className="w-4 h-4 rounded-full animate-spin flex-shrink-0"
            style={{ border: '2px solid rgba(124,58,237,0.25)', borderTopColor: '#7C3AED' }} />
          <p className="text-[12px]" style={{ color: '#9090B0', fontFamily: 'var(--font-sport)' }}>
            Cargando partidos…
          </p>
        </div>
      ) : displayEvents.length === 0 ? (
        <div className="rounded-2xl px-5 py-6 flex items-center justify-between gap-4"
          style={{ background: 'rgba(124,58,237,0.04)', border: '1px dashed rgba(124,58,237,0.18)' }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-full w-10 h-10 flex-shrink-0"
              style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.22)' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2.5" y="3.5" width="13" height="12" rx="1.5" stroke="#7C3AED" strokeWidth="1.3" />
                <path d="M2.5 7h13" stroke="#7C3AED" strokeWidth="1.3" />
                <path d="M6 1.5v3M12 1.5v3" stroke="#7C3AED" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="font-black text-[13px]" style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>
                {emptyTitle}
              </p>
              <p className="text-[11px]" style={{ color: '#6A6A7A', fontFamily: 'var(--font-sport)' }}>
                {emptySub}
              </p>
            </div>
          </div>
          {preview && (
            <Link href="/calendario"
              className="flex-shrink-0 text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={{
                color: '#7C3AED',
                background: 'rgba(124,58,237,0.08)',
                border: '1px solid rgba(124,58,237,0.25)',
                fontFamily: 'var(--font-sport)',
                textDecoration: 'none',
              }}>
              Ver calendario →
            </Link>
          )}
        </div>
      ) : (
      <div className="relative -mx-6 xl:-mx-10" style={{ background: 'var(--bg-base)' }}>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 pt-1"
          style={{ paddingLeft: 'max(24px, calc((100vw - 1440px) / 2 + 40px))', paddingRight: 24, background: 'var(--bg-base)' }}>
          {displayEvents.map((event, i) => (
            <div key={`${event.id}-${i}`} data-reveal>
              <EventCard event={event} liveScore={liveScores.get(event.id)} />
            </div>
          ))}

          {preview && (
            <Link href="/calendario"
              className="flex-shrink-0 flex flex-col items-center justify-center gap-2 transition-opacity hover:opacity-80"
              style={{ width: 150, borderRadius: 14, background: 'rgba(124,58,237,0.04)', border: '1px dashed rgba(124,58,237,0.18)', textDecoration: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7.5" stroke="#7C3AED" strokeWidth="1.3" opacity="0.4" />
                <path d="M9 5.5v4l2.5 2.5" stroke="#7C3AED" strokeWidth="1.3" strokeLinecap="round" opacity="0.4" />
              </svg>
              <p className="text-[10px] text-center leading-relaxed" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                Ver todos<br />los eventos →
              </p>
            </Link>
          )}

          <div className="flex-shrink-0 w-6 xl:w-10" />
        </div>

        <div className="absolute left-0 top-0 bottom-2 w-6 xl:w-10 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to right,var(--bg-base),transparent)' }} />
        <div className="absolute right-0 top-0 bottom-2 w-28 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to right,transparent,var(--bg-base))' }} />
      </div>
      )}
    </section>
  )
}
