import { NextResponse } from 'next/server'
import { SOCCER_LEAGUES } from '@/lib/stats-leagues'

export interface PlayerLeader {
  name: string
  team: string
  value: number
  matches: number
  extra?: Record<string, string>
  /** ESPN athlete id — lets the client deep-link to /jugador. */
  playerId?: string
  /** Club crest URL (ESPN has no soccer headshots, so we show the crest). */
  teamLogo?: string
  /** ESPN league slug (e.g. "soccer/esp.1") for building the player slug. */
  leagueSlug?: string
}

export interface LeaguePlayerData {
  id: string
  label: string
  goals: PlayerLeader[]
  assists: PlayerLeader[]
}

export interface PlayersResponse {
  leagues: LeaguePlayerData[]
  season: string
  updatedAt: string
}

const LEAGUES = SOCCER_LEAGUES.map(l => ({ id: l.id, label: l.label, slug: l.espnSlug }))

// European season label: Aug→May. Aug-Dec → Y/Y+1; Jan-Jul → Y-1/Y.
function seasonLabel(): string {
  const now = new Date()
  const start = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}
const SEASON_LABEL = seasonLabel()

// Player tables update slowly; ESPN goals/assists revalidate at 30 min.
export const revalidate = 1800

// ── ESPN ──────────────────────────────────────────────────────────────────────

interface EspnLeader {
  displayValue: string
  value: number
  athlete: {
    id?: string
    displayName: string
    team?: { id?: string; displayName?: string; logos?: { href?: string }[] }
  }
}
interface EspnStat { name: string; displayName: string; leaders: EspnLeader[] }

function parseLeaders(cat: EspnStat | undefined, leagueSlug: string): PlayerLeader[] {
  if (!cat) return []
  return cat.leaders.map(l => {
    const m = l.displayValue.match(/Matches:\s*(\d+)/)
    const teamId = l.athlete.team?.id
    return {
      name:    l.athlete.displayName,
      team:    l.athlete.team?.displayName ?? '',
      value:   Math.round(l.value),
      matches: m ? parseInt(m[1]) : 0,
      playerId:   l.athlete.id,
      teamLogo:   l.athlete.team?.logos?.[0]?.href
        ?? (teamId ? `https://a.espncdn.com/i/teamlogos/soccer/500/${teamId}.png` : undefined),
      leagueSlug,
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
    return {
      id: league.id, label: league.label,
      goals: parseLeaders(goalscat, league.slug),
      assists: parseLeaders(assistscat, league.slug),
    }
  } catch {
    return { id: league.id, label: league.label, goals: [], assists: [] }
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const leagues = await Promise.all(LEAGUES.map(fetchEspnLeague))
  return NextResponse.json({ leagues, season: SEASON_LABEL, updatedAt: new Date().toISOString() } satisfies PlayersResponse)
}
