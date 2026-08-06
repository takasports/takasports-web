// ─────────────────────────────────────────────────────────────────────────────
// Motor de "Fechas" — Ranked Fútbol
//
// Convierte el fixture crudo de ESPN en las FECHAS jugables de la sección de
// predicciones: para cada día, los 3-6 partidos más destacados y UN "Partido
// del Día" que vale x2.
//
// Todo lo de este archivo es PURO y determinista: mismas entradas → mismas
// salidas, sin reloj ni red. Es lo que permite testearlo y, sobre todo, que el
// cron pueda re-ejecutarse cada 30 min sin que la selección baile.
//
// Decisiones de producto (7-ago-2026):
//   · La unidad de juego es el DÍA (una "Fecha"); la de premio, la semana.
//   · Alcance = núcleo europeo (Champions/Europa/Conference/top-5/copas/
//     selecciones). Fuera Liga MX, MLS, Brasileirão y segundas divisiones.
//   · 1 Partido del Día por Fecha, no por semana → más momentos de x2.
// ─────────────────────────────────────────────────────────────────────────────

import { FOOTBALL_LEAGUES, type FootballLeague } from '@/lib/football-leagues'
import { getEventHighlightScore } from '@/lib/competitions'
import { toSpanishNation } from '@/lib/nation-names'
import { SOURCE_TZ } from '@/lib/timezone'

// ── Alcance: núcleo europeo ──────────────────────────────────────────────────
// Se declara por SLUG y el nombre visible se hereda de FOOTBALL_LEAGUES, que es
// la lista maestra del sitio. Así el nombre de competición que guardamos en
// ranked_events es literalmente el mismo que usan el calendario y los colores
// de COMP_ACCENT — no hay dos vocabularios que se puedan desincronizar.
//
// Para ampliar el alcance (Liga MX, MLS, Brasileirão, Libertadores…) basta con
// añadir slugs aquí: el resto del motor no cambia.
const CORE_SLUGS: ReadonlySet<string> = new Set([
  // UEFA — clubes
  'soccer/uefa.champions',
  'soccer/uefa.europa',
  'soccer/uefa.europa.conf',
  'soccer/uefa.super_cup',
  // Top-5 europeas
  'soccer/esp.1',
  'soccer/eng.1',
  'soccer/ita.1',
  'soccer/ger.1',
  'soccer/fra.1',
  // Copas nacionales
  'soccer/esp.copa_del_rey',
  'soccer/eng.fa',
  'soccer/eng.league_cup',
  'soccer/ita.coppa_italia',
  'soccer/ger.dfb_pokal',
  'soccer/fra.coupe_de_france',
  // Selecciones
  'soccer/uefa.euro',
  'soccer/uefa.nations',
  'soccer/fifa.friendly',
])

/** Competiciones que alimentan las Fechas, con su nombre visible ya resuelto. */
export const RANKED_FOOTBALL_SOURCES: readonly FootballLeague[] =
  FOOTBALL_LEAGUES.filter(l => CORE_SLUGS.has(l.slug))

// ── Parámetros de selección ──────────────────────────────────────────────────

/**
 * Listón mínimo de calidad, en la escala de `getEventHighlightScore`. Un
 * partido por debajo NO entra en ninguna Fecha, y un día sin ningún partido que
 * lo supere sencillamente no se publica.
 *
 * Es la corrección más importante del motor. Sin este suelo, el corte era solo
 * RELATIVO al mejor partido del día: un martes de agosto con nada más que
 * segundas rondas de Carabao Cup coronaba un Bristol City - Walsall como
 * "Partido del Día ×2". Un destacado que no destaca quema la credibilidad de
 * la sección entera, y el usuario que entra ese día no vuelve.
 *
 * Calibrado para que entren LaLiga/Premier/Serie A/Bundesliga (10-11), Ligue 1
 * y Europa League (8), Champions (12), Supercopa (10) y Copa del Rey (7 + prime
 * time), y se queden fuera las rondas iniciales de copas menores (4-6,5).
 * Si un día no llega, la sección no miente: no hay Fecha y el hub ofrece UFC.
 */
export const MIN_ABSOLUTE_SCORE = 7.5

/** Suelo blando: por debajo de esto una Fecha se considera pobre, y se intenta
 *  completar bajando el listón (pero nunca por debajo de HARD_FLOOR_RATIO). */
export const MIN_PER_DATE = 3
/** Techo duro: más de 6 picks en un día convierte el ritual diario en tarea. */
export const MAX_PER_DATE = 6
/** Un partido entra si puntúa al menos este % del mejor partido del día. */
export const RELATIVE_THRESHOLD = 0.6
/** Listón absoluto al completar hasta MIN_PER_DATE. Preferimos una Fecha de un
 *  solo partidazo antes que un partidazo rodeado de relleno. */
export const HARD_FLOOR_RATIO = 0.4

/** Ventana de fixture que se abre a predicción, en días. Coincide con el ciclo
 *  de la Jornada Taka (lun-dom) para que el usuario siempre vea "su" semana. */
export const RANKED_WINDOW_DAYS = 7

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Partido normalizado desde ESPN, antes de decidir si entra en una Fecha. */
export interface FootballFixture {
  espnId: string
  /** ISO UTC del kickoff. */
  isoDate: string
  /** Nombre visible de competición (heredado de FOOTBALL_LEAGUES). */
  comp: string
  leagueSlug: string
  home: string
  away: string
  homeLogo?: string
  awayLogo?: string
  homeAbbr?: string
  awayAbbr?: string
  /** Ronda/fase según ESPN ("Final", "Round of 16"…). Alimenta el stageBoost. */
  stage?: string
  venue?: string
}

export interface ScoredFixture extends FootballFixture {
  /** Puntuación de "destacado". Se guarda en meta para poder auditar por qué
   *  un partido entró (o no) sin tener que reconstruir el estado de aquel día. */
  score: number
  /** Día al que pertenece la Fecha, en hora de Madrid (YYYY-MM-DD). */
  dateKey: string
}

export interface RankedDate {
  /** YYYY-MM-DD en Europe/Madrid. */
  dateKey: string
  matches: ScoredFixture[]
  /** espnId del Partido del Día (x2). Siempre uno, y siempre de `matches`. */
  featuredEspnId: string
}

// ── Agrupación por día ───────────────────────────────────────────────────────

const DATE_KEY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: SOURCE_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
})

/**
 * Día al que pertenece un kickoff, en hora de Madrid.
 *
 * En Madrid y NO en UTC porque es la zona en la que la UI imprime las horas
 * (SOURCE_TZ): la cabecera de la Fecha tiene que decir el mismo día que la hora
 * que el usuario lee en la tarjeta. Madrid va 1-2 h por delante de UTC, así que
 * un kickoff de madrugada (00:30 CEST del domingo = 22:30 UTC del sábado) caería
 * en el bloque del día anterior si agrupáramos por UTC.
 */
export function toDateKey(isoDate: string): string {
  return DATE_KEY_FMT.format(new Date(isoDate))   // en-CA ya emite YYYY-MM-DD
}

// ── Puntuación ───────────────────────────────────────────────────────────────

/**
 * Puntúa un partido con el mismo criterio que el modo Destacados del
 * calendario (importancia de liga + cartelazo + selección + fase + prime time).
 *
 * NO se le pasa `isLive`: ese boost cambia con el reloj y haría que el ranking
 * del día bailara entre dos ejecuciones del cron. La selección tiene que ser
 * una función del fixture, no del momento en que se calcula.
 */
export function scoreFixture(fx: FootballFixture): number {
  return getEventHighlightScore({
    comp:    fx.comp,
    // Los nombres de selección llegan de ESPN en inglés ("Spain") y la lista de
    // selecciones importantes está en español, así que sin traducir aquí un
    // España-Francia puntuaría como amistoso cualquiera (3 en vez de 9).
    home:    toSpanishNation(fx.home),
    away:    toSpanishNation(fx.away),
    stage:   fx.stage,
    isoDate: fx.isoDate,
  })
}

/** Orden determinista: score desc y, a igualdad, espnId asc. El desempate por
 *  id importa — sin él, dos ejecuciones podrían elegir distinto Partido del Día
 *  para la misma Fecha según cómo llegara ordenado el JSON de ESPN. */
function byScoreThenId(a: ScoredFixture, b: ScoredFixture): number {
  if (b.score !== a.score) return b.score - a.score
  return a.espnId.localeCompare(b.espnId)
}

// ── Selección ────────────────────────────────────────────────────────────────

/**
 * Elige los partidos destacados de UN día y designa el Partido del Día.
 *
 * Reglas, por orden:
 *   0. Se descarta todo lo que no llegue a MIN_ABSOLUTE_SCORE. Si no queda
 *      nada, ese día NO tiene Fecha (devuelve null).
 *   1. De lo que queda, entran los que puntúen ≥ 60% del mejor del día, hasta 6.
 *   2. Si salen menos de 3, se completa hasta 3 bajando el listón al 40% del
 *      mejor — nunca por debajo del suelo absoluto.
 *   3. El Partido del Día es el de mayor puntuación.
 *
 * Las reglas 0 y 2 son deliberadamente tacañas: si un martes solo hay una final
 * de Champions y tres partidos de copa menor, la Fecha es la final y punto. Un
 * pick de relleno no suma emoción, resta credibilidad al "destacado".
 */
export function selectForDate(fixtures: ScoredFixture[]): RankedDate | null {
  const eligible = fixtures.filter(f => f.score >= MIN_ABSOLUTE_SCORE)
  if (eligible.length === 0) return null

  const sorted = [...eligible].sort(byScoreThenId)
  const best   = sorted[0].score

  let picked = sorted
    .filter(f => f.score >= best * RELATIVE_THRESHOLD)
    .slice(0, MAX_PER_DATE)

  if (picked.length < MIN_PER_DATE) {
    picked = sorted
      .filter(f => f.score >= best * HARD_FLOOR_RATIO)
      .slice(0, MIN_PER_DATE)
  }

  return {
    dateKey:        sorted[0].dateKey,
    matches:        picked,
    featuredEspnId: picked[0].espnId,
  }
}

/**
 * Construye todas las Fechas de una tanda de fixtures.
 *
 * `skipDateKeys` son los días que YA existen en base de datos: una Fecha
 * publicada no se recalcula jamás. Es la regla de oro del motor — si el cron
 * pudiera re-seleccionar, un partido ya pronosticado podría desaparecer de la
 * Fecha (dejando la predicción huérfana) o perder su x2 a mitad de semana.
 * Publicar es un acto irreversible; el cron solo añade días nuevos.
 */
export function buildRankedDates(
  fixtures: ScoredFixture[],
  skipDateKeys: ReadonlySet<string> = new Set(),
): RankedDate[] {
  const byDate = new Map<string, ScoredFixture[]>()
  for (const fx of fixtures) {
    if (skipDateKeys.has(fx.dateKey)) continue
    const bucket = byDate.get(fx.dateKey)
    if (bucket) bucket.push(fx)
    else byDate.set(fx.dateKey, [fx])
  }

  const dates: RankedDate[] = []
  for (const [, dayFixtures] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const date = selectForDate(dayFixtures)
    if (date) dates.push(date)
  }
  return dates
}

/** Añade score + dateKey a los fixtures crudos. Paso previo a la selección. */
export function scoreFixtures(fixtures: FootballFixture[]): ScoredFixture[] {
  return fixtures.map(fx => ({
    ...fx,
    score:   scoreFixture(fx),
    dateKey: toDateKey(fx.isoDate),
  }))
}

// ── Identidad en ranked_events ───────────────────────────────────────────────

/** id estable de un partido de Ranked Fútbol. El prefijo evita colisión con el
 *  archivo del Mundial 2026 (`wc26-espn-*`), que comparte tabla y origen ESPN. */
export function rankedFootballId(espnId: string): string {
  return `fb-espn-${espnId}`
}

/** Deporte de este producto en base de datos. La UI habla de 'futbol' (es lo que
 *  usan las pestañas y los iconos) pero la columna `sport` de ranked_events solo
 *  admite 'football' | 'ufc' | 'mundial' por CHECK, así que la traducción vive
 *  en `normalizeRankedSport` y este es el único valor que se escribe. */
export const RANKED_FOOTBALL_SPORT = 'football' as const
