'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { SportEvent } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { getEventHighlightScore, getLiveLabel, isTennis, isCombat, isRacing, sportThemeKey, SPORT_THEME, highlightReason, isMundial } from '@/lib/competitions'
import { isSplitBroadcast, getBroadcastForTz } from '@/lib/broadcasts'
import { groupEventsByDate, orderedDateKeys, namesMatch, formatDateLabel, isoToLocalDate, groupDayByCompetition } from '@/lib/calendar'
import { nameMatch } from '@/lib/quiniela'
import { getStoredTZ, setStoredTZ, SOURCE_TZ, TZ_KEY, convertEventTime } from '@/lib/timezone'
import TimezoneSelector from '@/components/TimezoneSelector'
import UFCCardModal from '@/components/UFCCardModal'
import FavoritesOnboarding from '@/components/FavoritesOnboarding'
import CompetitionSelector from '@/components/CompetitionSelector'
import { COMPETITIONS, getCompetition, matchesCompetition } from '@/lib/calendar-competitions'
import { filterByFollowed } from '@/lib/calendar-curate'
import { useFollowedSports, FOLLOWABLE_SPORTS } from '@/lib/useFollowedSports'
import { SLUG_TO_LABEL, accentForSport } from '@/lib/sports'
import { subscribeToPush } from '@/lib/push-client'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { WOMENS_COMPS } from '@/lib/football-leagues'
import { liveSportPassesFilter, isLiveStatus } from '@/lib/live-events'
import { SearchIcon, CalendarIcon, TvIcon, BellIcon, ClipboardIcon, SportIcon, LiveDotIcon, TennisIcon, F1Icon } from '@/components/icons/GameIcons'

// ── Favorites helpers ──────────────────────────────────────────
// Empareja el favorito guardado (nombre libre: del onboarding o del ❤ que guarda
// el nombre crudo del feed) contra el nombre del equipo del evento con el MISMO
// emparejador que la quiniela: por PALABRA COMPLETA + alias + sin acentos. Evita
// los falsos positivos del "contiene texto" ('Inter'⊄'Inter Miami', 'Milan'⊄'Inter
// Milan', 'Roma'⊄'Romania') sin perder los apodos ('Gladbach'→'Borussia
// Mönchengladbach', 'PSG'→'Paris Saint-Germain') ni las tildes ('Alavés'='Alaves').
function isFavorite(favorites: Set<string>, name: string | null | undefined): boolean {
  if (!name || favorites.size === 0) return false
  for (const fav of favorites) {
    if (nameMatch(name, fav)) return true
  }
  return false
}

function eventHasFavorite(favorites: Set<string>, ev: SportEvent): boolean {
  return isFavorite(favorites, ev.home) || isFavorite(favorites, ev.away)
}

// Clave de forma reciente con prefijo de género. El calendario recibe la forma
// indexada `w:`/`m:` + nombre (ver calendario/page.tsx) para no cruzar el club
// masculino con su homónimo femenino — comparten nombre, distinto equipo.
function formKey(ev: SportEvent, name: string): string {
  return `${WOMENS_COMPS.has(ev.comp ?? '') ? 'w' : 'm'}:${name}`
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


// Modo Destacados: cuántos partidos mostrar por día.
//   · MIN  → mínimo garantizado aunque el día sea flojo.
//   · ELITE→ umbral de "cartel top": en días de Mundial/Champions casi todos los
//            partidos llegan a 12, así que se muestran todos (no se cortan a 4).
//   · MAX  → tope de seguridad para días desbordados (amistosos masivos, etc.).
const DESTACADOS_MIN = 4
const DESTACADOS_ELITE = 12
const DESTACADOS_MAX = 8

// Timeline (vista Calendario): ventana de días PASADOS que se cargan de una vez
// al montar y se anteponen a la lista. El endpoint con live=1 cubre ~10 días;
// para histórico más antiguo está la pestaña Resultados.
const PAST_WINDOW_DAYS = 12

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

// Caché compartida a nivel módulo: ambos hooks (useLiveFixtures y useLiveScores)
// consumen los mismos datos del endpoint /api/events/live. Sin esto, montar
// CalendarioContent dispara DOS fetch idénticos cada 30s (uno por hook), con
// posibles races al actualizar estado. Con la caché, una sola request alimenta
// a ambos hooks.
let _liveCache: { data: RawLiveFixture[]; ts: number } | null = null
let _liveInflight: Promise<RawLiveFixture[]> | null = null
const LIVE_CACHE_TTL = 15_000  // 15s: cubre el solapamiento entre los dos hooks

async function fetchLiveSharedCached(): Promise<RawLiveFixture[]> {
  const now = Date.now()
  if (_liveCache && now - _liveCache.ts < LIVE_CACHE_TTL) return _liveCache.data
  if (_liveInflight) return _liveInflight
  _liveInflight = (async () => {
    try {
      const res = await fetch('/api/events/live', { cache: 'no-store' })
      if (!res.ok) return _liveCache?.data ?? []
      const data: RawLiveFixture[] = await res.json()
      _liveCache = { data, ts: Date.now() }
      return data
    } catch {
      return _liveCache?.data ?? []
    } finally {
      _liveInflight = null
    }
  })()
  return _liveInflight
}

// Cadencia del polling: 30s con partidos en juego, 60s sin ellos. La mayor
// parte del día no hay nada en vivo → la mitad de peticiones sin que se note.
function livePollMs(data: RawLiveFixture[]): number {
  return data.some(f => isLiveStatus(f.status)) ? 30_000 : 60_000
}

function useLiveFixtures() {
  const [fixtures, setFixtures] = useState<RawLiveFixture[]>([])
  const [pollMs, setPollMs] = useState(30_000)

  const fetch_ = useCallback(async () => {
    const data = await fetchLiveSharedCached()
    setFixtures(data.filter(f => isLiveStatus(f.status)))
    setPollMs(livePollMs(data))
  }, [])

  useVisiblePolling(fetch_, pollMs)

  return fixtures
}

function useLiveScores(events: SportEvent[]) {
  const [scores, setScores] = useState<Map<string, LiveScore>>(new Map())
  const [pollMs, setPollMs] = useState(30_000)

  const fetch_ = useCallback(async () => {
    try {
      const fixtures = await fetchLiveSharedCached()
      setPollMs(livePollMs(fixtures))
      const byRef = new Map<string, RawLiveFixture>()
      for (const f of fixtures) if (f.matchRef) byRef.set(f.matchRef, f)
      const next = new Map<string, LiveScore>()
      for (const ev of events) {
        // Primario: matchRef (clave exacta). Fallback por nombre SOLO si es
        // INEQUÍVOCO (una única fixture casa): con substring varias podían
        // casar y se pegaba el marcador al partido equivocado.
        let m = (ev.matchRef && byRef.get(ev.matchRef)) || undefined
        if (!m) {
          const cands = fixtures.filter(f => namesMatch(f.homeTeam, ev.home) && namesMatch(f.awayTeam, ev.away ?? ''))
          if (cands.length === 1) m = cands[0]
        }
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

  useVisiblePolling(fetch_, pollMs)

  return scores
}

// ─── Utilities ────────────────────────────────────────────────────────────
function TeamLogo({ logo, photo, name, size = 24, sport, accent, abbr }: { logo?: string; photo?: string; name: string; size?: number; sport?: string; accent?: string; abbr?: string }) {
  const [err, setErr] = useState(false)
  const displayPhoto = photo && !err

  if (displayPhoto) {
    return (
      <img src={photo} alt={name} width={size} height={size} onError={() => setErr(true)}
        style={{ width: size, height: size, objectFit: 'cover', borderRadius: '50%', flexShrink: 0 }} />
    )
  }

  if (!logo || err) {
    // FASE 3: escudo de respaldo = CUADRADO REDONDEADO tintado con el acento del
    // deporte e iniciales en ese color (maqueta: "nunca un círculo gris vacío").
    // Si el llamador pasa `accent`, se usa ese sistema (espejo del TeamCrest de la
    // app); si no, se conserva el respaldo antiguo para otros consumidores.
    if (accent) {
      return (
        <div className="flex items-center justify-center font-black flex-shrink-0"
          style={{
            width: size, height: size,
            borderRadius: Math.round(size * 0.28),
            fontSize: size * 0.34,
            letterSpacing: 0.2,
            background: `${accent}1A`,
            color: accent,
            border: `1px solid ${accent}4D`,
          }}>
          {crestInitials(abbr, name)}
        </div>
      )
    }
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

// Iniciales tintadas del escudo de respaldo (hasta 3 letras, prioriza el abbr).
// Espejo de crestInitials de la app: "RM" / "FCB" / "MCI"…
function crestInitials(abbr?: string, name?: string): string {
  const a = (abbr ?? '').trim()
  if (a) return a.slice(0, 3).toUpperCase()
  const parts = (name ?? '').replace(/\s*\/\s*/g, ' ').split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase()
  return parts.map((w) => w[0]).slice(0, 3).join('').toUpperCase()
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
  tz?: string
  flashing?: boolean
  isReminded: boolean
  onToggleReminder: () => void
}

function LiveHeroCard(p: HeroProps) {
  // FASE 3: comp en el color POR DEPORTE (fallback rojo del ticker en vivo).
  const compColor = accentForSport(p.sport, '#FF4D2E')
  const tennis = isTennis(p.sport)
  const racing = isRacing(p.sport)
  const liveLabel = getLiveLabel(p.status, p.elapsed, {
    sport: p.sport,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
  })

  const inner = (
    <div
      className={`cal-card cal-card--live rounded-xl flex flex-col hover:brightness-110 ${p.flashing ? 'ts-flash' : ''}`}
      style={{
        ['--row-accent' as string]: '#FF4D2E',
        width: 300,
        flexShrink: 0,
        background: 'linear-gradient(145deg, rgba(255,77,46,0.10) 0%, rgba(28,20,18,0.85) 60%, rgba(15,15,22,0.9) 100%)',
        border: '1px solid rgba(255,77,46,0.25)',
      }}
    >
      {/* Halo animado */}
      <span aria-hidden className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,77,46,0.18) 0%, transparent 70%)', filter: 'blur(8px)' }} />

      {/* Header */}
      <div className="relative flex items-center justify-between px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="cal-live-tag flex items-center gap-1 pl-1.5 pr-2.5 py-0.5 text-[8.5px] font-black uppercase"
            style={{ background: 'rgba(255,77,46,0.18)', color: '#FF4D2E', fontFamily: 'var(--font-sport)', letterSpacing: '0.1em' }}>
            <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#FF4D2E', boxShadow: '0 0 6px #FF4D2E' }} />
            EN VIVO
          </span>
          {tennis && <span style={{ color: '#d97706' }}><TennisIcon size={10} /></span>}
          <span className="text-[8.5px] font-bold uppercase tracking-wider truncate"
            style={{ color: compColor, fontFamily: 'var(--font-sport)', maxWidth: 140 }}>
            {p.comp}
          </span>
        </div>
        <span className="text-[8.5px] font-black uppercase tabular-nums px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ color: '#FF4D2E', background: 'rgba(255,77,46,0.10)', fontFamily: 'var(--font-display)' }}>
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
                style={{ color: '#FF4D2E', fontFamily: 'var(--font-sport)' }}>
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
                <span className="text-[8px] font-black uppercase tracking-[0.2em]"
                  style={{ color: '#FBBF24', fontFamily: 'var(--font-sport)' }}>
                  Sets
                </span>
              )}
              <div className="flex items-center gap-2">
                <span className="font-black tabular-nums leading-none"
                  style={{ fontSize: 28, color: '#FF4D2E', fontFamily: 'var(--font-display)', textShadow: '0 0 12px rgba(255,77,46,0.4)' }}>
                  {p.homeScore ?? 0}
                </span>
                <span className="text-[16px] font-light leading-none" style={{ color: '#3A3A4A' }}>—</span>
                <span className="font-black tabular-nums leading-none"
                  style={{ fontSize: 28, color: '#FF4D2E', fontFamily: 'var(--font-display)', textShadow: '0 0 12px rgba(255,77,46,0.4)' }}>
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
      <div className="relative flex items-center justify-between px-3.5 pb-3 pt-1 gap-2 border-t" style={{ borderColor: 'rgba(255,77,46,0.12)' }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[9px] font-semibold uppercase tracking-wider truncate" style={{ color: '#7A8A7E', fontFamily: 'var(--font-sport)' }}>
            {p.matchRef ? 'Ver detalles →' : p.sport}
          </span>
          <BroadcastChip comp={p.comp ?? ''} sport={p.sport} tz={p.tz} fallback={p.broadcast} />
        </div>
        {/* Sin campana de recordatorio: el partido YA está en vivo (M22). */}
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
function BroadcastChip({ comp, sport, tz, fallback }: {
  comp: string
  sport?: string
  tz?: string
  /** Canal de la fuente original (ESPN US) — solo si no hay dato local */
  fallback?: string
}) {
  // Primero intenta el canal del país del usuario; si no hay, usa el fallback
  const channel = getBroadcastForTz(comp, sport ?? '', tz ?? SOURCE_TZ) ?? fallback
  if (!channel) return null
  const split = isSplitBroadcast(channel)
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
      <span className="truncate max-w-[110px]">{channel}</span>
    </span>
  )
}

// Config de competición (página + escudo) para un grupo del feed, si existe.
// Match PRECISO (no substring) para no enlazar mal: nombre exacto de la comp
// (ligas de fútbol) o deporte exacto (NBA/F1/UFC). Así "Premier Padel" no cae
// en Premier League ni "LaLiga 2" en LaLiga.
function compConfigForGroup(comp: string, sport?: string) {
  const cl = comp.trim().toLowerCase()
  const sl = sport?.trim().toLowerCase()
  return COMPETITIONS.find((c) =>
    (c.matchComp && c.matchComp.toLowerCase() === cl) ||
    (c.matchSport && sl && c.matchSport.toLowerCase() === sl)
  ) ?? null
}

// ─── Competition sub-header ───────────────────────────────────────────────
// Si la competición tiene página propia, la cabecera lleva su escudo oficial y
// es un enlace a /calendario/[slug] (anclaje visual + descubrimiento).
function CompGroupHeader({ comp, accent, count, first, crest, slug, banner, pinned, onTogglePin }: {
  comp: string; accent: string; count: number; first?: boolean; crest?: string; slug?: string
  banner?: string; pinned?: boolean; onTogglePin?: () => void
}) {
  const inner = (
    <div className={`relative px-2 pb-2 ${first ? 'pt-1' : 'pt-4'}`}>
      {/* Backdrop sutil de la competición (broadcast): la foto asoma muy tenue
          por la derecha; un scrim la apaga sobre el lado del texto. Solo en las
          competiciones con banner; el resto mantiene la cabecera lisa de antes. */}
      {banner && (
        <div className="absolute left-0 right-0 rounded-lg overflow-hidden pointer-events-none" style={{ top: first ? 2 : 12, bottom: 2, zIndex: 0 }} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" aria-hidden="true" loading="lazy" decoding="async"
            className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.4, objectPosition: '85% 36%' }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, var(--bg-base) 6%, color-mix(in srgb, ${accent} 9%, rgba(10,10,18,0.82)) 46%, rgba(10,10,18,0.34) 100%)` }} />
        </div>
      )}
      <div className="relative flex items-center gap-2.5" style={{ zIndex: 1 }}>
        <span className="block flex-shrink-0 rounded-sm" style={{ width: 3, height: 14, background: accent, boxShadow: `0 0 8px ${accent}66` }} />
        {crest && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={crest} alt="" aria-hidden="true" width={16} height={16} loading="lazy" decoding="async"
            style={{ objectFit: 'contain', width: 16, height: 16, flexShrink: 0 }} />
        )}
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] truncate flex-1" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
          {comp}
        </span>
        {pinned && (
          <span className="text-[8px] font-black uppercase tracking-wider flex-shrink-0" style={{ color: accent, fontFamily: 'var(--font-sport)', opacity: 0.85 }}>
            Fijada
          </span>
        )}
        {onTogglePin && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin() }}
            aria-label={pinned ? `Dejar de fijar ${comp}` : `Fijar ${comp} arriba`}
            aria-pressed={!!pinned}
            className="flex items-center justify-center flex-shrink-0 rounded-md transition-all"
            style={{ width: 22, height: 22, cursor: 'pointer', background: pinned ? `${accent}22` : 'transparent', border: 'none' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={pinned ? accent : 'none'} stroke={pinned ? accent : '#6A6A80'} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
              <path d="M12 2.5l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 16.8 6.4 19.7l1.1-6.2L3 9.1l6.2-.9L12 2.5z" />
            </svg>
          </button>
        )}
        {slug && (
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none" className="flex-shrink-0" aria-hidden style={{ opacity: 0.95 }}>
            <path d="M4.5 2L8 6l-3.5 4" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <span className="text-[9px] font-bold tabular-nums px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: `${accent}14`, color: accent, border: `1px solid ${accent}30`, fontFamily: 'var(--font-sport)' }}>
          {count}
        </span>
      </div>
    </div>
  )
  return slug
    ? <Link href={`/calendario/${slug}`} prefetch={false} className="block no-underline transition-all hover:brightness-125" aria-label={`Ver calendario de ${comp}`}>{inner}</Link>
    : inner
}

// Inline strip of 5 W/D/L chips for a team's recent form. Renders nothing
// if the list is empty.
function FormStrip({ form, align = 'start' }: { form: ('W'|'D'|'L')[]; align?: 'start' | 'end' }) {
  if (!form || form.length === 0) return null
  const color = (r: 'W'|'D'|'L') => r === 'W' ? '#22C55E' : r === 'D' ? '#EAB308' : '#EF4444'
  // Lo más reciente, junto al escudo (input = más-reciente-primero, past-events order desc).
  // Local (align='end', escudo a la derecha) → invertir: lo más reciente queda a la derecha.
  // Visitante (align='start', escudo a la izquierda) → mantener: lo más reciente queda a la izquierda.
  const ordered = align === 'end' ? [...form].reverse() : [...form]
  return (
    <div className={`mt-1.5 flex gap-1 ${align === 'end' ? 'justify-end' : ''}`}>
      {ordered.map((r, i) => (
        <span key={i} className="size-2 rounded-sm" style={{ background: color(r) }} title={r} />
      ))}
    </div>
  )
}

// ─── Compact list row (non-live or in TODOS) ──────────────────────────────
function MatchRow({ event, liveScore, isReminded, onToggleReminder, dateLabel, onClickUFC, flashing, isFav, homeFav, awayFav, onToggleFav, formHome, formAway, showComp, showReason, tz }: {
  event: SportEvent
  liveScore?: LiveScore
  isReminded: boolean
  onToggleReminder: () => void
  dateLabel?: string
  onClickUFC?: (date: string) => void
  flashing?: boolean
  isFav?: boolean
  /** Favorito por-equipo (anillo + ♥ en el lado correcto). Si no llegan, cae en isFav (local). */
  homeFav?: boolean
  awayFav?: boolean
  onToggleFav?: () => void
  formHome?: ('W'|'D'|'L')[]
  formAway?: ('W'|'D'|'L')[]
  showComp?: boolean
  showReason?: boolean
  tz?: string
}) {
  // FASE 3 (2026-07-09): tarjeta VERTICAL, espejo de la app (maqueta aprobada).
  // Espina de acento POR DEPORTE (decisión de José Tomás), ceja de competición,
  // pastilla de estado, marcador blanco y escudo con anillo del favorito. Conserva
  // TODAS las features de la web: FormStrip, cuenta atrás, hora Madrid, badges de
  // fase/motivo, viñeta de evento-solo, favorito, recordatorio, BroadcastChip, tz.

  // Hora del partido (origen Madrid) convertida a la zona horaria del usuario.
  const displayTime = tz && tz !== SOURCE_TZ ? convertEventTime(event.time, tz, event.isoDate) : event.time
  const isLive = !!liveScore && isLiveStatus(liveScore.status)
  // Días pasados (timeline continuo): el marcador viaja en el propio evento
  // (homeScore/awayScore) y NO entra en el mapa liveScore. Dos convenciones.
  const pastHasScore = event.homeScore != null && event.awayScore != null
  const finishedPast = !liveScore && (event.isPast === true || pastHasScore)
  const homeScoreVal = liveScore ? liveScore.homeGoals : (event.homeScore ?? null)
  const awayScoreVal = liveScore ? liveScore.awayGoals : (event.awayScore ?? null)
  const isFinal = (!!liveScore && (liveScore.status === 'FT' || liveScore.status === 'Final' || liveScore.status === 'STATUS_FINAL') && liveScore.homeGoals !== null) || (finishedPast && pastHasScore)
  // Finalizado también para F1/UFC pasados (sin marcador, solo isPast) → "Final".
  const finished = !isLive && (isFinal || event.isPast === true)
  // Favorito por-equipo (retrocompat: si no llega, el local hereda isFav).
  const hFav = homeFav ?? !!isFav
  const aFav = awayFav ?? false
  const tennis = isTennis(event.sport)
  const combat = isCombat(event.sport)
  const racing = isRacing(event.sport)
  // Identidad por DEPORTE (verde fútbol, ámbar básket…); default morado #A78BFA.
  const accent = accentForSport(event.sport, '#A78BFA')
  const hasVs = !!event.away
  const eventDate = event.isoDate ? isoToLocalDate(event.isoDate, tz) : null
  const countdown = !isLive && !isFinal ? timeUntilLabel(event.isoDate) : null

  // Marcador numérico solo en deportes con marcador (nada en F1/MMA).
  const showScore = (isLive || isFinal) && !racing && !combat
  const hg = homeScoreVal ?? 0
  const ag = awayScoreVal ?? 0
  const homeLead = showScore && hg > ag
  const awayLead = showScore && ag > hg
  const dimHome = (finished || isLive) && awayLead
  const dimAway = (finished || isLive) && homeLead

  // Estado en vivo (sport-aware): "63'", "Q3 · 5'", "Set 3", "Descanso"…
  const liveLabel = isLive && liveScore
    ? getLiveLabel(liveScore.status, liveScore.elapsed, { sport: event.sport, homeScore: liveScore.homeGoals, awayScore: liveScore.awayGoals })
    : ''
  const paused = liveLabel === 'Descanso' || liveLabel === 'Intervalo'
  // Ganador de una carrera/velada terminada (deportes sin marcador).
  const winnerNote = !isLive && (combat || racing) && event.resultNote ? event.resultNote : null
  // Motivo "por qué es Destacado" (solo en modo Destacados, y si hay uno claro).
  const reason = showReason ? highlightReason({ comp: event.comp, home: event.home, away: event.away ?? undefined }) : null
  const compLabel = (event.comp ?? '').trim()
  // El comp por-tarjeta solo cuando NO hay cabecera de grupo (vista Recordatorios);
  // en la lista principal la competición ya la lleva CompGroupHeader.
  const showEyebrowComp = !!showComp && !!compLabel
  // Hora de Madrid (origen de la emisión) junto a la local, para la audiencia LatAm.
  const madTime = !isLive && !finished && !!tz && tz !== SOURCE_TZ ? `${event.time} MAD` : null
  const FAV = '#F472B6'

  // ── Pastilla de estado (arriba-dcha): EN VIVO · min / Descanso / Final / hora ──
  const statusPill = isLive && !paused ? (
    <span className="inline-flex items-center gap-1.5 rounded-full flex-shrink-0" style={{ padding: '3px 8px', background: 'rgba(255,77,46,0.18)', border: '1px solid rgba(255,77,46,0.42)' }}>
      <span className="rounded-full" style={{ width: 6, height: 6, background: '#FF4D2E', boxShadow: '0 0 7px #FF4D2E', animation: 'live-pulse 1.6s ease-out infinite' }} />
      <span className="text-[9px] font-black uppercase tracking-[0.06em] tabular-nums" style={{ color: '#fff', fontFamily: 'var(--font-sport)' }}>
        {liveLabel && liveLabel !== 'EN VIVO' ? `EN VIVO · ${liveLabel}` : 'EN VIVO'}
      </span>
    </span>
  ) : paused ? (
    <span className="text-[9.5px] font-black uppercase tracking-[0.08em] rounded-full flex-shrink-0" style={{ padding: '3px 9px', color: '#FBBF24', background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.3)', fontFamily: 'var(--font-sport)' }}>
      {liveLabel}
    </span>
  ) : finished ? (
    <span className="text-[9.5px] font-black uppercase tracking-[0.08em] rounded-full flex-shrink-0" style={{ padding: '3px 9px', color: '#9090A8', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-sport)' }}>
      Final
    </span>
  ) : (
    <span className="text-[10px] font-black tracking-[0.02em] tabular-nums rounded-full flex-shrink-0" style={{ padding: '3px 9px', color: accent, background: `${accent}22`, border: `1px solid ${accent}55`, fontFamily: 'var(--font-sport)' }}>
      {displayTime || 'Por confirmar'}
    </span>
  )

  // ── Fila de un equipo/entidad: escudo (+anillo favorito) · nombre (+♥ +forma) · marcador/VS ──
  const teamRow = (opts: { name: string; logo?: string; photo?: string; abbr?: string; score: number | null; lead: boolean; dim: boolean; fav: boolean; form?: ('W'|'D'|'L')[]; showVs: boolean }) => (
    <div className="flex items-center gap-2.5">
      <span className="flex-shrink-0 inline-flex rounded-lg" style={opts.fav ? { boxShadow: `0 0 0 2px ${FAV}` } : undefined}>
        <TeamLogo logo={opts.logo} photo={opts.photo} name={opts.name} abbr={opts.abbr} size={28} sport={event.sport} accent={accent} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate leading-snug" style={{ fontSize: 14, fontFamily: 'var(--font-sport)', fontWeight: opts.lead ? 900 : 700, color: opts.dim ? '#8A8A9E' : '#EBEBF5' }}>
            {opts.name}
          </span>
          {opts.fav && (
            <svg width="10" height="10" viewBox="0 0 16 16" fill={FAV} className="flex-shrink-0" aria-hidden>
              <path d="M8 13.5s-5-3-5-7a3 3 0 015-2 3 3 0 015 2c0 4-5 7-5 7z" />
            </svg>
          )}
        </div>
        {opts.form && <FormStrip form={opts.form} align="start" />}
      </div>
      {showScore ? (
        <span className="tabular-nums flex-shrink-0" style={{ fontSize: 22, fontFamily: 'var(--font-sport)', fontWeight: 900, color: opts.dim ? '#8A8A9E' : '#fff', marginLeft: 6 }}>
          {opts.score ?? 0}
        </span>
      ) : opts.showVs ? (
        <span className="flex-shrink-0" style={{ marginLeft: 6, fontWeight: 900, color: combat ? '#F472B6' : '#4A4A5E', fontSize: combat ? 13 : 12, letterSpacing: combat ? '0.12em' : '0.14em', fontFamily: combat ? 'var(--font-display)' : 'var(--font-sport)' }}>
          VS
        </span>
      ) : null}
    </div>
  )

  const inner = (
    <div
      className={`cal-card${isLive ? ' cal-card--live' : ''} rounded-xl hover:brightness-105 ${flashing ? 'ts-flash' : ''}`}
      style={{
        ['--row-accent' as string]: accent,
        padding: '11px 13px',
        background: isLive
          ? 'linear-gradient(100deg, rgba(255,77,46,0.07) 0%, rgba(255,255,255,0.02) 55%)'
          : 'rgba(255,255,255,0.025)',
        borderTop: `1px solid ${isLive ? 'rgba(255,77,46,0.15)' : 'rgba(255,255,255,0.05)'}`,
        borderRight: `1px solid ${isLive ? 'rgba(255,77,46,0.15)' : 'rgba(255,255,255,0.05)'}`,
        borderBottom: `1px solid ${isLive ? 'rgba(255,77,46,0.15)' : 'rgba(255,255,255,0.05)'}`,
        borderLeft: `4px solid ${isLive ? '#FF4D2E' : accent}`,
      }}
    >
      {/* Ceja: icono del deporte + competición (si toca) · fase · pastilla de estado */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="inline-flex flex-shrink-0" style={{ color: accent }}>
          <SportIcon sport={event.sport} size={13} />
        </span>
        {showEyebrowComp ? (
          <span className="truncate flex-1" style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent, fontFamily: 'var(--font-sport)' }}>
            {compLabel}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {event.stage && (
          <span className="text-[8px] font-black uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ color: accent, background: `${accent}14`, border: `1px solid ${accent}30`, fontFamily: 'var(--font-sport)' }}>
            {event.stage}
          </span>
        )}
        {tennis && showScore && (
          <span className="text-[8px] font-black uppercase tracking-[0.14em] flex-shrink-0" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>Sets</span>
        )}
        {tennis && isLive && liveScore?.clock && (
          <span className="text-[8px] font-bold uppercase tracking-[0.1em] tabular-nums flex-shrink-0" style={{ color: '#FBBF24', fontFamily: 'var(--font-sport)' }} title="Juego en curso">
            {liveScore.clock}
          </span>
        )}
        {statusPill}
      </div>

      {/* Equipos: fila local + fila visitante (carreras/eventos = una sola fila) */}
      <div className="flex flex-col gap-2">
        {teamRow({ name: event.home, logo: event.homeLogo, photo: event.homePhoto, abbr: event.homeAbbr, score: homeScoreVal, lead: homeLead, dim: dimHome, fav: hFav, form: hasVs ? formHome : undefined, showVs: !isLive && !finished && hasVs })}
        {hasVs && !racing ? teamRow({ name: event.away as string, logo: event.awayLogo, photo: event.awayPhoto, abbr: event.awayAbbr, score: awayScoreVal, lead: awayLead, dim: dimAway, fav: aFav, form: formAway, showVs: false }) : null}
      </div>

      {/* Ganador (combate/carrera terminada, sin marcador numérico) */}
      {winnerNote && (
        <div className="flex items-center gap-2 mt-2.5 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[13px] leading-none flex-shrink-0" aria-hidden>{racing ? '🏁' : '🏆'}</span>
          <span className="text-[9px] font-black uppercase tracking-[0.1em] flex-shrink-0" style={{ color: '#9090A8', fontFamily: 'var(--font-sport)' }}>Ganador</span>
          <span className="truncate flex-1 text-[13px] font-bold" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>{winnerNote}</span>
        </div>
      )}

      {/* Meta: motivo · fecha · canal · hora MAD · cuenta atrás · favorito · recordatorio */}
      <div className="flex items-center gap-2 mt-2.5 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          {reason && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.1em] flex-shrink-0" style={{ color: '#C4B5FD', background: 'rgba(124,58,237,0.14)', border: '1px solid rgba(124,58,237,0.32)', fontFamily: 'var(--font-sport)' }}>
              <svg width="7" height="7" viewBox="0 0 12 12" fill="currentColor" aria-hidden><path d="M6 1l1.5 3.2 3.5.5-2.5 2.4.6 3.4L6 8.9 2.9 10.5l.6-3.4L1 4.7l3.5-.5L6 1z" /></svg>
              {reason}
            </span>
          )}
          {dateLabel && (
            <span className="text-[8px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ color: accent, background: `${accent}14`, border: `1px solid ${accent}30`, fontFamily: 'var(--font-sport)' }}>
              {dateLabel}
            </span>
          )}
          <BroadcastChip comp={event.comp} sport={event.sport} tz={tz} fallback={event.broadcast} />
          {madTime && (
            <span className="text-[8px] font-bold uppercase tracking-wide tabular-nums flex-shrink-0" style={{ color: '#6A6A80', fontFamily: 'var(--font-sport)' }} title="Hora en Madrid (origen de la emisión)">
              {madTime}
            </span>
          )}
          {isFav && countdown && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black tabular-nums uppercase tracking-wider flex-shrink-0" style={{ background: 'rgba(244,114,182,0.12)', color: '#F472B6', border: '1px solid rgba(244,114,182,0.3)', fontFamily: 'var(--font-sport)' }} title="Tu equipo juega pronto">
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" /><path d="M6 4v2.5l1.5 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
              {countdown}
            </span>
          )}
        </div>
        {onToggleFav && <FavoriteHeart active={!!isFav} onClick={onToggleFav} size={15} />}
        {!isLive && !finished && <ReminderButton active={isReminded} onClick={onToggleReminder} color={event.accent} size="sm" />}
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
function DaySeparator({ dateKey, count, tone = 'upcoming', tz }: {
  dateKey: string
  count: number
  tone?: 'upcoming' | 'past'
  tz?: string
}) {
  const today = isoToLocalDate(new Date().toISOString(), tz)
  const isToday = dateKey === today
  // El acento del día sigue el tema del deporte activo (var(--cal-accent)); hoy
  // se ilumina mezclando con blanco. Los pasados van en rojo suave.
  const accent = tone === 'past' ? '#FCA5A5' : isToday ? 'color-mix(in srgb, var(--cal-accent) 58%, #ffffff)' : 'var(--cal-accent)'
  const subtitle = formatDateSubtitle(dateKey)
  const label = formatDateLabel(dateKey, tz)

  return (
    <div className="relative pt-7 pb-4 mb-3">
      {/* Top divider angulado — el acento del tema arranca a la izquierda */}
      <div className="absolute top-0 left-0 right-0" style={{ height: 2, background: `linear-gradient(90deg, ${accent} 0%, color-mix(in srgb, ${accent} 30%, transparent) 18%, rgba(255,255,255,0.07) 38%, rgba(255,255,255,0.03) 100%)` }} />
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="cal-pennant block flex-shrink-0" style={{ width: 6, height: 20, background: accent, boxShadow: `0 0 12px color-mix(in srgb, ${accent} 45%, transparent)` }} />
          <div className="min-w-0">
            <h2 className="font-black leading-none uppercase tracking-[0.18em]"
              style={{ fontFamily: 'var(--font-sport)', fontSize: 14, color: '#F0F0FA' }}>
              {label}
            </h2>
            {subtitle && (
              <p className="text-[10px] mt-1 first-letter:uppercase tracking-wide" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <span className="flex items-center justify-center min-w-[26px] h-[22px] px-2 rounded-full text-[10px] font-black tabular-nums flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent, border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)`, fontFamily: 'var(--font-sport)' }}>
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
        className="cal-rail flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scroll-smooth"
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
function CalendarDropdown({ value, eventDays, onChange, onClose, anchorRect, tz }: {
  value: string | null
  eventDays: Set<string>
  onChange: (k: string) => void
  onClose: () => void
  anchorRect: DOMRect | null
  tz?: string
}) {
  const today = isoToLocalDate(new Date().toISOString(), tz)
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
                onClick={isPast ? undefined : () => { onChange(iso); onClose() }}
                disabled={isPast}
                title={isPast ? 'Para ver días ya jugados, pulsa «Ver resultados anteriores» en el calendario' : undefined}
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
                  cursor: isPast ? 'not-allowed' : 'pointer',
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

// Navegación por días del calendario: un único botón de fecha (móvil y
// escritorio POR IGUAL) que despliega el calendario mensual (CalendarDropdown).
// Por defecto "Todos los días"; al elegir un día muestra el día + ✕ para volver.
// (Decisión del dueño: misma pieza en todas las pantallas, fuera la tira de días.)
function DayChips({ days, value, onChange, tz }: {
  days: { key: string }[]
  value: string | null
  onChange: (k: string | null) => void
  tz?: string
}) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const calBtnRef = useRef<HTMLButtonElement | null>(null)

  const today = isoToLocalDate(new Date().toISOString(), tz)
  const tomorrow = (() => {
    const d = new Date(today + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().split('T')[0]
  })()

  const eventDays = useMemo(() => new Set(days.map(d => d.key)), [days])
  const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const dayLabel = (key: string) => {
    const dt = new Date(key + 'T12:00:00Z')
    const d = dt.getUTCDate()
    const mon = MON[dt.getUTCMonth()]
    if (key === today) return `Hoy · ${d} ${mon}`
    if (key === tomorrow) return `Mañana · ${d} ${mon}`
    return `${DOW[dt.getUTCDay()]} ${d} ${mon}`
  }
  const hasDay = value !== null
  const active = showCalendar || hasDay

  const openCalendar = () => {
    if (calBtnRef.current) setAnchorRect(calBtnRef.current.getBoundingClientRect())
    setShowCalendar(v => !v)
  }

  return (
    <div className="cal-rail flex items-center gap-1.5 pb-1" style={{ position: 'relative' }}>
      {/* Botón de fecha: abre el calendario mensual (CalendarDropdown). */}
      <button
        ref={calBtnRef}
        onClick={openCalendar}
        aria-haspopup="dialog"
        aria-expanded={showCalendar}
        aria-label="Elegir día"
        className="cal-press flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0"
        style={{
          background: active ? 'rgba(124,58,237,0.22)' : 'rgba(124,58,237,0.12)',
          color: active ? '#D8CCFF' : '#C4B5FD',
          border: active ? '1px solid rgba(124,58,237,0.6)' : '1px solid rgba(124,58,237,0.3)',
          fontFamily: 'var(--font-sport)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <CalendarIcon size={12} />
        {hasDay ? dayLabel(value) : 'Todos los días'}
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.7 }}>
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* ✕ — solo cuando hay un día elegido: vuelve a "Todos los días". */}
      {hasDay && (
        <button
          onClick={() => { onChange(null); setShowCalendar(false) }}
          aria-label="Ver todos los días"
          className="cal-press flex items-center justify-center rounded-full flex-shrink-0 transition-all"
          style={{
            width: 26,
            height: 26,
            background: 'rgba(255,255,255,0.05)',
            color: '#9090A8',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {showCalendar && (
        <CalendarDropdown
          value={value}
          eventDays={eventDays}
          onChange={v => { onChange(v); setShowCalendar(false) }}
          onClose={() => setShowCalendar(false)}
          anchorRect={anchorRect}
          tz={tz}
        />
      )}
    </div>
  )
}

// ── Past result row (compact, for resultados tab) ─────────────────────────
function PastMatchRow({ event, isFav, onToggleFav }: {
  event: SportEvent
  isFav?: boolean
  onToggleFav?: () => void
}) {
  // FASE 3: Resultados con el mismo color POR DEPORTE que la lista principal.
  const compColor = accentForSport(event.sport, '#A78BFA')
  const hs = event.homeScore
  const as_ = event.awayScore
  const hasScore = hs !== null && hs !== undefined && as_ !== null && as_ !== undefined

  const hasVs = !!event.away
  const racing = isRacing(event.sport)
  const tennis = isTennis(event.sport)
  const combat = isCombat(event.sport)
  const inner = (
    <div
      className="relative grid items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2.5 sm:py-3 rounded-xl transition-all hover:brightness-105"
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
      <div className="flex items-center gap-2 min-w-0 justify-end text-right pr-1">
        <div className="min-w-0 flex flex-col items-end">
          <span className="text-[12px] sm:text-[13px] font-bold truncate max-w-full leading-snug" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {event.home}
          </span>
        </div>
        <TeamLogo logo={event.homeLogo} name={event.home} size={28} sport={event.sport} />
      </div>

      <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0 min-w-[80px] sm:min-w-[88px] px-2">
        <span className="text-[8.5px] font-black uppercase tracking-[0.18em] leading-none" style={{ color: '#4A4A5E', fontFamily: 'var(--font-sport)' }}>
          FT
        </span>
        {hasScore ? (
          <span className="flex items-center gap-2 leading-none tabular-nums font-black"
            style={{ fontSize: 20, color: '#C0C0D8', fontFamily: 'var(--font-sport)' }}>
            <span>{hs}</span>
            <span style={{ color: '#38384A', fontWeight: 400 }}>·</span>
            <span>{as_}</span>
          </span>
        ) : event.resultNote ? null : (
          <span className="text-[14px] font-bold" style={{ color: '#5A5A6A' }}>–</span>
        )}
        {/* Fase/grupo (Mundial: "Grupo A", "Octavos"…) */}
        {event.stage && (
          <span className="text-[8px] font-bold uppercase tracking-[0.14em] leading-none truncate max-w-[88px]"
            style={{ color: '#6A6A80', fontFamily: 'var(--font-sport)' }}>
            {event.stage}
          </span>
        )}
      </div>

      {hasVs ? (
        <div className="flex items-center gap-2 min-w-0 pl-1 pr-9 sm:pr-1">
          <TeamLogo logo={event.awayLogo} name={event.away!} size={28} sport={event.sport} />
          <span className="text-[12px] sm:text-[13px] font-bold truncate leading-snug" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {event.away}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0 pl-1 pr-9 sm:pr-1 opacity-60">
          <span className="inline-flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 28, height: 28, background: `${compColor}14`, border: `1px solid ${compColor}28`, color: compColor }}>
            {racing ? <F1Icon size={14} /> : tennis ? <TennisIcon size={14} /> : <SportIcon sport={event.sport} size={14} />}
          </span>
          <div className="min-w-0">
            {event.resultNote ? (
              <>
                <span className="text-[8.5px] font-black uppercase tracking-[0.14em] block"
                  style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                  Ganador
                </span>
                <span className="text-[12px] font-bold truncate block leading-snug"
                  style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
                  🏆 {event.resultNote}
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] truncate block"
                  style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                  {racing ? 'Carrera' : tennis ? 'Individual' : combat ? 'Cartelera' : 'Evento'}
                </span>
                {event.comp && (
                  <span className="text-[9px] truncate block mt-0.5"
                    style={{ color: compColor, fontFamily: 'var(--font-sport)' }}>
                    {event.comp}
                  </span>
                )}
              </>
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
type ViewType = 'todos' | 'resultados' | 'recordatorios'

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
  const [activeComp, setActiveComp] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)   // YYYY-MM-DD or null for all
  const [selectedUFCDate, setSelectedUFCDate] = useState<string | null>(null) // UFC modal date
  const [reminders, setReminders] = useState<Set<string>>(new Set())
  // Mini-paso de contexto antes de pedir el permiso de notificaciones del
  // navegador (ver toggleReminder). null = oculto; con datos = diálogo visible.
  const [reminderPrompt, setReminderPrompt] = useState<{ id: string; home: string; away: string | null; comp: string | null } | null>(null)
  const reminderDialogRef = useRef<HTMLDivElement>(null)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [favComps, setFavComps] = useState<Set<string>>(new Set())   // ligas fijadas (slugs)
  // Deportes seguidos (personalización de "Destacados"). Local + nube (sport:<slug>),
  // compartido con la app. Vacío → no filtra (se ve todo).
  const { sports: followedSports, toggle: toggleFollowedSport } = useFollowedSports()
  const [onlyLive, setOnlyLive] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set())
  // Histórico extendido (pestaña Resultados) — busca/pagina contra /api/events/past
  const [pastRange, setPastRange] = useState<'10d' | '30d' | '90d' | 'all'>('10d')
  const [extraPast, setExtraPast] = useState<SportEvent[]>([])
  const [pastNextCursor, setPastNextCursor] = useState<string | null>(null)
  const [pastLoading, setPastLoading] = useState(false)
  const [pastError, setPastError] = useState<string | null>(null)
  // Resultados rango "10 días": se cargan en cliente (no en SSR) para aligerar la
  // página. Vía /api/events/past?live=1 → ESPN en vivo (tenis + ganador F1/UFC).
  const [recentPast, setRecentPast] = useState<SportEvent[]>(pastEvents)
  const notifTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const prevScoresRef = useRef<Map<string, string>>(new Map())
  const flashTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  // Timeline continuo (vista Calendario): días PASADOS que se anteponen a la
  // lista al subir el scroll (arriba = pasado, HOY en medio, abajo = futuro).
  // Distintos del histórico de la pestaña Resultados (extraPast/recentPast).
  const [pastTimeline, setPastTimeline] = useState<SportEvent[]>([])
  const loadingPastRef = useRef(false)
  const prependAnchorRef = useRef<number | null>(null)  // scrollHeight antes del prepend (para anclar HOY tras cargar pasados)
  const stickyBarRef = useRef<HTMLDivElement | null>(null) // barra sticky (day chips + toolbar): su altura = offset del anclaje
  const todaySepRef = useRef<HTMLElement | null>(null) // sección de HOY (referencia; ya no se ancla al montar)

  const liveScores = useLiveScores(events)
  const liveFixtures = useLiveFixtures()

  useEffect(() => {
    // Auto-detect browser TZ on first visit (no stored preference).
    // We persist it so the next SSR render already uses the correct cookie.
    const detectedTz = getStoredTZ()
    setTz(detectedTz)
    if (!localStorage.getItem(TZ_KEY)) {
      setStoredTZ(detectedTz, 'auto')
    }
    try {
      // ── Reminders / favorites / onboarding ─────────────────────
      const stored = JSON.parse(localStorage.getItem('ts_reminders') ?? '[]')
      setReminders(new Set(stored))
      const favs = JSON.parse(localStorage.getItem('ts_favorites') ?? '[]')
      setFavorites(new Set(favs))
      const favC = JSON.parse(localStorage.getItem('ts_fav_comps') ?? '[]')
      setFavComps(new Set(favC))
      // El onboarding de favoritos ya NO se auto-abre: antes tapaba todo el
      // calendario en la 1ª visita (fricción). La invitación vive en el CTA
      // "Elegir equipos" del feed; el modal solo abre si el usuario lo pulsa.

      // ── Restore prefs: URL takes priority over localStorage ─────
      const params = new URLSearchParams(window.location.search)

      const urlView   = params.get('v')
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

      const savedView  = v3Migrated ? localStorage.getItem('ts_cal_view') : null
      const savedSport = v3Migrated ? localStorage.getItem('ts_cal_sport') : null

      // Legacy aliases: 'en-vivo' e 'destacados' (Inicio) fueron absorbidos
      // por el chip Destacados dentro del tab Calendario. Cualquier URL o
      // localStorage que apunte a esos valores cae a 'todos' (Calendario).
      // Legacy: 'en-vivo'/'destacados'/'resultados' (vistas retiradas o ya no
      // navegables desde la cabecera) caen a 'todos'.
      const VALID_VIEWS: ViewType[] = ['todos', 'recordatorios']
      const normalizedView = (urlView === 'en-vivo' || urlView === 'destacados') ? 'todos' : urlView
      if (normalizedView && VALID_VIEWS.includes(normalizedView as ViewType)) {
        setView(normalizedView as ViewType)
      } else if (savedView && VALID_VIEWS.includes(savedView as ViewType)) {
        setView(savedView as ViewType)
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
      if (view !== 'todos') params.set('v', view); else params.delete('v')
      if (activeFilter !== 'Todo') params.set('sport', activeFilter); else params.delete('sport')
      if (selectedDate) params.set('d', selectedDate); else params.delete('d')
      const qs = params.toString()
      const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
      window.history.replaceState(null, '', newUrl)
    } catch { /* ignore */ }
  }, [view, activeFilter, selectedDate])

  // Carga la ventana de días PASADOS del timeline (una sola vez, al montar). El
  // endpoint con live=1 cubre los ~10 días recientes: los traemos de golpe y los
  // anteponemos a la lista. Para histórico más antiguo está la pestaña Resultados.
  const loadPastWindow = useCallback(async () => {
    if (loadingPastRef.current) return
    loadingPastRef.current = true
    const from = new Date(Date.now() - PAST_WINDOW_DAYS * 86_400_000).toISOString()
    prependAnchorRef.current = document.documentElement.scrollHeight
    try {
      const res = await fetch(`/api/events/past?live=1&from=${encodeURIComponent(from)}&limit=200`)
      const data = res.ok ? await res.json() as { events?: SportEvent[] } : null
      const todayKey = isoToLocalDate(new Date().toISOString(), tz)
      // Solo días estrictamente anteriores a HOY (los de hoy ya vienen por events).
      const evs = (data?.events ?? []).filter(e => e.isoDate && isoToLocalDate(e.isoDate, tz) < todayKey)
      setPastTimeline(prev => {
        const seen = new Set(prev.map(e => e.id))
        const fresh = evs.filter(e => !seen.has(e.id))
        return fresh.length ? [...fresh, ...prev] : prev
      })
    } catch {
      prependAnchorRef.current = null
    }
    loadingPastRef.current = false
  }, [tz])

  // Al anteponer los días pasados (el usuario pulsó "Ver resultados anteriores"):
  // 1) compensamos cuánto creció la página para que HOY NO SALTE de sitio, y
  // 2) asomamos un poco hacia arriba (suave) para que se vean los primeros
  // resultados e invitar a seguir subiendo. Como NO se carga nada al montar,
  // al entrar HOY está arriba al instante y no hay "flash".
  useLayoutEffect(() => {
    if (prependAnchorRef.current == null) return
    const grew = document.documentElement.scrollHeight - prependAnchorRef.current
    prependAnchorRef.current = null
    if (grew <= 0) return
    window.scrollBy(0, grew) // mantiene la posición visual (HOY donde estaba)
    requestAnimationFrame(() => window.scrollBy({ top: -Math.min(grew, 260), behavior: 'smooth' }))
  }, [pastTimeline])

  // Debounce search input — avoid filtering on every keystroke
  useEffect(() => {
    // Búsqueda instantánea desde la 1ª letra (sin mínimo de 2), debounce corto.
    const t = setTimeout(() => setSearch(searchRaw.trim().length >= 1 ? searchRaw : ''), 140)
    return () => clearTimeout(t)
  }, [searchRaw])

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
      const timer = setTimeout(() => {
        flashTimers.current.delete(timer)
        setFlashIds(prev => {
          const next = new Set(prev)
          newFlashes.forEach(id => next.delete(id))
          return next
        })
      }, 1500)
      flashTimers.current.add(timer)
    }
  }, [liveScores])

  // Al desmontar: cancela los timers de flash pendientes (evita el setState
  // sobre un componente ya desmontado si un marcador cambió justo antes de salir).
  useEffect(() => () => {
    flashTimers.current.forEach(clearTimeout)
    flashTimers.current.clear()
  }, [])

  // Persistencia en la nube (best-effort, solo con sesión): sube o borra un
  // favorito en la cuenta (reusa user_favorites con etiqueta team:/comp:) para
  // que equipos y ligas sigan al usuario entre dispositivos.
  const syncFavoriteToCloud = useCallback((entryId: string, active: boolean) => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return
      if (active) {
        fetch('/api/rankings/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entry_id: entryId }),
        }).catch(() => { /* best-effort */ })
      } else {
        fetch(`/api/rankings/favorites?entry_id=${encodeURIComponent(entryId)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        }).catch(() => { /* best-effort */ })
      }
    }).catch(() => { /* ignore */ })
  }, [])

  const toggleFavorite = useCallback((name: string) => {
    if (!name) return
    const willActivate = !favorites.has(name)
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      localStorage.setItem('ts_favorites', JSON.stringify([...next]))
      return next
    })
    syncFavoriteToCloud(`team:${name}`, willActivate)
  }, [favorites, syncFavoriteToCloud])

  // Fijar / dejar de fijar una competición (slug). Las fijadas suben al principio
  // de cada día en el feed. Persistido en localStorage + cuenta.
  const togglePinComp = useCallback((slug: string) => {
    if (!slug) return
    const willPin = !favComps.has(slug)
    setFavComps(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      localStorage.setItem('ts_fav_comps', JSON.stringify([...next]))
      return next
    })
    syncFavoriteToCloud(`comp:${slug}`, willPin)
  }, [favComps, syncFavoriteToCloud])

  const finishOnboarding = useCallback((selectedTeams: string[]) => {
    const next = new Set(selectedTeams)
    // Sincroniza la diferencia con la cuenta: añade los nuevos, quita los retirados.
    for (const t of next) if (!favorites.has(t)) syncFavoriteToCloud(`team:${t}`, true)
    for (const t of favorites) if (!next.has(t)) syncFavoriteToCloud(`team:${t}`, false)
    setFavorites(next)
    localStorage.setItem('ts_favorites', JSON.stringify([...next]))
    localStorage.setItem('ts_onboarded', '1')
  }, [favorites, syncFavoriteToCloud])

  const skipOnboarding = useCallback(() => {
    localStorage.setItem('ts_onboarded', '1')
    setShowOnboarding(false)
  }, [])

  // Fusión con la cuenta (best-effort, solo con sesión): al entrar logueado
  // junta los favoritos de este navegador con los de la cuenta (no se pierde
  // nada) y deja la misma lista de equipos y ligas en todos los dispositivos.
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session || cancelled) return
      fetch('/api/rankings/favorites', { credentials: 'same-origin' })
        .then(r => (r.ok ? r.json() : { favorites: [] }))
        .then((j: { favorites?: { entry_id: string }[] }) => {
          if (cancelled) return
          const ids = (j.favorites ?? []).map(f => f.entry_id)
          const cloudTeams = ids.filter(id => id.startsWith('team:')).map(id => id.slice(5))
          const cloudComps = ids.filter(id => id.startsWith('comp:')).map(id => id.slice(5))
          const readArr = (k: string): string[] => {
            try { const v = JSON.parse(localStorage.getItem(k) ?? '[]'); return Array.isArray(v) ? v : [] }
            catch { return [] }
          }
          const localTeams = readArr('ts_favorites')
          const localComps = readArr('ts_fav_comps')
          const mergedTeams = new Set<string>([...localTeams, ...cloudTeams])
          const mergedComps = new Set<string>([...localComps, ...cloudComps])
          setFavorites(mergedTeams)
          setFavComps(mergedComps)
          try {
            localStorage.setItem('ts_favorites', JSON.stringify([...mergedTeams]))
            localStorage.setItem('ts_fav_comps', JSON.stringify([...mergedComps]))
          } catch { /* ignore */ }
          // Sube a la cuenta lo que solo estaba en este navegador (invitado→cuenta).
          const post = (entryId: string) => fetch('/api/rankings/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry_id: entryId }),
          }).catch(() => { /* best-effort */ })
          const cloudTeamSet = new Set(cloudTeams)
          const cloudCompSet = new Set(cloudComps)
          for (const t of localTeams) if (!cloudTeamSet.has(t)) post(`team:${t}`)
          for (const c of localComps) if (!cloudCompSet.has(c)) post(`comp:${c}`)
        })
        .catch(() => { /* best-effort */ })
    }).catch(() => { /* ignore */ })
    return () => { cancelled = true }
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

  // Recordatorio REAL vía push (server) → avisa aunque la web esté cerrada. Si
  // el usuario rechaza el permiso o el navegador no soporta push, cae al aviso
  // local (setTimeout, solo con la pestaña abierta).
  const enableReminderPush = useCallback(async (id: string) => {
    const ev = events.find(e => e.id === id)
    if (ev?.isoDate) {
      try {
        const r = await subscribeToPush(['calendario'])
        if (r.ok && r.endpoint) {
          const res = await fetch('/api/push/reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: r.endpoint, matchRef: id, kickoffIso: ev.isoDate,
              home: ev.home, away: ev.away ?? null, comp: ev.comp ?? null,
              url: ev.matchRef ? `/partido/${ev.matchRef}` : '/calendario',
            }),
          })
          if (res.ok) return  // push real OK → no programamos el local (evita doble aviso)
        }
      } catch { /* cae al fallback local */ }
    }
    await requestNotifPermission()
    scheduleNotif(id)
  }, [events, requestNotifPermission, scheduleNotif])

  // Baja del recordatorio en el servidor (la suscripción push se mantiene por si
  // hay otros recordatorios; solo se borra esta fila).
  const disableReminderPush = useCallback(async (id: string) => {
    try {
      if (!('serviceWorker' in navigator)) return
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub?.endpoint) {
        await fetch('/api/push/reminders', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint, matchRef: id }),
        }).catch(() => {})
      }
    } catch { /* ignore */ }
  }, [])

  // Persistencia en la nube (best-effort, solo con sesión): sube o borra el
  // recordatorio en la cuenta para que siga al usuario entre dispositivos.
  const syncReminderToCloud = useCallback((id: string, active: boolean, ev?: SportEvent) => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return
      if (active && ev) {
        fetch('/api/account/sync/reminders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ event_id: id, event_data: ev }] }),
        }).catch(() => { /* best-effort */ })
      } else if (!active) {
        fetch('/api/account/sync/reminders', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: id }),
        }).catch(() => { /* best-effort */ })
      }
    }).catch(() => { /* ignore */ })
  }, [])

  const toggleReminder = useCallback((id: string) => {
    const willActivate = !reminders.has(id)
    setReminders(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        const timer = notifTimers.current.get(id)
        if (timer) clearTimeout(timer)
        notifTimers.current.delete(id)
        disableReminderPush(id)
      } else {
        next.add(id)
      }
      localStorage.setItem('ts_reminders', JSON.stringify([...next]))
      // Snapshot del evento junto al id: el perfil lee 'ts_reminders_data' para
      // pintar el recordatorio (los ids reales espn-* no existen en mock data).
      try {
        const data = JSON.parse(localStorage.getItem('ts_reminders_data') ?? '{}')
        if (next.has(id)) {
          const ev = events.find(e => e.id === id)
          if (ev) data[id] = ev
        } else {
          delete data[id]
        }
        localStorage.setItem('ts_reminders_data', JSON.stringify(data))
      } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent('ts-reminders-change'))
      return next
    })
    // Al activar: si el permiso de notificaciones está SIN decidir ('default'),
    // mostramos primero un mini-paso de contexto. Pedir el permiso "a pelo" hace
    // que Chrome lo bloquee de forma permanente si el usuario lo descarta. El
    // recordatorio ya quedó guardado arriba; el permiso se pide al confirmar.
    // Si ya está concedido/denegado (o no hay API), seguimos el flujo directo.
    if (willActivate) {
      const ev = events.find(e => e.id === id)
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        setReminderPrompt({ id, home: ev?.home ?? '', away: ev?.away ?? null, comp: ev?.comp ?? null })
      } else {
        enableReminderPush(id)
      }
    }
    syncReminderToCloud(id, willActivate, events.find(e => e.id === id))
  }, [enableReminderPush, disableReminderPush, events, reminders, syncReminderToCloud])

  // Cierre del mini-paso de permiso (también lo usa el focus-trap con Escape).
  const closeReminderPrompt = useCallback(() => setReminderPrompt(null), [])
  useFocusTrap(!!reminderPrompt, reminderDialogRef, closeReminderPrompt)

  // Sync de snapshots: rellena 'ts_reminders_data' para los recordatorios
  // activos cuyo evento siga en el feed. Cubre recordatorios creados antes de
  // que existiera este store, para que el perfil pueda mostrarlos igualmente.
  useEffect(() => {
    if (reminders.size === 0) return
    try {
      const data = JSON.parse(localStorage.getItem('ts_reminders_data') ?? '{}')
      let changed = false
      for (const id of reminders) {
        const ev = events.find(e => e.id === id)
        if (ev) { data[id] = ev; changed = true }
      }
      if (changed) localStorage.setItem('ts_reminders_data', JSON.stringify(data))
    } catch { /* ignore */ }
  }, [reminders, events])

  // Destacados es un chip especial — no es un deporte sino un modo curado
  // que limita a los top 4 partidos por día por prestigio de liga + favoritos.
  // Las categorías (Destacados/Todo/deportes/competiciones) ahora viven en
  // <CompetitionSelector> (barra unificada de fichas con logo), en ambas pestañas.

  // Competición seleccionada en el selector "Por competición": filtra el feed en
  // el sitio + muestra su banner. null = sin filtro de competición.
  const activeCompCfg = useMemo(() => (activeComp ? getCompetition(activeComp) : null), [activeComp])

  // Base de la LISTA de días: en la vista Calendario (sin fecha ni "En vivo")
  // combinamos los días pasados del timeline continuo DELANTE de los futuros
  // (prop events). El resto de derivados (availableDays, favoriteEvents,
  // liveEventsInList, recordatorios…) siguen usando SOLO events.
  const baseEventsForList = useMemo(
    () => (view === 'todos' && !selectedDate && !onlyLive) ? [...pastTimeline, ...events] : events,
    [view, selectedDate, onlyLive, pastTimeline, events]
  )

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
      return isoToLocalDate(e.isoDate, tz) === selectedDate
    }
    const matchesLive = (e: SportEvent) => {
      if (!onlyLive) return true
      const score = liveScores.get(e.id)
      return !!score && isLiveStatus(score.status)
    }
    const matchesComp = (e: SportEvent) => !activeCompCfg || matchesCompetition(activeCompCfg, e)
    return baseEventsForList.filter(e => matchesSport(e) && matchesComp(e) && matchesSearch(e) && matchesDate(e) && matchesLive(e))
  }, [baseEventsForList, search, activeFilter, activeCompCfg, selectedDate, onlyLive, liveScores, tz])

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

  // "Destacados" y "Todo" son vistas por defecto (no son un filtro que el
  // usuario "active"), así que NO disparan el botón Limpiar. Solo lo hacen un
  // deporte concreto, una fecha, una búsqueda o el toggle En vivo.
  const hasActiveFilters = !!selectedDate || (activeFilter !== 'Todo' && activeFilter !== 'Destacados') || !!searchRaw || onlyLive || !!activeComp
  const clearFilters = useCallback(() => {
    setSelectedDate(null)
    setActiveFilter('Destacados')
    setActiveComp(null)
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
      if (!matchesSport(e) || (activeCompCfg && !matchesCompetition(activeCompCfg, e)) || !matchesSearch(e) || !e.isoDate) continue
      const k = isoToLocalDate(e.isoDate, tz)
      counts[k] = (counts[k] ?? 0) + 1
    }
    const today = isoToLocalDate(new Date().toISOString(), tz)
    // 42 días: cubre el Mundial completo (38 días) — antes el tope de 14 dejaba
    // fuera del selector las fechas de octavos en adelante.
    return Object.keys(counts)
      .filter(k => k >= today)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 42)
      // counts solo sirve para saber QUÉ días tienen partidos; DayChips ya no
      // pinta ni label ni count (calcula su propia etiqueta desde la key).
      .map(k => ({ key: k }))
  }, [events, search, activeFilter, activeCompCfg, tz])

  const liveEventsInList = useMemo(
    () => filtered.filter(e => liveScores.has(e.id) && isLiveStatus(liveScores.get(e.id)?.status ?? '')),
    [filtered, liveScores]
  )

  const orphanFixtures = useMemo(() => {
    return liveFixtures.filter(f => {
      // 'Todo'/'Destacados' = todos los deportes; un partido en vivo huérfano
      // (que arrancó tras el último SSR, p. ej. un Mundial en juego) es siempre
      // un destacado. Ver liveSportPassesFilter para el porqué del trato especial.
      if (!liveSportPassesFilter(activeFilter, f.sport)) return false
      const matched = liveEventsInList.find(e =>
        // Cruce por matchRef (id canónico, inmune al idioma): el feed en vivo
        // trae el nombre de selección en inglés y el calendario en español, así
        // que un namesMatch solo duplicaría esos partidos. matchRef es idéntico
        // en ambos lados (slug_id). namesMatch queda de respaldo.
        (f.matchRef != null && e.matchRef === f.matchRef) ||
        (namesMatch(e.home, f.homeTeam) && namesMatch(e.away ?? '', f.awayTeam))
      )
      return !matched
    })
  }, [liveFixtures, liveEventsInList, activeFilter])

  // Si el chip Destacados está activo, en la vista Calendario se muestran los
  // partidos más importantes de cada día. Criterio combinado:
  //   1. Favoritos del usuario primero (siempre)
  //   2. Highlight score: prestigio de liga + boost por marquee team
  //      (+2), fase final/semifinal/cuartos (+4/+3/+2), live (+1.5),
  //      prime time 18-23h Madrid (+0.5)
  //   3. Empate → hora más temprana
  // Cuántos por día: al menos DESTACADOS_MIN, pero se amplía para no cortar los
  // carteles élite (score ≥ DESTACADOS_ELITE: Mundial, Champions, fases finales).
  // En plena fase de grupos del Mundial (5-6 partidos top/día) se muestran todos.
  const filteredForGrouping = useMemo(() => {
    // Con una competición seleccionada se muestran TODOS sus partidos (no se aplica
    // la curación de Destacados, que recorta a los top del día).
    if (activeFilter !== 'Destacados' || activeComp) return filtered
    // Personalización IMPLÍCITA (solo en Destacados, sin búsqueda activa): quédate
    // con tus deportes/equipos seguidos. El Mundial, los directos y tus equipos
    // entran igual; sin nada seguido → se ve todo. La búsqueda es una elección
    // explícita, así que NO filtra por seguidos.
    const src = search
      ? filtered
      : filterByFollowed(
          filtered,
          { deportesSeguidos: [...followedSports], equiposSeguidos: [...favorites] },
          {
            isLive: (e) => {
              const ls = liveScores.get((e as SportEvent).id)
              return !!ls && isLiveStatus(ls.status)
            },
            teamMatch: (n, t) => (t ? nameMatch(n, t) : false),
          },
        )
    const byDay = new Map<string, SportEvent[]>()
    for (const ev of src) {
      const day = ev.isoDate ? isoToLocalDate(ev.isoDate, tz) : 'unknown'
      const arr = byDay.get(day) ?? []
      arr.push(ev)
      byDay.set(day, arr)
    }
    const scoreCache = new Map<string, number>()
    const scoreFor = (ev: SportEvent) => {
      const cached = scoreCache.get(ev.id)
      if (cached !== undefined) return cached
      const live = liveScores.has(ev.id) && isLiveStatus(liveScores.get(ev.id)?.status ?? '')
      const s = getEventHighlightScore({
        comp: ev.comp,
        home: ev.home,
        away: ev.away,
        stage: ev.stage,
        isoDate: ev.isoDate,
        isLive: live,
      })
      scoreCache.set(ev.id, s)
      return s
    }
    const todayKey = isoToLocalDate(new Date().toISOString(), tz)
    const out: SportEvent[] = []
    for (const [day, evs] of byDay) {
      const sorted = [...evs].sort((a, b) => {
        const aFav = eventHasFavorite(favorites, a) ? 1 : 0
        const bFav = eventHasFavorite(favorites, b) ? 1 : 0
        if (aFav !== bFav) return bFav - aFav
        const sA = scoreFor(a)
        const sB = scoreFor(b)
        if (sA !== sB) return sB - sA
        return (a.isoDate ?? '').localeCompare(b.isoDate ?? '')
      })
      // Días YA JUGADOS (timeline "Ver resultados anteriores"): se muestran
      // COMPLETOS, sin curación. Destacados solo tiene sentido como AVANCE de lo
      // que viene; en un día terminado el usuario quiere TODOS los resultados,
      // no 4 curados (que además esconderían resultados reales sin avisar).
      if (day !== 'unknown' && day < todayKey) {
        out.push(...sorted)
        continue
      }
      // Al menos MIN; se extiende mientras el siguiente siga siendo favorito o
      // élite (≥ ELITE), hasta MAX. Ordenado desc. → en cuanto uno no cualifica,
      // el resto tampoco: corte limpio.
      let keep = Math.min(DESTACADOS_MIN, sorted.length)
      while (
        keep < sorted.length &&
        keep < DESTACADOS_MAX &&
        (eventHasFavorite(favorites, sorted[keep]) || scoreFor(sorted[keep]) >= DESTACADOS_ELITE)
      ) {
        keep++
      }
      // El Mundial entra SIEMPRE en Destacados, aunque el tope del día (MAX) lo
      // dejara fuera: garantiza la cobertura del torneo en su ventana. Se respeta
      // el orden ya calculado (`sorted`), así que el Mundial mantiene su posición.
      out.push(...sorted.filter((e, i) => i < keep || isMundial(e.comp)))
    }
    return out
  }, [filtered, activeFilter, activeComp, favorites, followedSports, search, liveScores, tz])

  const grouped = useMemo(() => groupEventsByDate(filteredForGrouping, tz), [filteredForGrouping, tz])
  const orderedDates = useMemo(() => orderedDateKeys(grouped), [grouped])

  // A propósito NO cargamos días pasados al montar: HOY aparece arriba al
  // instante, sin "flash" ni saltos. Los pasados se traen solo cuando el usuario
  // pulsa la casilla "Ver resultados anteriores" (en el cuerpo de la lista).

  const liveCount = liveEventsInList.length + orphanFixtures.length

  const remindedEvents = useMemo(
    () => events.filter(e => reminders.has(e.id)),
    [events, reminders]
  )

  // Histórico: 10d usa lo que entró por SSR; rangos mayores cargan desde la API.
  const useExtendedPast = pastRange !== '10d'
  const pastSource = useExtendedPast ? extraPast : recentPast

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
    return pastSource.filter(e => matchesSport(e) && (!activeCompCfg || matchesCompetition(activeCompCfg, e)) && matchesSearch(e))
  }, [pastSource, search, activeFilter, activeCompCfg])

  // Past events grouped by date (most-recent first)
  const pastGrouped = useMemo(() => {
    const groups: Record<string, SportEvent[]> = {}
    for (const e of filteredPast) {
      const k = e.isoDate ? isoToLocalDate(e.isoDate, tz) : e.date
      if (!groups[k]) groups[k] = []
      groups[k].push(e)
    }
    return groups
  }, [filteredPast, tz])

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
      isoToLocalDate(e.isoDate, tz) === selectedUFCDate
    )
  }, [selectedUFCDate, filtered, tz])

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
          tz={tz}
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
          tz={tz}
          isReminded={reminders.has(fixture.id)}
          onToggleReminder={() => toggleReminder(fixture.id)}
        />
      )
    }
    return cards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEventsInList, orphanFixtures, reminders, liveScores, tz])

  // Tema por deporte: deriva del filtro activo. El cambio = solo swap de
  // variables CSS (instantáneo). La capa .cal-ambient se re-monta con key para
  // un crossfade suave de la textura característica.
  // Si hay competición seleccionada, su deporte manda (el ambiente casa con su
  // banner); si no, deriva del filtro de deporte.
  const themeKey = sportThemeKey(activeCompCfg?.sport ?? activeFilter)

  // Foto ÚNICA de la cabecera (telón): refleja lo seleccionado — la foto de la
  // competición si hay una elegida, si no la del deporte del filtro. Va de fondo,
  // con el título y los selectores encima; NO hay banner-recuadro aparte. Las
  // cabeceras de grupo de la competición activa no repiten la foto (la lleva el
  // telón); en la vista general cada liga conserva la suya (variedad).
  // En las vistas generales del calendario (Destacados/Todo/nicho → tema 'default')
  // usamos una arena nocturna PROPIA en vez del bokeh morado compartido con
  // Juegos/Rankings/Estadísticas: casa mejor con el look de foto visible y no
  // arrastra la "franja de luces" del bokeh. Las vistas de un deporte conservan su foto.
  const heroPhoto =
    activeCompCfg?.banner ??
    (themeKey === 'default' ? '/banners/signal/destacados.webp' : SPORT_THEME[themeKey].backdrop) ??
    null

  // Día de HOY (local): separa los días pasados (tono rojo suave) de los
  // futuros en las cabeceras del timeline continuo.
  const todayKey = isoToLocalDate(new Date().toISOString(), tz)

  return (
    <main
      className="cal-root relative max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-28"
      data-sport={themeKey}
      style={{ isolation: 'isolate' }}
    >
      {/* Capa ambiente del tema (foto IA + tinte + textura broadcast, detrás del
          hero). Solo el tema activo está montado → su foto carga lazy; el resto
          ni se pide. Sin foto configurada, caen solo tinte + textura. */}
      <div key={activeComp ?? themeKey} className={`cal-ambient${heroPhoto ? ' cal-ambient--photo' : ''}`} style={{ zIndex: 0 }} aria-hidden>
        {heroPhoto && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cal-backdrop" src={heroPhoto} alt="" aria-hidden="true" loading="lazy" decoding="async" />
            <div className="cal-backdrop-scrim" aria-hidden />
          </>
        )}
      </div>
      {/* Header */}
      <div className="relative pt-3 pb-2 sm:pt-6 sm:pb-4" style={{ zIndex: 1 }}>
        {/* Ambient glow */}
        <div className="absolute -top-8 left-0 w-96 h-56 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 15% 45%, rgba(124,58,237,0.09) 0%, transparent 70%)', filter: 'blur(20px)' }} />

        <div className="relative flex items-start justify-between gap-3 mb-2 sm:mb-4">
          <div className="min-w-0">
            {/* Eyebrow: identidad de la competición elegida (escudo + nombre) o
                "Agenda deportiva" cuando no hay filtro de competición. */}
            <div className={`${activeCompCfg ? 'flex' : 'hidden sm:flex'} items-center gap-2 mb-1 sm:mb-2`}>
              {activeCompCfg ? (
                <>
                  {activeCompCfg.crest && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={activeCompCfg.crest} alt="" aria-hidden="true" width={20} height={20} loading="lazy" decoding="async" style={{ objectFit: 'contain', width: 20, height: 20 }} />
                  )}
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] truncate" style={{ color: accentForSport(activeCompCfg.sport, '#A78BFA'), fontFamily: 'var(--font-sport)', maxWidth: '58vw' }}>
                    {activeCompCfg.displayName}
                  </span>
                </>
              ) : (
                <>
                  <span className="block rounded-sm" style={{ width: 3, height: 13, background: '#7C3AED', boxShadow: '0 0 8px rgba(124,58,237,0.5)' }} />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: '#5A5A74', fontFamily: 'var(--font-sport)' }}>
                    Todos los deportes
                  </span>
                </>
              )}
            </div>
            <h1 className="font-black leading-none uppercase"
              style={{ fontFamily: 'var(--font-headline)', fontSize: '1.3rem', color: '#F8F8FF', letterSpacing: '-0.01em' }}>
              Calendario
            </h1>
            {/* Acceso a la página de la competición + quitar filtro. Sustituye al
                antiguo banner-recuadro: la foto ya está de fondo, aquí va el texto. */}
            {activeCompCfg && (
              <div className="flex items-center gap-3 mt-2">
                {activeCompCfg.espnSlug && (
                  <Link href={`/calendario/${activeCompCfg.slug}`} prefetch={false}
                    className="inline-flex items-center gap-1 text-[11px] font-bold no-underline transition-opacity hover:opacity-80"
                    style={{ color: accentForSport(activeCompCfg.sport, '#A78BFA'), fontFamily: 'var(--font-sport)' }}>
                    Clasificación y goleadores
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M4.5 2 8 6l-3.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                )}
                <button onClick={() => setActiveComp(null)} aria-label="Quitar filtro de competición"
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors hover:text-white"
                  style={{ color: '#9A9AAE', fontFamily: 'var(--font-sport)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  Quitar
                </button>
              </div>
            )}
          </div>

          {/* Controles auxiliares a la derecha, en la MISMA fila que el título:
              zona horaria + favoritos + alertas. Sin pestañas ni stat chips para
              que los partidos se vean cuanto antes. */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Zona horaria — único selector (móvil + escritorio) */}
            <TimezoneSelector value={tz} onChange={(newTz) => { setTz(newTz); setStoredTZ(newTz) }} compact />
            {/* Favoritos — abre el modal de elegir equipos. Se tiñe de morado
                cuando el usuario ya tiene equipos guardados. */}
            {(() => {
              const hasFavs = favorites.size > 0
              return (
                <button
                  onClick={() => setShowOnboarding(true)}
                  aria-label="Mis equipos"
                  title="Mis equipos"
                  className="relative flex items-center justify-center rounded-full flex-shrink-0 transition-all"
                  style={{
                    width: 36, height: 36,
                    background: hasFavs ? 'rgba(124,58,237,0.16)' : 'rgba(255,255,255,0.04)',
                    border: hasFavs ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    color: hasFavs ? '#C4B5FD' : '#7A7A8E',
                    cursor: 'pointer',
                  }}>
                  <svg width={15} height={15} viewBox="0 0 16 16" fill={hasFavs ? '#C4B5FD' : 'none'} aria-hidden>
                    <path d="M8 13.5s-5-3-5-7a3 3 0 015-2 3 3 0 015 2c0 4-5 7-5 7z"
                      stroke={hasFavs ? '#C4B5FD' : '#7A7A8E'} strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                  {hasFavs && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center text-[9px] font-black tabular-nums rounded-full"
                      style={{ minWidth: 16, height: 16, padding: '0 4px', background: '#7C3AED', color: '#fff', border: '1px solid var(--bg-base)', fontFamily: 'var(--font-sport)' }}>
                      {favorites.size}
                    </span>
                  )}
                </button>
              )
            })()}
            {/* Alertas — botón icono auxiliar */}
            {(() => {
              const isActive = view === 'recordatorios'
              const remCount = remindedEvents.length
              return (
                <button
                  onClick={() => setView(isActive ? 'todos' : 'recordatorios')}
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
      </div>

      {/* Day chips + Toolbar (sticky on scroll) */}
      {view === 'todos' && (
        <div
          ref={stickyBarRef}
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
              <DayChips days={availableDays} value={selectedDate} onChange={setSelectedDate} tz={tz} />
            </div>
          )}
          {/* Toolbar — single scrollable row on mobile, two-row layout on sm+ */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
            <SearchInput value={searchRaw} onChange={setSearchRaw} />
            {/* Divider */}
            <div className="flex-shrink-0 w-px h-4" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <button
              onClick={() => setOnlyLive(v => !v)}
              aria-pressed={onlyLive}
              aria-label="Mostrar solo partidos en vivo"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0"
              style={{
                background: onlyLive ? 'rgba(255,77,46,0.18)' : 'rgba(255,255,255,0.04)',
                color: onlyLive ? '#FF4D2E' : '#7A7A8E',
                border: onlyLive ? '1px solid rgba(255,77,46,0.45)' : '1px solid rgba(255,255,255,0.06)',
                fontFamily: 'var(--font-sport)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: onlyLive ? '0 0 12px rgba(255,77,46,0.18)' : 'none',
              }}
            >
              {onlyLive && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#FF4D2E' }} />}
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
          {/* Barra unificada de categorías (fichas con logo, scrollable):
              Destacados → Todo → deportes (icono) → competiciones (escudo).
              Reemplaza los antiguos chips de texto. Deporte/modo ajusta el filtro;
              competición fija activeComp → su foto pasa al telón de fondo de la
              cabecera y su escudo/acceso a la página aparecen junto al título. */}
          <div className="mt-3 pb-1">
            <CompetitionSelector
              events={events}
              activeFilter={activeFilter}
              activeComp={activeComp}
              onSelectSport={(k) => { setActiveComp(null); setActiveFilter(k) }}
              onSelectComp={(slug) => { if (activeComp === slug) { setActiveComp(null) } else { setActiveFilter('Todo'); setActiveComp(slug) } }}
            />
            {/* "Mis deportes": personaliza los Destacados. Vacío → se ven todos.
                Se sincroniza con la app (usuarios con sesión). Editor completo en el
                Perfil (fase posterior); aquí una fila mínima de chips. */}
            {activeFilter === 'Destacados' && (
              <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                <span className="text-[10px] font-black uppercase tracking-widest flex-shrink-0"
                  style={{ color: '#6A6A7A', fontFamily: 'var(--font-sport)' }}>
                  Mis deportes
                </span>
                {FOLLOWABLE_SPORTS.map((slug) => {
                  const on = followedSports.has(slug)
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => toggleFollowedSport(slug)}
                      aria-pressed={on}
                      className="flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full transition-all"
                      style={{
                        background: on ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
                        color: on ? '#C4B5FD' : '#8A8AA0',
                        border: on ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        fontFamily: 'var(--font-sport)',
                      }}
                    >
                      {SLUG_TO_LABEL[slug] ?? slug}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {view === 'todos' && (
        <div className="relative z-[1] space-y-10">
          {/* Live strip at top of TODOS view */}
          {liveCount > 0 && !selectedDate && (
            <section>
              <SectionHeader icon={<LiveDotIcon size={8} />} label="En Vivo" color="#FF4D2E" count={liveCount} hint={liveCount > 3 ? '← desliza →' : undefined} />
              <LiveHeroStrip items={liveHeroCards} />
            </section>
          )}

          {/* El resumen grande de "tus equipos" se retiró de la lista: ocupaba
              demasiado. Ver y cambiar tus equipos vive ahora en el botón ♥ de la
              cabecera. Así, al entrar, se ven antes los partidos. */}

          {orderedDates.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="mb-2 flex justify-center" style={{ color: onlyLive ? '#FF4D2E' : '#5A5A6A' }}>
                {onlyLive
                  ? <LiveDotIcon size={32} />
                  : search
                    ? <SearchIcon size={32} />
                    : (activeFilter !== 'Todo' && activeFilter !== 'Destacados')
                      ? <SportIcon sport={activeFilter} size={32} />
                      : <CalendarIcon size={32} />}
              </p>
              <p style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', fontSize: 13, fontWeight: 600 }}>
                {onlyLive
                  ? 'No hay partidos en vivo ahora mismo'
                  : search
                    ? `Sin resultados para "${search}"`
                    : selectedDate
                      ? 'No hay partidos para esa fecha'
                      : activeCompCfg
                        ? `No hay partidos de ${activeCompCfg.shortName} programados ahora`
                        : (activeFilter !== 'Todo' && activeFilter !== 'Destacados')
                          ? `No hay eventos de ${activeFilter} en los próximos días`
                          : 'No se encontraron eventos'}
              </p>
              <p className="text-[10px] mt-1.5" style={{ color: '#7A7A8E' }}>
                {onlyLive
                  ? 'Cuando arranque un partido aparecerá aquí. Quita el filtro para ver todo el calendario.'
                  : search
                    ? 'Prueba con el nombre del equipo o la competición'
                    : selectedDate
                      ? 'Mostramos las próximas ~3 semanas. Para los días ya jugados, pulsa «Ver resultados anteriores».'
                      : activeCompCfg
                        ? 'Mira su clasificación y todo el calendario en el banner de arriba ↑'
                        : (activeFilter !== 'Todo' && activeFilter !== 'Destacados')
                          ? 'Prueba seleccionando otra fecha o cambia el filtro'
                          : 'Vuelve a intentarlo en unos minutos'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all hover:brightness-125"
                  style={{ background: 'rgba(124,58,237,0.16)', color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.4)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
                >
                  ✕ Quitar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Casilla "Ver resultados anteriores": al entrar HOY está arriba y
                  no se carga nada (sin flash). Al pulsarla se traen los días
                  pasados con sus marcadores y se asoman por arriba (el usuario
                  sube para verlos). Solo en la vista general (sin día ni "En vivo"). */}
              {pastTimeline.length === 0 && !selectedDate && !onlyLive ? (
                <button
                  onClick={() => loadPastWindow()}
                  className="cal-press w-full flex items-center justify-center gap-1.5 py-2.5 mb-1 rounded-xl text-[10px] font-black uppercase tracking-[0.18em] transition-all hover:brightness-125"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)', color: '#9090A8', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M2.5 7.5L6 4l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Ver resultados anteriores
                </button>
              ) : pastTimeline.length > 0 ? (
                <div className="flex items-center justify-center py-2 text-[10px] uppercase tracking-widest" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
                  <span>Resultados de días anteriores</span>
                </div>
              ) : null}
              {orderedDates.map(dateKey => {
              // Orden cronológico de los partidos del día. En "Destacados" se respeta
              // la curación por relevancia (top del día); en el resto (Todo / deporte /
              // competición) se ordena por isoDate (instante real → sube de menor a
              // mayor sea cual sea la zona horaria del usuario), de modo que las
              // competiciones quedan por su primer partido y, dentro de cada una, los
              // encuentros van en hora ascendente.
              const rawDay = grouped[dateKey] ?? []
              const dayEvents = activeFilter === 'Destacados'
                ? rawDay
                : [...rawDay].sort((a, b) => (a.isoDate ?? '').localeCompare(b.isoDate ?? ''))
              // Agrupar por competición (orden de primera aparición) y ordenar por
              // hora los partidos DENTRO de cada liga. En Destacados venían por
              // relevancia ("caché"), no por hora → ver groupDayByCompetition.
              const { order: compOrder, byComp } = groupDayByCompetition(dayEvents)
              // Ligas fijadas primero (orden estable; el resto, primera aparición).
              compOrder.sort((a, b) => {
                const pa = favComps.has(compConfigForGroup(a, byComp[a][0]?.sport)?.slug ?? '') ? 1 : 0
                const pb = favComps.has(compConfigForGroup(b, byComp[b][0]?.sport)?.slug ?? '') ? 1 : 0
                return pb - pa
              })
              return (
                // key incluye el filtro/fecha/onlyLive: al cambiarlos la sección
                // se re-monta y dispara la entrada en cascada (Fase B). No incluye
                // search ni liveScores → no re-anima al teclear ni en cada poll.
                <section ref={dateKey === todayKey ? todaySepRef : undefined} key={`${activeFilter}|${selectedDate ?? ''}|${onlyLive ? 'L' : ''}|${dateKey}`}>
                  <DaySeparator dateKey={dateKey} count={dayEvents.length} tone={dateKey < todayKey ? 'past' : 'upcoming'} tz={tz} />
                  {compOrder.map((comp, compIdx) => {
                    const compEvents = byComp[comp]
                    // FASE 3 (José Tomás 2026-07-09): cabecera de liga en el color
                    // POR DEPORTE (verde fútbol, ámbar básket…), igual que las tarjetas
                    // y que la app. Antes usaba el color de marca de la competición.
                    const accent = accentForSport(compEvents[0]?.sport, '#A78BFA')
                    const cfg = compConfigForGroup(comp, compEvents[0]?.sport)
                    return (
                      <div key={comp} className="mb-2 relative cal-anim-in" style={{ animationDelay: `${Math.min(compIdx * 55, 280)}ms` }}>
                        <CompGroupHeader comp={comp} accent={accent} count={compEvents.length} first={compIdx === 0} crest={cfg?.crest} slug={cfg?.slug} banner={activeComp && cfg?.slug === activeComp ? undefined : cfg?.banner} pinned={!!cfg?.slug && favComps.has(cfg.slug)} onTogglePin={cfg?.slug ? () => togglePinComp(cfg.slug!) : undefined} />
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
                              homeFav={isFavorite(favorites, event.home)}
                              awayFav={isFavorite(favorites, event.away)}
                              onToggleFav={() => toggleFavorite(event.home)}
                              formHome={recentForms[formKey(event, event.home)]}
                              formAway={event.away ? recentForms[formKey(event, event.away)] : undefined}
                              showReason={activeFilter === 'Destacados'}
                              tz={tz}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </section>
              )
              })}
            </>
          )}

          {/* CTA — invitar a ver toda la agenda cuando estamos en modo Destacados */}
          {activeFilter === 'Destacados' && orderedDates.length > 0 && filtered.length > filteredForGrouping.length && (
            <div className="flex flex-col items-center gap-1.5 pt-2">
              <p className="text-[11px]" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                Mostrando lo más destacado de cada día
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
                Ver todo el calendario ({filtered.length})
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {view === 'recordatorios' && (
        <div className="relative z-[1] space-y-5">
          {remindedEvents.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="mb-3 flex justify-center" style={{ color: '#FBBF24', opacity: 0.6 }}><BellIcon size={32} /></p>
              <p style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', fontSize: 13, fontWeight: 600 }}>
                No tienes recordatorios activos
              </p>
              <p className="text-[10px] mt-1.5 flex items-center justify-center gap-1" style={{ color: '#7A7A8E' }}>
                Pulsa <BellIcon size={10} /> en cualquier partido para recordarlo
              </p>
            </div>
          ) : (
            <section>
              <SectionHeader icon={<BellIcon size={12} />} label="Mis Recordatorios" color="#FBBF24" count={remindedEvents.length} />
              <div className="space-y-1.5">
                {remindedEvents.map(event => {
                  const evDate = event.isoDate ? isoToLocalDate(event.isoDate, tz) : null
                  const today = isoToLocalDate(new Date().toISOString(), tz)
                  const dateLabel = evDate && evDate !== today ? formatDateLabel(evDate, tz) : undefined
                  return (
                    <MatchRow
                      key={event.id}
                      event={event}
                      liveScore={liveScores.get(event.id)}
                      isReminded={true}
                      onToggleReminder={() => toggleReminder(event.id)}
                      dateLabel={dateLabel}
                      showComp
                      onClickUFC={setSelectedUFCDate}
                      flashing={flashIds.has(event.id)}
                      isFav={eventHasFavorite(favorites, event)}
                      homeFav={isFavorite(favorites, event.home)}
                      awayFav={isFavorite(favorites, event.away)}
                      onToggleFav={() => toggleFavorite(event.home)}
                      formHome={recentForms[formKey(event, event.home)]}
                      formAway={event.away ? recentForms[formKey(event, event.away)] : undefined}
                      tz={tz}
                    />
                  )
                })}
              </div>
            </section>
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

      {/* Mini-paso de contexto antes de pedir el permiso de notificaciones.
          Solo aparece la 1ª vez (permiso 'default'); el permiso real se solicita
          al pulsar "Permitir avisos" (dentro del gesto, con contexto). */}
      {reminderPrompt && (
        <div
          onClick={closeReminderPrompt}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            ref={reminderDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reminder-dialog-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 340, maxWidth: '90%', background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 18, padding: '24px 22px', textAlign: 'center' }}
          >
            <div style={{ width: 56, height: 56, margin: '0 auto 14px', borderRadius: '50%', background: 'rgba(255,77,46,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-action)' }}>
              <BellIcon size={26} />
            </div>
            <div style={{ fontFamily: 'var(--font-sport)', textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 11, color: 'var(--accent-action)', fontWeight: 600, marginBottom: 6 }}>
              Recordatorio
            </div>
            <h2 id="reminder-dialog-title" style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontWeight: 700, fontSize: 24, lineHeight: 1.05, color: '#F4F4F8', marginBottom: 10 }}>
              Activa los avisos
            </h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
              Te avisamos <strong style={{ color: '#C8C8D4', fontWeight: 600 }}>~10 min antes</strong> del partido, aunque tengas la web cerrada. Para eso necesitamos tu permiso de notificaciones.
            </p>
            {(reminderPrompt.home || reminderPrompt.comp) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', background: '#0E0E14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 12px', marginBottom: 18 }}>
                <span style={{ color: '#34D399', display: 'inline-flex' }}><ClipboardIcon size={15} /></span>
                <span style={{ fontSize: 12.5, color: '#C8C8D4' }}>
                  {reminderPrompt.home}{reminderPrompt.away ? ` vs ${reminderPrompt.away}` : ''}{reminderPrompt.comp ? ` · ${reminderPrompt.comp}` : ''}
                </span>
              </div>
            )}
            <button
              onClick={() => { const id = reminderPrompt.id; enableReminderPush(id); setReminderPrompt(null) }}
              style={{ width: '100%', background: 'var(--accent-action)', color: '#fff', border: 'none', borderRadius: 11, padding: 12, fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontWeight: 700, fontSize: 15, letterSpacing: '0.04em', cursor: 'pointer', marginBottom: 9 }}
            >
              Permitir avisos
            </button>
            <button
              onClick={closeReminderPrompt}
              style={{ width: '100%', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 11, padding: 11, fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
            >
              Ahora no
            </button>
            <p style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--text-muted)', margin: '13px 0 0' }}>
              El recordatorio se guarda en tu cuenta igualmente. Sin permiso no podremos enviarte el aviso.
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
