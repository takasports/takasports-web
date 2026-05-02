import { NextResponse } from 'next/server'

export interface PlayerLeader {
  name: string
  team: string
  value: number
  matches: number
  extra?: Record<string, string>
}

export interface LeaguePlayerData {
  id: string
  label: string
  goals: PlayerLeader[]
  assists: PlayerLeader[]
  yellowCards: PlayerLeader[]
  redCards: PlayerLeader[]
  shots: PlayerLeader[]       // shots on target per game (×10 for display)
  goalsPerGame: PlayerLeader[] // goals per 90 min (×100 for display)
}

export interface PlayersResponse {
  leagues: LeaguePlayerData[]
  updatedAt: string
}

const LEAGUES = [
  { id: 'esp.1', label: 'LaLiga',     slug: 'soccer/esp.1', apiId: 140 },
  { id: 'eng.1', label: 'Premier',    slug: 'soccer/eng.1', apiId: 39  },
  { id: 'ger.1', label: 'Bundesliga', slug: 'soccer/ger.1', apiId: 78  },
  { id: 'ita.1', label: 'Serie A',    slug: 'soccer/ita.1', apiId: 135 },
  { id: 'fra.1', label: 'Ligue 1',    slug: 'soccer/fra.1', apiId: 61  },
]

// API-Sports free tier: only covers up to season 2024.
// To unlock 2025-26 data (cards, shots, goals per 90) upgrade to Pro (~€12/mes)
// and change SEASON to 2025.
const SEASON = 2024

// ESPN cache: 30 min
type EspnCache = { data: Pick<LeaguePlayerData, 'id' | 'label' | 'goals' | 'assists'>[]; ts: number }
let espnCache: EspnCache | null = null
const ESPN_TTL = 30 * 60_000

// API-Football cache: 24 h
type ApiFootyData = Record<string, Pick<LeaguePlayerData, 'yellowCards' | 'redCards' | 'shots' | 'goalsPerGame'>>
type ApiFootyCache = { data: ApiFootyData; ts: number }
let apiFootyCache: ApiFootyCache | null = null
const APIFOOTY_TTL = 24 * 60 * 60_000

// ── ESPN ──────────────────────────────────────────────────────────────────────

interface EspnLeader {
  displayValue: string
  value: number
  athlete: { displayName: string; team?: { displayName: string } }
}
interface EspnStat { name: string; displayName: string; leaders: EspnLeader[] }

function parseLeaders(cat: EspnStat | undefined): PlayerLeader[] {
  if (!cat) return []
  return cat.leaders.map(l => {
    const m = l.displayValue.match(/Matches:\s*(\d+)/)
    return {
      name:    l.athlete.displayName,
      team:    l.athlete.team?.displayName ?? '',
      value:   Math.round(l.value),
      matches: m ? parseInt(m[1]) : 0,
    }
  })
}

async function fetchEspnLeague(
  league: typeof LEAGUES[0],
): Promise<Pick<LeaguePlayerData, 'id' | 'label' | 'goals' | 'assists'>> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${league.slug}/statistics`
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } })
    if (!res.ok) return { id: league.id, label: league.label, goals: [], assists: [] }
    const json = await res.json()
    const stats = (json.stats ?? []) as EspnStat[]
    const goalscat   = stats.find(c => c.displayName === 'Goals'   || c.name === 'goals')
    const assistscat = stats.find(c => c.displayName === 'Assists' || c.name === 'assists')
    return { id: league.id, label: league.label, goals: parseLeaders(goalscat), assists: parseLeaders(assistscat) }
  } catch {
    return { id: league.id, label: league.label, goals: [], assists: [] }
  }
}

// ── API-Football ──────────────────────────────────────────────────────────────

interface ApiPlayer {
  player: { name: string }
  statistics: [{
    team: { name: string }
    games: { appearences: number; minutes: number }
    shots: { total: number; on: number }
    goals: { total: number }
    cards: { yellow: number; yellowred: number; red: number }
  }]
}

async function fetchApiFooty(endpoint: string): Promise<ApiPlayer[]> {
  const key = process.env.API_SPORTS_KEY
  if (!key) return []
  try {
    const res = await fetch(`https://v3.football.api-sports.io/${endpoint}`, {
      headers: { 'x-apisports-key': key },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.response ?? []) as ApiPlayer[]
  } catch { return [] }
}

function toShots(players: ApiPlayer[]): PlayerLeader[] {
  return players
    .filter(p => p.statistics[0]?.games.appearences > 0)
    .map(p => {
      const s = p.statistics[0]
      const spg = s.games.appearences > 0 ? s.shots.on / s.games.appearences : 0
      return { name: p.player.name, team: s.team.name, value: Math.round(spg * 10) / 10, matches: s.games.appearences }
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
}

function toGoalsPer90(players: ApiPlayer[]): PlayerLeader[] {
  return players
    .filter(p => p.statistics[0]?.games.minutes > 0)
    .map(p => {
      const s = p.statistics[0]
      const g90 = s.games.minutes > 0 ? (s.goals.total / s.games.minutes) * 90 : 0
      return { name: p.player.name, team: s.team.name, value: Math.round(g90 * 100) / 100, matches: s.games.appearences }
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
}

function toYellowCards(players: ApiPlayer[]): PlayerLeader[] {
  return players
    .map(p => {
      const s = p.statistics[0]
      return { name: p.player.name, team: s.team.name, value: s.cards.yellow + s.cards.yellowred, matches: s.games.appearences }
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
}

function toRedCards(players: ApiPlayer[]): PlayerLeader[] {
  return players
    .map(p => {
      const s = p.statistics[0]
      return { name: p.player.name, team: s.team.name, value: s.cards.red + s.cards.yellowred, matches: s.games.appearences }
    })
    .filter(p => p.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
}

async function fetchApiFootyLeague(
  league: typeof LEAGUES[0],
): Promise<Pick<LeaguePlayerData, 'yellowCards' | 'redCards' | 'shots' | 'goalsPerGame'>> {
  const empty = { yellowCards: [], redCards: [], shots: [], goalsPerGame: [] }
  const key = process.env.API_SPORTS_KEY
  if (!key) return empty

  const base = `league=${league.apiId}&season=${SEASON}`
  const [scorers, yellows, reds] = await Promise.allSettled([
    fetchApiFooty(`players/topscorers?${base}`),
    fetchApiFooty(`players/topyellowcards?${base}`),
    fetchApiFooty(`players/topredcards?${base}`),
  ])

  return {
    shots:       scorers.status === 'fulfilled' ? toShots(scorers.value)         : [],
    goalsPerGame:scorers.status === 'fulfilled' ? toGoalsPer90(scorers.value)    : [],
    yellowCards: yellows.status === 'fulfilled' ? toYellowCards(yellows.value)   : [],
    redCards:    reds.status    === 'fulfilled' ? toRedCards(reds.value)         : [],
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const now = Date.now()

  // ESPN data (30 min cache)
  let espnData: EspnCache['data']
  if (espnCache && now - espnCache.ts < ESPN_TTL) {
    espnData = espnCache.data
  } else {
    espnData = await Promise.all(LEAGUES.map(fetchEspnLeague))
    espnCache = { data: espnData, ts: now }
  }

  // API-Football data (24 h cache)
  let apiFootyData: ApiFootyData
  if (apiFootyCache && now - apiFootyCache.ts < APIFOOTY_TTL) {
    apiFootyData = apiFootyCache.data
  } else {
    const results = await Promise.allSettled(LEAGUES.map(fetchApiFootyLeague))
    apiFootyData = {}
    LEAGUES.forEach((league, i) => {
      const r = results[i]
      apiFootyData[league.id] = r.status === 'fulfilled'
        ? r.value
        : { yellowCards: [], redCards: [], shots: [], goalsPerGame: [] }
    })
    apiFootyCache = { data: apiFootyData, ts: now }
  }

  const leagues: LeaguePlayerData[] = espnData.map(l => ({
    ...l,
    ...(apiFootyData[l.id] ?? { yellowCards: [], redCards: [], shots: [], goalsPerGame: [] }),
  }))

  return NextResponse.json({ leagues, updatedAt: new Date(now).toISOString() } satisfies PlayersResponse)
}
