import { NextRequest, NextResponse } from 'next/server'
import { SOCCER_LEAGUES, EUROPEAN_CUPS } from '@/lib/stats-leagues'
import {
  FIFA_RANKING, FIFA_RANKING_AS_OF, UFC_P4P, UFC_P4P_AS_OF,
  type StandingRow,
} from '@/lib/stats-editorial'
export type { StandingRow } from '@/lib/stats-editorial'
import { withStaleFallback, tfetch } from '@/lib/stats-cache'
import { espnStandingsSchema, jolpicaDriverStandingsSchema, safeParse } from '@/lib/stats-schemas'
import { loadAllSnapshots, type StatSnapshot } from '@/lib/stat-snapshots'
import { UFC_DIVISIONS } from '@/lib/ufc-scraper'

const staleSet = new Set<string>()

export interface LeagueStandings {
  id: string
  label: string
  rows: StandingRow[]
  /** ESPN slug (e.g. "soccer/esp.1") — lets the client build /equipo deep-links. */
  leagueSlug?: string
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
  ufcChampions: StandingRow[]
  // Rankings por división — Record<blockId, rows> para evitar 11 fields explícitos.
  // Las 11 keys posibles vienen de UFC_DIVISIONS en src/lib/ufc-scraper.ts.
  ufcDivisions: Record<string, StandingRow[]>
  womenLigaF: StandingRow[]
  womenGoals: StandingRow[]
  womenAssists: StandingRow[]
  worldCup: LeagueStandings[]
  worldCupKnockout: StandingRow[]
  worldCupSchedule: StandingRow[]
  uclFixtures: StandingRow[]
  uelFixtures: StandingRow[]
  // ── nuevos automatizados ────────────────────────────────────────────
  f1Calendar: StandingRow[]
  f1Sprints: StandingRow[]
  nbaMvpRace: StandingRow[]
  nbaDpoyRace: StandingRow[]
  nbaRookieRace: StandingRow[]
  uclScorers: StandingRow[]
  uelScorers: StandingRow[]
  uclAssists: StandingRow[]
  uelAssists: StandingRow[]
  worldCupQualified: StandingRow[]
  motogpRiders: StandingRow[]
  motogpConstructors: StandingRow[]
  meta: Record<string, BlockMeta>
  updatedAt: string
}

// force-dynamic: esta ruta NO se prerendea en build. Crítico — durante
// Roland Garros (jun 2026) los scoreboards de tenis de ESPN superan 2MB,
// Next no puede cachearlos, y los ~1000 renders paralelos del build
// re-fetchean en cascada saturando ESPN → la ruta excede el límite de 60s
// de Vercel y ROMPE TODO el build. La ruta solo se consume client-side
// (la página /estadisticas la llama por fetch), así que generarla on-demand
// es correcto. Las fetches internas conservan su `next:{revalidate}` para
// cachear los datos en runtime. (fix jun 2026, deploys rotos 23h)
export const dynamic = 'force-dynamic'

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
      // Trae las entries de una temporada (sin param = la "actual" según ESPN).
      const grab = async (season?: number) => {
        const url = season ? `${BASE}/${slug}/standings?season=${season}` : `${BASE}/${slug}/standings`
        const res = await tfetch(url, { next: { revalidate: 1800 } })
        if (!res.ok) throw new Error(`espn ${res.status}`)
        const json = await res.json()
        const parsed = safeParse(espnStandingsSchema, json, `football:${slug}`)
        const yr = typeof json?.season === 'number' ? json.season : (json?.season?.year as number | undefined)
        return { entries: parsed?.children?.[0]?.standings?.entries ?? [], yr }
      }
      const first = await grab()
      let entries = first.entries
      // Offseason rollover: ESPN pasa la liga a la nueva temporada (0 partidos →
      // tabla vacía) mientras la anterior sigue siendo la relevante. Caemos a
      // season-1 para no perder la tabla. Ocurre escalonado may-jul → blinda a las
      // 5 grandes ligas. (fix Serie A jun 2026: ESPN rotó ita.1 a 2026-27 el 5-jun)
      if (!entries.length && first.yr) entries = (await grab(first.yr - 1)).entries
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
          extra: {
            V: String(w), E: String(d), D: String(l),
            GF: String(Math.round(gf)), GC: String(Math.round(gc)),
            DG: `${gd >= 0 ? '+' : ''}${Math.round(gd)}`,
          },
          teamId: team?.id,
          logo: team?.id ? `https://a.espncdn.com/i/teamlogos/soccer/500/${team.id}.png` : undefined,
        }
      })
      return { id, label, rows, leagueSlug: slug }
    },
    fallback,
  )
  if (result.stale) staleSet.add(id)
  else staleSet.delete(id)   // se recuperó: deja de marcarlo stale (antes quedaba pegado)
  return result.data
}

// ── F1 via Jolpica/Ergast (more accurate + dynamic season) ────────────────────

interface JolpicaDriver { givenName: string; familyName: string; nationality: string; code?: string }
interface JolpicaCtor  { name: string; constructorId?: string }

interface F1Result {
  drivers: StandingRow[]
  constructors: StandingRow[]
  poles: StandingRow[]
  season: string
  round: string
}

const CTOR_ABBR: Record<string, string> = {
  mercedes: 'MER', ferrari: 'FER', red_bull: 'RBR', mclaren: 'MCL', aston_martin: 'AST',
  alpine: 'ALP', williams: 'WIL', haas: 'HAA', sauber: 'SAU', rb: 'RB',
  kick_sauber: 'SAU', cadillac: 'CAD',
}

async function fetchF1All(): Promise<F1Result> {
  const empty: F1Result = { drivers: [], constructors: [], poles: [], season: '', round: '' }
  try {
    const dr = await tfetch('https://api.jolpi.ca/ergast/f1/current/driverstandings.json', { next: { revalidate: 3600 } })
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

    const cr = await tfetch('https://api.jolpi.ca/ergast/f1/current/constructorstandings.json', { next: { revalidate: 3600 } })
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

    const poles = await fetchF1Poles(season)

    return { drivers, constructors, poles, season, round }
  } catch (err) {
    console.error('[standings] F1 (Jolpica) failed:', err)
    return empty
  }
}

async function fetchF1Poles(season: string): Promise<StandingRow[]> {
  if (!season) return []
  try {
    const res = await tfetch(`https://api.jolpi.ca/ergast/f1/${season}/qualifying.json?limit=100`, { next: { revalidate: 86400 } })
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

// ── NBA via ESPN ──────────────────────────────────────────────────────────────

async function fetchNBA(): Promise<{ east: StandingRow[]; west: StandingRow[] }> {
  const fallback = { east: [] as StandingRow[], west: [] as StandingRow[] }
  const result = await withStaleFallback<{ east: StandingRow[]; west: StandingRow[] }>(
    'nba:standings',
    30 * 60_000,
    async () => {
      const res = await tfetch(`${BASE}/basketball/nba/standings`, { next: { revalidate: 1800 } })
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
        const logos = (team?.logos as { href?: string }[] | undefined) ?? []
        return {
          seed,
          name: (team?.displayName as string) ?? '—',
          abbr: (team?.abbreviation as string) ?? '',
          w, l, ppg, streak,
          teamId: team?.id as string | undefined,
          logo: logos[0]?.href,
        }
      }).sort((a, b) => a.seed - b.seed)
      return mapped.map((r, i) => ({
        rank: i + 1, name: r.name, abbr: r.abbr,
        value: `${r.w}-${r.l}`, sub: `${i + 1}º ${confLabel}`, trend: 'flat' as const,
        extra: { PPG: r.ppg, Racha: r.streak },
        teamId: r.teamId,
        logo: r.logo,
      }))
    }

      return { east: parse(children[0] as Record<string, unknown>, 'Este'), west: parse(children[1] as Record<string, unknown>, 'Oeste') }
    },
    fallback,
  )
  if (result.stale) { staleSet.add('nbaEast'); staleSet.add('nbaWest') }
  else { staleSet.delete('nbaEast'); staleSet.delete('nbaWest') }
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

async function fetchNBAStatCategory(stat: string, season: string, scope: 'S' | 'Rookies' = 'S'): Promise<StandingRow[]> {
  try {
    const res = await tfetch(
      `https://stats.nba.com/stats/leagueleaders?LeagueID=00&PerMode=PerGame&Scope=${scope}&Season=${season}&SeasonType=Regular+Season&StatCategory=${stat}`,
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

type NbaLeaders = {
  scoring: StandingRow[]; rebounds: StandingRow[]; assists: StandingRow[]
  blocks: StandingRow[]; steals: StandingRow[]; efficiency: StandingRow[]; threePt: StandingRow[]
}

// ── Fallback GRATIS de líderes NBA vía ESPN ──────────────────────────────────
// stats.nba.com bloquea con 403 las IPs de datacenter (Vercel) de forma
// intermitente. Cuando eso pasa, en vez de dejar los bloques NBA "no disponible"
// caemos a la API pública de ESPN (que no bloquea a Vercel). ESPN no expone
// "efficiency", así que ese único bloque se queda como esté en ese caso.
const ESPN_NBA_LEADERS: { key: keyof NbaLeaders; sort: string; group: string; stat: string }[] = [
  { key: 'scoring',  sort: 'offensive.avgPoints',                   group: 'offensive', stat: 'avgPoints' },
  { key: 'rebounds', sort: 'general.avgRebounds',                   group: 'general',   stat: 'avgRebounds' },
  { key: 'assists',  sort: 'offensive.avgAssists',                  group: 'offensive', stat: 'avgAssists' },
  { key: 'blocks',   sort: 'defensive.avgBlocks',                   group: 'defensive', stat: 'avgBlocks' },
  { key: 'steals',   sort: 'defensive.avgSteals',                   group: 'defensive', stat: 'avgSteals' },
  { key: 'threePt',  sort: 'offensive.avgThreePointFieldGoalsMade', group: 'offensive', stat: 'avgThreePointFieldGoalsMade' },
]

async function fetchEspnNbaLeaderCategory(sort: string, group: string, stat: string): Promise<StandingRow[]> {
  try {
    const res = await tfetch(
      `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&limit=15&sort=${sort}:desc`,
      { next: { revalidate: 3600 } },
    )
    if (!res.ok) return []
    const json = (await res.json()) as {
      categories?: { name: string; names?: string[] }[]
      athletes?: { athlete?: { displayName?: string; teamShortName?: string }; categories?: { name: string; totals?: string[] }[] }[]
    }
    // El índice de la columna se deriva de los `names` de la propia respuesta
    // (robusto ante reordenamientos de ESPN), no de un índice hardcodeado.
    const idx = ((json.categories ?? []).find(c => c.name === group)?.names ?? []).indexOf(stat)
    if (idx < 0) return []
    return (json.athletes ?? []).slice(0, 10).map((a, i) => {
      const totals = a.categories?.find(c => c.name === group)?.totals ?? []
      const num = parseFloat(totals[idx] ?? '')
      const team = a.athlete?.teamShortName ?? ''
      return {
        rank:  i + 1,
        name:  a.athlete?.displayName ?? '—',
        abbr:  team,
        value: Number.isFinite(num) ? (num % 1 === 0 ? String(num) : num.toFixed(1)) : '—',
        sub:   team,
        trend: 'flat' as const,
        extra: {},
      }
    })
  } catch (err) {
    console.error(`[standings] ESPN NBA leaders (${sort}) failed:`, err)
    return []
  }
}

async function fetchEspnNbaLeaders(): Promise<Partial<NbaLeaders>> {
  const rows = await Promise.all(ESPN_NBA_LEADERS.map(l => fetchEspnNbaLeaderCategory(l.sort, l.group, l.stat)))
  const out: Partial<NbaLeaders> = {}
  ESPN_NBA_LEADERS.forEach((l, i) => { out[l.key] = rows[i] })
  return out
}

async function fetchNBALeaders(season: string): Promise<NbaLeaders> {
  const [scoring, rebounds, assists, blocks, steals, efficiency, threePt] = await Promise.all([
    fetchNBAStatCategory('PTS', season),
    fetchNBAStatCategory('REB', season),
    fetchNBAStatCategory('AST', season),
    fetchNBAStatCategory('BLK', season),
    fetchNBAStatCategory('STL', season),
    fetchNBAStatCategory('EFF', season),
    fetchNBAStatCategory('FG3M', season),
  ])
  // NBA.com 403 desde Vercel → todo vacío. Caemos a ESPN (gratis) por bloque.
  if (!scoring.length && !rebounds.length && !assists.length) {
    const espn = await fetchEspnNbaLeaders()
    return {
      scoring:  espn.scoring?.length  ? espn.scoring  : scoring,
      rebounds: espn.rebounds?.length ? espn.rebounds : rebounds,
      assists:  espn.assists?.length  ? espn.assists  : assists,
      blocks:   espn.blocks?.length   ? espn.blocks   : blocks,
      steals:   espn.steals?.length   ? espn.steals   : steals,
      efficiency, // ESPN no expone efficiency
      threePt:  espn.threePt?.length  ? espn.threePt  : threePt,
    }
  }
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
    const res = await tfetch(`${BASE}/soccer/esp.w.1/standings`, { next: { revalidate: 3600 } })
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
    const res = await tfetch('https://site.api.espn.com/apis/site/v2/sports/soccer/esp.w.1/statistics', { next: { revalidate: 3600 } })
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
      const res = await tfetch(`https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/rankings`, { next: { revalidate: 1800 } })
      if (!res.ok) return []
      const json = await res.json()
      const ranks: Record<string, unknown>[] = (json?.rankings?.[0]?.ranks as Record<string, unknown>[]) ?? []
      return ranks.slice(0, 10).map(r => {
        const ath = r.athlete as Record<string, unknown>
        const cc = (ath?.citizenshipCountry as string | undefined)?.toLowerCase() ?? ''
        return {
          rank:  Number(r.current ?? 99),
          name:  (ath?.displayName as string) ?? '—',
          abbr:  cc.toUpperCase(),
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

// ── World Cup 2026 via ESPN ───────────────────────────────────────────────────

async function fetchWorldCup(): Promise<LeagueStandings[]> {
  try {
    const res = await tfetch(`${BASE}/soccer/fifa.world/standings`, { next: { revalidate: 1800 } })
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
        const espnName = (team?.displayName as string) ?? '—'
        const m = nationMeta(espnName)
        return {
          rank: i + 1,
          name: m?.es ?? espnName,
          abbr: (team?.abbreviation as string) ?? '',
          value: String(Math.round(pts)),
          sub:   pj > 0 ? `${pj} PJ · ${gd >= 0 ? '+' : ''}${Math.round(gd)}` : 'Sin jugar',
          trend: 'flat' as const,
          extra: { PJ: String(Math.round(pj)), V: String(w), E: String(d), D: String(l), GF: String(Math.round(gf)), GC: String(Math.round(gc)) },
          flag: m?.flag,
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
    const res = await tfetch(
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
    const res = await tfetch(
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

// ── European cups: top scorers & assists vía ESPN /statistics ────────────────
// Funciona para uefa.champions, uefa.europa, uefa.conference. Devuelve top 10
// goleadores (o asistentes según `kind`).
interface EspnLeader {
  displayValue?: string
  value?: number
  athlete?: { displayName?: string; team?: { displayName?: string; abbreviation?: string } }
}
interface EspnStatCat { name?: string; displayName?: string; leaders?: EspnLeader[] }

async function fetchEuropeanCupLeaders(
  slug: string,
  kind: 'goals' | 'assists',
): Promise<StandingRow[]> {
  try {
    const res = await tfetch(
      `https://site.api.espn.com/apis/site/v2/sports/${slug}/statistics`,
      { next: { revalidate: 1800 } },
    )
    if (!res.ok) return []
    const json = await res.json() as { stats?: EspnStatCat[] }
    const cats = json.stats ?? []
    const target = kind === 'goals' ? 'Goals' : 'Assists'
    const cat = cats.find(c => c.displayName === target || c.name === kind)
    const leaders = cat?.leaders ?? []
    return leaders.slice(0, 10).map((l, i) => ({
      rank: i + 1,
      name: l.athlete?.displayName ?? '—',
      abbr: l.athlete?.team?.abbreviation ?? l.athlete?.team?.displayName ?? '',
      value: String(Math.round(l.value ?? 0)),
      sub: l.athlete?.team?.displayName ?? '',
      trend: 'flat' as const,
      extra: {},
    }))
  } catch {
    return []
  }
}


// ── F1 Calendar ───────────────────────────────────────────────────────────────

async function fetchF1Calendar(season: string): Promise<StandingRow[]> {
  if (!season) return []
  try {
    const res = await tfetch(`https://api.jolpi.ca/ergast/f1/${season}.json`, { next: { revalidate: 86400 } })
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

// ── F1 Sprints — leaderboard de victorias en sprint (vía Jolpica) ────────────

async function fetchF1Sprints(season: string): Promise<StandingRow[]> {
  if (!season) return []
  try {
    const res = await tfetch(`https://api.jolpi.ca/ergast/f1/${season}/sprint.json?limit=100`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) return []
    const json = await res.json()
    const races = (json.MRData?.RaceTable?.Races ?? []) as Record<string, unknown>[]
    if (!races.length) return []

    // Agregamos por piloto: victorias + podios en sprint.
    type Acc = { wins: number; podiums: number; lastDate: string; flag?: string; constructor?: string }
    const byDriver = new Map<string, Acc>()
    for (const race of races) {
      const results = (race.SprintResults ?? []) as Record<string, unknown>[]
      const date = String(race.date ?? '')
      for (const r of results) {
        const pos = parseInt(String(r.position))
        if (!Number.isFinite(pos) || pos > 3) continue
        const driver = r.Driver as Record<string, unknown>
        const constructor = (r.Constructor as Record<string, unknown> | undefined)?.name as string | undefined
        const name = `${driver.givenName} ${driver.familyName}`
        const cur = byDriver.get(name) ?? { wins: 0, podiums: 0, lastDate: '', constructor }
        if (pos === 1) cur.wins++
        cur.podiums++
        if (date > cur.lastDate) cur.lastDate = date
        if (!cur.constructor && constructor) cur.constructor = constructor
        byDriver.set(name, cur)
      }
    }

    const rows = Array.from(byDriver.entries())
      .filter(([, v]) => v.podiums > 0)
      .sort((a, b) => b[1].wins - a[1].wins || b[1].podiums - a[1].podiums)
      .slice(0, 10)
      .map(([name, v], i) => ({
        rank: i + 1,
        name,
        abbr: v.constructor ?? '',
        value: String(v.wins),
        sub: `${v.podiums} podio${v.podiums !== 1 ? 's' : ''} · Temp. ${season}`,
        trend: 'flat' as const,
        extra: { Vic: String(v.wins), Podios: String(v.podiums) },
      }))
    return rows
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

function buildNbaDpoyRace(blocks: StandingRow[], steals: StandingRow[]): StandingRow[] {
  // Pool combinado de líderes en bloqueos + robos.
  // Score defensivo = bloqueos*1.5 + robos. Pondera bloqueos un 50% más
  // (alineado con peso histórico DPOY: tradicionalmente premia rim protection).
  const pool = new Map<string, { name: string; team: string; flag?: string; bpg: number; spg: number }>()
  const upsert = (row: StandingRow, kind: 'bpg' | 'spg') => {
    const v = parseFloat(row.value) || 0
    const cur = pool.get(row.name) ?? { name: row.name, team: row.abbr ?? '', flag: row.flag, bpg: 0, spg: 0 }
    cur[kind] = v
    if (!cur.team && row.abbr) cur.team = row.abbr
    if (!cur.flag && row.flag) cur.flag = row.flag
    pool.set(row.name, cur)
  }
  blocks.forEach(r => upsert(r, 'bpg'))
  steals.forEach(r => upsert(r, 'spg'))
  if (!pool.size) return []
  const arr = Array.from(pool.values())
    .map(r => ({ ...r, score: r.bpg * 1.5 + r.spg }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 7)
  return arr.map((r, i) => ({
    rank: i + 1, name: r.name, abbr: r.team,
    value: `#${i + 1}`,
    sub: `${r.bpg.toFixed(1)} BPG · ${r.spg.toFixed(1)} SPG`,
    flag: r.flag,
    trend: 'flat' as const,
    extra: { BPG: r.bpg.toFixed(1), SPG: r.spg.toFixed(1), Equipo: r.team },
  }))
}

// ROY Race: ahora usa NBA.com con Scope=Rookies (filtrado server-side, no
// dependemos de mantener un Set hardcoded de nombres del Draft cada año).
async function fetchNbaRookieRace(season: string): Promise<StandingRow[]> {
  const [scoring, rebounds, assists] = await Promise.all([
    fetchNBAStatCategory('PTS', season, 'Rookies'),
    fetchNBAStatCategory('REB', season, 'Rookies'),
    fetchNBAStatCategory('AST', season, 'Rookies'),
  ])
  if (!scoring.length) return []
  const pool = new Map<string, { name: string; team: string; ppg: number; rpg: number; apg: number }>()
  const upsert = (row: StandingRow, kind: 'ppg' | 'rpg' | 'apg') => {
    const v = parseFloat(row.value) || 0
    const cur = pool.get(row.name) ?? { name: row.name, team: row.abbr ?? '', ppg: 0, rpg: 0, apg: 0 }
    cur[kind] = v
    if (!cur.team && row.abbr) cur.team = row.abbr
    pool.set(row.name, cur)
  }
  scoring.forEach(r => upsert(r, 'ppg'))
  rebounds.forEach(r => upsert(r, 'rpg'))
  assists.forEach(r => upsert(r, 'apg'))
  // Composite score: PPG + RPG + 1.5*APG (assists weighted higher per ROY tradition).
  return Array.from(pool.values())
    .map(r => ({ ...r, score: r.ppg + r.rpg + r.apg * 1.5 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 7)
    .map((r, i) => ({
      rank: i + 1, name: r.name, abbr: r.team,
      value: `#${i + 1}`,
      sub: `${r.ppg} PPG · ${r.rpg} RPG · ${r.apg} APG`,
      trend: 'flat' as const,
      extra: { PPG: String(r.ppg), Equipo: r.team },
    }))
}

// ── World Cup qualified (derivado de FIFA ranking + anfitriones) ──────────────

// Las 48 selecciones del Mundial 2026 + sinónimos en español. ESPN devuelve
// nombres en inglés en /standings; los aliases en español sirven para otras
// llamadas (FIFA ranking, etc.). Una sola fuente para bandera, confederación
// y nombre mostrado en español.
interface NationMeta { flag: string; confed: string; es?: string }
const WC_NATIONS: Record<string, NationMeta> = {
  // CONCACAF
  Mexico:           { flag: '🇲🇽', confed: 'CONCACAF', es: 'México' },
  Canada:           { flag: '🇨🇦', confed: 'CONCACAF', es: 'Canadá' },
  'United States':  { flag: '🇺🇸', confed: 'CONCACAF', es: 'EEUU' },
  Haiti:            { flag: '🇭🇹', confed: 'CONCACAF', es: 'Haití' },
  Panama:           { flag: '🇵🇦', confed: 'CONCACAF', es: 'Panamá' },
  Curaçao:          { flag: '🇨🇼', confed: 'CONCACAF', es: 'Curazao' },
  Curacao:          { flag: '🇨🇼', confed: 'CONCACAF', es: 'Curazao' },
  // CONMEBOL
  Argentina:        { flag: '🇦🇷', confed: 'CONMEBOL' },
  Brazil:           { flag: '🇧🇷', confed: 'CONMEBOL', es: 'Brasil' },
  Uruguay:          { flag: '🇺🇾', confed: 'CONMEBOL' },
  Colombia:         { flag: '🇨🇴', confed: 'CONMEBOL' },
  Ecuador:          { flag: '🇪🇨', confed: 'CONMEBOL' },
  Paraguay:         { flag: '🇵🇾', confed: 'CONMEBOL' },
  // UEFA
  Czechia:          { flag: '🇨🇿', confed: 'UEFA', es: 'Chequia' },
  Switzerland:      { flag: '🇨🇭', confed: 'UEFA', es: 'Suiza' },
  Scotland:         { flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', confed: 'UEFA', es: 'Escocia' },
  Turkey:           { flag: '🇹🇷', confed: 'UEFA', es: 'Turquía' },
  Türkiye:          { flag: '🇹🇷', confed: 'UEFA', es: 'Turquía' },
  Germany:          { flag: '🇩🇪', confed: 'UEFA', es: 'Alemania' },
  Netherlands:      { flag: '🇳🇱', confed: 'UEFA', es: 'Países Bajos' },
  Sweden:           { flag: '🇸🇪', confed: 'UEFA', es: 'Suecia' },
  Belgium:          { flag: '🇧🇪', confed: 'UEFA', es: 'Bélgica' },
  Spain:            { flag: '🇪🇸', confed: 'UEFA', es: 'España' },
  Norway:           { flag: '🇳🇴', confed: 'UEFA', es: 'Noruega' },
  France:           { flag: '🇫🇷', confed: 'UEFA', es: 'Francia' },
  Austria:          { flag: '🇦🇹', confed: 'UEFA' },
  Portugal:         { flag: '🇵🇹', confed: 'UEFA' },
  England:          { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', confed: 'UEFA', es: 'Inglaterra' },
  Croatia:          { flag: '🇭🇷', confed: 'UEFA', es: 'Croacia' },
  'Bosnia-Herzegovina': { flag: '🇧🇦', confed: 'UEFA', es: 'Bosnia-Herzegovina' },
  // AFC
  'South Korea':    { flag: '🇰🇷', confed: 'AFC', es: 'Corea del Sur' },
  Qatar:            { flag: '🇶🇦', confed: 'AFC' },
  Japan:            { flag: '🇯🇵', confed: 'AFC', es: 'Japón' },
  Iran:             { flag: '🇮🇷', confed: 'AFC', es: 'Irán' },
  'Saudi Arabia':   { flag: '🇸🇦', confed: 'AFC', es: 'Arabia Saudí' },
  Iraq:             { flag: '🇮🇶', confed: 'AFC', es: 'Irak' },
  Jordan:           { flag: '🇯🇴', confed: 'AFC', es: 'Jordania' },
  Uzbekistan:       { flag: '🇺🇿', confed: 'AFC', es: 'Uzbekistán' },
  Australia:        { flag: '🇦🇺', confed: 'AFC' },
  // CAF
  'South Africa':   { flag: '🇿🇦', confed: 'CAF', es: 'Sudáfrica' },
  Morocco:          { flag: '🇲🇦', confed: 'CAF', es: 'Marruecos' },
  'Ivory Coast':    { flag: '🇨🇮', confed: 'CAF', es: 'Costa de Marfil' },
  "Côte d'Ivoire":  { flag: '🇨🇮', confed: 'CAF', es: 'Costa de Marfil' },
  Tunisia:          { flag: '🇹🇳', confed: 'CAF', es: 'Túnez' },
  Egypt:            { flag: '🇪🇬', confed: 'CAF', es: 'Egipto' },
  'Cape Verde':     { flag: '🇨🇻', confed: 'CAF', es: 'Cabo Verde' },
  'Cabo Verde':     { flag: '🇨🇻', confed: 'CAF', es: 'Cabo Verde' },
  Senegal:          { flag: '🇸🇳', confed: 'CAF' },
  Algeria:          { flag: '🇩🇿', confed: 'CAF', es: 'Argelia' },
  'DR Congo':       { flag: '🇨🇩', confed: 'CAF', es: 'Congo RD' },
  'Congo DR':       { flag: '🇨🇩', confed: 'CAF', es: 'Congo RD' },
  Ghana:            { flag: '🇬🇭', confed: 'CAF' },
  // OFC
  'New Zealand':    { flag: '🇳🇿', confed: 'OFC', es: 'Nueva Zelanda' },
}

// Lookup directo por nombre ESPN (inglés) o por su traducción ES.
const WC_NATIONS_BY_ES: Record<string, NationMeta> = Object.fromEntries(
  Object.values(WC_NATIONS).filter(m => m.es).map(m => [m.es!, m]),
)
function nationMeta(name: string): NationMeta | undefined {
  return WC_NATIONS[name] ?? WC_NATIONS_BY_ES[name]
}

// Aplana las 48 selecciones reales del Mundial 2026 (las que ESPN ya devuelve
// en /standings, distribuidas en 12 grupos). Una sola fuente de verdad.
function buildWorldCupQualifiedFromStandings(groups: LeagueStandings[]): StandingRow[] {
  const out: StandingRow[] = []
  let rank = 1
  for (const g of groups) {
    const letter = g.label.replace(/^Grupo\s+/i, '')
    for (const r of g.rows) {
      const m = nationMeta(r.name)
      out.push({
        rank: rank++,
        name: m?.es ?? r.name,
        abbr: r.abbr,
        value: `Grupo ${letter}`,
        sub: r.sub === 'Sin jugar' ? 'Clasificada' : r.sub,
        flag: m?.flag ?? r.flag ?? '',
        trend: 'flat',
        extra: { Confed: m?.confed ?? '—' },
      })
    }
  }
  return out
}

// Próximos partidos del Mundial 2026 (≤ 14 días). Antes del 11-jun: vacío;
// después: muestra los partidos del bloque del día y siguientes.
async function fetchWorldCupSchedule(): Promise<StandingRow[]> {
  try {
    const now = new Date()
    const start = now < new Date('2026-06-11') ? new Date('2026-06-11') : now
    const end = new Date(start.getTime() + 14 * 86400_000)
    const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
    const res = await tfetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${fmt(start)}-${fmt(end)}`,
      { next: { revalidate: 600 } },
    )
    if (!res.ok) return []
    const json = await res.json()
    const events = (json.events as Record<string, unknown>[]) ?? []
    const rows: StandingRow[] = []
    for (const ev of events.slice(0, 12)) {
      const comp = ((ev.competitions as Record<string, unknown>[])?.[0]) as Record<string, unknown> | undefined
      const cs = (comp?.competitors as Record<string, unknown>[]) ?? []
      if (cs.length < 2) continue
      const home = cs.find(c => (c as Record<string, unknown>).homeAway === 'home') ?? cs[0]
      const away = cs.find(c => (c as Record<string, unknown>).homeAway === 'away') ?? cs[1]
      const hTeam = (home.team as Record<string, unknown>)?.displayName as string
      const aTeam = (away.team as Record<string, unknown>)?.displayName as string
      if (!hTeam || !aTeam) continue
      const hEs = nationMeta(hTeam)?.es ?? hTeam
      const aEs = nationMeta(aTeam)?.es ?? aTeam
      const venue = ((comp?.venue as Record<string, unknown>)?.fullName as string) ?? ''
      const dateStr = (ev.date as string) ?? ''
      const d = dateStr ? new Date(dateStr) : null
      const dateLabel = d
        ? d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })
        : '—'
      const timeLabel = d
        ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
        : ''
      rows.push({
        rank: rows.length + 1,
        name: `${hEs} vs ${aEs}`,
        abbr: '',
        value: timeLabel,
        sub: venue ? `${dateLabel} · ${venue}` : dateLabel,
        trend: 'flat',
        extra: {},
      })
    }
    return rows
  } catch { return [] }
}

// ── GET ───────────────────────────────────────────────────────────────────────

const SPORT_KEYS: Record<string, (keyof StatsStandingsResponse)[]> = {
  // Fútbol incluye TODAS las sub-secciones del sport (competiciones, selecciones, entrenadores, femenino).
  futbol: [
    'football',
    'uclFixtures', 'uelFixtures',
    'uclScorers', 'uelScorers',
    'uclAssists', 'uelAssists',
    'fifaRanking',
    'womenLigaF', 'womenGoals', 'womenAssists',
  ],
  football: ['football', 'uclScorers', 'uelScorers', 'uclAssists', 'uelAssists'],
  nba: ['nbaEast', 'nbaWest', 'nbaScoring', 'nbaRebounds', 'nbaAssists', 'nbaBlocks', 'nbaSteals', 'nbaEfficiency', 'nba3ptMade', 'nbaMvpRace', 'nbaDpoyRace', 'nbaRookieRace'],
  f1: ['f1Drivers', 'f1Constructors', 'f1Poles', 'f1Calendar', 'f1Sprints'],
  tenis: ['atpRanking', 'wtaRanking'],
  tennis: ['atpRanking', 'wtaRanking'],
  ufc: ['ufcP4P', 'ufcChampions', 'ufcDivisions'],
  selecciones: ['fifaRanking'],
  femenino: ['womenLigaF', 'womenGoals', 'womenAssists'],
  mundial: ['worldCup', 'worldCupKnockout', 'worldCupQualified', 'worldCupSchedule'],
  motogp: ['motogpRiders', 'motogpConstructors'],
}

async function buildPayload(): Promise<StatsStandingsResponse> {
  const [footballResults, f1, nba, nbaSeason, tennis, ufcP4P, womenLigaF, womenStats, worldCup, worldCupKnockout, worldCupSchedule, uclFixtures, uelFixtures] = await Promise.all([
    Promise.allSettled(FOOTBALL_LEAGUES.map(l => fetchFootball(l.slug, l.id, l.label))),
    fetchF1All(),
    fetchNBA(),
    Promise.resolve(nbaSeasonLabel()),
    fetchTennis(),
    fetchUFCP4P(),
    fetchWomenLigaF(),
    fetchWomenStats(),
    fetchWorldCup(),
    fetchWorldCupKnockout(),
    fetchWorldCupSchedule(),
    fetchEuropeanCupFixtures('soccer/uefa.champions'),
    fetchEuropeanCupFixtures('soccer/uefa.europa'),
  ])
  const [uclScorers, uelScorers, uclAssists, uelAssists] = await Promise.all([
    fetchEuropeanCupLeaders('soccer/uefa.champions',  'goals'),
    fetchEuropeanCupLeaders('soccer/uefa.europa',     'goals'),
    fetchEuropeanCupLeaders('soccer/uefa.champions',  'assists'),
    fetchEuropeanCupLeaders('soccer/uefa.europa',     'assists'),
  ])
  const nbaLeaders = await fetchNBALeaders(nbaSeason)
  const [f1Calendar, f1Sprints] = f1.season
    ? await Promise.all([fetchF1Calendar(f1.season), fetchF1Sprints(f1.season)])
    : [[], []] as [StandingRow[], StandingRow[]]
  const snapshots = await loadAllSnapshots()

  const football = footballResults
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter(Boolean) as LeagueStandings[]

  // Resuelve un bloque editorial: snapshot Supabase si existe, si no fallback hardcoded.
  // Devuelve también la metadata para ese bloque (source / asOf).
  const resolveSnapshot = (
    blockId: string,
    fallback: StandingRow[],
    fallbackSource: string,
    fallbackAsOf: string,
  ): { rows: StandingRow[]; snap: StatSnapshot | null } => {
    const snap = snapshots.get(blockId) ?? null
    if (snap && snap.rows.length > 0) return { rows: snap.rows, snap }
    return { rows: fallback, snap: null }
  }
  const ufcP4PR          = resolveSnapshot('ufc-p4p',             ufcP4P,              'UFC Rankings', UFC_P4P_AS_OF)
  const ufcChampionsR    = resolveSnapshot('ufc-campeones',       [],                  'UFC',          UFC_P4P_AS_OF)
  // 11 divisiones — cada blockId resuelve a su propio snapshot.
  const ufcDivisionsResolved = UFC_DIVISIONS.map(div => ({
    div,
    r: resolveSnapshot(div.blockId, [], `ufc.com · ${div.label}`, ''),
  }))
  const fifaR            = resolveSnapshot('ranking-fifa',        FIFA_RANKING,        'FIFA',         FIFA_RANKING_AS_OF)
  // El snapshot del Elo puede traer banderas regional-indicator inválidas para
  // subdivisiones británicas (England → 🇪🇳, que renderiza como letras "EN").
  // Forzamos la bandera canónica por nombre desde WC_NATIONS (nationMeta acepta
  // nombre en inglés y en español); el resto de selecciones conservan la suya.
  fifaR.rows = fifaR.rows.map(r => { const m = nationMeta(r.name); return m?.flag ? { ...r, flag: m.flag } : r })
  // MotoGP solo tiene datos vía cron Vercel → snapshot Supabase. Si snapshot
  // ausente, devuelve [] y meta='unavailable' (UI lo oculta con toggle).
  const motogpRidersR    = resolveSnapshot('motogp-pilotos',       [], 'motogp.com', '')
  const motogpConstructR = resolveSnapshot('motogp-constructores', [], 'motogp.com', '')

  // Derived blocks
  const nbaMvpRace = buildNbaMvpRace(nbaLeaders.scoring, nba.east, nba.west)
  const nbaDpoyRace = buildNbaDpoyRace(nbaLeaders.blocks, nbaLeaders.steals)
  const nbaRookieRace = await fetchNbaRookieRace(nbaSeason)
  const worldCupQualified = buildWorldCupQualifiedFromStandings(worldCup)

  const now = new Date().toISOString()
  const stale   = (source: string): BlockMeta => ({ status: 'stale', source, fetchedAt: now, asOf: 'caché reciente' })
  const live    = (source: string, key?: string): BlockMeta =>
    (key && staleSet.has(key)) ? stale(source) : ({ status: 'live', source, fetchedAt: now })
  const unavail = (source: string): BlockMeta => ({ status: 'unavailable', source, fetchedAt: now })
  // Snapshots (UFC/MotoGP/Elo desde el cron a Supabase): si llevan ≥ SNAP_STALE_DAYS
  // sin refrescarse (el cron semanal pudo fallar para ese bloque), no los etiquetamos
  // "live" — mostramos su antigüedad real para no presentar datos viejos como actuales.
  const SNAP_STALE_DAYS = 8
  const snapMeta = (snap: StatSnapshot): BlockMeta => {
    const days = Math.floor((Date.now() - new Date(snap.updatedAt).getTime()) / 86_400_000)
    return Number.isFinite(days) && days >= SNAP_STALE_DAYS
      ? { status: 'historical', source: snap.source, fetchedAt: now, asOf: `hace ${days} días` }
      : { status: 'live', source: snap.source, fetchedAt: now }
  }

  const wcStarted = worldCup.some(g => g.rows.some(r => r.sub !== 'Sin jugar'))

  const meta: Record<string, BlockMeta> = {
    // football meta is populated per-league below (each tabla- id can be stale independently)
    football:        live('ESPN'),
    f1Drivers:       f1.drivers.length      ? live(`Jolpica · ${f1.season} R${f1.round}`) : unavail('Jolpica'),
    f1Constructors:  f1.constructors.length ? live(`Jolpica · ${f1.season} R${f1.round}`) : unavail('Jolpica'),
    f1Poles:         f1.poles.length        ? live(`Jolpica · ${f1.season}`)              : unavail('Jolpica'),
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
    // Sin fallback hardcoded: si snapshot ausente → unavailable (no datos viejos disfrazados de live).
    fifaRanking:     fifaR.snap ? snapMeta(fifaR.snap) : unavail('Sin snapshot — esperando cron diario Elo'),
    ufcP4P:          ufcP4PR.snap ? snapMeta(ufcP4PR.snap) : unavail('Sin snapshot — esperando cron lunes UFC'),
    ufcChampions:    ufcChampionsR.snap ? snapMeta(ufcChampionsR.snap) : unavail('Sin snapshot — ejecutar cron UFC'),
    // Meta de cada división se inyecta debajo en el for-loop (no cabe aquí).
    womenLigaF:          womenLigaF.length             ? live('ESPN') : unavail('ESPN'),
    womenGoals:          womenStats.goals.length       ? live('ESPN') : unavail('ESPN'),
    womenAssists:        womenStats.assists.length     ? live('ESPN') : unavail('ESPN'),
    worldCup:         worldCup.length
      ? wcStarted ? live('ESPN · FIFA World Cup 2026') : ({ status: 'stale', source: 'ESPN · FIFA World Cup 2026', fetchedAt: now, asOf: 'Grupos confirmados — torneo inicia 11 jun 2026' } satisfies BlockMeta)
      : unavail('ESPN'),
    worldCupKnockout: worldCupKnockout.length
      ? worldCupKnockout.some(r => r.extra?.Estado === 'En juego') ? live('ESPN · FIFA World Cup 2026') : ({ status: 'stale', source: 'ESPN · FIFA World Cup 2026', fetchedAt: now, asOf: 'Partidos del día' } satisfies BlockMeta)
      : unavail('ESPN · Fase eliminatoria no iniciada'),
    uclFixtures: uclFixtures.length
      ? uclFixtures.some(r => r.extra?.Estado === 'En juego') ? live('ESPN · UEFA Champions League') : ({ status: 'stale', source: 'ESPN · UCL', fetchedAt: now, asOf: 'Fase KO' } satisfies BlockMeta)
      : unavail('ESPN'),
    uelFixtures: uelFixtures.length
      ? uelFixtures.some(r => r.extra?.Estado === 'En juego') ? live('ESPN · UEFA Europa League') : ({ status: 'stale', source: 'ESPN · UEL', fetchedAt: now, asOf: 'Fase KO' } satisfies BlockMeta)
      : unavail('ESPN'),
    // ── Nuevos automatizados ────────────────────────────────────────────
    f1Calendar:        f1Calendar.length    ? live(`Jolpica · ${f1.season}`) : unavail('Jolpica'),
    f1Sprints:         f1Sprints.length     ? live(`Jolpica · sprints ${f1.season}`) : unavail('Jolpica · sin sprints aún'),
    nbaMvpRace:        nbaMvpRace.length    ? live(`Auto · NBA.com · ${nbaSeason}`) : unavail('NBA.com'),
    nbaDpoyRace:       nbaDpoyRace.length   ? live(`Auto · NBA.com · ${nbaSeason}`) : unavail('NBA.com'),
    nbaRookieRace:     nbaRookieRace.length ? live(`Auto · NBA.com · ${nbaSeason}`) : unavail('NBA.com'),
    uclScorers:        uclScorers.length    ? live('ESPN · UEFA Champions League') : unavail('ESPN'),
    uelScorers:        uelScorers.length    ? live('ESPN · UEFA Europa League')    : unavail('ESPN'),
    uclAssists:        uclAssists.length    ? live('ESPN · UEFA Champions League') : unavail('ESPN'),
    uelAssists:        uelAssists.length    ? live('ESPN · UEFA Europa League')    : unavail('ESPN'),
    worldCupQualified: worldCupQualified.length ? live('Auto · FIFA World Cup 2026') : unavail('ESPN'),
    worldCupSchedule:  worldCupSchedule.length  ? live('ESPN · scoreboard')          : unavail('ESPN'),
    motogpRiders:        motogpRidersR.snap    ? snapMeta(motogpRidersR.snap)    : unavail('Sin snapshot — ejecutar cron MotoGP'),
    motogpConstructors:  motogpConstructR.snap ? snapMeta(motogpConstructR.snap) : unavail('Sin snapshot — ejecutar cron MotoGP'),
  }

  // Per-UFC-division meta + payload aggregator
  const ufcDivisions: Record<string, StandingRow[]> = {}
  for (const { div, r } of ufcDivisionsResolved) {
    ufcDivisions[div.blockId] = r.rows
    meta[div.blockId] = r.snap
      ? snapMeta(r.snap)
      : unavail('Sin snapshot — ejecutar cron UFC')
  }

  // Per-football-league meta — lets the UI surface stale-fallback per tabla-* block.
  for (const league of football) {
    if (staleSet.has(league.id)) {
      meta[league.id] = { status: 'stale', source: 'ESPN · caché reciente', fetchedAt: now, asOf: 'fallback' }
    } else if (league.rows.length) {
      meta[league.id] = { status: 'live', source: 'ESPN', fetchedAt: now }
    } else {
      // Liga sin filas (p.ej. ESPN aún no publica la tabla de la nueva temporada):
      // marcar 'unavailable' para que el cliente vacíe el fallback hardcodeado en
      // vez de mostrarlo como ● LIVE. (fix Serie A jun 2026)
      meta[league.id] = unavail('ESPN · sin tabla esta temporada')
    }
  }

  return {
    football,
    f1Drivers:      f1.drivers,
    f1Constructors: f1.constructors,
    f1Poles:        f1.poles,
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
    fifaRanking:    fifaR.rows,
    ufcP4P:         ufcP4PR.rows,
    ufcChampions:   ufcChampionsR.rows,
    ufcDivisions,
    womenLigaF,
    womenGoals:          womenStats.goals,
    womenAssists:        womenStats.assists,
    worldCup,
    worldCupKnockout,
    worldCupSchedule,
    uclFixtures,
    uelFixtures,
    f1Calendar,
    f1Sprints,
    nbaMvpRace,
    nbaDpoyRace,
    nbaRookieRace,
    uclScorers,
    uelScorers,
    uclAssists,
    uelAssists,
    worldCupQualified,
    motogpRiders:       motogpRidersR.rows,
    motogpConstructors: motogpConstructR.rows,
    meta,
    updatedAt:          now,
  }
}

export async function getStandingsData(): Promise<StatsStandingsResponse> {
  return buildPayload()
}

// Shard de la respuesta para un solo sport (reduce tamaño SSR ~80%).
// Reutilizado por GET y por page.tsx en initialData cuando se entra a
// un /estadisticas?sport=X (links de redes/SEO).
export function shardStandingsForSport(
  data: StatsStandingsResponse,
  sport: string,
): Partial<StatsStandingsResponse> & { updatedAt: string; meta: Record<string, BlockMeta> } {
  const keys = SPORT_KEYS[sport]
  if (!keys) return data
  const meta: Record<string, BlockMeta> = {}
  for (const k of keys) if (data.meta[k as string]) meta[k as string] = data.meta[k as string]
  // También copiamos meta de los blockIds que se manejan por blockId directo
  // (ej. divisiones UFC ufc-hw, ufc-lhw…). Filtramos por prefijo del sport.
  const sportPrefix = sport === 'ufc' ? 'ufc-' : sport === 'futbol' ? 'tabla-' : ''
  if (sportPrefix) {
    for (const k of Object.keys(data.meta)) {
      if (k.startsWith(sportPrefix)) meta[k] = data.meta[k]
    }
  }
  const shard: Partial<StatsStandingsResponse> & { updatedAt: string; meta: Record<string, BlockMeta> } = {
    meta, updatedAt: data.updatedAt,
  }
  for (const k of keys) {
    ;(shard as Record<string, unknown>)[k as string] = (data as unknown as Record<string, unknown>)[k as string]
  }
  return shard
}

export async function GET(req: NextRequest) {
  const data = await getStandingsData()
  const sport = req.nextUrl.searchParams.get('sport')?.toLowerCase()
  // El CDN sirve la misma respuesta ~60s a todos los clientes (evita reconstruir
  // el árbol de ~40 fetches en cada request). Los datos ya tienen su propio
  // revalidate por fetch, así que 60s extra de caché de respuesta es inocuo.
  const headers = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
  if (sport && SPORT_KEYS[sport]) {
    return NextResponse.json(shardStandingsForSport(data, sport), { headers })
  }
  return NextResponse.json(data, { headers })
}
