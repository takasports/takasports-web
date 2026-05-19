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

// Cross-league combined rankings (ESPN core API, free). Keys map 1:1 to blocks.
export type CombinedKey =
  | 'yellowCards' | 'redCards' | 'shotsOnTarget' | 'totalShots'
  | 'foulsCommitted' | 'saves'

export interface PlayersResponse {
  leagues: LeaguePlayerData[]
  combined: Record<CombinedKey, PlayerLeader[]>
  season: string
  updatedAt: string
}

const LEAGUES = SOCCER_LEAGUES.map(l => ({ id: l.id, label: l.label, slug: l.espnSlug }))

// European season: Aug→May. Aug-Dec → start=Y; Jan-Jul → start=Y-1.
function seasonStartYear(): number {
  const now = new Date()
  return now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}
const SEASON_START = seasonStartYear()
const SEASON_LABEL = `${SEASON_START}-${String((SEASON_START + 1) % 100).padStart(2, '0')}`

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

// ── ESPN Core API — combined cross-league rankings (free) ──────────────────────
// core leaders return value inline but athlete/team as $ref URLs. We sort by the
// inline value first, keep only the global top N, then resolve just those names.

const COMBINED_CATS: CombinedKey[] = [
  'yellowCards', 'redCards', 'shotsOnTarget', 'totalShots', 'foulsCommitted', 'saves',
]
const TOP_N = 15

interface CoreLeader {
  value: number
  athlete?: { $ref?: string }
  team?: { $ref?: string }
}
interface CoreCategory { name: string; leaders?: CoreLeader[] }

interface RawEntry { value: number; athleteId: string; teamId?: string; leagueSlug: string }

function idFromRef(ref: string | undefined, segment: string): string | undefined {
  if (!ref) return undefined
  const m = ref.match(new RegExp(`/${segment}/(\\d+)`))
  return m?.[1]
}

async function fetchCoreLeaders(
  league: typeof LEAGUES[0],
): Promise<Record<string, RawEntry[]>> {
  const url = `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${league.id}/seasons/${SEASON_START}/types/1/leaders?lang=en`
  const out: Record<string, RawEntry[]> = {}
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) return out
    const json = await res.json()
    const cats = (json.categories ?? []) as CoreCategory[]
    for (const key of COMBINED_CATS) {
      const cat = cats.find(c => c.name === key)
      if (!cat?.leaders) continue
      out[key] = cat.leaders.flatMap(l => {
        const athleteId = idFromRef(l.athlete?.$ref, 'athletes')
        if (!athleteId || !Number.isFinite(l.value)) return []
        return [{
          value: l.value,
          athleteId,
          teamId: idFromRef(l.team?.$ref, 'teams'),
          leagueSlug: league.slug,
        }]
      })
    }
  } catch { /* league offline → skip */ }
  return out
}

async function resolveAthleteName(slug: string, id: string): Promise<string> {
  // slug is "soccer/esp.1" → core path needs sports/<sport>/leagues/<leagueId>
  const [sport, leagueId] = slug.split('/')
  try {
    const r = await fetch(
      `https://sports.core.api.espn.com/v2/sports/${sport}/leagues/${leagueId}/seasons/${SEASON_START}/athletes/${id}?lang=en`,
      { next: { revalidate: 86400 } },
    )
    if (!r.ok) return ''
    const a = await r.json()
    return (a.displayName as string) ?? (a.fullName as string) ?? ''
  } catch { return '' }
}

async function buildCombined(): Promise<Record<CombinedKey, PlayerLeader[]>> {
  const result: Record<CombinedKey, PlayerLeader[]> = {
    yellowCards: [], redCards: [], shotsOnTarget: [], totalShots: [], foulsCommitted: [], saves: [],
  }
  const perLeague = await Promise.all(LEAGUES.map(fetchCoreLeaders))

  // Merge + sort by inline value, keep global top N per category.
  const topByCat: Record<string, RawEntry[]> = {}
  for (const key of COMBINED_CATS) {
    const merged = perLeague.flatMap(l => l[key] ?? [])
    merged.sort((a, b) => b.value - a.value)
    topByCat[key] = merged.slice(0, TOP_N)
  }

  // Resolve only the names we'll actually display (dedupe across categories).
  const need = new Map<string, string>() // athleteId -> leagueSlug
  for (const key of COMBINED_CATS)
    for (const e of topByCat[key]) if (!need.has(e.athleteId)) need.set(e.athleteId, e.leagueSlug)
  const names = new Map<string, string>()
  await Promise.all([...need].map(async ([id, slug]) => {
    names.set(id, await resolveAthleteName(slug, id))
  }))

  for (const key of COMBINED_CATS) {
    result[key] = topByCat[key].flatMap((e, i) => {
      const name = names.get(e.athleteId)
      if (!name) return []
      return [{
        name,
        team: '',
        value: e.value,
        matches: 0,
        playerId: e.athleteId,
        teamLogo: e.teamId ? `https://a.espncdn.com/i/teamlogos/soccer/500/${e.teamId}.png` : undefined,
        leagueSlug: e.leagueSlug,
        extra: { Pos: String(i + 1) },
      }]
    })
  }
  return result
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const [leagues, combined] = await Promise.all([
    Promise.all(LEAGUES.map(fetchEspnLeague)),
    buildCombined(),
  ])
  return NextResponse.json(
    { leagues, combined, season: SEASON_LABEL, updatedAt: new Date().toISOString() } satisfies PlayersResponse,
  )
}
