// Histórico de resultados — capa de datos.
// - Lectura pública via anon key (RLS permite SELECT a todos).
// - Escritura solo desde service role (cron / job de sync).
// - Si Supabase no está configurado, las funciones devuelven [] / 0 sin reventar.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SportEvent } from './types'
import { adminSupabase } from './supabase-admin'

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
}

const DAYS_ES   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function toDateLabel(iso: string): string {
  const d = new Date(iso)
  return `${DAYS_ES[d.getUTCDay()]} · ${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]}`
}

function toTimeStr(iso: string): string {
  const d = new Date(iso)
  const h = String(d.getUTCHours()).padStart(2, '0')
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
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
export async function fetchH2H(
  teamA: string,
  teamB: string,
  opts: { limit?: number; excludeId?: string } = {}
): Promise<H2HResult | null> {
  const sb = readClient()
  if (!sb) return null
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 20)

  // Either (home=A AND away=B) OR (home=B AND away=A). PostgREST `or` syntax
  // requires both clauses inside one filter expression with `and()` groups.
  const filter = `and(home.eq.${escapeOr(teamA)},away.eq.${escapeOr(teamB)}),and(home.eq.${escapeOr(teamB)},away.eq.${escapeOr(teamA)})`

  const { data, error } = await sb
    .from('past_events')
    .select('id,iso_date,comp,home,away,home_score,away_score,home_logo,away_logo,home_abbr,away_abbr,match_ref')
    .or(filter)
    .order('iso_date', { ascending: false })
    .limit(limit + (opts.excludeId ? 1 : 0))

  if (error || !data) return null

  const rows = (data as PastEventRow[])
    .filter(r => !opts.excludeId || r.id !== opts.excludeId)
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
