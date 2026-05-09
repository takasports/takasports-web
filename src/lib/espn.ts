import type { SportEvent } from './types'
import { getSportStyle } from './sports'
import { SOURCE_TZ } from './timezone'
import { getSpanishBroadcast } from './broadcasts'

interface EspnSource {
  slug: string
  sport: string
  comp: string
  teamSport: boolean
}

const SOURCES: EspnSource[] = [
  { slug: 'soccer/esp.1',       sport: 'Fútbol',  comp: 'LaLiga',     teamSport: true  },
  { slug: 'soccer/eng.1',       sport: 'Fútbol',  comp: 'Premier',    teamSport: true  },
  { slug: 'soccer/ita.1',       sport: 'Fútbol',  comp: 'Serie A',    teamSport: true  },
  { slug: 'soccer/ger.1',       sport: 'Fútbol',  comp: 'Bundesliga', teamSport: true  },
  { slug: 'soccer/fra.1',       sport: 'Fútbol',  comp: 'Ligue 1',    teamSport: true  },
  { slug: 'basketball/nba',     sport: 'NBA',     comp: 'NBA',        teamSport: true  },
  { slug: 'racing/f1',          sport: 'F1',      comp: 'Fórmula 1',  teamSport: false },
  { slug: 'mma/ufc',            sport: 'UFC',     comp: 'UFC',        teamSport: false },
]

const TENNIS_SLUGS = ['tennis/atp', 'tennis/wta']

// Only show top-tier tournaments, skip doubles (names with '/')
const TENNIS_TOP_TOURNAMENTS = [
  'australian open', 'roland garros', 'wimbledon', 'us open',
  'indian wells', 'miami open', 'monte carlo', 'madrid open', 'rome',
  'canada', 'cincinnati', 'shanghai', 'paris masters', 'vienna',
  'barcelona', 'hamburg', 'halle', "queen's", 'eastbourne',
  'dubai', 'doha', 'rotterdam', 'munich', 'lyon', 'geneva',
  'madrid', 'rome masters', 'internazionali',
  // WTA
  'wta finals', 'pan pacific', 'toronto', 'guadalajara',
]

function isTennisTopTournament(tournamentName: string): boolean {
  const n = tournamentName.toLowerCase()
  return TENNIS_TOP_TOURNAMENTS.some(t => n.includes(t))
}

function isTennisDoubles(player1: string, player2: string): boolean {
  return player1.includes('/') || player2.includes('/')
}

const DAYS_ES   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function toDateLabel(isoDate: string): string {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).format(new Date())
  const eventStr = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).format(new Date(isoDate))
  const diffDays = Math.round(
    (new Date(eventStr).getTime() - new Date(todayStr).getTime()) / 86_400_000
  )
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Mañana'
  if (diffDays < 0) return 'Pasado'
  const d = new Date(eventStr + 'T12:00:00Z')
  return `${DAYS_ES[d.getUTCDay()]} · ${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]}`
}

function toTimeStr(isoDate: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: SOURCE_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(isoDate))
  const h = parts.find(p => p.type === 'hour')?.value   ?? '00'
  const m = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${h}:${m}`
}

function dateRangeParam(daysAhead: number): string {
  const now = new Date()
  const end = new Date(now)
  end.setDate(now.getDate() + daysAhead)
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
  return `${fmt(now)}-${fmt(end)}`
}

function dateRangePastParam(daysBack: number): string {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - daysBack)
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
  return `${fmt(start)}-${fmt(now)}`
}

function parseScore(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v === 'object') {
    const val = (v as Record<string, unknown>).value
    if (typeof val === 'number') return val
  }
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? null : n }
  return null
}

const FINAL_STATUSES = new Set(['STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_ENDED'])

interface RawEvent {
  isoDate: string
  event: SportEvent
}

async function fetchLeague(source: EspnSource): Promise<RawEvent[]> {
  const { accent } = getSportStyle(source.sport)
  const url = `https://site.api.espn.com/apis/site/v2/sports/${source.slug}/scoreboard?dates=${dateRangeParam(21)}&limit=30`

  let json: Record<string, unknown>
  try {
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) return []
    json = await res.json()
  } catch {
    return []
  }

  const results: RawEvent[] = []
  const espnEvents = (json.events as unknown[]) ?? []

  for (const raw of espnEvents) {
    const ev = raw as Record<string, unknown>
    const isoDate = ev.date as string | undefined
    if (!isoDate) continue

    const dateLabel = toDateLabel(isoDate)
    if (dateLabel === 'Pasado') continue

    const comp = ((ev.competitions as unknown[]) ?? [])[0] as Record<string, unknown> | undefined
    if (!comp) continue

    const statusName = ((comp.status as Record<string, unknown>)?.type as Record<string, unknown>)?.name as string | undefined
    if (statusName === 'STATUS_POSTPONED') continue
    if (statusName === 'STATUS_FINAL' && dateLabel !== 'Hoy') continue

    const competitors = (comp.competitors as Record<string, unknown>[]) ?? []

    let home: string
    let away: string | null = null

    let homeLogo: string | undefined
    let awayLogo: string | undefined
    let homeAbbr: string | undefined
    let awayAbbr: string | undefined

    if (source.teamSport && competitors.length >= 2) {
      const homeComp = competitors.find(c => c.homeAway === 'home') ?? competitors[0]
      const awayComp = competitors.find(c => c.homeAway === 'away') ?? competitors[1]
      const homeTeamObj = homeComp.team as Record<string, unknown>
      const awayTeamObj = awayComp.team as Record<string, unknown>
      home      = (homeTeamObj?.displayName as string) ?? ''
      away      = (awayTeamObj?.displayName as string) ?? null
      homeAbbr  = homeTeamObj?.abbreviation as string | undefined
      awayAbbr  = awayTeamObj?.abbreviation as string | undefined
      homeLogo  = (homeTeamObj?.logoDark ?? homeTeamObj?.logo) as string | undefined
      awayLogo  = (awayTeamObj?.logoDark ?? awayTeamObj?.logo) as string | undefined
    } else {
      home = (ev.name as string) ?? (ev.shortName as string) ?? source.sport
    }

    if (!home) continue

    const venue  = ((comp.venue as Record<string, unknown>)?.fullName as string) ?? undefined
    const broadcast = getSpanishBroadcast(source.comp, source.sport)
    const matchRef  = `${source.slug.replace('/', '_')}_${ev.id as string}`

    results.push({
      isoDate,
      event: {
        id:        `espn-${source.slug.replace(/\//g, '-')}-${ev.id as string}`,
        home,
        away,
        sport:     source.sport,
        comp:      source.comp,
        date:      dateLabel,
        time:      toTimeStr(isoDate),
        accent,
        isoDate,
        venue,
        broadcast,
        homeLogo,
        awayLogo,
        homeAbbr,
        awayAbbr,
        matchRef,
        source:    'espn' as const,
      },
    })
  }

  return results
}

// Tennis uses /scoreboard endpoint — gives individual match IDs for detail pages
async function fetchTennisLeague(slug: string): Promise<RawEvent[]> {
  const { accent } = getSportStyle('Tenis')
  const comp = slug.includes('wta') ? 'WTA' : 'ATP'
  const shortSlug = slug.split('/')[1] // 'atp' or 'wta'
  const url = `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard`

  let json: Record<string, unknown>
  try {
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) return []
    json = await res.json()
  } catch {
    return []
  }

  const results: RawEvent[] = []
  const espnEvents = (json.events as unknown[]) ?? []

  for (const rawEv of espnEvents) {
    const ev = rawEv as Record<string, unknown>
    const tournamentName = (ev.name as string) ?? (ev.shortName as string) ?? comp
    if (!isTennisTopTournament(tournamentName)) continue

    const groupings = (ev.groupings as unknown[]) ?? []
    for (const rawG of groupings) {
      const g = rawG as Record<string, unknown>
      const competitions = (g.competitions as unknown[]) ?? []

      for (const rawM of competitions) {
        const m = rawM as Record<string, unknown>
        const isoDate = m.date as string | undefined
        if (!isoDate) continue

        const dateLabel = toDateLabel(isoDate)
        if (dateLabel === 'Pasado') continue

        const statusName = ((m.status as Record<string, unknown>)?.type as Record<string, unknown>)?.name as string | undefined
        if (statusName === 'STATUS_POSTPONED') continue
        if (statusName === 'STATUS_FINAL' && dateLabel !== 'Hoy') continue

        const competitors = (m.competitors as Record<string, unknown>[]) ?? []
        if (competitors.length < 2) continue

        const home = ((competitors[0]?.athlete as Record<string, unknown>)?.displayName as string | undefined)
                  ?? (competitors[0]?.displayName as string | undefined)
        const away = ((competitors[1]?.athlete as Record<string, unknown>)?.displayName as string | undefined)
                  ?? (competitors[1]?.displayName as string | undefined)
        if (!home || !away || home === 'TBD' || away === 'TBD') continue
        if (isTennisDoubles(home, away)) continue

        const matchId  = m.id as string
        const matchRef = `tennis_${shortSlug}_${matchId}`

        results.push({
          isoDate,
          event: {
            id:        `espn-${slug.replace(/\//g, '-')}-${matchId}`,
            home,
            away,
            sport:     'Tenis',
            comp:      tournamentName,
            date:      dateLabel,
            time:      toTimeStr(isoDate),
            accent,
            isoDate,
            broadcast: getSpanishBroadcast(tournamentName, 'Tenis'),
            matchRef,
            source:    'espn' as const,
          },
        })
      }
    }
  }

  return results
}

export async function fetchEspnEvents(): Promise<SportEvent[]> {
  const [leagueResults, tennisResults] = await Promise.all([
    Promise.allSettled(SOURCES.map(fetchLeague)),
    Promise.allSettled(TENNIS_SLUGS.map(fetchTennisLeague)),
  ])

  const raw: RawEvent[] = []

  for (const r of leagueResults) {
    if (r.status === 'fulfilled') raw.push(...r.value)
  }
  for (const r of tennisResults) {
    if (r.status === 'fulfilled') raw.push(...r.value)
  }

  raw.sort((a, b) => a.isoDate.localeCompare(b.isoDate))

  // ── Dedup ─────────────────────────────────────────────────────────────────
  // For non-team sports (F1, UFC) ESPN returns multiple sessions per event
  // (FP1, Qualifying, Race…) with the same name. Keep only the first/earliest.
  const seenIds       = new Set<string>()
  const seenNonTeam   = new Set<string>()   // sport|home → earliest session

  return raw
    .map(r => r.event)
    .filter(ev => {
      if (seenIds.has(ev.id)) return false
      seenIds.add(ev.id)

      if (ev.away === null) {
        // Non-team: deduplicate by sport+name, keep the earliest (already sorted)
        const key = `${ev.sport}|${ev.home}`
        if (seenNonTeam.has(key)) return false
        seenNonTeam.add(key)
      }
      return true
    })
}

// ── Past results (last N days) ────────────────────────────────────────────
async function fetchLeaguePast(source: EspnSource, daysBack = 10): Promise<RawEvent[]> {
  const { accent } = getSportStyle(source.sport)
  const url = `https://site.api.espn.com/apis/site/v2/sports/${source.slug}/scoreboard?dates=${dateRangePastParam(daysBack)}&limit=50`

  let json: Record<string, unknown>
  try {
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) return []
    json = await res.json()
  } catch {
    return []
  }

  const results: RawEvent[] = []
  const espnEvents = (json.events as unknown[]) ?? []

  for (const raw of espnEvents) {
    const ev = raw as Record<string, unknown>
    const isoDate = ev.date as string | undefined
    if (!isoDate) continue

    const comp = ((ev.competitions as unknown[]) ?? [])[0] as Record<string, unknown> | undefined
    if (!comp) continue

    const statusName = ((comp.status as Record<string, unknown>)?.type as Record<string, unknown>)?.name as string | undefined
    if (!statusName || !FINAL_STATUSES.has(statusName)) continue

    const competitors = (comp.competitors as Record<string, unknown>[]) ?? []
    let home: string
    let away: string | null = null
    let homeLogo: string | undefined
    let awayLogo: string | undefined
    let homeAbbr: string | undefined
    let awayAbbr: string | undefined
    let homeScore: number | null = null
    let awayScore: number | null = null

    if (source.teamSport && competitors.length >= 2) {
      const homeComp = competitors.find(c => c.homeAway === 'home') ?? competitors[0]
      const awayComp = competitors.find(c => c.homeAway === 'away') ?? competitors[1]
      const homeTeamObj = homeComp.team as Record<string, unknown>
      const awayTeamObj = awayComp.team as Record<string, unknown>
      home      = (homeTeamObj?.displayName as string) ?? ''
      away      = (awayTeamObj?.displayName as string) ?? null
      homeAbbr  = homeTeamObj?.abbreviation as string | undefined
      awayAbbr  = awayTeamObj?.abbreviation as string | undefined
      homeLogo  = (homeTeamObj?.logoDark ?? homeTeamObj?.logo) as string | undefined
      awayLogo  = (awayTeamObj?.logoDark ?? awayTeamObj?.logo) as string | undefined
      homeScore = parseScore(homeComp.score)
      awayScore = parseScore(awayComp.score)
    } else {
      home = (ev.name as string) ?? (ev.shortName as string) ?? source.sport
    }

    if (!home) continue

    const venue    = ((comp.venue as Record<string, unknown>)?.fullName as string) ?? undefined
    const matchRef = `${source.slug.replace('/', '_')}_${ev.id as string}`

    results.push({
      isoDate,
      event: {
        id:        `espn-past-${source.slug.replace(/\//g, '-')}-${ev.id as string}`,
        home,
        away,
        sport:     source.sport,
        comp:      source.comp,
        date:      toDateLabel(isoDate),
        time:      toTimeStr(isoDate),
        accent,
        isoDate,
        venue,
        homeLogo,
        awayLogo,
        homeAbbr,
        awayAbbr,
        matchRef,
        homeScore,
        awayScore,
        isPast:    true,
        source:    'espn' as const,
      },
    })
  }

  return results
}

export async function fetchEspnPastEvents(): Promise<SportEvent[]> {
  const leagueResults = await Promise.allSettled(SOURCES.map(s => fetchLeaguePast(s, 10)))
  const raw: RawEvent[] = []
  for (const r of leagueResults) {
    if (r.status === 'fulfilled') raw.push(...r.value)
  }
  // Most recent first
  raw.sort((a, b) => b.isoDate.localeCompare(a.isoDate))
  return raw.map(r => r.event)
}
