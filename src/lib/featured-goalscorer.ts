// ─────────────────────────────────────────────────────────────────
// Helper server-side para el feature «Goleador del partido destacado».
// SOLO importar desde route handlers — usa adminSupabase + fetch a ESPN.
//
// Reusa el patrón de /api/match/[ref]/route.ts:
//   · ESPN summary endpoint: trae rosters (candidatos) y keyEvents
//     (goleadores reales) para el mismo espnId.
//   · IDs de atleta consistentes en ambos: rostroId === scorerId →
//     matcheo perfecto sin normalización de nombres.
// ─────────────────────────────────────────────────────────────────

// ── Helpers de extracción de JSON laxo ────────────────────────────
function asObj(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : undefined
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

// ── Tipos públicos ───────────────────────────────────────────────
export interface GoalscorerCandidate {
  id: string             // athlete.id ESPN — primary key para matcheo
  name: string
  shortName?: string
  jersey?: string
  posAbbr?: string       // 'F' | 'M' | 'D' | 'G' | etc. — para filtros UI
  headshot?: string
  teamSide: 'home' | 'away'
  /** true = titular en la formación. false/undefined = banquillo (puede entrar). */
  starter?: boolean
}

export interface FeaturedTeamLineup {
  /** Sistema táctico anunciado, e.g. '4-3-3'. Vacío si no hay todavía. */
  formation: string
  /** Los 11 titulares (sin portero) ordenados FWD → MID → DEF. */
  starters: GoalscorerCandidate[]
  /** Banquillo (suplentes que pueden marcar al entrar). */
  bench: GoalscorerCandidate[]
}

export interface FeaturedRoster {
  home: FeaturedTeamLineup
  away: FeaturedTeamLineup
  /** Status del partido: 'pre' (sin kickoff), 'live' (en curso), 'final' (terminado), 'unknown' */
  status: 'pre' | 'live' | 'final' | 'unknown'
}

export interface ScorerCount {
  playerId: string
  playerName: string
  teamSide: 'home' | 'away'
  goals: number          // SOLO goles propios. Los own-goals no cuentan para el goleador elegido.
}

// ── ESPN summary fetch con caché breve ───────────────────────────
interface SummaryCacheEntry { json: Record<string, unknown> | null; ts: number }
const summaryCache = new Map<string, SummaryCacheEntry>()
const SUMMARY_TTL_PRE   = 60 * 60_000   // 1h pre-kickoff (rosters cambian poco)
const SUMMARY_TTL_LIVE  = 60_000        // 1min en vivo (goles entran)
const SUMMARY_TTL_FINAL = 24 * 60 * 60_000 // 24h post-final (no cambia)

function summaryTtl(status: 'pre' | 'live' | 'final' | 'unknown'): number {
  if (status === 'live') return SUMMARY_TTL_LIVE
  if (status === 'final') return SUMMARY_TTL_FINAL
  return SUMMARY_TTL_PRE
}

/**
 * Pega al summary endpoint de ESPN para un evento y devuelve el JSON
 * crudo. Implementa caché in-memory por (leagueSlug, espnId) con TTL
 * variable según status del partido — re-fetch ágil mientras está
 * live para captar goles, lento pre-kickoff y post-final.
 */
export async function fetchSummary(
  leagueSlug: string,
  espnId: string,
): Promise<Record<string, unknown> | null> {
  const key = `${leagueSlug}|${espnId}`
  const prev = summaryCache.get(key)
  const prevStatus = prev?.json ? extractStatusInternal(prev.json) : 'unknown'
  const ttl = summaryTtl(prevStatus)
  if (prev && Date.now() - prev.ts < ttl) return prev.json

  try {
    const r = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${leagueSlug}/summary?event=${espnId}`,
      { next: { revalidate: 30 } },
    )
    if (!r.ok) return prev?.json ?? null   // stale-on-failure
    const json = await r.json() as Record<string, unknown>
    summaryCache.set(key, { json, ts: Date.now() })
    return json
  } catch {
    return prev?.json ?? null
  }
}

// ── Extracción de roster (candidatos) ────────────────────────────
function isGoalscorerPosition(posAbbr: string | undefined): boolean {
  if (!posAbbr) return true                  // si no sabemos, mejor incluir que excluir
  const a = posAbbr.toUpperCase()
  // Excluir solo porteros. Defensas y centrocampistas también marcan
  // (córners, jugadas a balón parado, contraataques, etc.).
  return !(a === 'G' || a === 'GK')
}

// Orden de líneas para mostrar la formación de arriba abajo (delanteros
// primero, mejor primero los que más marcan).
const LINE_ORDER: Record<string, number> = {
  'F': 0, 'CF': 0, 'ST': 0, 'SS': 0, 'LW': 0, 'RW': 0, 'FW': 0,
  'M': 1, 'CM': 1, 'AM': 1, 'DM': 1, 'LM': 1, 'RM': 1, 'MF': 1,
  'D': 2, 'CB': 2, 'LB': 2, 'RB': 2, 'WB': 2, 'DF': 2,
}

function lineRank(posAbbr: string | undefined): number {
  if (!posAbbr) return 3
  return LINE_ORDER[posAbbr.toUpperCase()] ?? 3
}

function parseLineup(rosterObj: Record<string, unknown>, side: 'home' | 'away'): FeaturedTeamLineup {
  const formation = asString(rosterObj.formation) ?? ''
  const all = asArr(rosterObj.roster) as Record<string, unknown>[]
  const starters: GoalscorerCandidate[] = []
  const bench: GoalscorerCandidate[] = []

  for (const p of all) {
    const ath = asObj(p.athlete)
    if (!ath) continue
    const id = asString(ath.id)
    const name = asString(ath.displayName)
    if (!id || !name) continue
    const pos = asObj(p.position)
    const posAbbr = asString(pos?.abbreviation)
    // Excluir porteros — no candidatos al goleador (raro que marquen).
    if (!isGoalscorerPosition(posAbbr)) continue

    const isStarter = p.starter === true
    const candidate: GoalscorerCandidate = {
      id,
      name,
      shortName: asString(ath.shortName),
      jersey: asString(p.jersey),
      posAbbr,
      headshot: asString(asObj(ath.headshot)?.href),
      teamSide: side,
      starter: isStarter,
    }
    if (isStarter) starters.push(candidate)
    else bench.push(candidate)
  }

  // Ordenar titulares por línea: FWD → MID → DEF (los que más marcan arriba).
  starters.sort((a, b) => {
    const r = lineRank(a.posAbbr) - lineRank(b.posAbbr)
    if (r !== 0) return r
    // Dentro de la misma línea, por dorsal asc (visual estable)
    const ja = Number(a.jersey ?? 99); const jb = Number(b.jersey ?? 99)
    return ja - jb
  })
  // Bench: también ordenado por línea (FWD primero los más probables de marcar).
  bench.sort((a, b) => lineRank(a.posAbbr) - lineRank(b.posAbbr))

  return { formation, starters, bench }
}

/** Aplana un FeaturedTeamLineup a un array de candidatos (titulares +
 *  banquillo) por si algún consumer necesita la lista completa. */
export function lineupCandidates(lineup: FeaturedTeamLineup): GoalscorerCandidate[] {
  return [...lineup.starters, ...lineup.bench]
}

function extractStatusInternal(json: Record<string, unknown>): FeaturedRoster['status'] {
  const header = asObj(json.header)
  const comps = asArr(header?.competitions)
  const comp = asObj(comps[0])
  const status = asObj(asObj(comp?.status)?.type)
  const name = asString(status?.name) ?? ''
  if (name === 'STATUS_FINAL' || name === 'STATUS_FULL_TIME') return 'final'
  if (name === 'STATUS_IN_PROGRESS' || name === 'STATUS_HALFTIME' || name === 'STATUS_FIRST_HALF' || name === 'STATUS_SECOND_HALF') return 'live'
  if (name === 'STATUS_SCHEDULED' || name === 'STATUS_PRE_GAME') return 'pre'
  return 'unknown'
}

/**
 * Extrae los dos lineups (home/away) del summary ESPN. Cada lineup
 * trae { formation, starters, bench }:
 *   · formation = sistema táctico anunciado (ej. '4-3-3')
 *   · starters  = los 10 de campo titulares (sin GK), ordenados
 *                 FWD → MID → DEF (delanteros arriba)
 *   · bench     = suplentes (pueden marcar al entrar)
 *
 * Si ESPN aún no publicó alineaciones (típico hasta ~1h antes del
 * kickoff), home/away vienen con arrays vacíos y formation=''.
 * Excluye porteros (raro que marquen).
 */
export function extractRoster(json: Record<string, unknown>): FeaturedRoster {
  const status = extractStatusInternal(json)
  const rosters = asArr(json.rosters) as Record<string, unknown>[]
  const empty: FeaturedTeamLineup = { formation: '', starters: [], bench: [] }
  if (rosters.length < 2) return { home: empty, away: empty, status }

  const homeR = rosters.find(r => r.homeAway === 'home') ?? rosters[0]
  const awayR = rosters.find(r => r.homeAway === 'away') ?? rosters[1]
  return {
    home: parseLineup(homeR as Record<string, unknown>, 'home'),
    away: parseLineup(awayR as Record<string, unknown>, 'away'),
    status,
  }
}

/**
 * Cuenta goles por jugador del partido. Solo goles propios; own-goals
 * NO cuentan al goleador elegido (lo decide ESPN con type='owngoal',
 * que filtramos aparte). Devuelve mapa id → ScorerCount.
 */
export function extractScorers(json: Record<string, unknown>): Map<string, ScorerCount> {
  const out = new Map<string, ScorerCount>()
  const header = asObj(json.header)
  const comp = asObj(asArr(header?.competitions)[0])
  const competitors = asArr(comp?.competitors) as Record<string, unknown>[]
  const homeId = asString(asObj(competitors.find(c => c.homeAway === 'home') ?? competitors[0])?.team
    ? asObj((competitors.find(c => c.homeAway === 'home') ?? competitors[0]).team)?.id
    : undefined)

  for (const ev of asArr(json.keyEvents) as Record<string, unknown>[]) {
    const type = asObj(ev.type)
    const typeKey = asString(type?.type) ?? ''
    // SOLO goles propios. Own-goal y penalty-goal-missed se descartan.
    if (typeKey !== 'goal' && typeKey !== 'penalty-goal') continue
    const firstParticipant = asObj(asArr(ev.participants)[0])
    const ath = asObj(firstParticipant?.athlete)
    const playerId = asString(ath?.id)
    const playerName = asString(ath?.displayName)
    if (!playerId || !playerName) continue
    const team = asObj(ev.team)
    const teamSide: 'home' | 'away' = asString(team?.id) === homeId ? 'home' : 'away'
    const existing = out.get(playerId)
    if (existing) existing.goals += 1
    else out.set(playerId, { playerId, playerName, teamSide, goals: 1 })
  }
  return out
}

// ── Recompensa escalonada por goles ──────────────────────────────
/**
 * Tarifa de monedas por número de goles del jugador elegido.
 *   · 0 goles → 0 (no acierto)
 *   · 1 gol   → 100
 *   · 2 goles → 200
 *   · 3+      → 350 (hat-trick, premio máximo)
 *
 * Decisión de producto del 2026-05-23.
 */
export function coinsForGoals(goals: number): number {
  if (!Number.isFinite(goals) || goals <= 0) return 0
  if (goals === 1) return 100
  if (goals === 2) return 200
  return 350
}

// ── Helper: featured match desde /api/quiniela ────────────────────
/**
 * Lee el featured match de la jornada actual desde el endpoint
 * interno /api/quiniela. Más simple que replicar matchScore aquí.
 * Devuelve null si no hay match con isFeatured (e.g. jornada sin
 * partidos con espnId+leagueSlug).
 */
export interface FeaturedMatchInfo {
  jornada: string
  espnId: string
  leagueSlug: string
  home: string
  away: string
  homeAbbr?: string
  awayAbbr?: string
  homeLogo?: string
  awayLogo?: string
  isoDate: string
  comp: string
}

export async function fetchFeaturedMatch(origin: string): Promise<FeaturedMatchInfo | null> {
  try {
    const r = await fetch(`${origin}/api/quiniela`, { cache: 'no-store' })
    if (!r.ok) return null
    const data = await r.json() as { jornada: string; matches: Array<Record<string, unknown>> }
    if (!data?.matches?.length) return null
    const featured = data.matches.find(m => m.isFeatured === true)
    if (!featured) return null
    const espnId = asString(featured.espnId)
    const leagueSlug = asString(featured.leagueSlug)
    const home = asString(featured.home)
    const away = asString(featured.away)
    const isoDate = asString(featured.isoDate)
    const comp = asString(featured.comp)
    if (!espnId || !leagueSlug || !home || !away || !isoDate || !comp) return null
    return {
      jornada: data.jornada,
      espnId,
      leagueSlug,
      home,
      away,
      homeAbbr: asString(featured.homeAbbr),
      awayAbbr: asString(featured.awayAbbr),
      homeLogo: asString(featured.homeLogo),
      awayLogo: asString(featured.awayLogo),
      isoDate,
      comp,
    }
  } catch {
    return null
  }
}
