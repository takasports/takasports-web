import { NextRequest, NextResponse } from 'next/server'

export interface StandingRow {
  rank: number
  name: string
  abbr: string
  value: string
  sub: string
  trend: 'up' | 'down' | 'flat'
  extra: Record<string, string>
  flag?: string
}

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
  meta: Record<string, BlockMeta>
  updatedAt: string
}

interface CacheEntry { data: StatsStandingsResponse; ts: number }
let cache: CacheEntry | null = null
const CACHE_TTL = 30 * 60_000

const BASE = 'https://site.web.api.espn.com/apis/v2/sports'

const FOOTBALL_LEAGUES = [
  { slug: 'soccer/esp.1',         id: 'tabla-laliga',     label: 'LaLiga' },
  { slug: 'soccer/eng.1',         id: 'tabla-premier',    label: 'Premier League' },
  { slug: 'soccer/ita.1',         id: 'tabla-serie-a',    label: 'Serie A' },
  { slug: 'soccer/ger.1',         id: 'tabla-bundesliga', label: 'Bundesliga' },
  { slug: 'soccer/fra.1',         id: 'tabla-ligue1',     label: 'Ligue 1' },
  { slug: 'soccer/uefa.champions',   id: 'tabla-ucl',  label: 'Champions League' },
  { slug: 'soccer/uefa.europa',      id: 'tabla-uel',  label: 'Europa League' },
  { slug: 'soccer/uefa.conference',  id: 'tabla-uecl', label: 'Conference League' },
]

type RawStat = { name: string; value?: number; displayValue?: string }

function sv(stats: RawStat[], name: string): number {
  return (stats.find(s => s.name === name)?.value as number | undefined) ?? 0
}

// ── Football ──────────────────────────────────────────────────────────────────

async function fetchFootball(slug: string, id: string, label: string): Promise<LeagueStandings> {
  const fallback: LeagueStandings = { id, label, rows: [] }
  try {
    const res = await fetch(`${BASE}/${slug}/standings`, { next: { revalidate: 1800 } })
    if (!res.ok) return fallback
    const json = await res.json()
    const firstChild = ((json?.children as Record<string, unknown>[] | undefined)?.[0]) as Record<string, unknown> | undefined
    const standings  = firstChild?.standings as Record<string, unknown> | undefined
    const entries: Record<string, unknown>[] = (standings?.entries as Record<string, unknown>[] | undefined) ?? []
    if (!entries.length) return fallback

    const rows: StandingRow[] = entries.map((e, i) => {
      const team  = e.team as Record<string, unknown>
      const stats = (e.stats as RawStat[]) ?? []
      const w = sv(stats, 'wins'); const d = sv(stats, 'ties'); const l = sv(stats, 'losses')
      const pts = sv(stats, 'points'); const gd = sv(stats, 'pointDifferential')
      const gf  = sv(stats, 'pointsFor'); const gc = sv(stats, 'pointsAgainst')
      const gp  = w + d + l
      return {
        rank:  i + 1,
        name:  (team?.displayName as string) ?? '—',
        abbr:  (team?.abbreviation as string) ?? '',
        value: String(Math.round(pts)),
        sub:   `${gp} PJ · ${gd >= 0 ? '+' : ''}${Math.round(gd)}`,
        trend: 'flat' as const,
        extra: { V: String(w), E: String(d), D: String(l), GF: String(Math.round(gf)), GC: String(Math.round(gc)) },
      }
    })
    return { id, label, rows }
  } catch (err) {
    console.error(`[standings] Football failed for ${slug}:`, err)
    return fallback
  }
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
    const list = dj.MRData?.StandingsTable?.StandingsLists?.[0]
    const season = String(list?.season ?? '')
    const round  = String(list?.round  ?? '')
    const drivers: StandingRow[] = (list?.DriverStandings ?? []).slice(0, 10).map((d: Record<string, unknown>, i: number) => {
      const driver = d.Driver as JolpicaDriver
      const ctor = ((d.Constructors as JolpicaCtor[]) ?? [])[0]
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
  const fallback = { east: [], west: [] }
  try {
    const res = await fetch(`${BASE}/basketball/nba/standings`, { next: { revalidate: 1800 } })
    if (!res.ok) return fallback
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
  } catch (err) {
    console.error('[standings] NBA failed:', err)
    return fallback
  }
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

// ── UFC: ESPN endpoint is dead (Usman/Ngannou). Returning empty + historical flag ──

async function fetchUFCP4P(): Promise<StandingRow[]> {
  // ESPN's /mma/ufc/rankings has not been updated since ~2022 (returns Kamaru Usman as #1).
  // Until we wire a working source, we return empty so the UI renders an "Histórico no disponible"
  // state instead of misleading data.
  return []
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

// ── FIFA Ranking (manually maintained snapshot) ───────────────────────────────

const FIFA_RANKING_AS_OF = '2026-04'
const FIFA_RANKING: StandingRow[] = [
  { rank: 1,  name: 'Francia',        abbr: 'FRA', value: '1877', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'up',   extra: { Pts: '1877.32' } },
  { rank: 2,  name: 'España',         abbr: 'ESP', value: '1876', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'down', extra: { Pts: '1876.40' } },
  { rank: 3,  name: 'Argentina',      abbr: 'ARG', value: '1875', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'down', extra: { Pts: '1874.82' } },
  { rank: 4,  name: 'Inglaterra',     abbr: 'ENG', value: '1826', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'flat', extra: { Pts: '1825.97' } },
  { rank: 5,  name: 'Portugal',       abbr: 'POR', value: '1764', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'up',   extra: { Pts: '1763.83' } },
  { rank: 6,  name: 'Brasil',         abbr: 'BRA', value: '1761', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'down', extra: { Pts: '1761.16' } },
  { rank: 7,  name: 'Países Bajos',   abbr: 'NED', value: '1758', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'flat', extra: { Pts: '1757.87' } },
  { rank: 8,  name: 'Marruecos',      abbr: 'MAR', value: '1757', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'up',   extra: { Pts: '1756.80' } },
  { rank: 9,  name: 'Bélgica',        abbr: 'BEL', value: '1735', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'down', extra: { Pts: '1734.72' } },
  { rank: 10, name: 'Alemania',       abbr: 'GER', value: '1730', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'up',   extra: { Pts: '1730.37' } },
]

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

async function fetchFedExCup(): Promise<StandingRow[]> {
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/pga/statistics', { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const d = await res.json()
    const stats = d.stats as Record<string, unknown>
    const cats = (stats?.categories as Record<string, unknown>[]) ?? []
    const fedex = cats.find(c => (c as Record<string, unknown>).name === 'cupPoints') as Record<string, unknown> | undefined
    if (!fedex) return []
    const season = (d.season as Record<string, unknown>)?.year ?? ''
    const leaders = (fedex.leaders as Record<string, unknown>[]) ?? []
    return leaders.slice(0, 10).map((l, i) => {
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
  } catch (err) {
    console.error('[standings] FedEx Cup failed:', err)
    return []
  }
}

// ── Coaches win-rate via ESPN team records ────────────────────────────────────
// Update coach names here when managers change. Win% auto-fetches from ESPN.

const COACH_CONFIG = [
  { name: 'Hansi Flick',     team: 'FC Barcelona',  flag: '🇩🇪', league: 'esp.1', teamId: '83'   },
  { name: 'Vincent Kompany', team: 'Bayern Munich', flag: '🇧🇪', league: 'ger.1', teamId: '132'  },
  { name: 'Luis Enrique',    team: 'PSG',           flag: '🇪🇸', league: 'fra.1', teamId: '160'  },
  { name: 'Pep Guardiola',   team: 'Man City',      flag: '🇪🇸', league: 'eng.1', teamId: '382'  },
  { name: 'Mikel Arteta',    team: 'Arsenal',       flag: '🇪🇸', league: 'eng.1', teamId: '359'  },
  { name: 'Diego Simeone',   team: 'Atlético',      flag: '🇦🇷', league: 'esp.1', teamId: '1068' },
  { name: 'Arne Slot',       team: 'Liverpool',     flag: '🇳🇱', league: 'eng.1', teamId: '364'  },
]

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
        sub:   `Temp. 25/26 · ${gpFull} PJ`,
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

// ── GET ───────────────────────────────────────────────────────────────────────

const SPORT_KEYS: Record<string, (keyof StatsStandingsResponse)[]> = {
  futbol: ['football'],
  football: ['football'],
  nba: ['nbaEast', 'nbaWest', 'nbaScoring', 'nbaRebounds', 'nbaAssists', 'nbaBlocks', 'nbaSteals', 'nbaEfficiency', 'nba3ptMade'],
  f1: ['f1Drivers', 'f1Constructors', 'f1Poles', 'f1FastestLaps'],
  tenis: ['atpRanking', 'wtaRanking'],
  tennis: ['atpRanking', 'wtaRanking'],
  ufc: ['ufcP4P'],
  selecciones: ['fifaRanking', 'nationsLeague'],
  femenino: ['womenLigaF', 'womenGoals', 'womenAssists'],
  golf: ['pgaTourLeaderboard', 'pgaFedExCup'],
}

async function buildPayload(): Promise<StatsStandingsResponse> {
  const [footballResults, f1, nba, nbaSeason, tennis, ufcP4P, womenLigaF, womenStats, pga, nationsLeague, fedExCup, coaches] = await Promise.all([
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
  ])
  const nbaLeaders = await fetchNBALeaders(nbaSeason)

  const football = footballResults
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter(Boolean) as LeagueStandings[]

  const now = new Date().toISOString()
  const live = (source: string): BlockMeta => ({ status: 'live', source, fetchedAt: now })
  const unavail = (source: string): BlockMeta => ({ status: 'unavailable', source, fetchedAt: now })
  const histor = (source: string, asOf: string): BlockMeta => ({ status: 'historical', source, fetchedAt: now, asOf })

  const meta: Record<string, BlockMeta> = {
    football:        live('ESPN'),
    f1Drivers:       f1.drivers.length      ? live(`Jolpica · ${f1.season} R${f1.round}`) : unavail('Jolpica'),
    f1Constructors:  f1.constructors.length ? live(`Jolpica · ${f1.season} R${f1.round}`) : unavail('Jolpica'),
    f1Poles:         f1.poles.length        ? live(`Jolpica · ${f1.season}`)              : unavail('Jolpica'),
    f1FastestLaps:   f1.fastestLaps.length  ? live(`Jolpica · ${f1.season}`)              : unavail('Jolpica'),
    nbaEast:         nba.east.length        ? live('ESPN')          : unavail('ESPN'),
    nbaWest:         nba.west.length        ? live('ESPN')          : unavail('ESPN'),
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
    ufcP4P:              unavail('ESPN (endpoint obsoleto)'),
    womenLigaF:          womenLigaF.length             ? live('ESPN') : unavail('ESPN'),
    womenGoals:          womenStats.goals.length       ? live('ESPN') : unavail('ESPN'),
    womenAssists:        womenStats.assists.length     ? live('ESPN') : unavail('ESPN'),
    pgaTourLeaderboard:  pga.leaderboard.length
      ? pga.isLive      ? live(`ESPN · ${pga.tournamentName}`)
      : pga.isCompleted ? ({ status: 'stale', source: `ESPN · ${pga.tournamentName}`, fetchedAt: now, asOf: 'Final' } satisfies BlockMeta)
      :                   unavail('ESPN')
      : unavail('ESPN'),
    pgaFedExCup:         fedExCup.length ? live('ESPN') : unavail('ESPN'),
    nationsLeague:       nationsLeague.length ? live('ESPN · UEFA Nations League') : unavail('ESPN · Nations League no iniciada'),
    coachesWinRate:      coaches.length ? live('ESPN') : unavail('ESPN'),
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
    meta,
    updatedAt:           now,
  }
}

export async function getStandingsData(): Promise<StatsStandingsResponse> {
  const now = Date.now()
  if (cache && now - cache.ts < CACHE_TTL) return cache.data
  const data = await buildPayload()
  cache = { data, ts: now }
  return data
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
