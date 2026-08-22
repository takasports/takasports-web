import { NextResponse } from 'next/server'
import { tfetch } from '@/lib/stats-cache'
import { SOCCER_LEAGUES } from '@/lib/stats-leagues'
import { getPhotosByEspnId } from '@/lib/sport-entities'
import { finishedBadge, sameSeasonOnly } from '@/lib/season-label'

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
  /** Foto ya resuelta por la cascada (sport_entity_images). Sin ella se cae al escudo. */
  photo?: string
  /** Atribución obligatoria cuando la licencia lo exige (Wikimedia CC). */
  photoAttribution?: string
}

/** Temporada de la que salen realmente los líderes de una liga. */
export interface LeaderSeason {
  kind: 'current' | 'finished'
  /** "2025-26". */
  label: string
}

export interface LeaguePlayerData {
  id: string
  label: string
  goals: PlayerLeader[]
  assists: PlayerLeader[]
  /** Qué curso describen estas cifras. En agosto no es el mismo en todas. */
  season?: LeaderSeason
}

/** Frescura por bloque, misma forma que la de /api/stats/standings. */
export interface PlayerBlockMeta {
  status: 'live' | 'historical'
  source: string
  fetchedAt: string
  asOf?: string
}

// Cross-league combined rankings (ESPN core API, free). Keys map 1:1 to blocks.
export type CombinedKey =
  | 'yellowCards' | 'redCards' | 'shotsOnTarget' | 'totalShots'
  | 'foulsCommitted' | 'saves'

export interface PlayersResponse {
  leagues: LeaguePlayerData[]
  combined: Record<CombinedKey, PlayerLeader[]>
  /** Temporada de los bloques que funden varias ligas (Bota de Oro, Goleadores). */
  season: string
  /** Por blockId — el cliente la usa para no rotular como ● LIVE un curso cerrado. */
  meta: Record<string, PlayerBlockMeta>
  updatedAt: string
}

const LEAGUES = SOCCER_LEAGUES.map(l => ({ id: l.id, label: l.label, slug: l.espnSlug }))

// European season: Aug→May. Aug-Dec → start=Y; Jan-Jul → start=Y-1.
function seasonStartYear(): number {
  const now = new Date()
  return now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}
const SEASON_START = seasonStartYear()
const seasonLabelOf = (startYear: number) =>
  `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
const SEASON_LABEL = seasonLabelOf(SEASON_START)

// force-dynamic: igual que standings — no prerendear en build para no romper
// el deploy con fetches lentas a ESPN. Solo se consume client-side. Las fetches
// internas conservan su revalidate de 30 min. (fix jun 2026)
export const dynamic = 'force-dynamic'

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
): Promise<Pick<LeaguePlayerData, 'id' | 'label' | 'goals' | 'assists' | 'season'>> {
  const base = `https://site.api.espn.com/apis/site/v2/sports/${league.slug}/statistics`
  // Pide explícitamente la temporada vigente (SEASON_START). En el parón de
  // verano ESPN rota la liga a la nueva temporada (sin goleadores aún); si la
  // vigente viene vacía, caemos a la anterior. Sin esto Serie A se quedaba a 0
  // tras el rollover de jun 2026. Blinda a las 5 grandes ligas.
  const grab = async (season: number) => {
    const res = await tfetch(`${base}?season=${season}`, { next: { revalidate: 1800 } })
    if (!res.ok) return null
    const json = await res.json()
    const stats = (json.stats ?? []) as EspnStat[]
    const goalscat   = stats.find(c => c.displayName === 'Goals'   || c.name === 'goals')
    const assistscat = stats.find(c => c.displayName === 'Assists' || c.name === 'assists')
    const goals   = parseLeaders(goalscat, league.slug)
    const assists = parseLeaders(assistscat, league.slug)
    return (goals.length || assists.length) ? { goals, assists } : null
  }
  try {
    // Cuál de las dos temporadas acabó respondiendo es LA información que antes se
    // perdía: el 21/08/2026 LaLiga traía 2026-27 (Mariano, 2 goles) y las otras
    // cuatro el cierre de 2025-26 (Kane, 36), y todas se presentaban igual.
    const current = await grab(SEASON_START)
    if (current) {
      return { ...league2(league), ...current, season: { kind: 'current', label: SEASON_LABEL } }
    }
    const prev = await grab(SEASON_START - 1)
    if (prev) {
      return { ...league2(league), ...prev, season: { kind: 'finished', label: seasonLabelOf(SEASON_START - 1) } }
    }
    return { ...league2(league), goals: [], assists: [] }
  } catch {
    return { ...league2(league), goals: [], assists: [] }
  }
}

const league2 = (l: typeof LEAGUES[0]) => ({ id: l.id, label: l.label })

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
    const res = await tfetch(url, { next: { revalidate: 86400 } })
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
    const r = await tfetch(
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

/**
 * Pega a cada líder la foto que el cron ya resolvió. Es una lectura de NUESTRA caché
 * (sport_entity_images), no una llamada a terceros: aquí no se resuelve nada. Si la
 * base no responde, no hay foto y cada fila cae al escudo del club, como hasta ahora.
 */
async function attachPhotos(data: PlayersResponse): Promise<PlayersResponse> {
  const all = [
    ...data.leagues.flatMap(league => [...league.goals, ...league.assists]),
    ...Object.values(data.combined).flat(),
  ]
  const ids = [...new Set(all.map(p => p.playerId).filter((id): id is string => Boolean(id)))]
  if (!ids.length) return data

  const photos = await getPhotosByEspnId('football', ids)
  for (const leader of all) {
    const photo = leader.playerId ? photos.get(leader.playerId) : undefined
    if (!photo) continue
    leader.photo = photo.url
    leader.photoAttribution = photo.attribution ?? undefined
  }
  return data
}

/**
 * Payload completo de líderes. Exportado para reusarlo desde el cron de entidades sin
 * un self-fetch HTTP — mismo patrón que getStandingsData() en standings/route.ts.
 */
export async function getPlayersData(): Promise<PlayersResponse> {
  const [leagues, combined] = await Promise.all([
    Promise.all(LEAGUES.map(fetchEspnLeague)),
    buildCombined(),
  ])
  const now = new Date().toISOString()

  // Los bloques que funden ligas (Bota de Oro, "Goleadores" sin filtro) toman la
  // temporada del grupo mayoritario; en agosto eso es el curso cerrado, y decirlo
  // es lo que evita que Kane con 36 goles del año pasado gane un ranking donde
  // LaLiga compite con 2. El reparto en sí lo aplica el cliente con la misma regla.
  const cross = sameSeasonOnly(leagues)
  const crossLabel = cross.label ?? SEASON_LABEL
  const meta: Record<string, PlayerBlockMeta> = {}
  const stamp = (blockId: string, finished: boolean, label: string, source: string) => {
    meta[blockId] = finished
      ? { status: 'historical', source, fetchedAt: now, asOf: finishedBadge(label) }
      : { status: 'live', source, fetchedAt: now }
  }
  for (const id of ['goleadores', 'asistencias', 'bota-oro']) {
    stamp(id, cross.finished, crossLabel, `ESPN · ${crossLabel}`)
  }
  // El Pichichi es de una sola liga: lleva la suya, no la mayoritaria.
  const laliga = leagues.find(l => l.id === 'esp.1')?.season
  if (laliga) stamp('pichichi-laliga', laliga.kind === 'finished', laliga.label, `ESPN · ${laliga.label}`)
  // Los rankings combinados (tarjetas, tiros, faltas) se piden SIEMPRE a la
  // temporada vigente y sin respaldo (`seasons/${SEASON_START}`), así que son de
  // este curso por construcción y no necesitan sello: sin meta ya salen en vivo.

  return attachPhotos({
    leagues,
    combined,
    season: crossLabel,
    meta,
    updatedAt: now,
  })
}

export async function GET() {
  return NextResponse.json(await getPlayersData(), {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  })
}
