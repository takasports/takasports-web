// Filtro + curación por deportes/equipos seguidos.
//
// ESPEJO A MANO de takasports-shared/src/calendar/index.ts (toSportSlug /
// filterByFollowed / curateDay). La web NO consume el paquete @takasports/shared
// (un dep `file:` no resolvería en Vercel), así que se mantiene sincronizado a
// mano, igual que competitions.ts. Si tocas la política aquí, tócala también en
// el shared (y al revés).

import { getEventHighlightScore, isMundial } from './competitions'

// ── Normalización de deporte a slug canónico ─────────────────────────────────
const SPORT_SLUG_MAP: Record<string, string> = {
  futbol: 'futbol', soccer: 'futbol', football: 'futbol',
  baloncesto: 'baloncesto', basketball: 'baloncesto', basket: 'baloncesto',
  nba: 'baloncesto', euroliga: 'baloncesto', euroleague: 'baloncesto', bcl: 'baloncesto', acb: 'baloncesto',
  tenis: 'tenis', tennis: 'tenis', atp: 'tenis', wta: 'tenis',
  formula1: 'formula1', f1: 'formula1', 'formula 1': 'formula1', racing: 'formula1',
  motogp: 'motogp', moto: 'motogp',
  ufc: 'ufc', mma: 'ufc', boxing: 'ufc', boxeo: 'ufc',
  rugby: 'rugby',
  wwe: 'wwe', wrestling: 'wwe', aew: 'wwe', 'lucha libre': 'wwe',
  padel: 'padel',
  golf: 'golf', pga: 'golf',
}

/** Normaliza cualquier vocabulario de deporte (label ES / slug ESPN / SportSlug) a slug canónico. null si desconocido. */
export function toSportSlug(raw?: string | null): string | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (SPORT_SLUG_MAP[key]) return SPORT_SLUG_MAP[key]
  const prefix = key.split('/')[0]
  if (SPORT_SLUG_MAP[prefix]) return SPORT_SLUG_MAP[prefix]
  return null
}

// ── Filtro + curación ────────────────────────────────────────────────────────
export interface CurateEvent {
  sport?: string | null
  comp?: string | null
  home?: string | null
  away?: string | null
  homeTeam?: string | null
  awayTeam?: string | null
  stage?: string
  isoDate?: string | null
}

const homeOf = (e: CurateEvent) => e.home ?? e.homeTeam ?? null
const awayOf = (e: CurateEvent) => e.away ?? e.awayTeam ?? null

function normTeam(s?: string | null): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}
function defaultTeamMatch(followed: string, team: string | null | undefined): boolean {
  const a = normTeam(followed), b = normTeam(team)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

export interface FollowedPrefs {
  deportesSeguidos?: readonly string[]
  equiposSeguidos?: readonly string[]
}
export interface FollowFilterHooks {
  isLive?: (ev: CurateEvent) => boolean
  teamMatch?: (followedName: string, eventTeam: string | null | undefined) => boolean
}

/** ¿Este evento pasa el filtro de personalización? (Mundial/directo/deporte seguido/equipo seguido). */
export function eventMatchesFollowed(ev: CurateEvent, prefs: FollowedPrefs, hooks: FollowFilterHooks = {}): boolean {
  const sportSet = new Set((prefs.deportesSeguidos ?? []).map(toSportSlug).filter((s): s is string => !!s))
  const teams = prefs.equiposSeguidos ?? []
  if (sportSet.size === 0 && teams.length === 0) return true
  if (isMundial(ev.comp ?? '')) return true
  if (hooks.isLive?.(ev)) return true
  const slug = toSportSlug(ev.sport)
  if (slug && sportSet.has(slug)) return true
  if (teams.length) {
    const tm = hooks.teamMatch ?? defaultTeamMatch
    const h = homeOf(ev), a = awayOf(ev)
    for (const t of teams) if ((h && tm(t, h)) || (a && tm(t, a))) return true
  }
  return false
}

/** Filtra por deportes/equipos seguidos. Sin ninguna preferencia → devuelve TODO. */
export function filterByFollowed<T extends CurateEvent>(events: readonly T[], prefs: FollowedPrefs = {}, hooks: FollowFilterHooks = {}): T[] {
  const sportSet = new Set((prefs.deportesSeguidos ?? []).map(toSportSlug).filter((s): s is string => !!s))
  const teams = prefs.equiposSeguidos ?? []
  if (sportSet.size === 0 && teams.length === 0) return events.slice()
  return events.filter(ev => eventMatchesFollowed(ev, prefs, hooks))
}

export interface CurateDayOptions extends FollowedPrefs, FollowFilterHooks {
  dayKey?: (iso: string | null | undefined) => string
  now?: number
  min?: number
  elite?: number
  max?: number
  filter?: boolean
}

function defaultDayKey(iso?: string | null): string {
  if (!iso) return 'unknown'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'unknown'
  return d.toISOString().slice(0, 10)
}

/**
 * Filtra por seguidos (salvo `filter:false`) y CURA por día: al menos `min`,
 * ampliando mientras el siguiente sea favorito o score ≥ `elite`, hasta `max`.
 * Mundial y directos entran SIEMPRE. Días ya jugados van completos. Unifica la
 * política que estaba duplicada inline en el calendario de app y web.
 */
export function curateDay<T extends CurateEvent>(events: readonly T[], opts: CurateDayOptions = {}): T[] {
  const min = opts.min ?? 4
  const elite = opts.elite ?? 12
  const max = opts.max ?? 8
  const now = opts.now ?? Date.now()
  const dayKey = opts.dayKey ?? defaultDayKey
  const tm = opts.teamMatch ?? defaultTeamMatch
  const teams = opts.equiposSeguidos ?? []
  const isLive = opts.isLive

  const base = opts.filter === false ? events.slice() : filterByFollowed(events, opts, opts)

  const byDay = new Map<string, T[]>()
  for (const ev of base) {
    const k = dayKey(ev.isoDate)
    const arr = byDay.get(k) ?? []
    arr.push(ev)
    byDay.set(k, arr)
  }
  const todayKey = dayKey(new Date(now).toISOString())

  const isFav = (ev: T): boolean => {
    if (!teams.length) return false
    const h = homeOf(ev), a = awayOf(ev)
    return teams.some(t => (h && tm(t, h)) || (a && tm(t, a)))
  }
  const scoreCache = new Map<T, number>()
  const scoreFor = (ev: T): number => {
    const c = scoreCache.get(ev)
    if (c !== undefined) return c
    const s = getEventHighlightScore({
      comp: ev.comp ?? '', home: homeOf(ev) ?? undefined, away: awayOf(ev) ?? undefined,
      stage: ev.stage, isoDate: ev.isoDate ?? undefined, isLive: isLive?.(ev) ?? false,
    })
    scoreCache.set(ev, s)
    return s
  }

  const out: T[] = []
  for (const [day, evs] of byDay) {
    const sorted = [...evs].sort((a, b) => {
      const af = isFav(a) ? 1 : 0, bf = isFav(b) ? 1 : 0
      if (af !== bf) return bf - af
      const sa = scoreFor(a), sb = scoreFor(b)
      if (sa !== sb) return sb - sa
      return (a.isoDate ?? '').localeCompare(b.isoDate ?? '')
    })
    if (day !== 'unknown' && day < todayKey) { out.push(...sorted); continue }
    let keep = Math.min(min, sorted.length)
    while (keep < sorted.length && keep < max && (isFav(sorted[keep]) || scoreFor(sorted[keep]) >= elite)) keep++
    out.push(...sorted.filter((e, i) => i < keep || isMundial(e.comp ?? '') || (isLive?.(e) ?? false)))
  }
  return out
}
