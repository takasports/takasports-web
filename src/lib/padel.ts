import type { SportEvent } from './types'
import { SOURCE_TZ } from './timezone'

// ── Premier Padel API ────────────────────────────────────────
// Base URL: https://premierpadel.com/premierpadel/api/
// Auth: none required
// All endpoints: POST with JSON body

const PP_BASE = 'https://premierpadel.com/premierpadel/api/beforeauth'
const DAYS_AHEAD = 21

const DAYS_ES   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// ── Date helpers ─────────────────────────────────────────────

// Parse "5/3/2026 12:00:00 AM" → "2026-05-03"
function parsePPDate(dateStr: string): string | null {
  if (!dateStr) return null
  const m = dateStr.match(/(\d+)\/(\d+)\/(\d+)/)
  if (!m) return null
  const month = m[1].padStart(2, '0')
  const day   = m[2].padStart(2, '0')
  const year  = m[3]
  return `${year}-${month}-${day}`
}

function toDateLabel(iso: string): string {
  const todayStr  = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).format(new Date())
  const eventStr  = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).format(new Date(iso))
  const diffDays  = Math.round((new Date(eventStr).getTime() - new Date(todayStr).getTime()) / 86_400_000)
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Mañana'
  if (diffDays < 0)  return 'Pasado'
  const d = new Date(eventStr + 'T12:00:00Z')
  return `${DAYS_ES[d.getUTCDay()]} · ${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]}`
}

function isoToDateStr(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).format(new Date(iso))
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── Types ─────────────────────────────────────────────────────

interface PPTournament {
  tournaments_id: number
  full_name: string
  city: string
  country: string
  slug: string
  gender: string   // 'C' = combined, 'M' = men, 'W' = women
  start_date: string
  end_date: string
}

// Match from gettournamentsmatchlistnew — field names discovered at runtime
// (API field names confirmed once a live tournament is running)
interface PPMatch {
  [key: string]: unknown
}

// ── API calls ─────────────────────────────────────────────────

async function ppPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${PP_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch {
    return null
  }
}

async function fetchTournaments(): Promise<PPTournament[]> {
  const data = await ppPost<{ status: number; data: { tournaments?: PPTournament[] } }>(
    'gethomescreen', { lang: 'es' }
  )
  return data?.data?.tournaments ?? []
}

async function fetchDayMatches(
  tournamentsId: number,
  date: string
): Promise<{ main_draw: PPMatch[]; qualify_draw: PPMatch[]; live: PPMatch[]; upcoming: PPMatch[] }> {
  const empty = { main_draw: [], qualify_draw: [], live: [], upcoming: [] }

  for (const drawType of ['MD', 'WD']) {
    const data = await ppPost<{
      data: { main_draw: PPMatch[]; qualify_draw: PPMatch[]; live: PPMatch[]; upcoming: PPMatch[] }
    }>('gettournamentsmatchlistnew', {
      tournaments_id: tournamentsId,
      date,
      draw_type: drawType,
      lang: 'es',
    })

    if (!data?.data) continue
    const { main_draw = [], qualify_draw = [], live = [], upcoming = [] } = data.data
    const total = main_draw.length + qualify_draw.length + live.length + upcoming.length
    if (total > 0) return { main_draw, qualify_draw, live, upcoming }
  }
  return empty
}

// Extract player names from a match object — tries all known field patterns
function extractPlayers(match: PPMatch): { home: string; away: string } | null {
  // Log once so we can confirm field names when data appears
  if (process.env.NODE_ENV !== 'production') {
    console.log('[padel] raw match keys:', Object.keys(match).join(', '))
  }

  // Try direct name fields (various API naming conventions)
  const candidates: [string, string][] = [
    ['home_player_name', 'away_player_name'],
    ['player1_name', 'player2_name'],
    ['team_home_name', 'team_away_name'],
    ['pair_1_name', 'pair_2_name'],
    ['home', 'away'],
    ['player_1', 'player_2'],
    ['team_a_name', 'team_b_name'],
  ]

  for (const [hKey, aKey] of candidates) {
    const h = match[hKey] as string | undefined
    const a = match[aKey] as string | undefined
    if (h && a) return { home: String(h), away: String(a) }
  }

  // Try nested objects
  const nested: [string, string][] = [
    ['home_player', 'away_player'],
    ['pair_1', 'pair_2'],
    ['team_home', 'team_away'],
  ]
  for (const [hKey, aKey] of nested) {
    const h = match[hKey] as Record<string, unknown> | undefined
    const a = match[aKey] as Record<string, unknown> | undefined
    if (h && a) {
      const hName = (h.name ?? h.full_name ?? h.displayName ?? h.title) as string | undefined
      const aName = (a.name ?? a.full_name ?? a.displayName ?? a.title) as string | undefined
      if (hName && aName) return { home: String(hName), away: String(aName) }
    }
  }

  return null
}

function extractMatchTime(match: PPMatch): string {
  const candidates = ['match_start_time', 'scheduled_time', 'match_time', 'start_time', 'time', 'start']
  for (const key of candidates) {
    const val = match[key] as string | undefined
    if (val && typeof val === 'string') {
      // If already HH:MM format
      if (/^\d{2}:\d{2}$/.test(val)) return val
      // If ISO or datetime
      const isoM = val.match(/T(\d{2}:\d{2})/)
      if (isoM) return isoM[1]
      // If H:MM AM/PM
      const amPmM = val.match(/(\d+):(\d+)\s*(AM|PM)?/i)
      if (amPmM) {
        let h = parseInt(amPmM[1])
        const m = amPmM[2]
        const ap = amPmM[3]?.toUpperCase()
        if (ap === 'PM' && h < 12) h += 12
        if (ap === 'AM' && h === 12) h = 0
        return `${String(h).padStart(2, '0')}:${m}`
      }
    }
  }
  return '00:00'
}

function extractMatchId(match: PPMatch): string {
  const candidates = ['match_id', 'id', 'fixture_id', 'game_id']
  for (const key of candidates) {
    const val = match[key]
    if (val !== undefined && val !== null) return String(val)
  }
  return String(Math.random())
}

// ── Main export ───────────────────────────────────────────────

let cache: { data: SportEvent[]; ts: number } | null = null
const CACHE_TTL = 5 * 60_000

export async function fetchPadelEvents(): Promise<SportEvent[]> {
  const now = Date.now()
  if (cache && now - cache.ts < CACHE_TTL) return cache.data

  try {
    const tournaments = await fetchTournaments()
    const todayStr = isoToDateStr(new Date().toISOString())
    const cutoffStr = addDays(todayStr, DAYS_AHEAD)

    // Filter tournaments that overlap with the next 21 days
    const relevant = tournaments.filter(t => {
      const start = parsePPDate(t.start_date)
      const end   = parsePPDate(t.end_date)
      if (!start || !end) return false
      return start <= cutoffStr && end >= todayStr
    })

    const events: SportEvent[] = []

    for (const t of relevant) {
      const startIso = parsePPDate(t.start_date)
      const endIso   = parsePPDate(t.end_date)
      if (!startIso || !endIso) continue

      const tournamentName = t.full_name
        .split(' ')
        .map((w: string) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ')
      const location = `${t.city}, ${t.country}`
      const accent = '#22d3ee'

      let foundMatches = false

      // Try to get individual match data for each day in our window
      let dayIso = startIso > todayStr ? startIso : todayStr
      while (dayIso <= endIso && dayIso <= cutoffStr) {
        const dateLabel = toDateLabel(dayIso + 'T12:00:00Z')
        if (dateLabel === 'Pasado') { dayIso = addDays(dayIso, 1); continue }

        const { main_draw, qualify_draw, live, upcoming } = await fetchDayMatches(t.tournaments_id, dayIso)
        const allMatches = [...live, ...main_draw, ...qualify_draw, ...upcoming]

        if (allMatches.length > 0) {
          foundMatches = true
          for (const match of allMatches) {
            const players = extractPlayers(match)
            if (!players) continue

            const matchId = extractMatchId(match)
            const time = extractMatchTime(match)
            const isoDate = `${dayIso}T${time}:00`

            events.push({
              id: `pp-${t.tournaments_id}-${matchId}`,
              home: players.home,
              away: players.away,
              sport: 'Pádel',
              comp: tournamentName,
              date: dateLabel,
              time,
              accent,
              isoDate,
              venue: location,
              source: 'padel' as const,
            })
          }
        }

        dayIso = addDays(dayIso, 1)
      }

      // If no match-level data: show tournament as a single placeholder event on start/today
      if (!foundMatches) {
        const eventDay = startIso > todayStr ? startIso : todayStr
        const dateLabel = toDateLabel(eventDay + 'T12:00:00Z')
        if (dateLabel !== 'Pasado') {
          events.push({
            id: `pp-${t.tournaments_id}-tournament`,
            home: tournamentName,
            away: null,
            sport: 'Pádel',
            comp: 'Premier Padel',
            date: dateLabel,
            time: '00:00',
            accent,
            isoDate: eventDay + 'T00:00:00Z',
            venue: location,
            stage: `${startIso} – ${endIso}`,
            source: 'padel' as const,
          })
        }
      }
    }

    cache = { data: events, ts: now }
    return events
  } catch (err) {
    console.error('[padel] fetchPadelEvents error:', err)
    return cache?.data ?? []
  }
}
