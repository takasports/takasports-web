import { NextResponse } from 'next/server'
import { normalizeTeam, normalizeAthlete, type NormalizedTeam } from '@/lib/teams-catalog'

export interface LiveScore {
  id: string
  homeTeam: string
  awayTeam: string
  homeGoals: number | null
  awayGoals: number | null
  status: string      // '1H' | '2H' | 'HT' | 'FT' | 'NS' | 'LIVE' | 'FINAL' etc.
  elapsed: number | null
  sport: string
  // Extended fields
  comp?: string        // league/competition name
  venue?: string       // stadium/venue name
  period?: number      // half (soccer), quarter (basketball)
  clock?: string       // display clock e.g. "45'" or "8:30"
  homeAbbr?: string
  awayAbbr?: string
  homeLogo?: string
  awayLogo?: string
  homePhoto?: string   // athlete headshot URL if available
  awayPhoto?: string
  matchRef?: string   // "{sport}_{league}_{espnId}" for detail page URL
  setsStr?: string    // tennis: formatted set scores e.g. "6-4 7-5 *3-2" (* = active set)
}

interface CacheEntry { data: LiveScore[]; ts: number; hasLive: boolean }
let cache: CacheEntry | null = null
let staleCache: CacheEntry | null = null

const LIVE_TTL  = 60_000
const IDLE_TTL  = 5 * 60_000
const STALE_MAX = 10 * 60_000

const ESPN_TEAM_LEAGUES = [
  { slug: 'soccer/uefa.champions',   sport: 'soccer',     comp: 'Champions'  },
  { slug: 'soccer/uefa.europa',      sport: 'soccer',     comp: 'Europa'     },
  { slug: 'soccer/uefa.europa.conf', sport: 'soccer',     comp: 'Conference' },
  { slug: 'soccer/uefa.super_cup',   sport: 'soccer',     comp: 'Super Cup'  },
  { slug: 'soccer/uefa.nations',     sport: 'soccer',     comp: 'Nations'    },
  { slug: 'soccer/esp.1',            sport: 'soccer',     comp: 'LaLiga'     },
  { slug: 'soccer/eng.1',            sport: 'soccer',     comp: 'Premier'    },
  { slug: 'soccer/ita.1',            sport: 'soccer',     comp: 'Serie A'    },
  { slug: 'soccer/ger.1',            sport: 'soccer',     comp: 'Bundesliga' },
  { slug: 'soccer/fra.1',            sport: 'soccer',     comp: 'Ligue 1'    },
  { slug: 'basketball/nba',          sport: 'basketball', comp: 'NBA'        },
] as const

const TENNIS_SLUGS = ['tennis/atp', 'tennis/wta'] as const

function mapStatus(espnStatus: string, sport: string, period?: number): string {
  if (espnStatus === 'STATUS_IN_PROGRESS') {
    if (sport === 'basketball') return period ? `Q${period}` : 'LIVE'
    // Tennis has no halves/sets concept in status — use LIVE so downstream
    // getLiveLabel can derive the set number from homeGoals+awayGoals instead.
    if (sport === 'tennis') return 'LIVE'
    return '1H'
  }
  if (espnStatus === 'STATUS_HALFTIME')    return 'HT'
  if (espnStatus === 'STATUS_SECOND_HALF') return '2H'
  if (espnStatus === 'STATUS_END_PERIOD') {
    if (sport === 'basketball') return period === 2 ? 'HT' : 'INT'
    return 'HT'
  }
  if (espnStatus === 'STATUS_OVERTIME')    return 'OT'
  if (espnStatus === 'STATUS_FULL_TIME' || espnStatus === 'STATUS_FINAL') return 'FT'
  if (espnStatus === 'STATUS_SCHEDULED')   return 'NS'
  if (espnStatus === 'STATUS_ABANDONED' || espnStatus === 'STATUS_CANCELED' ||
      espnStatus === 'STATUS_WALKOVER'  || espnStatus === 'STATUS_RETIRED'  ||
      espnStatus === 'STATUS_POSTPONED' || espnStatus === 'STATUS_SUSPENDED') return 'FT'
  return espnStatus.replace('STATUS_', '')
}

function parseElapsed(clock: string | undefined): number | null {
  if (!clock) return null
  const match = clock.match(/^(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

function parseSetsWon(scoreStr: string | undefined): [number, number] {
  if (!scoreStr) return [0, 0]
  const sets = scoreStr.trim().split(/\s+/)
  let home = 0, away = 0
  for (const set of sets) {
    const base = set.replace(/\(.*?\)/g, '')
    const [a, b] = base.split('-').map(Number)
    if (isNaN(a) || isNaN(b)) continue
    if (a > b) home++
    else if (b > a) away++
  }
  return [home, away]
}

function parseCurrentSetScore(scoreStr: string | undefined): string | null {
  if (!scoreStr) return null
  const sets = scoreStr.trim().split(/\s+/)
  if (sets.length === 0) return null
  const last = sets[sets.length - 1].replace(/\(.*?\)/g, '')
  const parts = last.split('-').map(Number)
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null
  const [a, b] = parts
  const isComplete = (a >= 6 || b >= 6) && Math.abs(a - b) >= 2
  return isComplete ? null : last
}

/** Build a human-readable set-by-set string for tennis (e.g. "6-4 7-5 *3-2").
 *  The active (incomplete) set is prefixed with * for UI highlighting.
 *  Handles tiebreaks: "7-6(4)" is correctly treated as a completed set. */
function formatTennisSets(homeStr: string | undefined): string {
  if (!homeStr) return ''
  const sets = homeStr.trim().split(/\s+/)
  const parts: string[] = []
  for (const set of sets) {
    const hasTiebreak = /\(.*?\)/.test(set)
    const base = set.replace(/\(.*?\)/g, '')
    const [a, b] = base.split('-').map(Number)
    if (isNaN(a) || isNaN(b)) continue
    const isComplete = hasTiebreak || ((a >= 6 || b >= 6) && Math.abs(a - b) >= 2)
    parts.push(isComplete ? `${a}-${b}` : `*${a}-${b}`)
  }
  return parts.join(' ')
}

// ── Helpers ─────────────────────────────────────────────────────

type RawCompetitor = Record<string, unknown>

function buildScore(
  id: string,
  home: NormalizedTeam,
  away: NormalizedTeam,
  homeGoals: number | null,
  awayGoals: number | null,
  status: string,
  sport: string,
  extras: Partial<LiveScore> = {},
): LiveScore {
  return {
    id,
    homeTeam: home.name,
    awayTeam: away.name,
    homeAbbr: home.abbr,
    awayAbbr: away.abbr,
    homeLogo: home.logo,
    awayLogo: away.logo,
    homeGoals,
    awayGoals,
    status,
    elapsed: null,
    sport,
    ...extras,
  }
}

// ── Football / Basketball (team vs team) ────────────────────────

async function fetchTeamLeague(slug: string, sport: string, comp: string, leagueKey: string): Promise<LiveScore[]> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard`,
      { next: { revalidate: 30 } }
    )
    if (!res.ok) return []
    const json = await res.json()
    const results: LiveScore[] = []

    for (const ev of json.events ?? []) {
      const competition = ev.competitions?.[0]
      if (!competition) continue
      const statusName: string = competition.status?.type?.name ?? ''
      if (statusName === 'STATUS_SCHEDULED' || statusName === 'STATUS_POSTPONED') continue

      const competitors: RawCompetitor[] = competition.competitors ?? []
      const homeRaw = competitors.find((c) => c.homeAway === 'home') ?? competitors[0]
      const awayRaw = competitors.find((c) => c.homeAway === 'away') ?? competitors[1]
      if (!homeRaw || !awayRaw) continue

      const home = normalizeTeam({
        ...(homeRaw.team as Record<string, unknown>),
        id: (homeRaw.team as Record<string, unknown>)?.id as string | undefined,
        logo: (homeRaw.team as Record<string, unknown>)?.logo as string | undefined,
      })
      const away = normalizeTeam({
        ...(awayRaw.team as Record<string, unknown>),
        id: (awayRaw.team as Record<string, unknown>)?.id as string | undefined,
        logo: (awayRaw.team as Record<string, unknown>)?.logo as string | undefined,
      })
      if (!home || !away) continue

      const homeScore = homeRaw.score !== undefined ? Number(homeRaw.score) : null
      const awayScore = awayRaw.score !== undefined ? Number(awayRaw.score) : null

      const statusObj = competition.status as Record<string, unknown> | undefined
      const period    = statusObj?.period as number | undefined
      const clock     = statusObj?.displayClock as string | undefined
      const venue     = (competition.venue as Record<string, unknown>)?.fullName as string | undefined

      const homePhoto = (homeRaw.athlete as Record<string, unknown>)?.headshot as string | undefined
      const awayPhoto = (awayRaw.athlete as Record<string, unknown>)?.headshot as string | undefined

      results.push(buildScore(
        String(ev.id),
        home,
        away,
        homeScore,
        awayScore,
        mapStatus(statusName, sport, period),
        sport,
        {
          comp,
          venue,
          period,
          clock,
          elapsed: parseElapsed(clock),
          homePhoto,
          awayPhoto,
          matchRef: `${leagueKey}_${String(ev.id)}`,
        },
      ))
    }
    return results
  } catch (err) {
    console.error(`[live] ESPN fetch failed for ${slug}:`, err)
    return []
  }
}

// ── Tennis (athlete vs athlete) ─────────────────────────────────

async function fetchTennisLive(slug: string): Promise<LiveScore[]> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${slug}/events?limit=50`,
      { next: { revalidate: 30 } }
    )
    if (!res.ok) return []
    const json = await res.json()
    const results: LiveScore[] = []

    for (const ev of json.events ?? []) {
      const statusName: string = ev.fullStatus?.type?.name ?? ''
      if (statusName === 'STATUS_SCHEDULED' || statusName === 'STATUS_POSTPONED') continue

      const competitors: RawCompetitor[] = ev.competitors ?? []
      if (competitors.length < 2) continue

      const home = normalizeAthlete({
        id: competitors[0]?.id as string | undefined,
        displayName: competitors[0]?.displayName as string | undefined,
        shortName: competitors[0]?.shortName as string | undefined,
        abbreviation: competitors[0]?.abbreviation as string | undefined,
      })
      const away = normalizeAthlete({
        id: competitors[1]?.id as string | undefined,
        displayName: competitors[1]?.displayName as string | undefined,
        shortName: competitors[1]?.shortName as string | undefined,
        abbreviation: competitors[1]?.abbreviation as string | undefined,
      })
      if (!home || !away) continue

      const scoreStr     = competitors[0]?.score as string | undefined
      const awayScoreStr = competitors[1]?.score as string | undefined
      const [homeGoals, awayGoals] = parseSetsWon(scoreStr)
      const currentSet = parseCurrentSetScore(scoreStr)
      const tournament = (ev.shortName as string) ?? (slug.includes('wta') ? 'WTA' : 'ATP')
      const setsStr = formatTennisSets(scoreStr)

      let clock: string | undefined
      if (currentSet) {
        const awayCurrentSet = parseCurrentSetScore(awayScoreStr)
        clock = awayCurrentSet ?? currentSet
      }

      results.push(buildScore(
        String(ev.id),
        home,
        away,
        homeGoals,
        awayGoals,
        mapStatus(statusName, 'tennis'),
        'tennis',
        { comp: tournament, clock, ...(setsStr ? { setsStr } : {}) },
      ))
    }
    return results
  } catch (err) {
    console.error(`[live] ESPN tennis fetch failed for ${slug}:`, err)
    return []
  }
}

// ── UFC (athlete vs athlete por pelea) ──────────────────────────
// La estructura ESPN para MMA es: 1 evento (PPV) → N competitions (peleas) →
// 2 competitors por pelea, cada competitor con su `athlete`.

async function fetchUfcLive(): Promise<LiveScore[]> {
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard',
      { next: { revalidate: 30 } }
    )
    if (!res.ok) return []
    const json = await res.json()
    const results: LiveScore[] = []

    for (const ev of json.events ?? []) {
      const eventName = (ev.shortName as string) ?? (ev.name as string) ?? 'UFC'
      const venue = (ev.competitions?.[0]?.venue as Record<string, unknown>)?.fullName as string | undefined
      for (const competition of ev.competitions ?? []) {
        const statusName: string = competition.status?.type?.name ?? ''
        if (statusName === 'STATUS_SCHEDULED' || statusName === 'STATUS_POSTPONED') continue

        const competitors: RawCompetitor[] = competition.competitors ?? []
        if (competitors.length < 2) continue

        const home = normalizeAthlete({
          id: (competitors[0]?.athlete as Record<string, unknown>)?.id as string | undefined,
          displayName: (competitors[0]?.athlete as Record<string, unknown>)?.displayName as string | undefined,
          shortName: (competitors[0]?.athlete as Record<string, unknown>)?.shortName as string | undefined,
          abbreviation: competitors[0]?.abbreviation as string | undefined,
          headshot: (competitors[0]?.athlete as Record<string, unknown>)?.headshot as string | { href?: string } | undefined,
        })
        const away = normalizeAthlete({
          id: (competitors[1]?.athlete as Record<string, unknown>)?.id as string | undefined,
          displayName: (competitors[1]?.athlete as Record<string, unknown>)?.displayName as string | undefined,
          shortName: (competitors[1]?.athlete as Record<string, unknown>)?.shortName as string | undefined,
          abbreviation: competitors[1]?.abbreviation as string | undefined,
          headshot: (competitors[1]?.athlete as Record<string, unknown>)?.headshot as string | { href?: string } | undefined,
        })
        if (!home || !away) continue

        const statusObj = competition.status as Record<string, unknown> | undefined
        const period    = statusObj?.period as number | undefined
        const clock     = statusObj?.displayClock as string | undefined

        results.push(buildScore(
          String(competition.id ?? ev.id),
          home,
          away,
          null,
          null,
          mapStatus(statusName, 'mma', period),
          'mma',
          {
            comp: eventName,
            venue,
            period,
            clock,
            homePhoto: home.logo,
            awayPhoto: away.logo,
            matchRef: `mma_ufc_${String(competition.id ?? ev.id)}`,
          },
        ))
      }
    }
    return results
  } catch (err) {
    console.error('[live] ESPN UFC fetch failed:', err)
    return []
  }
}

// ── F1 (race-status, no team-vs-team) ───────────────────────────
// Devolvemos un evento con homeTeam = nombre carrera, awayTeam = líder actual.

async function fetchF1Live(): Promise<LiveScore[]> {
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard',
      { next: { revalidate: 30 } }
    )
    if (!res.ok) return []
    const json = await res.json()
    const results: LiveScore[] = []

    for (const ev of json.events ?? []) {
      const competition = ev.competitions?.[0]
      if (!competition) continue
      const statusName: string = competition.status?.type?.name ?? ''
      if (statusName === 'STATUS_SCHEDULED' || statusName === 'STATUS_POSTPONED') continue
      // Solo emitimos F1 cuando hay carrera en curso. Carreras finalizadas no
      // se cuelan en el "ticker live" — eso lo cubre el endpoint de upcoming.
      if (statusName !== 'STATUS_IN_PROGRESS') continue

      const competitors: RawCompetitor[] = competition.competitors ?? []
      // Ordenar por posición (más bajo = líder)
      const sorted = [...competitors].sort((a, b) => {
        const ap = Number(a.order ?? 999)
        const bp = Number(b.order ?? 999)
        return ap - bp
      })
      const leader = sorted[0]
      const leaderName = (leader?.athlete as Record<string, unknown>)?.displayName as string | undefined
      const raceName = (ev.shortName as string) ?? (ev.name as string) ?? 'F1 GP'

      const statusObj = competition.status as Record<string, unknown> | undefined
      const period    = statusObj?.period as number | undefined
      const totalLaps = competition.numLaps as number | undefined
      const lapInfo = period && totalLaps ? `L${period}/${totalLaps}` : period ? `L${period}` : undefined

      results.push({
        id: String(ev.id),
        homeTeam: raceName,
        awayTeam: leaderName?.trim() ? `Líder: ${leaderName}` : 'En curso',
        homeAbbr: 'F1',
        awayAbbr: leaderName ? leaderName.split(' ').slice(-1)[0].slice(0, 4).toUpperCase() : 'LDR',
        homeGoals: null,
        awayGoals: null,
        status: 'LIVE',
        elapsed: null,
        sport: 'racing',
        comp: 'F1',
        clock: lapInfo,
        period,
        matchRef: `racing_f1_${String(ev.id)}`,
      })
    }
    return results
  } catch (err) {
    console.error('[live] ESPN F1 fetch failed:', err)
    return []
  }
}

// ── API-Sports (solo si hay key) ────────────────────────────────

async function fetchApiSportsLive(): Promise<LiveScore[]> {
  const key = process.env.API_SPORTS_KEY
  if (!key) return []
  try {
    const res = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
      headers: { 'x-apisports-key': key },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error(`[live] API-Sports responded ${res.status}`)
      return []
    }
    const json = await res.json()
    if (!Array.isArray(json.response)) return []

    const results: LiveScore[] = []
    for (const f of json.response) {
      const fixture = f.fixture as Record<string, unknown>
      const league  = f.league  as Record<string, unknown>
      const teams   = f.teams   as Record<string, Record<string, unknown>>
      const goals   = f.goals   as Record<string, number | null>
      const status  = fixture.status as Record<string, unknown>

      const home = normalizeTeam({
        id: teams.home.id as string | number | undefined,
        displayName: teams.home.name as string | undefined,
        logo: teams.home.logo as string | undefined,
      })
      const away = normalizeTeam({
        id: teams.away.id as string | number | undefined,
        displayName: teams.away.name as string | undefined,
        logo: teams.away.logo as string | undefined,
      })
      if (!home || !away) continue

      results.push(buildScore(
        `apisports-${fixture.id}`,
        home,
        away,
        goals.home,
        goals.away,
        status.short as string,
        'soccer',
        {
          comp: league.name as string,
          venue: (fixture.venue as Record<string, unknown>)?.name as string | undefined,
          elapsed: status.elapsed as number | null,
        },
      ))
    }
    return results
  } catch (err) {
    console.error('[live] API-Sports fetch failed:', err)
    return []
  }
}

// ── Handler ─────────────────────────────────────────────────────

// Cache headers para CDN edge: todos los usuarios polleando comparten una sola
// respuesta cacheada en el CDN en vez de invocar la función cada vez.
// LIVE: 30s fresh + 60s stale-while-revalidate (matches client polling interval).
// IDLE: 120s fresh + 300s stale (no urge si no hay partidos en vivo).
function cacheHeaders(hasLive: boolean, extra: Record<string, string> = {}): Record<string, string> {
  const sMax = hasLive ? 30 : 120
  const swr  = hasLive ? 60 : 300
  return {
    'Cache-Control': `public, s-maxage=${sMax}, stale-while-revalidate=${swr}`,
    'CDN-Cache-Control': `public, s-maxage=${sMax}, stale-while-revalidate=${swr}`,
    ...extra,
  }
}

export async function GET() {
  const now = Date.now()
  const ttl = cache?.hasLive ? LIVE_TTL : IDLE_TTL

  if (cache && now - cache.ts < ttl) {
    return NextResponse.json(cache.data, { headers: cacheHeaders(cache.hasLive) })
  }

  try {
    const [leagueResults, tennisResults, ufcResults, f1Results, apiSportsResults] = await Promise.all([
      Promise.allSettled(ESPN_TEAM_LEAGUES.map(s => fetchTeamLeague(s.slug, s.sport, s.comp, s.slug.replace('/', '_')))),
      Promise.allSettled(TENNIS_SLUGS.map(fetchTennisLive)),
      fetchUfcLive(),
      fetchF1Live(),
      fetchApiSportsLive(),
    ])

    const scores: LiveScore[] = []
    for (const r of leagueResults) { if (r.status === 'fulfilled') scores.push(...r.value) }
    for (const r of tennisResults)  { if (r.status === 'fulfilled') scores.push(...r.value) }
    scores.push(...ufcResults, ...f1Results)

    // Merge API-Sports
    const espnIds = new Set(scores.map(s => `${s.homeTeam}|${s.awayTeam}`))
    for (const s of apiSportsResults) {
      if (!espnIds.has(`${s.homeTeam}|${s.awayTeam}`)) scores.push(s)
    }

    // Garantía de salida: nunca emitimos eventos sin nombres válidos.
    const valid = scores.filter(s => !!s.homeTeam && !!s.awayTeam && s.homeTeam.trim() && s.awayTeam.trim())

    const hasLive = valid.length > 0
    cache = { data: valid, ts: now, hasLive }
    staleCache = cache

    return NextResponse.json(valid, { headers: cacheHeaders(hasLive) })
  } catch (err) {
    console.error('[live] Unexpected error fetching live scores:', err)
    if (staleCache && now - staleCache.ts < STALE_MAX) {
      return NextResponse.json(staleCache.data, { headers: cacheHeaders(staleCache.hasLive, { 'X-Cache': 'STALE' }) })
    }
    return NextResponse.json([], { headers: cacheHeaders(false) })
  }
}
