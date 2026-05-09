import { NextRequest, NextResponse } from 'next/server'
import { SOCCER_LEAGUES, EUROPEAN_CUPS } from '@/lib/stats-leagues'
import {
  FIFA_RANKING, FIFA_RANKING_AS_OF, UFC_P4P, UFC_P4P_AS_OF, COACH_CONFIG,
  MOTOGP_RIDERS, MOTOGP_CONSTRUCTORS, MOTOGP_AS_OF,
  CYCLING_UCI, CYCLING_GRAND_TOURS, CYCLING_AS_OF,
  PGA_OWGR, LIV_RANKING, PGA_MAJORS_2026, GOLF_AS_OF,
  UFC_NEXT_CARD, UFC_STREAKS, UFC_NEXT_EVENT_AS_OF,
  TENNIS_SLAMS_2026, WTA_SURFACES,
  NBA_ROOKIE_NAMES,
  type StandingRow,
} from '@/lib/stats-editorial'
export type { StandingRow } from '@/lib/stats-editorial'
import { withStaleFallback } from '@/lib/stats-cache'
import { espnStandingsSchema, jolpicaDriverStandingsSchema, safeParse } from '@/lib/stats-schemas'

const staleSet = new Set<string>()

export interface LeagueStandings {
  id: string
  label: string
  rows: StandingRow[]
}

export type FreshnessStatus = 'live' | 'stale' | 'historical' | 'unavailable'

export interface BlockMeta {
  status: FreshnessStatus
  source: string
  fetchedAt: string
  // For historical / stale blocks: human label like "Histórico 2024-25"
  asOf?: string
}

export interface StatsStandingsResponse {
  football: LeagueStandings[]
  f1Drivers: StandingRow[]
  f1Constructors: StandingRow[]
  f1Poles: StandingRow[]
  f1FastestLaps: StandingRow[]
  nbaEast: StandingRow[]
  nbaWest: StandingRow[]
  nbaScoring: StandingRow[]
  nbaRebounds: StandingRow[]
  nbaAssists: StandingRow[]
  nbaBlocks: StandingRow[]
  nbaSteals: StandingRow[]
  nbaEfficiency: StandingRow[]
  nba3ptMade: StandingRow[]
  atpRanking: StandingRow[]
  wtaRanking: StandingRow[]
  fifaRanking: StandingRow[]
  ufcP4P: StandingRow[]
  womenLigaF: StandingRow[]
  womenGoals: StandingRow[]
  womenAssists: StandingRow[]
  pgaTourLeaderboard: StandingRow[]
  pgaFedExCup: StandingRow[]
  nationsLeague: LeagueStandings[]
  coachesWinRate: StandingRow[]
  worldCup: LeagueStandings[]
  worldCupScorers: StandingRow[]
  worldCupKnockout: StandingRow[]
  nbaPlayoffSeries: StandingRow[]
  uclFixtures: StandingRow[]
  uelFixtures: StandingRow[]
  ueclFixtures: StandingRow[]
  // ── nuevos automatizados ────────────────────────────────────────────
  f1Calendar: StandingRow[]
  nbaMvpRace: StandingRow[]
  nbaRookieRace: StandingRow[]
  worldCupQualified: StandingRow[]
  motogpRiders: StandingRow[]
  motogpConstructors: StandingRow[]
  cyclingUci: StandingRow[]
  cyclingGrandTours: StandingRow[]
  pgaOwgr: StandingRow[]
  livRanking: StandingRow[]
  pgaMajors: StandingRow[]
  ufcCard: StandingRow[]
  ufcStreaks: StandingRow[]
  tennisSlams: StandingRow[]
  wtaSurfaces: StandingRow[]
  meta: Record<string, BlockMeta>
  updatedAt: string
}

// Page-level revalidate kept low so live blocks (NBA playoffs at 60s, WC knockout at 300s,
// UCL/UEL/UECL fixtures at 300s) can refresh on schedule. Slow blocks
// (FedEx Cup, FIFA ranking) carry their own longer fetch-level revalidate.
export const revalidate = 300

const BASE = 'https://site.web.api.espn.com/apis/v2/sports'

const FOOTBALL_LEAGUES = [
  ...SOCCER_LEAGUES.map(l => ({ slug: l.espnSlug, id: l.blockId, label: l.label })),
  ...EUROPEAN_CUPS.map(l => ({ slug: l.espnSlug, id: l.id, label: l.label })),
]

type RawStat = { name: string; value?: number; displayValue?: string }

function sv(stats: RawStat[], name: string): number {
  return (stats.find(s => s.name === name)?.value as number | undefined) ?? 0
}

// ── Football ──────────────────────────────────────────────────────────────────

async function fetchFootball(slug: string, id: string, label: string): Promise<LeagueStandings> {
  const fallback: LeagueStandings = { id, label, rows: [] }
  const result = await withStaleFallback<LeagueStandings>(
    `football:${slug}`,
    30 * 60_000,
    async () => {
      const res = await fetch(`${BASE}/${slug}/standings`, { next: { revalidate: 1800 } })
      if (!res.ok) throw new Error(`espn ${res.status}`)
      const json = await res.json()
      const parsed = safeParse(espnStandingsSchema, json, `football:${slug}`)
      const firstChild = parsed?.children?.[0]
      const entries = firstChild?.standings?.entries ?? []
      if (!entries.length) return null

      const rows: StandingRow[] = entries.map((e, i) => {
        const team  = e.team
        const stats: RawStat[] = (e.stats as RawStat[] | undefined) ?? []
        const w = sv(stats, 'wins'); const d = sv(stats, 'ties'); const l = sv(stats, 'losses')
        const pts = sv(stats, 'points'); const gd = sv(stats, 'pointDifferential')
        const gf  = sv(stats, 'pointsFor'); const gc = sv(stats, 'pointsAgainst')
        const gp  = w + d + l
        return {
          rank:  i + 1,
          name:  team?.displayName ?? '—',
          abbr:  team?.abbreviation ?? '',
          value: String(Math.round(pts)),
          sub:   `${gp} PJ · ${gd >= 0 ? '+' : ''}${Math.round(gd)}`,
          trend: 'flat' as const,
          extra: { V: String(w), E: String(d), D: String(l), GF: String(Math.round(gf)), GC: String(Math.round(gc)) },
        }
      })
      return { id, label, rows }
    },
    fallback,
  )
  if (result.stale) staleSet.add(id)
  return result.data
}

// ── F1 via Jolpica/Ergast (more accurate + dynamic season) ────────────────────

interface JolpicaDriver { givenName: string; familyName: string; nationality: string; code?: string }
interface JolpicaCtor  { name: string; constructorId?: string }

interface F1Result {
  drivers: StandingRow[]
  constructors: StandingRow[]
  poles: StandingRow[]
  fastestLaps: StandingRow[]
  season: string
  round: string
}

const CTOR_ABBR: Record<string, string> = {
  mercedes: 'MER', ferrari: 'FER', red_bull: 'RBR', mclaren: 'MCL', aston_martin: 'AST',
  alpine: 'ALP', williams: 'WIL', haas: 'HAA', sauber: 'SAU', rb: 'RB',
  kick_sauber: 'SAU', cadillac: 'CAD',
}

async function fetchF1All(): Promise<F1Result> {
  const empty: F1Result = { drivers: [], constructors: [], poles: [], fastestLaps: [], season: '', round: '' }
  try {
    const dr = await fetch('https://api.jolpi.ca/ergast/f1/current/driverstandings.json', { next: { revalidate: 3600 } })
    if (!dr.ok) return empty
    const dj = await dr.json()
    const validated = safeParse(jolpicaDriverStandingsSchema, dj, 'f1:drivers')
    const list = validated?.MRData?.StandingsTable?.StandingsLists?.[0]
    const season = String(list?.season ?? '')
    const round  = String(list?.round  ?? '')
    const drivers: StandingRow[] = (list?.DriverStandings ?? []).slice(0, 10).map((d, i: number) => {
      const driver = d.Driver
      const ctor = (d.Constructors ?? [])[0]
      const team = ctor?.name ?? ''
      return {
        rank: Number(d.position ?? i + 1),
        name: `${driver.givenName} ${driver.familyName}`,
        abbr: driver.code ?? '',
        value: String(d.points ?? '0'),
        sub: `Temp. ${season} · R${round}`,
        trend: 'flat' as const,
        extra: { Pts: String(d.points ?? '0'), Escudería: team, V: String(d.wins ?? '0') },
      }
    })

    const cr = await fetch('https://api.jolpi.ca/ergast/f1/current/constructorstandings.json', { next: { revalidate: 3600 } })
    let constructors: StandingRow[] = []
    if (cr.ok) {
      const cj = await cr.json()
      const clist = cj.MRData?.StandingsTable?.StandingsLists?.[0]
      constructors = (clist?.ConstructorStandings ?? []).slice(0, 10).map((c: Record<string, unknown>, i: number) => {
        const ctor = c.Constructor as JolpicaCtor
        const id = (ctor.constructorId ?? '').toLowerCase()
        return {
          rank: Number(c.position ?? i + 1),
          name: ctor.name,
          abbr: CTOR_ABBR[id] ?? ctor.name.slice(0, 3).toUpperCase(),
          value: String(c.points ?? '0'),
          sub: `Temp. ${season} · R${round}`,
          trend: 'flat' as const,
          extra: { Pts: String(c.points ?? '0'), V: String(c.wins ?? '0') },
        }
      })
    }

    const [poles, fastestLaps] = await Promise.all([
      fetchF1Poles(season),
      fetchF1FastestLaps(season),
    ])

    return { drivers, constructors, poles, fastestLaps, season, round }
  } catch (err) {
    console.error('[standings] F1 (Jolpica) failed:', err)
    return empty
  }
}

async function fetchF1Poles(season: string): Promise<StandingRow[]> {
  if (!season) return []
  try {
    const res = await fetch(`https://api.jolpi.ca/ergast/f1/${season}/qualifying.json?limit=100`, { next: { revalidate: 86400 } })
    if (!res.ok) return []
    const json = await res.json()
    const races = (json.MRData?.RaceTable?.Races ?? []) as Record<string, unknown>[]
    const counts: Record<string, { name: string; team: string; n: number }> = {}
    for (const race of races) {
      const pole = ((race.QualifyingResults as Record<string, unknown>[])?.[0]) as Record<string, unknown> | undefined
      if (!pole) continue
      const d = pole.Driver as JolpicaDriver
      const c = pole.Constructor as JolpicaCtor
      const name = `${d.givenName} ${d.familyName}`
      counts[name] ??= { name, team: c.name, n: 0 }
      counts[name].n++
    }
    return Object.values(counts).sort((a, b) => b.n - a.n).map((d, i) => ({
      rank: i + 1, name: d.name, abbr: d.team,
      value: String(d.n), sub: `Temp. ${season}`, trend: 'flat' as const, extra: { Escudería: d.team },
    }))
  } catch { return [] }
}

async function fetchF1FastestLaps(season: string): Promise<StandingRow[]> {
  if (!season) return []
  try {
    const res = await fetch(`https://api.jolpi.ca/ergast/f1/${season}/fastest/1/results.json?limit=100`, { next: { revalidate: 86400 } })
    if (!res.ok) return []
    const json = await res.json()
    const races = (json.MRData?.RaceTable?.Races ?? []) as Record<string, unknown>[]
    const counts: Record<string, { name: string; team: string; n: number }> = {}
    for (const race of races) {
      const result = ((race.Results as Record<string, unknown>[])?.[0]) as Record<string, unknown> | undefined
      if (!result) continue
      const d = result.Driver as JolpicaDriver
      const c = result.Constructor as JolpicaCtor
      const name = `${d.givenName} ${d.familyName}`
      counts[name] ??= { name, team: c.name, n: 0 }
      counts[name].n++
    }
    return Object.values(counts).sort((a, b) => b.n - a.n).map((d, i) => ({
      rank: i + 1, name: d.name, abbr: d.team,
      value: String(d.n), sub: `Temp. ${season}`, trend: 'flat' as const, extra: { Escudería: d.team },
    }))
  } catch { return [] }
}

// ── NBA via ESPN ──────────────────────────────────────────────────────────────

async function fetchNBA(): Promise<{ east: StandingRow[]; west: StandingRow[] }> {
  const fallback = { east: [] as StandingRow[], west: [] as StandingRow[] }
  const result = await withStaleFallback<{ east: StandingRow[]; west: StandingRow[] }>(
    'nba:standings',
    30 * 60_000,
    async () => {
      const res = await fetch(`${BASE}/basketball/nba/standings`, { next: { revalidate: 1800 } })
      if (!res.ok) throw new Error(`espn ${res.status}`)
      const json = await res.json()
      const children = (json?.children as Record<string, unknown>[]) ?? []

    const parse = (child: Record<string, unknown>, confLabel: string): StandingRow[] => {
      const entries = (child?.standings as Record<string, unknown>)?.entries as Record<string, unknown>[] ?? []
      const mapped = entries.map(e => {
        const team  = e.team as Record<string, unknown>
        const stats = (e.stats as RawStat[]) ?? []
        const seed  = Number(stats.find(s => s.name === 'playoffSeed')?.displayValue ?? '99')
        const w     = stats.find(s => s.name === 'wins')?.displayValue ?? '0'
        const l     = stats.find(s => s.name === 'losses')?.displayValue ?? '0'
        const ppg   = stats.find(s => s.name === 'avgPointsFor')?.displayValue ?? '—'
        const streak= stats.find(s => s.name === 'streak')?.displayValue ?? '—'
        return { seed, name: (team?.displayName as string) ?? '—', abbr: (team?.abbreviation as string) ?? '', w, l, ppg, streak }
      }).sort((a, b) => a.seed - b.seed)
      return mapped.map((r, i) => ({
        rank: i + 1, name: r.name, abbr: r.abbr,
        value: `${r.w}-${r.l}`, sub: `${i + 1}º ${confLabel}`, trend: 'flat' as const,
        extra: { PPG: r.ppg, Racha: r.streak },
      }))
    }

      return { east: parse(children[0] as Record<string, unknown>, 'Este'), west: parse(children[1] as Record<string, unknown>, 'Oeste') }
    },
    fallback,
  )
  if (result.stale) { staleSet.add('nbaEast'); staleSet.add('nbaWest') }
  return result.data
}

// ── NBA Player Leaders via NBA.com ────────────────────────────────────────────

function nbaSeasonLabel(): string {
  // NBA season starts in October. Before October, current season label is (year-1)-year.
  const now = new Date()
  const y = now.getUTCFullYear()
  const startYear = now.getUTCMonth() >= 9 ? y : y - 1
  const yy = String((startYear + 1) % 100).padStart(2, '0')
  return `${startYear}-${yy}`
}

async function fetchNBAStatCategory(stat: string, season: string): Promise<StandingRow[]> {
  try {
    const res = await fetch(
      `https://stats.nba.com/stats/leagueleaders?LeagueID=00&PerMode=PerGame&Scope=S&Season=${season}&SeasonType=Regular+Season&StatCategory=${stat}`,
      {
        headers: {
          'Referer': 'https://www.nba.com',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) return []
    const json = await res.json()
    const rs = json.resultSet as { headers: string[]; rowSet: unknown[][] } | undefined
    if (!rs) return []
    const hi = (col: string) => rs.headers.indexOf(col)
    const pi = hi('PLAYER'); const ti = hi('TEAM'); const vi = hi(stat)
    if (pi < 0 || vi < 0) return []
    return rs.rowSet.slice(0, 10).map((row, i) => {
      const val = row[vi] as number
      return {
        rank:  i + 1,
        name:  row[pi] as string,
        abbr:  ti >= 0 ? (row[ti] as string) : '',
        value: val % 1 === 0 ? String(val) : val.toFixed(1),
        sub:   ti >= 0 ? (row[ti] as string) : '',
        trend: 'flat' as const,
        extra: {},
      }
    })
  } catch (err) {
    console.error(`[standings] NBA ${stat} leaders failed:`, err)
    return []
  }
}

async function fetchNBALeaders(season: string): Promise<{ scoring: StandingRow[]; rebounds: StandingRow[]; assists: StandingRow[]; blocks: StandingRow[]; steals: StandingRow[]; efficiency: StandingRow[]; threePt: StandingRow[] }> {
  const [scoring, rebounds, assists, blocks, steals, efficiency, threePt] = await Promise.all([
    fetchNBAStatCategory('PTS', season),
    fetchNBAStatCategory('REB', season),
    fetchNBAStatCategory('AST', season),
    fetchNBAStatCategory('BLK', season),
    fetchNBAStatCategory('STL', season),
    fetchNBAStatCategory('EFF', season),
    fetchNBAStatCategory('FG3M', season),
  ])
  return { scoring, rebounds, assists, blocks, steals, efficiency, threePt }
}

// ── UFC P4P — curated snapshot (no public API available) ─────────────────────
// Data lives in @/lib/stats-editorial.ts. Update there + bump UFC_P4P_AS_OF.
function fetchUFCP4P(): Promise<StandingRow[]> {
  return Promise.resolve(UFC_P4P)
}

// ── Women's Liga F via ESPN ───────────────────────────────────────────────────

async function fetchWomenLigaF(): Promise<StandingRow[]> {
  try {
    const res = await fetch(`${BASE}/soccer/esp.w.1/standings`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const json = await res.json()
    const firstChild = ((json?.children as Record<string, unknown>[] | undefined)?.[0]) as Record<string, unknown> | undefined
    const standings = firstChild?.standings as Record<string, unknown> | undefined
    const entries: Record<string, unknown>[] = (standings?.entries as Record<string, unknown>[] | undefined) ?? []
    if (!entries.length) return []
    return entries.slice(0, 10).map((e, i) => {
      const team  = e.team as Record<string, unknown>
      const stats = (e.stats as RawStat[]) ?? []
      const w = sv(stats, 'wins'); const d = sv(stats, 'ties'); const l = sv(stats, 'losses')
      const pts = sv(stats, 'points'); const gd = sv(stats, 'pointDifferential')
      const gp = w + d + l
      return {
        rank: i + 1, name: (team?.displayName as string) ?? '—', abbr: (team?.abbreviation as string) ?? '',
        value: String(Math.round(pts)), sub: `${gp} PJ · ${gd >= 0 ? '+' : ''}${Math.round(gd)}`,
        trend: 'flat' as const, extra: { V: String(w), E: String(d), D: String(l) },
      }
    })
  } catch { return [] }
}

async function fetchWomenStats(): Promise<{ goals: StandingRow[]; assists: StandingRow[] }> {
  const empty = { goals: [], assists: [] }
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/esp.w.1/statistics', { next: { revalidate: 3600 } })
    if (!res.ok) return empty
    const json = await res.json()
    const stats = (json.stats ?? []) as Array<{ name: string; displayName: string; leaders: Array<{ displayValue: string; value: number; athlete: { displayName: string; team?: { displayName: string } } }> }>
    const parse = (catName: string): StandingRow[] => {
      const cat = stats.find(c => c.displayName === catName || c.name === catName.toLowerCase())
      if (!cat) return []
      return cat.leaders.slice(0, 10).map((l, i) => ({
        rank: i + 1, name: l.athlete.displayName, abbr: l.athlete.team?.displayName ?? '',
        value: String(Math.round(l.value)), sub: l.athlete.team?.displayName ?? '',
        trend: 'flat' as const, extra: {},
      }))
    }
    return { goals: parse('Goals'), assists: parse('Assists') }
  } catch { return empty }
}

// ── Tennis via ESPN ───────────────────────────────────────────────────────────

async function fetchTennis(): Promise<{ atp: StandingRow[]; wta: StandingRow[] }> {
  const fallback = { atp: [], wta: [] }
  const parse = async (tour: 'atp' | 'wta'): Promise<StandingRow[]> => {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/rankings`, { next: { revalidate: 1800 } })
      if (!res.ok) return []
      const json = await res.json()
      const ranks: Record<string, unknown>[] = (json?.rankings?.[0]?.ranks as Record<string, unknown>[]) ?? []
      return ranks.slice(0, 10).map(r => {
        const ath = r.athlete as Record<string, unknown>
        const cc = (ath?.citizenshipCountry as string | undefined)?.toLowerCase() ?? ''
        return {
          rank:  Number(r.current ?? 99),
          name:  (ath?.displayName as string) ?? '—',
          abbr:  cc,
          value: String(r.points ?? 0),
          sub:   `${r.points ?? 0} pts`,
          trend: 'flat' as const,
          extra: { País: cc.toUpperCase(), Prev: String(r.previous ?? '') },
        }
      })
    } catch { return [] }
  }
  const [atp, wta] = await Promise.all([parse('atp'), parse('wta')])
  return atp.length || wta.length ? { atp, wta } : fallback
}

// FIFA ranking & UFC P4P snapshots live in @/lib/stats-editorial.ts so editors
// can update one file. Future: cron pulls from Supabase Storage and overwrites.

// ── UEFA Nations League via ESPN ──────────────────────────────────────────────

const NATIONS_LEAGUE_A_GROUPS = ['A1', 'A2', 'A3', 'A4']

async function fetchNationsLeague(): Promise<LeagueStandings[]> {
  try {
    const res = await fetch('https://site.web.api.espn.com/apis/v2/sports/soccer/uefa.nations/standings', { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const json = await res.json()
    const children = (json.children as Record<string, unknown>[]) ?? []
    const results: LeagueStandings[] = []
    for (const child of children) {
      const name = (child.name as string) ?? ''
      const groupLetter = name.replace('Group ', '')
      if (!NATIONS_LEAGUE_A_GROUPS.includes(groupLetter)) continue
      const entries = (child.standings as Record<string, unknown>)?.entries as Record<string, unknown>[] ?? []
      const rows: StandingRow[] = entries.map((e, i) => {
        const team  = e.team as Record<string, unknown>
        const stats = (e.stats as RawStat[]) ?? []
        const w = sv(stats, 'wins'); const d = sv(stats, 'ties'); const l = sv(stats, 'losses')
        const pts = sv(stats, 'points'); const gp = w + d + l
        const gd  = sv(stats, 'pointDifferential')
        return {
          rank: i + 1,
          name: (team?.displayName as string) ?? '—',
          abbr: (team?.abbreviation as string) ?? '',
          value: String(Math.round(pts)),
          sub: gp > 0 ? `${gp} PJ · ${gd >= 0 ? '+' : ''}${Math.round(gd)}` : 'Por jugar',
          trend: 'flat' as const,
          extra: { V: String(w), E: String(d), D: String(l) },
        }
      })
      // Only include groups with at least one match played
      const hasData = rows.some(r => r.sub !== 'Por jugar')
      if (hasData) {
        results.push({ id: `nations-${groupLetter.toLowerCase()}`, label: `Grupo ${groupLetter} · Nations League`, rows })
      }
    }
    return results
  } catch (err) {
    console.error('[standings] Nations League failed:', err)
    return []
  }
}

// ── PGA Tour via ESPN ─────────────────────────────────────────────────────────

interface PGAResult {
  leaderboard: StandingRow[]
  fedExCup: StandingRow[]
  tournamentName: string
  isCompleted: boolean
  isLive: boolean
}

async function fetchPGA(): Promise<PGAResult> {
  const empty: PGAResult = { leaderboard: [], fedExCup: [], tournamentName: '', isCompleted: false, isLive: false }
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard', { next: { revalidate: 1800 } })
    if (!res.ok) return empty
    const sb = await res.json()
    const event = (sb.events as Record<string, unknown>[] | undefined)?.[0]
    if (!event) return empty

    const tournamentName = (event.name as string) ?? 'PGA Tour'
    const eventStatus = (event.status as Record<string, unknown>)?.type as Record<string, unknown>
    const isCompleted = eventStatus?.state === 'post'
    const isLive      = eventStatus?.state === 'in'

    const comp = (event.competitions as Record<string, unknown>[] | undefined)?.[0]
    const competitors = (comp?.competitors as Record<string, unknown>[]) ?? []

    const leaderboard = competitors
      .map(c => {
        const ath = c.athlete as Record<string, unknown>
        const scoreRaw = c.score as string | number | null
        const scoreNum = scoreRaw !== null && scoreRaw !== undefined ? Number(scoreRaw) : null
        const scoreStr = scoreNum === null ? 'E' : scoreNum === 0 ? 'E' : scoreNum > 0 ? `+${scoreNum}` : String(scoreNum)
        const country = (ath?.flag as Record<string, unknown>)?.alt as string ?? ''
        const subLabel = isCompleted ? 'Final' : isLive ? 'En juego' : 'Próximo'
        return {
          rank: Number(c.order ?? 99),
          name: (ath?.displayName as string) ?? '—',
          abbr: country.slice(0, 3).toUpperCase(),
          value: scoreStr,
          sub: subLabel,
          trend: 'flat' as const,
          extra: { Torneo: tournamentName, País: country },
        }
      })
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 10)
      .map((r, i) => ({ ...r, rank: i + 1 }))

    return { leaderboard, fedExCup: [], tournamentName, isCompleted, isLive }
  } catch (err) {
    console.error('[standings] PGA failed:', err)
    return empty
  }
}

// ── FedEx Cup via ESPN statistics endpoint ────────────────────────────────────

// ESPN's PGA statistics endpoint returns ~11 MB (every PGA member's full stat
// history). Next.js Data Cache rejects bodies > 2 MB so every hit was a fresh
// 11 MB roundtrip. Read the response as a stream, slim it to the FedEx Cup
// category only, and cache the trimmed shape ourselves.
let fedExCupCache: { data: StandingRow[]; expiresAt: number } | null = null
const FEDEX_TTL_MS = 60 * 60 * 1000

async function fetchFedExCup(): Promise<StandingRow[]> {
  if (fedExCupCache && Date.now() < fedExCupCache.expiresAt) return fedExCupCache.data
  try {
    // `cache: 'no-store'` → bypass Next.js Data Cache entirely (the 11 MB body
    // would just trigger the >2 MB warning every time).
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/pga/statistics', { cache: 'no-store' })
    if (!res.ok) return fedExCupCache?.data ?? []
    const d = await res.json()
    const stats = d.stats as Record<string, unknown>
    const cats = (stats?.categories as Record<string, unknown>[]) ?? []
    const fedex = cats.find(c => (c as Record<string, unknown>).name === 'cupPoints') as Record<string, unknown> | undefined
    if (!fedex) return fedExCupCache?.data ?? []
    const season = (d.season as Record<string, unknown>)?.year ?? ''
    const leaders = (fedex.leaders as Record<string, unknown>[]) ?? []
    const rows = leaders.slice(0, 10).map((l, i) => {
      const ath = l.athlete as Record<string, unknown>
      return {
        rank:  i + 1,
        name:  (ath?.displayName as string) ?? '—',
        abbr:  '',
        value: String(Math.round((l.value as number) ?? 0)),
        sub:   `Temp. ${season}`,
        trend: 'flat' as const,
        extra: { Pts: String(Math.round((l.value as number) ?? 0)) },
      }
    })
    fedExCupCache = { data: rows, expiresAt: Date.now() + FEDEX_TTL_MS }
    return rows
  } catch (err) {
    console.error('[standings] FedEx Cup failed:', err)
    return fedExCupCache?.data ?? []
  }
}

// ── Coaches win-rate via ESPN team records ────────────────────────────────────
// Update coach names here when managers change. Win% auto-fetches from ESPN.

// COACH_CONFIG lives in @/lib/stats-editorial.ts — update there when sackings happen.

// European seasons run Aug→May. Aug-Dec → "yy/yy+1"; Jan-Jul → "yy-1/yy".
function soccerSeasonShort(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const startYear = now.getUTCMonth() >= 7 ? y : y - 1
  const a = String(startYear % 100).padStart(2, '0')
  const b = String((startYear + 1) % 100).padStart(2, '0')
  return `${a}/${b}`
}

async function fetchCoachRecords(): Promise<StandingRow[]> {
  const results = await Promise.allSettled(
    COACH_CONFIG.map(async coach => {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${coach.league}/teams/${coach.teamId}`,
        { next: { revalidate: 3600 } }
      )
      if (!res.ok) return null
      const d = await res.json()
      const team = d.team ?? d
      const items: Record<string, unknown>[] = team?.record?.items ?? []
      const total = (items.find((i: Record<string, unknown>) => i.type === 'total') ?? items[0]) as Record<string, unknown> | undefined
      if (!total) return null
      const parts = String(total.summary ?? '').split('-').map(Number)
      const w = parts[0] || 0; const dr = parts[1] || 0; const l = parts[2] || 0
      const gp = w + dr + l
      if (gp === 0) return null
      const winPct = Math.round((w / gp) * 100)
      const stats = (total.stats as Record<string, unknown>[]) ?? []
      const sv2 = (name: string) => Number((stats.find((s: Record<string, unknown>) => s.name === name) as Record<string, unknown> | undefined)?.value ?? 0)
      const gf = sv2('pointsFor'); const gc = sv2('pointsAgainst')
      const gpFull = sv2('gamesPlayed') || gp
      return {
        rank:  0,
        name:  coach.name,
        abbr:  coach.team,
        flag:  coach.flag,
        value: `${winPct}%`,
        sub:   `Temp. ${soccerSeasonShort()} · ${gpFull} PJ`,
        trend: 'flat' as const,
        extra: { GF: (gf / gpFull).toFixed(2), GC: (gc / gpFull).toFixed(2), Club: coach.team },
      } satisfies StandingRow
    })
  )
  return results
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => parseFloat(b!.value) - parseFloat(a!.value))
    .map((r, i) => ({ ...r!, rank: i + 1 })) as StandingRow[]
}

// ── World Cup 2026 via ESPN ───────────────────────────────────────────────────

async function fetchWorldCup(): Promise<LeagueStandings[]> {
  try {
    const res = await fetch(`${BASE}/soccer/fifa.world/standings`, { next: { revalidate: 1800 } })
    if (!res.ok) return []
    const json = await res.json()
    const children = (json.children as Record<string, unknown>[]) ?? []
    const results: LeagueStandings[] = []
    for (const child of children) {
      const name = (child.name as string) ?? ''
      if (!name.startsWith('Group ')) continue
      const groupLetter = name.replace('Group ', '')
      const entries = (child.standings as Record<string, unknown>)?.entries as Record<string, unknown>[] ?? []
      const rows: StandingRow[] = entries.map((e, i) => {
        const team  = e.team as Record<string, unknown>
        const stats = (e.stats as RawStat[]) ?? []
        const pj = sv(stats, 'gamesPlayed') || sv(stats, 'wins') + sv(stats, 'ties') + sv(stats, 'losses')
        const w  = sv(stats, 'wins'); const d = sv(stats, 'ties'); const l = sv(stats, 'losses')
        const pts = sv(stats, 'points'); const gd = sv(stats, 'pointDifferential')
        const gf  = sv(stats, 'pointsFor'); const gc = sv(stats, 'pointsAgainst')
        return {
          rank: i + 1,
          name: (team?.displayName as string) ?? '—',
          abbr: (team?.abbreviation as string) ?? '',
          value: String(Math.round(pts)),
          sub:   pj > 0 ? `${pj} PJ · ${gd >= 0 ? '+' : ''}${Math.round(gd)}` : 'Sin jugar',
          trend: 'flat' as const,
          extra: { PJ: String(Math.round(pj)), V: String(w), E: String(d), D: String(l), GF: String(Math.round(gf)), GC: String(Math.round(gc)) },
        }
      })
      results.push({ id: `wc-group-${groupLetter.toLowerCase()}`, label: `Grupo ${groupLetter}`, rows })
    }
    return results
  } catch (err) {
    console.error('[standings] World Cup failed:', err)
    return []
  }
}

// ── World Cup 2026 knockout phase via ESPN scoreboard ────────────────────────
// Returns empty array before tournament starts (Jun 11, 2026); auto-activates.

async function fetchWorldCupKnockout(): Promise<StandingRow[]> {
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
      { next: { revalidate: 300 } },
    )
    if (!res.ok) return []
    const json = await res.json()
    const events = (json.events as Record<string, unknown>[]) ?? []
    const rows: StandingRow[] = []

    for (const event of events) {
      const comp = ((event.competitions as Record<string, unknown>[])?.[0]) as Record<string, unknown> | undefined
      if (!comp) continue
      const notes = (comp.notes as Record<string, unknown>[]) ?? []
      const roundNote = ((notes[0]?.headline ?? notes[0]?.text) as string) ?? ''
      // Skip group-stage games (headline contains "Group")
      if (roundNote.toLowerCase().includes('group')) continue

      const competitors = (comp.competitors as Record<string, unknown>[]) ?? []
      const home = competitors.find(c => (c as Record<string, unknown>).homeAway === 'home') as Record<string, unknown> | undefined
      const away = competitors.find(c => (c as Record<string, unknown>).homeAway === 'away') as Record<string, unknown> | undefined
      if (!home || !away) continue

      const homeAbbr = ((home.team as Record<string, unknown>)?.abbreviation as string) ?? '?'
      const awayAbbr = ((away.team as Record<string, unknown>)?.abbreviation as string) ?? '?'
      const homeScore = (home.score as string) ?? ''
      const awayScore = (away.score as string) ?? ''

      const status = comp.status as Record<string, unknown>
      const state = ((status?.type as Record<string, unknown>)?.state as string) ?? 'pre'

      let matchup: string, statusStr: string, estado: string
      if (state === 'in') {
        matchup = `${awayAbbr} ${awayScore}–${homeScore} ${homeAbbr}`
        statusStr = `En juego · ${(status?.displayClock as string) ?? ''}`
        estado = 'En juego'
      } else if (state === 'post') {
        matchup = `${awayAbbr} ${awayScore}–${homeScore} ${homeAbbr}`
        statusStr = 'Final'
        estado = 'Final'
      } else {
        matchup = `${awayAbbr} vs ${homeAbbr}`
        const d = (event.date as string) ?? ''
        statusStr = d ? new Date(d).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) : 'Por confirmar'
        estado = 'Programado'
      }

      rows.push({
        rank: rows.length + 1, name: matchup,
        abbr: roundNote.slice(0, 14),
        value: state !== 'pre' ? `${awayScore}-${homeScore}` : 'vs',
        sub: statusStr, trend: 'flat' as const,
        extra: { Ronda: roundNote || 'Fase eliminatoria', Estado: estado },
      })
    }
    return rows
  } catch (err) {
    console.error('[standings] WC knockout failed:', err)
    return []
  }
}

// ── European cup fixtures via ESPN scoreboard (fallback when no standings) ────
// Used during knockout phase when standings endpoint returns empty rows.

async function fetchEuropeanCupFixtures(slug: string): Promise<StandingRow[]> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard`,
      { next: { revalidate: 300 } },
    )
    if (!res.ok) return []
    const json = await res.json()
    const events = (json.events as Record<string, unknown>[]) ?? []
    const rows: StandingRow[] = []

    for (const event of events) {
      const comp = ((event.competitions as Record<string, unknown>[])?.[0]) as Record<string, unknown> | undefined
      if (!comp) continue
      const notes = (comp.notes as Record<string, unknown>[]) ?? []
      const roundNote = ((notes[0]?.headline ?? notes[0]?.text) as string) ?? ''

      const competitors = (comp.competitors as Record<string, unknown>[]) ?? []
      const home = competitors.find(c => (c as Record<string, unknown>).homeAway === 'home') as Record<string, unknown> | undefined
      const away = competitors.find(c => (c as Record<string, unknown>).homeAway === 'away') as Record<string, unknown> | undefined
      if (!home || !away) continue

      const homeAbbr = ((home.team as Record<string, unknown>)?.abbreviation as string) ?? '?'
      const awayAbbr = ((away.team as Record<string, unknown>)?.abbreviation as string) ?? '?'
      const homeScore = (home.score as string) ?? ''
      const awayScore = (away.score as string) ?? ''

      const status = comp.status as Record<string, unknown>
      const state = ((status?.type as Record<string, unknown>)?.state as string) ?? 'pre'

      let matchup: string, statusStr: string, estado: string
      if (state === 'in') {
        matchup = `${awayAbbr} ${awayScore}–${homeScore} ${homeAbbr}`
        statusStr = `En juego · ${(status?.displayClock as string) ?? ''}`
        estado = 'En juego'
      } else if (state === 'post') {
        matchup = `${awayAbbr} ${awayScore}–${homeScore} ${homeAbbr}`
        statusStr = 'Final'
        estado = 'Final'
      } else {
        matchup = `${awayAbbr} vs ${homeAbbr}`
        const d = (event.date as string) ?? ''
        statusStr = d ? new Date(d).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) : 'Por confirmar'
        estado = 'Programado'
      }

      rows.push({
        rank: rows.length + 1, name: matchup,
        abbr: roundNote.slice(0, 14),
        value: state !== 'pre' ? `${awayScore}-${homeScore}` : 'vs',
        sub: statusStr, trend: 'flat' as const,
        extra: { Ronda: roundNote || (slug.split('/').pop() ?? 'Europea'), Estado: estado },
      })
    }
    return rows.slice(0, 16)
  } catch (err) {
    console.error(`[standings] European cup fixtures failed for ${slug}:`, err)
    return []
  }
}

// ── NBA Playoff Series via ESPN scoreboard ────────────────────────────────────

async function fetchNBAPlayoffSeries(): Promise<StandingRow[]> {
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return []
    const json = await res.json()
    const events = (json.events as Record<string, unknown>[]) ?? []
    const rows: StandingRow[] = []
    let rank = 0

    for (const event of events) {
      const comp = ((event.competitions as Record<string, unknown>[])?.[0]) as Record<string, unknown> | undefined
      if (!comp) continue
      const series = comp.series as Record<string, unknown> | undefined
      if (!series?.summary) continue

      const competitors = (comp.competitors as Record<string, unknown>[]) ?? []
      const home = competitors.find(c => (c as Record<string, unknown>).homeAway === 'home') as Record<string, unknown> | undefined
      const away = competitors.find(c => (c as Record<string, unknown>).homeAway === 'away') as Record<string, unknown> | undefined
      const homeAbbr = ((home?.team as Record<string, unknown>)?.abbreviation as string) ?? '?'
      const awayAbbr = ((away?.team as Record<string, unknown>)?.abbreviation as string) ?? '?'
      const homeScore = (home?.score as string) ?? ''
      const awayScore = (away?.score as string) ?? ''

      const seriesSummary = (series.summary as string) ?? ''
      const seriesScore = seriesSummary.match(/\d-\d/)?.[0] ?? ''

      const status = (comp.status ?? event.status) as Record<string, unknown>
      const state = ((status?.type as Record<string, unknown>)?.state as string) ?? 'pre'
      const clock = (status?.displayClock as string) ?? ''
      const period = (status?.period as number) ?? 0

      let statusStr: string
      let estado: string
      if (state === 'in') {
        statusStr = period > 4 ? `Prórroga · ${clock}` : `Q${period} · ${clock}`
        estado = 'En juego'
      } else if (state === 'post') {
        statusStr = 'Final'
        estado = 'Final'
      } else {
        const dateStr = (event.date as string) ?? ''
        statusStr = dateStr
          ? new Date(dateStr).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })
          : 'Próximo'
        estado = 'Programado'
      }

      const hasScore = state !== 'pre' && homeScore && awayScore
      const matchup = hasScore
        ? `${awayAbbr} ${awayScore}–${homeScore} ${homeAbbr}`
        : `${awayAbbr} @ ${homeAbbr}`

      rows.push({ rank: ++rank, name: matchup, abbr: seriesScore, value: seriesScore, sub: statusStr, trend: 'flat', extra: { Serie: seriesSummary, Estado: estado } })
    }
    return rows
  } catch (err) {
    console.error('[standings] NBA playoffs failed:', err)
    return []
  }
}

// ── World Cup top scorers (empty until tournament starts Jun 11, 2026) ─────────

async function fetchWorldCupScorers(): Promise<StandingRow[]> {
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/statistics',
      { next: { revalidate: 1800 } },
    )
    if (!res.ok) return []
    const json = await res.json()
    const stats = (json.stats ?? []) as Array<{ name: string; displayName: string; leaders: Array<{ value: number; athlete: { displayName: string; team?: { displayName: string } } }> }>
    const goalsCat = stats.find(c => c.displayName === 'Goals' || c.name === 'goals')
    if (!goalsCat?.leaders.length) return []
    return goalsCat.leaders.slice(0, 10).map((l, i) => ({
      rank: i + 1, name: l.athlete.displayName,
      abbr: l.athlete.team?.displayName ?? '',
      value: String(Math.round(l.value)),
      sub: l.athlete.team?.displayName ?? '',
      trend: 'flat' as const, extra: {},
    }))
  } catch { return [] }
}

// ── F1 Calendar ───────────────────────────────────────────────────────────────

async function fetchF1Calendar(season: string): Promise<StandingRow[]> {
  if (!season) return []
  try {
    const res = await fetch(`https://api.jolpi.ca/ergast/f1/${season}.json`, { next: { revalidate: 86400 } })
    if (!res.ok) return []
    const json = await res.json()
    const races = (json.MRData?.RaceTable?.Races ?? []) as Record<string, unknown>[]
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const upcoming = races
      .filter(r => new Date(String(r.date)).getTime() >= today.getTime())
      .slice(0, 8)
    if (!upcoming.length) return []
    return upcoming.map((r, i) => {
      const d = new Date(String(r.date))
      const fmt = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
      const circuit = r.Circuit as Record<string, unknown> | undefined
      const circuitName = (circuit?.circuitName as string) ?? ''
      return {
        rank: i + 1,
        name: `${r.raceName as string} · ${(circuit?.Location as Record<string, unknown> | undefined)?.country ?? ''}`,
        abbr: '',
        value: fmt,
        sub: `R${r.round as string} · ${circuitName}`,
        trend: 'flat' as const,
        extra: {},
      }
    })
  } catch { return [] }
}

// ── NBA MVP Race + Rookie Race (auto-derivado) ────────────────────────────────

function buildNbaMvpRace(scoring: StandingRow[], east: StandingRow[], west: StandingRow[]): StandingRow[] {
  if (!scoring.length || (!east.length && !west.length)) return []
  // team → win % from standings (extra has W-L in 'value' like "60-22")
  const winPct: Record<string, number> = {}
  for (const team of [...east, ...west]) {
    const m = team.value.match(/(\d+)-(\d+)/)
    if (!m) continue
    const w = parseInt(m[1]); const l = parseInt(m[2])
    if (w + l === 0) continue
    const pct = w / (w + l)
    // map abbr (KEY) — standings rows expose team abbr in `abbr`
    if (team.abbr) winPct[team.abbr] = pct
  }
  // score = PPG * (0.5 + 0.5 * winPct)  → rewards top scorers in good teams
  const scored = scoring.map(p => {
    const ppg = parseFloat(p.value) || 0
    const teamAbbr = p.abbr || ''
    const w = winPct[teamAbbr] ?? 0.5
    return { ...p, mvpScore: ppg * (0.5 + 0.5 * w) }
  })
  scored.sort((a, b) => b.mvpScore - a.mvpScore)
  return scored.slice(0, 7).map((p, i) => ({
    rank: i + 1, name: p.name, abbr: p.abbr,
    value: `#${i + 1}`,
    sub: `${p.value} PPG · W% ${Math.round((winPct[p.abbr ?? ''] ?? 0) * 100)}%`,
    flag: p.flag,
    trend: 'flat' as const,
    extra: { PPG: p.value, Equipo: p.abbr ?? '' },
  }))
}

function buildNbaRookieRace(scoring: StandingRow[], rebounds: StandingRow[], assists: StandingRow[], rookies: Set<string>): StandingRow[] {
  // Pull rookies from scoring + rebounds + assists (combined unique pool)
  const pool = new Map<string, { name: string; team: string; flag?: string; ppg: number; rpg: number; apg: number }>()
  const upsert = (row: StandingRow, kind: 'ppg' | 'rpg' | 'apg') => {
    if (!rookies.has(row.name)) return
    const v = parseFloat(row.value) || 0
    const cur = pool.get(row.name) ?? { name: row.name, team: row.abbr ?? '', flag: row.flag, ppg: 0, rpg: 0, apg: 0 }
    cur[kind] = v
    if (!cur.team && row.abbr) cur.team = row.abbr
    if (!cur.flag && row.flag) cur.flag = row.flag
    pool.set(row.name, cur)
  }
  scoring.forEach(r => upsert(r, 'ppg'))
  rebounds.forEach(r => upsert(r, 'rpg'))
  assists.forEach(r => upsert(r, 'apg'))
  if (!pool.size) return []
  // Composite score: PPG + RPG + 1.5*APG  (assists weighted higher per ROY tradition)
  const arr = Array.from(pool.values())
    .map(r => ({ ...r, score: r.ppg + r.rpg + r.apg * 1.5 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 7)
  return arr.map((r, i) => ({
    rank: i + 1, name: r.name, abbr: r.team,
    value: `#${i + 1}`,
    sub: `${r.ppg} PPG · ${r.rpg} RPG · ${r.apg} APG`,
    flag: r.flag,
    trend: 'flat' as const,
    extra: { PPG: String(r.ppg), Equipo: r.team },
  }))
}

// ── World Cup qualified (derivado de FIFA ranking + anfitriones) ──────────────

const FIFA_FLAG: Record<string, string> = {
  'Francia': '🇫🇷', 'España': '🇪🇸', 'Argentina': '🇦🇷', 'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Portugal': '🇵🇹', 'Brasil': '🇧🇷', 'Países Bajos': '🇳🇱', 'Marruecos': '🇲🇦',
  'Bélgica': '🇧🇪', 'Alemania': '🇩🇪',
}
const FIFA_CONFED: Record<string, string> = {
  'Francia': 'UEFA', 'España': 'UEFA', 'Argentina': 'CONMEBOL', 'Inglaterra': 'UEFA',
  'Portugal': 'UEFA', 'Brasil': 'CONMEBOL', 'Países Bajos': 'UEFA', 'Marruecos': 'CAF',
  'Bélgica': 'UEFA', 'Alemania': 'UEFA',
}

function buildWorldCupQualified(): StandingRow[] {
  const hosts: StandingRow[] = [
    { rank: 1, name: 'EEUU',    abbr: 'USA', value: 'Anfitrión', sub: 'Co-anfitrión',  flag: '🇺🇸', trend: 'flat', extra: { Confed: 'CONCACAF' } },
    { rank: 2, name: 'México',   abbr: 'MEX', value: 'Anfitrión', sub: 'Co-anfitrión',  flag: '🇲🇽', trend: 'flat', extra: { Confed: 'CONCACAF' } },
    { rank: 3, name: 'Canadá',   abbr: 'CAN', value: 'Anfitrión', sub: 'Co-anfitrión',  flag: '🇨🇦', trend: 'flat', extra: { Confed: 'CONCACAF' } },
  ]
  const champion: StandingRow = { rank: 4, name: 'Argentina', abbr: 'ARG', value: 'Campeona', sub: 'Defiende título 2022', flag: '🇦🇷', trend: 'flat', extra: { Confed: 'CONMEBOL' } }
  const fifaTop = FIFA_RANKING
    .filter(r => r.name !== 'Argentina')
    .slice(0, 8)
    .map((r, i) => ({
      rank: 5 + i, name: r.name, abbr: r.abbr,
      value: 'Top FIFA', sub: r.sub,
      flag: FIFA_FLAG[r.name] ?? '',
      trend: r.trend,
      extra: { Confed: FIFA_CONFED[r.name] ?? '—', Pts: r.extra?.Pts ?? '' },
    } as StandingRow))
  return [...hosts, champion, ...fifaTop]
}

// ── GET ───────────────────────────────────────────────────────────────────────

const SPORT_KEYS: Record<string, (keyof StatsStandingsResponse)[]> = {
  futbol: ['football', 'uclFixtures', 'uelFixtures', 'ueclFixtures'],
  football: ['football'],
  nba: ['nbaEast', 'nbaWest', 'nbaScoring', 'nbaRebounds', 'nbaAssists', 'nbaBlocks', 'nbaSteals', 'nbaEfficiency', 'nba3ptMade', 'nbaPlayoffSeries', 'nbaMvpRace', 'nbaRookieRace'],
  f1: ['f1Drivers', 'f1Constructors', 'f1Poles', 'f1FastestLaps', 'f1Calendar'],
  tenis: ['atpRanking', 'wtaRanking', 'tennisSlams', 'wtaSurfaces'],
  tennis: ['atpRanking', 'wtaRanking', 'tennisSlams', 'wtaSurfaces'],
  ufc: ['ufcP4P', 'ufcCard', 'ufcStreaks'],
  selecciones: ['fifaRanking', 'nationsLeague'],
  femenino: ['womenLigaF', 'womenGoals', 'womenAssists'],
  golf: ['pgaTourLeaderboard', 'pgaFedExCup', 'pgaOwgr', 'livRanking', 'pgaMajors'],
  mundial: ['worldCup', 'worldCupScorers', 'worldCupKnockout', 'worldCupQualified'],
  motogp: ['motogpRiders', 'motogpConstructors'],
  ciclismo: ['cyclingUci', 'cyclingGrandTours'],
}

async function buildPayload(): Promise<StatsStandingsResponse> {
  const [footballResults, f1, nba, nbaSeason, tennis, ufcP4P, womenLigaF, womenStats, pga, nationsLeague, fedExCup, coaches, worldCup, nbaPlayoffSeries, worldCupScorers, worldCupKnockout, uclFixtures, uelFixtures, ueclFixtures] = await Promise.all([
    Promise.allSettled(FOOTBALL_LEAGUES.map(l => fetchFootball(l.slug, l.id, l.label))),
    fetchF1All(),
    fetchNBA(),
    Promise.resolve(nbaSeasonLabel()),
    fetchTennis(),
    fetchUFCP4P(),
    fetchWomenLigaF(),
    fetchWomenStats(),
    fetchPGA(),
    fetchNationsLeague(),
    fetchFedExCup(),
    fetchCoachRecords(),
    fetchWorldCup(),
    fetchNBAPlayoffSeries(),
    fetchWorldCupScorers(),
    fetchWorldCupKnockout(),
    fetchEuropeanCupFixtures('soccer/uefa.champions'),
    fetchEuropeanCupFixtures('soccer/uefa.europa'),
    fetchEuropeanCupFixtures('soccer/uefa.conference'),
  ])
  const nbaLeaders = await fetchNBALeaders(nbaSeason)
  const f1Calendar = f1.season ? await fetchF1Calendar(f1.season) : []

  const football = footballResults
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter(Boolean) as LeagueStandings[]

  // Derived blocks
  const nbaMvpRace = buildNbaMvpRace(nbaLeaders.scoring, nba.east, nba.west)
  const nbaRookieRace = buildNbaRookieRace(nbaLeaders.scoring, nbaLeaders.rebounds, nbaLeaders.assists, NBA_ROOKIE_NAMES)
  const worldCupQualified = buildWorldCupQualified()

  const now = new Date().toISOString()
  const stale   = (source: string): BlockMeta => ({ status: 'stale', source, fetchedAt: now, asOf: 'caché reciente' })
  const live    = (source: string, key?: string): BlockMeta =>
    (key && staleSet.has(key)) ? stale(source) : ({ status: 'live', source, fetchedAt: now })
  const unavail = (source: string): BlockMeta => ({ status: 'unavailable', source, fetchedAt: now })
  const histor  = (source: string, asOf: string): BlockMeta => ({ status: 'historical', source, fetchedAt: now, asOf })

  const wcStarted = worldCup.some(g => g.rows.some(r => r.sub !== 'Sin jugar'))

  const meta: Record<string, BlockMeta> = {
    // football meta is populated per-league below (each tabla- id can be stale independently)
    football:        live('ESPN'),
    f1Drivers:       f1.drivers.length      ? live(`Jolpica · ${f1.season} R${f1.round}`) : unavail('Jolpica'),
    f1Constructors:  f1.constructors.length ? live(`Jolpica · ${f1.season} R${f1.round}`) : unavail('Jolpica'),
    f1Poles:         f1.poles.length        ? live(`Jolpica · ${f1.season}`)              : unavail('Jolpica'),
    f1FastestLaps:   f1.fastestLaps.length  ? live(`Jolpica · ${f1.season}`)              : unavail('Jolpica'),
    nbaEast:         nba.east.length        ? live('ESPN', 'nbaEast') : unavail('ESPN'),
    nbaWest:         nba.west.length        ? live('ESPN', 'nbaWest') : unavail('ESPN'),
    nbaScoring:      nbaLeaders.scoring.length    ? live(`NBA.com · ${nbaSeason}`) : unavail('NBA.com'),
    nbaRebounds:     nbaLeaders.rebounds.length   ? live(`NBA.com · ${nbaSeason}`) : unavail('NBA.com'),
    nbaAssists:      nbaLeaders.assists.length    ? live(`NBA.com · ${nbaSeason}`) : unavail('NBA.com'),
    nbaBlocks:       nbaLeaders.blocks.length     ? live(`NBA.com · ${nbaSeason}`) : unavail('NBA.com'),
    nbaSteals:       nbaLeaders.steals.length     ? live(`NBA.com · ${nbaSeason}`) : unavail('NBA.com'),
    nbaEfficiency:   nbaLeaders.efficiency.length ? live(`NBA.com · ${nbaSeason}`) : unavail('NBA.com'),
    nba3ptMade:      nbaLeaders.threePt.length    ? live(`NBA.com · ${nbaSeason}`) : unavail('NBA.com'),
    atpRanking:      tennis.atp.length ? live('ESPN') : unavail('ESPN'),
    wtaRanking:      tennis.wta.length ? live('ESPN') : unavail('ESPN'),
    fifaRanking:     histor('FIFA', FIFA_RANKING_AS_OF),
    ufcP4P:          histor('UFC Rankings', UFC_P4P_AS_OF),
    womenLigaF:          womenLigaF.length             ? live('ESPN') : unavail('ESPN'),
    womenGoals:          womenStats.goals.length       ? live('ESPN') : unavail('ESPN'),
    womenAssists:        womenStats.assists.length     ? live('ESPN') : unavail('ESPN'),
    pgaTourLeaderboard:  pga.leaderboard.length
      ? pga.isLive      ? live(`ESPN · ${pga.tournamentName}`)
      : pga.isCompleted ? ({ status: 'stale', source: `ESPN · ${pga.tournamentName}`, fetchedAt: now, asOf: 'Final' } satisfies BlockMeta)
      :                   unavail('ESPN')
      : unavail('ESPN'),
    pgaFedExCup:      fedExCup.length ? live('ESPN') : unavail('ESPN'),
    nationsLeague:    nationsLeague.length ? live('ESPN · UEFA Nations League') : unavail('ESPN · Nations League no iniciada'),
    coachesWinRate:   coaches.length ? live('ESPN') : unavail('ESPN'),
    worldCup:         worldCup.length
      ? wcStarted ? live('ESPN · FIFA World Cup 2026') : ({ status: 'stale', source: 'ESPN · FIFA World Cup 2026', fetchedAt: now, asOf: 'Grupos confirmados — torneo inicia 11 jun 2026' } satisfies BlockMeta)
      : unavail('ESPN'),
    worldCupScorers:  worldCupScorers.length ? live('ESPN · FIFA World Cup 2026') : unavail('ESPN · Torneo no iniciado'),
    worldCupKnockout: worldCupKnockout.length
      ? worldCupKnockout.some(r => r.extra?.Estado === 'En juego') ? live('ESPN · FIFA World Cup 2026') : ({ status: 'stale', source: 'ESPN · FIFA World Cup 2026', fetchedAt: now, asOf: 'Partidos del día' } satisfies BlockMeta)
      : unavail('ESPN · Fase eliminatoria no iniciada'),
    nbaPlayoffSeries: nbaPlayoffSeries.length
      ? nbaPlayoffSeries.some(r => r.extra?.Estado === 'En juego') ? live('ESPN · NBA Playoffs') : ({ status: 'stale', source: 'ESPN · NBA Playoffs', fetchedAt: now, asOf: 'Juegos del día' } satisfies BlockMeta)
      : unavail('ESPN'),
    uclFixtures: uclFixtures.length
      ? uclFixtures.some(r => r.extra?.Estado === 'En juego') ? live('ESPN · UEFA Champions League') : ({ status: 'stale', source: 'ESPN · UCL', fetchedAt: now, asOf: 'Fase KO' } satisfies BlockMeta)
      : unavail('ESPN'),
    uelFixtures: uelFixtures.length
      ? uelFixtures.some(r => r.extra?.Estado === 'En juego') ? live('ESPN · UEFA Europa League') : ({ status: 'stale', source: 'ESPN · UEL', fetchedAt: now, asOf: 'Fase KO' } satisfies BlockMeta)
      : unavail('ESPN'),
    ueclFixtures: ueclFixtures.length
      ? ueclFixtures.some(r => r.extra?.Estado === 'En juego') ? live('ESPN · UEFA Conference League') : ({ status: 'stale', source: 'ESPN · UECL', fetchedAt: now, asOf: 'Fase KO' } satisfies BlockMeta)
      : unavail('ESPN'),
    // ── Nuevos automatizados ────────────────────────────────────────────
    f1Calendar:        f1Calendar.length    ? live(`Jolpica · ${f1.season}`) : unavail('Jolpica'),
    nbaMvpRace:        nbaMvpRace.length    ? live(`Auto · NBA.com · ${nbaSeason}`) : unavail('NBA.com'),
    nbaRookieRace:     nbaRookieRace.length ? live(`Auto · NBA.com · ${nbaSeason}`) : unavail('NBA.com'),
    worldCupQualified: live('Auto · FIFA + anfitriones'),
    motogpRiders:        histor('MotoGP.com', MOTOGP_AS_OF),
    motogpConstructors:  histor('MotoGP.com', MOTOGP_AS_OF),
    cyclingUci:          histor('UCI', CYCLING_AS_OF),
    cyclingGrandTours:   histor('UCI · calendario', CYCLING_AS_OF),
    pgaOwgr:             histor('OWGR', GOLF_AS_OF),
    livRanking:          histor('LIV Golf', GOLF_AS_OF),
    pgaMajors:           histor('PGA · calendario', GOLF_AS_OF),
    ufcCard:             histor('UFC', UFC_NEXT_EVENT_AS_OF),
    ufcStreaks:          histor('UFC Stats', UFC_P4P_AS_OF),
    tennisSlams:         histor('ATP/WTA · calendario', '2026'),
    wtaSurfaces:         histor('WTA', '2024-25'),
  }

  // Per-football-league meta — lets the UI surface stale-fallback per tabla-* block.
  for (const league of football) {
    if (staleSet.has(league.id)) {
      meta[league.id] = { status: 'stale', source: 'ESPN · caché reciente', fetchedAt: now, asOf: 'fallback' }
    } else if (league.rows.length) {
      meta[league.id] = { status: 'live', source: 'ESPN', fetchedAt: now }
    }
  }

  return {
    football,
    f1Drivers:      f1.drivers,
    f1Constructors: f1.constructors,
    f1Poles:        f1.poles,
    f1FastestLaps:  f1.fastestLaps,
    nbaEast:        nba.east,
    nbaWest:        nba.west,
    nbaScoring:     nbaLeaders.scoring,
    nbaRebounds:    nbaLeaders.rebounds,
    nbaAssists:     nbaLeaders.assists,
    nbaBlocks:      nbaLeaders.blocks,
    nbaSteals:      nbaLeaders.steals,
    nbaEfficiency:  nbaLeaders.efficiency,
    nba3ptMade:     nbaLeaders.threePt,
    atpRanking:     tennis.atp,
    wtaRanking:     tennis.wta,
    fifaRanking:    FIFA_RANKING,
    ufcP4P,
    womenLigaF,
    womenGoals:          womenStats.goals,
    womenAssists:        womenStats.assists,
    pgaTourLeaderboard:  pga.leaderboard,
    pgaFedExCup:         fedExCup,
    nationsLeague,
    coachesWinRate:      coaches,
    worldCup,
    worldCupScorers,
    worldCupKnockout,
    nbaPlayoffSeries,
    uclFixtures,
    uelFixtures,
    ueclFixtures,
    f1Calendar,
    nbaMvpRace,
    nbaRookieRace,
    worldCupQualified,
    motogpRiders:       MOTOGP_RIDERS,
    motogpConstructors: MOTOGP_CONSTRUCTORS,
    cyclingUci:         CYCLING_UCI,
    cyclingGrandTours:  CYCLING_GRAND_TOURS,
    pgaOwgr:            PGA_OWGR,
    livRanking:         LIV_RANKING,
    pgaMajors:          PGA_MAJORS_2026,
    ufcCard:            UFC_NEXT_CARD,
    ufcStreaks:         UFC_STREAKS,
    tennisSlams:        TENNIS_SLAMS_2026,
    wtaSurfaces:        WTA_SURFACES,
    meta,
    updatedAt:          now,
  }
}

export async function getStandingsData(): Promise<StatsStandingsResponse> {
  return buildPayload()
}

export async function GET(req: NextRequest) {
  const data = await getStandingsData()

  // Optional sport sharding via ?sport=
  const sport = req.nextUrl.searchParams.get('sport')?.toLowerCase()
  if (sport && SPORT_KEYS[sport]) {
    const keys = SPORT_KEYS[sport]
    const meta: Record<string, BlockMeta> = {}
    for (const k of keys) if (data.meta[k as string]) meta[k as string] = data.meta[k as string]
    const shard: Partial<StatsStandingsResponse> & { updatedAt: string; meta: Record<string, BlockMeta> } = {
      meta, updatedAt: data.updatedAt,
    }
    for (const k of keys) {
      ;(shard as Record<string, unknown>)[k as string] = (data as unknown as Record<string, unknown>)[k as string]
    }
    return NextResponse.json(shard)
  }

  return NextResponse.json(data)
}
