// Fontanería de datos EN VIVO de /estadisticas: ids de bloques live, metadatos de
// frescura por fuente y merge de líderes por jugador. Extraído del monolito.

import { getZone } from '@/lib/league-zones'
import type { StatBlock, StatRow } from './stats-types'

/**
 * Ratio por partido para métricas de TOTAL ("1,16 /PJ"). Información nueva de datos que
 * ya viajan (valor ÷ PJ), pedida por el dueño en lugar de una barra decorativa. Coma
 * decimal (es). No aplica a métricas que ya son por-partido (PPG de NBA) ni sin PJ.
 */
function perMatchLabel(value: number, matches: number | undefined): string | undefined {
  if (!matches || matches <= 0 || !Number.isFinite(value)) return undefined
  return `${(value / matches).toFixed(2).replace('.', ',')} /PJ`
}

export const LIVE_BLOCK_IDS = new Set([
  'tabla-laliga', 'tabla-premier', 'tabla-serie-a', 'tabla-bundesliga', 'tabla-ligue1', 'tabla-ucl', 'tabla-uel',
  'nba-este', 'nba-oeste',
  'f1-campeonato', 'f1-constructores', 'f1-poles', 'f1-calendario', 'f1-sprints',
  'atp-ranking', 'wta-ranking',
  'goles-equipo', 'menos-goles',
  'ranking-fifa',
  'ufc-p4p', 'ufc-campeones',
  'ufc-hw', 'ufc-lhw', 'ufc-mw', 'ufc-ww', 'ufc-lw', 'ufc-fw', 'ufc-bw', 'ufc-flw',
  'ufc-w-bw', 'ufc-w-flw', 'ufc-w-stw',
  'nba-scoring', 'nba-rebounds', 'nba-assists', 'nba-blocks', 'nba-steals', 'nba-efficiency', 'nba-3pt',
  'nba-mvp-race', 'nba-dpoy-race', 'nba-rookie-race',
  'ucl-scorers', 'uel-scorers', 'ucl-assists', 'uel-assists',
  'f-ligaf-tabla', 'f-goleadoras', 'f-asistencias',
  'stats-dt',
  // World Cup 2026 — grupos A-L + goleadores
  'wc-group-a', 'wc-group-b', 'wc-group-c', 'wc-group-d',
  'wc-group-e', 'wc-group-f', 'wc-group-g', 'wc-group-h',
  'wc-group-i', 'wc-group-j', 'wc-group-k', 'wc-group-l',
  'wc-qualified',
  'wc-schedule',
  'wc-scorers',
  'wc-assists',
  // Snapshots auto-actualizados (cron Vercel)
  'motogp-pilotos', 'motogp-constructores',
  'tenis-slams',
])

export interface LiveStandingRow {
  rank: number; name: string; abbr: string; value: string; sub: string
  trend?: 'up' | 'down' | 'flat'; extra: Record<string, string>
  flag?: string
  teamId?: string
  logo?: string
}
export interface LiveLeague { id: string; label: string; rows: LiveStandingRow[]; leagueSlug?: string }
export type FreshnessStatus = 'live' | 'stale' | 'historical' | 'unavailable'
export interface BlockMeta { status: FreshnessStatus; source: string; fetchedAt: string; asOf?: string }
export interface LiveStandingsData {
  football: LiveLeague[]
  f1Drivers: LiveStandingRow[]; f1Constructors: LiveStandingRow[]
  f1Poles: LiveStandingRow[]
  nbaEast: LiveStandingRow[];   nbaWest: LiveStandingRow[]
  nbaScoring: LiveStandingRow[];nbaRebounds: LiveStandingRow[]
  nbaAssists: LiveStandingRow[];nbaBlocks: LiveStandingRow[]
  nbaSteals: LiveStandingRow[]; nbaEfficiency: LiveStandingRow[]
  nba3ptMade: LiveStandingRow[]
  atpRanking: LiveStandingRow[]; wtaRanking: LiveStandingRow[]
  fifaRanking: LiveStandingRow[]
  ufcP4P: LiveStandingRow[]
  ufcChampions?: LiveStandingRow[]
  ufcDivisions?: Record<string, LiveStandingRow[]>
  womenLigaF: LiveStandingRow[]
  womenGoals: LiveStandingRow[]; womenAssists: LiveStandingRow[]
  coachesWinRate?: LiveStandingRow[]
  worldCup?: LiveLeague[]
  uclFixtures?: LiveStandingRow[]
  uelFixtures?: LiveStandingRow[]
  // Nuevos automatizados
  f1Calendar?: LiveStandingRow[]
  f1Sprints?: LiveStandingRow[]
  nbaMvpRace?: LiveStandingRow[]
  nbaDpoyRace?: LiveStandingRow[]
  nbaRookieRace?: LiveStandingRow[]
  uclScorers?: LiveStandingRow[]
  uelScorers?: LiveStandingRow[]
  uclAssists?: LiveStandingRow[]
  uelAssists?: LiveStandingRow[]
  mundialScorers?: LiveStandingRow[]
  mundialAssists?: LiveStandingRow[]
  worldCupQualified?: LiveStandingRow[]
  worldCupSchedule?: LiveStandingRow[]
  motogpRiders?: LiveStandingRow[]
  motogpConstructors?: LiveStandingRow[]
  tennisSlams?: LiveStandingRow[]
  meta?: Record<string, BlockMeta>
  updatedAt?: string
}

// Map block.id -> standings payload key (for meta lookup)
export const BLOCK_TO_META_KEY: Record<string, string> = {
  // Cada liga lee su PROPIA meta (no la genérica 'football') para que, si ESPN
  // devuelve una liga vacía, el bloque se marque 'unavailable' y NO muestre el
  // fallback hardcodeado como ● LIVE. (fix Serie A jun 2026)
  'tabla-laliga': 'tabla-laliga', 'tabla-premier': 'tabla-premier', 'tabla-serie-a': 'tabla-serie-a',
  'tabla-bundesliga': 'tabla-bundesliga', 'tabla-ligue1': 'tabla-ligue1', 'tabla-ucl': 'football', 'tabla-uel': 'football',
  'goles-equipo': 'football', 'menos-goles': 'football',
  'nba-este': 'nbaEast', 'nba-oeste': 'nbaWest',
  'nba-scoring': 'nbaScoring', 'nba-rebounds': 'nbaRebounds', 'nba-assists': 'nbaAssists',
  'nba-blocks': 'nbaBlocks', 'nba-steals': 'nbaSteals', 'nba-efficiency': 'nbaEfficiency', 'nba-3pt': 'nba3ptMade',
  'f1-campeonato': 'f1Drivers', 'f1-constructores': 'f1Constructors',
  'f1-poles': 'f1Poles',
  'atp-ranking': 'atpRanking', 'wta-ranking': 'wtaRanking',
  'ranking-fifa': 'fifaRanking',
  'ufc-p4p': 'ufcP4P',
  'ufc-campeones': 'ufcChampions',
  // Divisiones UFC: meta se inyecta por blockId directo (route lo hace en
  // for-loop sobre UFC_DIVISIONS), así que mapeamos blockId → mismo key.
  'ufc-hw': 'ufc-hw', 'ufc-lhw': 'ufc-lhw', 'ufc-mw': 'ufc-mw', 'ufc-ww': 'ufc-ww',
  'ufc-lw': 'ufc-lw', 'ufc-fw': 'ufc-fw', 'ufc-bw': 'ufc-bw', 'ufc-flw': 'ufc-flw',
  'ufc-w-bw': 'ufc-w-bw', 'ufc-w-flw': 'ufc-w-flw', 'ufc-w-stw': 'ufc-w-stw',
  'f-ligaf-tabla': 'womenLigaF', 'f-goleadoras': 'womenGoals', 'f-asistencias': 'womenAssists',
  'stats-dt': 'coachesWinRate',
  'wc-group-a': 'worldCup', 'wc-group-b': 'worldCup', 'wc-group-c': 'worldCup',
  'wc-group-d': 'worldCup', 'wc-group-e': 'worldCup', 'wc-group-f': 'worldCup',
  'wc-group-g': 'worldCup', 'wc-group-h': 'worldCup', 'wc-group-i': 'worldCup',
  'wc-group-j': 'worldCup', 'wc-group-k': 'worldCup', 'wc-group-l': 'worldCup',
  'wc-qualified': 'worldCupQualified',
  'wc-schedule': 'worldCupSchedule',
  'wc-scorers': 'mundialScorers',
  'wc-assists': 'mundialAssists',
  'f1-calendario': 'f1Calendar',
  'f1-sprints': 'f1Sprints',
  'nba-mvp-race': 'nbaMvpRace',
  'nba-dpoy-race': 'nbaDpoyRace',
  'nba-rookie-race': 'nbaRookieRace',
  'ucl-scorers': 'uclScorers', 'uel-scorers': 'uelScorers',
  'ucl-assists': 'uclAssists', 'uel-assists': 'uelAssists',
  'motogp-pilotos': 'motogpRiders',
  'motogp-constructores': 'motogpConstructors',
  'tenis-slams': 'tennisSlams',
}

// (Histórico/estimated block sets removidos: la web ya no muestra bloques editoriales.)
export const HISTORICAL_PLAYER_BLOCK_IDS = new Set<string>()
export const STATIC_STALE_BLOCK_IDS = new Set<string>()

export const FIXTURE_META_KEY: Record<string, string> = {
  'tabla-ucl': 'uclFixtures', 'tabla-uel': 'uelFixtures',
}

export const STATIC_HIST_META: BlockMeta  = { status: 'historical', source: 'Estimado',    fetchedAt: '', asOf: 'Temp. 24/25' }
export const HIST_PLAYER_META: BlockMeta  = { status: 'historical', source: 'API-Sports',  fetchedAt: '', asOf: 'Temp. 24/25' }

export function getBlockMeta(blockId: string, liveMeta?: Record<string, BlockMeta>, cardType?: string): BlockMeta | undefined {
  if (cardType === 'fixtures') {
    const fKey = FIXTURE_META_KEY[blockId]
    if (fKey && liveMeta?.[fKey]) return liveMeta[fKey]
  }
  const key = BLOCK_TO_META_KEY[blockId]
  if (key && liveMeta?.[key]) return liveMeta[key]
  if (HISTORICAL_PLAYER_BLOCK_IDS.has(blockId)) return HIST_PLAYER_META
  if (STATIC_STALE_BLOCK_IDS.has(blockId)) return STATIC_HIST_META
  return undefined
}

// ── Player stats types (from /api/stats/players) ──────────────────
export interface PlayerLeader {
  name: string; team: string; value: number; matches: number
  extra?: Record<string, string>
  playerId?: string; teamLogo?: string; leagueSlug?: string
  /** Foto resuelta por el cron; si no hay, la fila cae al escudo del club. */
  photo?: string; photoAttribution?: string
}

// Build the /jugador deep-link slug from an ESPN league slug + athlete id.
export function playerHref(p: { playerId?: string; leagueSlug?: string }): string | undefined {
  if (!p.playerId || !p.leagueSlug) return undefined
  return `/jugador/${p.leagueSlug.replaceAll('/', '_')}_${p.playerId}`
}
export interface LeaguePlayerData {
  id: string; label: string
  goals: PlayerLeader[]; assists: PlayerLeader[]
}
export interface LivePlayerData {
  leagues: LeaguePlayerData[]
  combined?: Record<string, PlayerLeader[]>
}

// IDs of blocks that get player-stats live data (ESPN)
export const LIVE_PLAYER_BLOCK_IDS = new Set([
  'pichichi-laliga', 'bota-oro', 'goleadores', 'asistencias',
  'tiros-puerta', 'tiros-totales', 'tarjetas-amarillas', 'tarjetas-rojas', 'faltas', 'paradas',
])

// Combined-ranking blocks → key in livePlayerData.combined
export const COMBINED_BLOCK_KEY: Record<string, string> = {
  'tiros-puerta': 'shotsOnTarget', 'tiros-totales': 'totalShots',
  'tarjetas-amarillas': 'yellowCards', 'tarjetas-rojas': 'redCards',
  'faltas': 'foulsCommitted', 'paradas': 'saves',
}

export const LEAGUE_FILTER_TO_ID: Record<string, string> = {
  'LaLiga': 'esp.1', 'Premier League': 'eng.1', 'Bundesliga': 'ger.1',
  'Serie A': 'ita.1', 'Ligue 1': 'fra.1',
}

export function applyLivePlayerToBlock(
  block: StatBlock,
  lpd: LivePlayerData,
  leagueFilter?: string,
): { block: StatBlock; isLive: boolean } {
  const leagues = lpd.leagues

  const combinedKey = COMBINED_BLOCK_KEY[block.id]
  if (combinedKey) {
    const src = lpd.combined?.[combinedKey] ?? []
    if (!src.length) return { block, isLive: false }
    return { isLive: true, block: { ...block, rows: src.map((g, i) => ({
      rank: i + 1, name: g.name, team: '',
      value: g.value.toString(), trend: 'flat' as const,
      photo: g.photo, logo: g.teamLogo, kind: 'player' as const,
      perMatch: perMatchLabel(g.value, g.matches), href: playerHref(g),
    }))}}
  }

  if (block.id === 'pichichi-laliga') {
    const lg = leagues.find(l => l.id === 'esp.1')
    if (!lg?.goals.length) return { block, isLive: false }
    return { isLive: true, block: { ...block, rows: lg.goals.slice(0, 10).map((g, i) => ({
      rank: i + 1, name: g.name, team: g.team,
      value: g.value.toString(), sub: `${g.matches} PJ`, trend: 'flat' as const,
      photo: g.photo, logo: g.teamLogo, kind: 'player' as const,
      perMatch: perMatchLabel(g.value, g.matches), href: playerHref(g),
    }))}}
  }

  if (block.id === 'bota-oro') {
    const all = leagues
      .flatMap(l => l.goals.slice(0, 10).map(g => ({ ...g, league: l.label })))
      .sort((a, b) => b.value - a.value).slice(0, 10)
    if (!all.length) return { block, isLive: false }
    return { isLive: true, block: { ...block, rows: all.map((g, i) => ({
      rank: i + 1, name: g.name,
      team: `${g.team} · ${g.league}`,
      value: (g.value * 2).toString(),
      sub: `${g.value} goles`,
      trend: 'flat' as const,
      photo: g.photo, logo: g.teamLogo, kind: 'player' as const,
      href: playerHref(g),
    }))}}
  }

  if (block.id === 'goleadores') {
    const filterId = leagueFilter ? LEAGUE_FILTER_TO_ID[leagueFilter] : null
    const source = filterId
      ? leagues.filter(l => l.id === filterId).flatMap(l => l.goals.slice(0, 10))
      : leagues.flatMap(l => l.goals.slice(0, 6)).sort((a, b) => b.value - a.value).slice(0, 12)
    if (!source.length) return { block, isLive: false }
    return { isLive: true, block: { ...block, rows: source.map((g, i) => ({
      rank: i + 1, name: g.name, team: g.team,
      value: g.value.toString(), sub: `${g.matches} PJ`, trend: 'flat' as const,
      photo: g.photo, logo: g.teamLogo, kind: 'player' as const,
      perMatch: perMatchLabel(g.value, g.matches), href: playerHref(g),
    }))}}
  }

  if (block.id === 'asistencias') {
    const filterId = leagueFilter ? LEAGUE_FILTER_TO_ID[leagueFilter] : null
    const source = filterId
      ? leagues.filter(l => l.id === filterId).flatMap(l => l.assists.slice(0, 10))
      : leagues.flatMap(l => l.assists.slice(0, 5)).sort((a, b) => b.value - a.value).slice(0, 10)
    if (!source.length) return { block, isLive: false }
    return { isLive: true, block: { ...block, rows: source.map((g, i) => ({
      rank: i + 1, name: g.name, team: g.team,
      value: g.value.toString(), sub: `${g.matches} PJ`, trend: 'flat' as const,
      photo: g.photo, logo: g.teamLogo, kind: 'player' as const,
      perMatch: perMatchLabel(g.value, g.matches), href: playerHref(g),
    }))}}
  }

  return { block, isLive: false }
}

export function toStatRows(rows: LiveStandingRow[], teamKey?: string, leagueSlug?: string): StatRow[] {
  return rows.map(r => ({
    rank: r.rank, name: r.name,
    team: teamKey ? r.extra[teamKey] : r.abbr || undefined,
    flag: r.flag,
    value: r.value, sub: r.sub, trend: r.trend ?? 'flat',
    extra: Object.fromEntries(Object.entries(r.extra).filter(([k]) => k !== teamKey)),
    href: leagueSlug && r.teamId
      ? `/equipo/${leagueSlug.replaceAll('/', '_')}_${r.teamId}`
      : undefined,
    logo: r.logo,
    kind: 'club' as const,
    zone: leagueSlug ? getZone(leagueSlug, r.rank) : undefined,
  }))
}
