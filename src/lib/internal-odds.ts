// ─────────────────────────────────────────────────────────────────
// Cuotas internas para Quiniela Ranked.
//
// Cuando the-odds-api no devuelve cuotas (cupo del free tier agotado,
// downtime, liga sin cobertura), generamos cuotas conservadoras a
// partir de las standings de ESPN — la "actividad" reciente del club
// queda reflejada en pts (puntos en la temporada actual) y gd
// (diferencia de goles acumulada).
//
// Modelo:
//   strength(t) = pts(t) + 0.3 * gd(t)
//   diff        = (strength(home) + HOME_ADV) - strength(away)
//   p_h_v_a     = 1 / (1 + exp(-diff/SCALE))         ← logística simple
//   p_draw      = max(DRAW_FLOOR, DRAW_BASE - |diff|/100)
//   p_home      = (1 - p_draw) * p_h_v_a
//   p_away      = (1 - p_draw) * (1 - p_h_v_a)
//   odd         = 1 / (p * MARGIN), clamp a [MIN_ODD, MAX_ODD]
//
// Decisiones de diseño (cuotas conservadoras del 2026-05-23):
//   · Clamp 1.30–6.0  → ni regalos al favorito ni jackpots imposibles
//   · Margen 8%       → overround típico del bookmaker, cuotas se ven "de casa"
//   · Empate generoso (30% base, suelo 18%) → fútbol tiene muchos empates
//   · HOME_ADV +5pts  → convención sólida para fútbol
//
// El sistema vivo de cuotas en MatchCard (lib/helpers.ts liveOdds) sigue
// funcionando encima: si hay consenso real de usuarios, mueve la línea
// como con cuotas de bookmaker.
// ─────────────────────────────────────────────────────────────────

import { nameMatch } from './quiniela'

// ── Parámetros del modelo ─────────────────────────────────────────
const HOME_ADV     = 5
const SCALE        = 15
const DRAW_BASE    = 0.30
const DRAW_FLOOR   = 0.18
const MARGIN       = 1.08
const MIN_ODD      = 1.30
const MAX_ODD      = 6.00

// Cuotas neutrales (cuando no tenemos NI standings NI datos del equipo).
// Reflejan honestamente "no sabemos quién es favorito" sin regalar nada.
const NEUTRAL_HOME = 2.50
const NEUTRAL_DRAW = 3.20
const NEUTRAL_AWAY = 2.80

// ── Standings cache ───────────────────────────────────────────────
// 30 min de TTL (mismo que /api/match). Stale-on-failure: si ESPN cae,
// servimos la última versión conocida en lugar de quedarnos sin cuotas.
const STANDINGS_TTL = 30 * 60_000

// Slugs ESPN que sí devuelven tabla de standings. Para el resto
// (Copa del Rey, Europa, Mundial fase KO) el sistema cae a cuotas
// neutrales — refleja la realidad de "no hay tabla regular".
const TABLE_SLUGS: ReadonlySet<string> = new Set([
  'soccer/esp.1', 'soccer/eng.1', 'soccer/ita.1',
  'soccer/ger.1', 'soccer/fra.1', 'soccer/uefa.champions',
])

interface StandingsEntry {
  name: string
  pts: number
  gp: number  // games played
  gd: number  // goal difference
}

interface CacheEntry { data: StandingsEntry[]; ts: number }
const standingsCache = new Map<string, CacheEntry>()

// ── JSON helpers (defensa contra ESPN payloads ambiguos) ─────────
function asObj(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : undefined
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

async function fetchStandings(leagueSlug: string): Promise<StandingsEntry[]> {
  if (!TABLE_SLUGS.has(leagueSlug)) return []
  const cached = standingsCache.get(leagueSlug)
  const now = Date.now()
  if (cached && now - cached.ts < STANDINGS_TTL) return cached.data

  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/v2/sports/${leagueSlug}/standings`,
      { next: { revalidate: 1800 } },
    )
    if (!res.ok) return cached?.data ?? []
    const json = await res.json() as Record<string, unknown>
    const groups  = asArr(json.children) as Record<string, unknown>[]
    const entries = asArr(asObj(groups[0]?.standings)?.entries) as Record<string, unknown>[]
    if (!entries.length) return cached?.data ?? []

    const data: StandingsEntry[] = entries.map(e => {
      const team  = asObj(e.team) ?? {}
      const stats = asArr(e.stats) as Array<{ name: string; value?: number }>
      const sv = (name: string) =>
        Math.round((stats.find(s => s.name === name)?.value as number) ?? 0)
      const w = sv('wins'); const d = sv('ties'); const l = sv('losses')
      return {
        name: asString(team.displayName) ?? '',
        pts: sv('points'),
        gp:  w + d + l,
        gd:  sv('pointDifferential'),
      }
    }).filter(e => e.name && e.gp > 0)
    // Filtramos gp>0: principio de temporada con 0 partidos jugados
    // daría diff=0 y cuotas neutrales. Mejor caer a neutrales globales.

    if (data.length > 0) {
      standingsCache.set(leagueSlug, { data, ts: now })
    }
    return data.length > 0 ? data : (cached?.data ?? [])
  } catch {
    return cached?.data ?? []
  }
}

function findTeam(standings: StandingsEntry[], teamName: string): StandingsEntry | null {
  return standings.find(s => nameMatch(s.name, teamName)) ?? null
}

function clampOdd(o: number): number {
  if (!isFinite(o) || o <= 0) return MAX_ODD
  return Math.max(MIN_ODD, Math.min(MAX_ODD, Math.round(o * 100) / 100))
}

// ── API pública ───────────────────────────────────────────────────
export interface InternalOdds {
  home: number
  draw: number
  away: number
}

/**
 * Computa cuotas internas para un partido usando standings ESPN.
 * Devuelve null si no hay datos suficientes — el caller debería
 * usar `neutralOdds()` como fallback final.
 *
 * Es async porque puede pegar al endpoint ESPN. Con caché interno
 * 30min — llamarlo N veces para la misma liga es barato.
 */
export async function computeInternalOdds(
  home: string,
  away: string,
  leagueSlug: string,
): Promise<InternalOdds | null> {
  const standings = await fetchStandings(leagueSlug)
  if (standings.length === 0) return null

  const homeTeam = findTeam(standings, home)
  const awayTeam = findTeam(standings, away)
  if (!homeTeam || !awayTeam) return null

  const strength = (t: StandingsEntry) => t.pts + 0.3 * t.gd
  const diff = (strength(homeTeam) + HOME_ADV) - strength(awayTeam)

  const pHomeVsAway = 1 / (1 + Math.exp(-diff / SCALE))
  const drawProb    = Math.max(DRAW_FLOOR, DRAW_BASE - Math.abs(diff) / 100)
  const pHome       = (1 - drawProb) * pHomeVsAway
  const pAway       = (1 - drawProb) * (1 - pHomeVsAway)

  // Defensa contra probs degeneradas (no debería ocurrir con los
  // floor/ceiling pero por las dudas).
  if (pHome <= 0 || pAway <= 0 || drawProb <= 0) return null

  return {
    home: clampOdd(1 / (pHome * MARGIN)),
    draw: clampOdd(1 / (drawProb * MARGIN)),
    away: clampOdd(1 / (pAway * MARGIN)),
  }
}

/**
 * Cuotas neutrales para fallback. Se usan cuando no hay standings
 * (Copa, Champions KO, Mundial KO) o cuando algún equipo no está
 * en la tabla (recién ascendido, equipo invitado).
 *
 * Diseño conservador: ni regalos al favorito ni jackpots.
 */
export function neutralOdds(): InternalOdds {
  return { home: NEUTRAL_HOME, draw: NEUTRAL_DRAW, away: NEUTRAL_AWAY }
}
