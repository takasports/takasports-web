// Histórico de resultados — capa de datos.
// - Lectura pública via anon key (RLS permite SELECT a todos).
// - Escritura solo desde service role (cron / job de sync).
// - Si Supabase no está configurado, las funciones devuelven [] / 0 sin reventar.

import { unstable_cache } from 'next/cache'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SportEvent } from './types'
import { adminSupabase } from './supabase-admin'
import { WOMENS_SLUGS, isWomensSlug } from './football-leagues'

let _read: SupabaseClient | null | undefined

function readClient(): SupabaseClient | null {
  if (_read !== undefined) return _read
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) { _read = null; return null }
  _read = createClient(url, key, { auth: { persistSession: false } })
  return _read
}

interface PastEventRow {
  id: string
  iso_date: string
  sport: string
  comp: string
  home: string
  away: string | null
  home_score: number | null
  away_score: number | null
  home_logo: string | null
  away_logo: string | null
  home_abbr: string | null
  away_abbr: string | null
  venue: string | null
  match_ref: string | null
  accent: string | null
  source: string
  result_note: string | null
}

const DAYS_ES   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const MADRID_TZ = 'Europe/Madrid'
const WEEKDAY_IDX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

// Partes de la fecha en hora de Madrid (antes se mostraba en UTC, con desfase
// de 1-2 h → la franja de noche caía en el día equivocado). Es la zona que usa
// el resto de la web para fechas/horas mostradas.
function madridParts(iso: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MADRID_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return {
    wd: WEEKDAY_IDX[get('weekday')] ?? 0,
    day: Number(get('day')),
    month: Number(get('month')) - 1, // 0-based para MONTHS_ES
    hour: get('hour'),
    minute: get('minute'),
  }
}

function toDateLabel(iso: string): string {
  const p = madridParts(iso)
  return `${DAYS_ES[p.wd]} · ${p.day} ${MONTHS_ES[p.month]}`
}

function toTimeStr(iso: string): string {
  const p = madridParts(iso)
  return `${p.hour}:${p.minute}`
}

function rowToEvent(r: PastEventRow): SportEvent {
  return {
    id: r.id,
    home: r.home,
    away: r.away,
    sport: r.sport,
    comp: r.comp,
    date: toDateLabel(r.iso_date),
    time: toTimeStr(r.iso_date),
    accent: r.accent ?? '#7C3AED',
    isoDate: r.iso_date,
    venue: r.venue ?? undefined,
    homeLogo: r.home_logo ?? undefined,
    awayLogo: r.away_logo ?? undefined,
    homeAbbr: r.home_abbr ?? undefined,
    awayAbbr: r.away_abbr ?? undefined,
    matchRef: r.match_ref ?? undefined,
    homeScore: r.home_score,
    awayScore: r.away_score,
    resultNote: r.result_note ?? undefined,
    isPast: true,
    source: (r.source === 'sanity' || r.source === 'padel') ? r.source : 'espn',
  }
}

function eventToRow(e: SportEvent): PastEventRow | null {
  if (!e.isoDate) return null
  return {
    id: e.id,
    iso_date: e.isoDate,
    sport: e.sport,
    comp: e.comp,
    home: e.home,
    away: e.away,
    home_score: e.homeScore ?? null,
    away_score: e.awayScore ?? null,
    home_logo: e.homeLogo ?? null,
    away_logo: e.awayLogo ?? null,
    home_abbr: e.homeAbbr ?? null,
    away_abbr: e.awayAbbr ?? null,
    venue: e.venue ?? null,
    match_ref: e.matchRef ?? null,
    accent: e.accent ?? null,
    source: e.source ?? 'espn',
    result_note: e.resultNote ?? null,
  }
}

export interface PastQuery {
  from?: string        // ISO date (inclusive)
  to?: string          // ISO date (exclusive)
  sport?: string       // 'Fútbol', 'NBA'…
  comp?: string
  q?: string           // texto libre (equipo / competición)
  limit?: number       // default 60, max 200
  cursor?: string      // iso_date para paginar (devuelve eventos < cursor)
}

export interface PastQueryResult {
  events: SportEvent[]
  nextCursor: string | null
}

export async function searchPastEvents(query: PastQuery): Promise<PastQueryResult | null> {
  const sb = readClient()
  if (!sb) return null

  const limit = Math.min(Math.max(query.limit ?? 60, 1), 200)

  let q = sb.from('past_events').select('*').order('iso_date', { ascending: false }).limit(limit + 1)

  if (query.from)   q = q.gte('iso_date', query.from)
  if (query.to)     q = q.lt('iso_date', query.to)
  if (query.cursor) q = q.lt('iso_date', query.cursor)
  if (query.sport && query.sport !== 'Todo') q = q.eq('sport', query.sport)
  if (query.comp)   q = q.eq('comp', query.comp)

  if (query.q && query.q.trim()) {
    const term = query.q.trim().replace(/[%,]/g, ' ')
    // ilike sobre home/away/comp — suficiente y portable sin depender de unaccent en runtime.
    q = q.or(`home.ilike.%${term}%,away.ilike.%${term}%,comp.ilike.%${term}%`)
  }

  const { data, error } = await q
  if (error) return null
  if (!data) return { events: [], nextCursor: null }

  const rows = data as PastEventRow[]
  const hasMore = rows.length > limit
  const slice = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? slice[slice.length - 1].iso_date : null

  return { events: slice.map(rowToEvent), nextCursor }
}

// Busca UN evento archivado por su matchRef. Lo usa la ficha para resolver un
// resultado pasado cuando su fuente en vivo ya rotó (p. ej. tenis: al acabar el
// torneo, el scoreboard de ESPN deja de devolver el partido → 404). past_events
// guarda el tenis (sets ganados) vía el cron sync-past-results.
export async function getPastEventByRef(matchRef: string): Promise<SportEvent | null> {
  if (!matchRef) return null
  const sb = readClient()
  if (!sb) return null
  const { data, error } = await sb
    .from('past_events')
    .select('*')
    .eq('match_ref', matchRef)
    .order('iso_date', { ascending: false })
    .limit(1)
  if (error || !data || data.length === 0) return null
  return rowToEvent(data[0] as PastEventRow)
}

export async function upsertPastEvents(events: SportEvent[]): Promise<number> {
  const admin = adminSupabase()
  if (!admin) return 0
  const rows = events.map(eventToRow).filter((r): r is PastEventRow => r !== null)
  if (rows.length === 0) return 0

  // Upsert por id en chunks de 500.
  let written = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map(r => ({ ...r, updated_at: new Date().toISOString() }))
    const { error } = await admin.from('past_events').upsert(chunk, { onConflict: 'id' })
    if (!error) written += chunk.length
  }
  return written
}

export function pastEventsConfigured(): boolean {
  return readClient() !== null
}

// ── Filtro de género ───────────────────────────────────────────────────────
// Club y selección comparten nombre en masculino y femenino, pero el slug de
// liga (y por tanto el género) viaja embebido en cada fila: el job de sync
// genera `match_ref` = `<slug con / → _>_<eventId>` (indexado) e `id` =
// `espn-past-<slug con / → ->-<eventId>`. Reconstruimos los prefijos de las
// competiciones femeninas para etiquetar cada fila sin columna nueva ni
// migración. Prefijo exacto, no substring, para no confundir 'esp.w.1' con,
// p.ej., 'esp.1'.
const WOMENS_REF_PREFIXES = Array.from(WOMENS_SLUGS, (s) => `${s.replace('/', '_')}_`)
const WOMENS_ID_PREFIXES  = Array.from(WOMENS_SLUGS, (s) => `espn-past-${s.replace(/\//g, '-')}-`)

// ¿La fila pertenece a una competición femenina? Mira primero match_ref
// (indexado y siempre presente en fútbol), con respaldo en el id.
export function isWomensPastRow(r: { match_ref?: string | null; id?: string | null }): boolean {
  const ref = r.match_ref
  if (ref) return WOMENS_REF_PREFIXES.some((p) => ref.startsWith(p))
  const id = r.id ?? ''
  return WOMENS_ID_PREFIXES.some((p) => id.startsWith(p))
}

export interface H2HMatch {
  id: string
  isoDate: string
  comp: string
  home: string
  away: string
  homeScore: number | null
  awayScore: number | null
  homeLogo?: string
  awayLogo?: string
  homeAbbr?: string
  awayAbbr?: string
  matchRef?: string
}

export interface H2HResult {
  matches: H2HMatch[]
  // Counted from the perspective of `teamA`.
  wins: number
  draws: number
  losses: number
}

// Returns the last N matches between two teams in any order, ordered by date desc.
// Excludes the current match (caller can filter by `excludeId`).
async function _fetchH2HUncached(
  teamA: string,
  teamB: string,
  opts: { limit?: number; excludeId?: string; leagueSlug?: string } = {}
): Promise<H2HResult | null> {
  const sb = readClient()
  if (!sb) return null
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 20)

  // Filtro de género: si conocemos la liga del partido actual, solo contamos
  // enfrentamientos del mismo género (mismos nombres de club, distinto equipo).
  // `null` = sin contexto de liga → no se filtra (compat. con llamadas legadas).
  const wantWomens = opts.leagueSlug ? isWomensSlug(opts.leagueSlug) : null

  // Either (home=A AND away=B) OR (home=B AND away=A). PostgREST `or` syntax
  // requires both clauses inside one filter expression with `and()` groups.
  const filter = `and(home.eq.${escapeOr(teamA)},away.eq.${escapeOr(teamB)}),and(home.eq.${escapeOr(teamB)},away.eq.${escapeOr(teamA)})`

  // Con filtro de género pedimos margen extra para no quedarnos cortos al
  // descartar filas del otro género tras la consulta.
  const fetchN = wantWomens === null
    ? limit + (opts.excludeId ? 1 : 0)
    : Math.min(limit * 4 + 4, 80)

  const { data, error } = await sb
    .from('past_events')
    .select('id,iso_date,comp,home,away,home_score,away_score,home_logo,away_logo,home_abbr,away_abbr,match_ref')
    .or(filter)
    .order('iso_date', { ascending: false })
    .limit(fetchN)

  if (error || !data) return null

  const rows = (data as PastEventRow[])
    .filter(r => !opts.excludeId || r.id !== opts.excludeId)
    .filter(r => wantWomens === null || isWomensPastRow(r) === wantWomens)
    .slice(0, limit)

  let wins = 0, draws = 0, losses = 0
  for (const r of rows) {
    if (r.home_score == null || r.away_score == null) continue
    const aIsHome = r.home === teamA
    const aScore = aIsHome ? r.home_score : r.away_score
    const bScore = aIsHome ? r.away_score : r.home_score
    if (aScore > bScore) wins++
    else if (aScore < bScore) losses++
    else draws++
  }

  const matches: H2HMatch[] = rows.map(r => ({
    id: r.id,
    isoDate: r.iso_date,
    comp: r.comp,
    home: r.home,
    away: r.away ?? '',
    homeScore: r.home_score,
    awayScore: r.away_score,
    homeLogo: r.home_logo ?? undefined,
    awayLogo: r.away_logo ?? undefined,
    homeAbbr: r.home_abbr ?? undefined,
    awayAbbr: r.away_abbr ?? undefined,
    matchRef: r.match_ref ?? undefined,
  }))

  return { matches, wins, draws, losses }
}

// Escape commas and parens for PostgREST `or` clause values.
function escapeOr(s: string): string {
  return s.replace(/[(),]/g, m => `\\${m}`)
}

export type FormResult = 'W' | 'D' | 'L'

// Fetch the last N results for each team in the list. Returns a map from
// team name → array of 'W' | 'D' | 'L' in chronological order (most recent
// first). Teams not in the cache get an empty array. Single Supabase query
// for all teams, then grouped client-side. Returns null if Supabase not
// configured (callers should treat as "no form available").
async function _fetchRecentFormByTeamsUncached(
  teams: string[],
  limit = 5,
  leagueSlug?: string,
): Promise<Record<string, FormResult[]> | null> {
  const sb = readClient()
  if (!sb) return null
  if (teams.length === 0) return {}

  // Filtro de género opcional: solo cuando el llamador pasa la liga del partido
  // (p.ej. /partido). El calendario pasa una lista mixta sin liga única → null
  // → sin filtro (comportamiento previo intacto).
  const wantWomens = leagueSlug ? isWomensSlug(leagueSlug) : null

  // Dedup + cap at 200 names per call to keep URL length reasonable.
  const uniq = Array.from(new Set(teams)).slice(0, 200)
  const orFilter = uniq
    .flatMap(t => [`home.eq.${escapeOr(t)}`, `away.eq.${escapeOr(t)}`])
    .join(',')

  // Pull a generous slice — newest 600 rows max. With ~200 teams and a few
  // games each per month this covers comfortably.
  const { data, error } = await sb
    .from('past_events')
    .select('home,away,home_score,away_score,iso_date,match_ref,id')
    .or(orFilter)
    .order('iso_date', { ascending: false })
    .limit(600)

  if (error || !data) return null

  const teamSet = new Set(uniq)
  const out: Record<string, FormResult[]> = {}
  for (const t of uniq) out[t] = []

  for (const r of data as Array<{ home: string; away: string | null; home_score: number | null; away_score: number | null; match_ref: string | null; id: string }>) {
    if (r.home_score == null || r.away_score == null) continue
    if (wantWomens !== null && isWomensPastRow(r) !== wantWomens) continue
    const hs = r.home_score, as = r.away_score

    if (teamSet.has(r.home) && out[r.home].length < limit) {
      out[r.home].push(hs > as ? 'W' : hs < as ? 'L' : 'D')
    }
    if (r.away && teamSet.has(r.away) && out[r.away].length < limit) {
      out[r.away].push(as > hs ? 'W' : as < hs ? 'L' : 'D')
    }
  }

  return out
}

// ── Cached wrappers — TTL 5 min, alineado con revalidate del calendario ──
// La cache key se deriva de los argumentos (Next serializa). Cada combo
// equipos×limit / par×opts se memoiza por 300s. Limpieza global via tag.
export const fetchH2H = unstable_cache(
  _fetchH2HUncached,
  ['past-events:h2h'],
  { revalidate: 300, tags: ['past-events'] }
)

export const fetchRecentFormByTeams = unstable_cache(
  _fetchRecentFormByTeamsUncached,
  ['past-events:form'],
  { revalidate: 300, tags: ['past-events'] }
)
