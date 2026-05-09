import { NextResponse } from 'next/server'
import { SOCCER_LEAGUES } from '@/lib/stats-leagues'

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
  season: string
  updatedAt: string
}

const LEAGUES = SOCCER_LEAGUES.map(l => ({ id: l.id, label: l.label, slug: l.espnSlug, apiId: l.apiSportsId }))

// API-Sports free tier: only covers up to season 2024.
// Pro (~€12/mes) unlocks current seasons.
// Season detection: European leagues run Aug → May. Aug-Dec → that year; Jan-Jul → year-1.
// Override via API_SPORTS_SEASON env var (e.g. "2025" if Pro tier is active).
function soccerSeason(): number {
  const env = Number(process.env.API_SPORTS_SEASON)
  if (Number.isFinite(env) && env > 2000) return env
  // Without Pro, the highest season the free tier can resolve is 2024.
  if (!process.env.API_SPORTS_PRO) return 2024
  const now = new Date()
  return now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}
const SEASON = soccerSeason()
const SEASON_LABEL = `${SEASON}-${String((SEASON + 1) % 100).padStart(2, '0')}`

// Player tables update slowly; ESPN goals/assists at 30 min, API-Sports cards at 24 h.
export const revalidate = 1800

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
  const [espnData, apiFootyResults] = await Promise.all([
    Promise.all(LEAGUES.map(fetchEspnLeague)),
    Promise.allSettled(LEAGUES.map(fetchApiFootyLeague)),
  ])

  const apiFootyData: Record<string, Pick<LeaguePlayerData, 'yellowCards' | 'redCards' | 'shots' | 'goalsPerGame'>> = {}
  LEAGUES.forEach((league, i) => {
    const r = apiFootyResults[i]
    apiFootyData[league.id] = r.status === 'fulfilled'
      ? r.value
      : { yellowCards: [], redCards: [], shots: [], goalsPerGame: [] }
  })

  const leagues: LeaguePlayerData[] = espnData.map(l => ({
    ...l,
    ...(apiFootyData[l.id] ?? { yellowCards: [], redCards: [], shots: [], goalsPerGame: [] }),
  }))

  return NextResponse.json({ leagues, season: SEASON_LABEL, updatedAt: new Date().toISOString() } satisfies PlayersResponse)
}
