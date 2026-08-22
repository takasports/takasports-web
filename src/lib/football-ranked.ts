// ─────────────────────────────────────────────────────────────────────────────
// Motor de "Jornadas" — Ranked Fútbol
//
// Convierte el fixture crudo de ESPN en las JORNADAS jugables de la sección de
// predicciones: para cada semana, los 7-9 partidos más destacados y UN
// "Partidazo de la Jornada" que vale x2.
//
// Todo lo de este archivo es PURO y determinista: mismas entradas → mismas
// salidas, sin reloj ni red. Es lo que permite testearlo y, sobre todo, que el
// cron pueda re-ejecutarse cada 30 min sin que la selección baile.
//
// Decisiones de producto:
//   · La unidad de PREMIO y de SELECCIÓN es la SEMANA ("Jornada"), lun-dom
//     hora de Madrid. Antes era el día ("Fecha") — se cambió el 13-ago-2026
//     porque forzar un destacado diario producía relleno en días flojos
//     (Bristol City-Walsall, y luego un Deportivo-Elche de lunes coronado
//     "Partido del Día" sin serlo) y diluía el x2 a "sale casi todos los
//     días". La semana da margen para elegir de verdad; el día a día lo
//     sostienen ya noticias/directos/calendario, no esta sección.
//   · Alcance = núcleo europeo (Champions/Europa/Conference/top-5/copas/
//     selecciones). Fuera Liga MX, MLS, Brasileirão y segundas divisiones.
//   · 1 Partidazo por Jornada, no por día → que el x2 vuelva a significar algo.
//   · Clásicos y derbis puntúan aparte (rivalryBoost en competitions.ts): un
//     Sevilla-Betis debe poder colarse aunque LaLiga por sí sola no baste.
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

/** Competiciones que alimentan las Jornadas, con su nombre visible ya resuelto. */
export const RANKED_FOOTBALL_SOURCES: readonly FootballLeague[] =
  FOOTBALL_LEAGUES.filter(l => CORE_SLUGS.has(l.slug))

// ── Parámetros de selección ──────────────────────────────────────────────────

/**
 * Listón mínimo de calidad, en la escala de `getEventHighlightScore`. Un
 * partido por debajo NO entra en ninguna Jornada, y una semana sin ningún
 * partido que lo supere sencillamente no se publica.
 *
 * Es la corrección más importante del motor. Sin este suelo, el corte era solo
 * RELATIVO al mejor partido de la semana: una semana con nada más que segundas
 * rondas de Carabao Cup coronaba un Bristol City - Walsall como "Partidazo de
 * la Jornada ×2". Un destacado que no destaca quema la credibilidad de la
 * sección entera, y el usuario que entra esa semana no vuelve.
 *
 * Calibrado para que entren LaLiga/Premier/Serie A/Bundesliga (10-11), Ligue 1
 * y Europa League (8), Champions (12), Supercopa (10) y Copa del Rey (7 + prime
 * time), y se queden fuera las rondas iniciales de copas menores (4-6,5).
 */
export const MIN_ABSOLUTE_SCORE = 7.5

/** Suelo blando: por debajo de esto una Jornada se considera pobre, y se
 *  intenta completar bajando el listón (pero nunca por debajo de
 *  HARD_FLOOR_RATIO). 7 es "se siente una jornada de verdad" sin llegar a la
 *  sensación de tarea de una quiniela de 14. */
export const MIN_PER_WEEK = 7
/** Techo duro: más de 9 picks convierte la Jornada en deberes. */
export const MAX_PER_WEEK = 9
/** Un partido entra si puntúa al menos este % del mejor de la semana. */
export const RELATIVE_THRESHOLD = 0.6
/** Listón absoluto al completar hasta MIN_PER_WEEK. Preferimos una Jornada
 *  corta pero de partidazos antes que rellenarla con morralla. */
export const HARD_FLOOR_RATIO = 0.4

/** Ventana de fixture que se abre a predicción, en días. Tiene que dar de sí
 *  para que la semana SIGUIENTE quepa ENTERA (lunes a domingo) antes de que la
 *  publiquemos: con 10 días, el domingo de la próxima Jornada entra en la
 *  ventana el jueves anterior, que es cuando se publica. Ver
 *  `weekEndKey` y el parámetro `horizonDateKey` de `buildRankedWeeks`. */
export const RANKED_WINDOW_DAYS = 10

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Partido normalizado desde ESPN, antes de decidir si entra en una Jornada. */
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
   *  un partido entró (o no) sin tener que reconstruir el estado de aquella
   *  semana. */
  score: number
  /** Día del kickoff, en hora de Madrid (YYYY-MM-DD). Se conserva para
   *  agrupar la Jornada por día en la UI (sub-cabeceras "sábado", "domingo"). */
  dateKey: string
  /** Semana a la que pertenece la Jornada: el lunes de esa semana ISO, en hora
   *  de Madrid (YYYY-MM-DD). Es la unidad real de selección y de premio. */
  weekKey: string
}

export interface RankedWeek {
  /** YYYY-MM-DD del lunes de la semana, en Europe/Madrid. */
  weekKey: string
  matches: ScoredFixture[]
  /** espnId del Partidazo de la Jornada (x2). Siempre uno, y siempre de `matches`. */
  featuredEspnId: string
}

// ── Agrupación por día y por semana ──────────────────────────────────────────

const DATE_KEY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: SOURCE_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
})

/**
 * Día al que pertenece un kickoff, en hora de Madrid.
 *
 * En Madrid y NO en UTC porque es la zona en la que la UI imprime las horas
 * (SOURCE_TZ): la sub-cabecera del día dentro de la Jornada tiene que decir el
 * mismo día que la hora que el usuario lee en la tarjeta.
 */
export function toDateKey(isoDate: string): string {
  return DATE_KEY_FMT.format(new Date(isoDate))   // en-CA ya emite YYYY-MM-DD
}

/**
 * Lunes (YYYY-MM-DD, hora de Madrid) de la semana ISO a la que pertenece un
 * kickoff. Es la unidad de selección y de premio: dos partidos con el mismo
 * `weekKey` compiten por el mismo cupo de 7-9 y pagan el mismo Pleno.
 */
export function toWeekKey(isoDate: string): string {
  const dateKey = toDateKey(isoDate)
  const [y, m, d] = dateKey.split('-').map(Number)
  // Mediodía UTC para que el cálculo del día de la semana no se mueva por el
  // desfase horario de Madrid respecto a UTC.
  const at = new Date(Date.UTC(y, m - 1, d, 12))
  const isoDow = at.getUTCDay() === 0 ? 7 : at.getUTCDay()   // lunes=1 … domingo=7
  at.setUTCDate(at.getUTCDate() - (isoDow - 1))
  return DATE_KEY_FMT.format(at)
}

/**
 * Domingo (YYYY-MM-DD) de la semana cuyo lunes es `weekKey`. Es el último día
 * que puede tener partidos esa Jornada, y por tanto el que decide si ya la
 * hemos VISTO entera. Ver `buildRankedWeeks`.
 */
export function weekEndKey(weekKey: string): string {
  const [y, m, d] = weekKey.split('-').map(Number)
  const at = new Date(Date.UTC(y, m - 1, d, 12))
  at.setUTCDate(at.getUTCDate() + 6)
  return DATE_KEY_FMT.format(at)
}

// ── Puntuación ───────────────────────────────────────────────────────────────

/**
 * Puntúa un partido con el mismo criterio que el modo Destacados del
 * calendario (importancia de liga + cartelazo + clásico/derbi + selección +
 * fase + prime time).
 *
 * NO se le pasa `isLive`: ese boost cambia con el reloj y haría que el ranking
 * de la semana bailara entre dos ejecuciones del cron. La selección tiene que
 * ser una función del fixture, no del momento en que se calcula.
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
 *  id importa — sin él, dos ejecuciones podrían elegir distinto Partidazo de
 *  la Jornada según cómo llegara ordenado el JSON de ESPN. */
function byScoreThenId(a: ScoredFixture, b: ScoredFixture): number {
  if (b.score !== a.score) return b.score - a.score
  return a.espnId.localeCompare(b.espnId)
}

// ── Selección ────────────────────────────────────────────────────────────────

/**
 * Elige los partidos destacados de UNA semana y designa el Partidazo.
 *
 * Reglas, por orden:
 *   0. Se descarta todo lo que no llegue a MIN_ABSOLUTE_SCORE. Si no queda
 *      nada, esa semana NO tiene Jornada (devuelve null).
 *   1. De lo que queda, entran los que puntúen ≥ 60% del mejor de la semana,
 *      hasta 9.
 *   2. Si salen menos de 7, se completa hasta 7 bajando el listón al 40% del
 *      mejor — nunca por debajo del suelo absoluto.
 *   3. El Partidazo de la Jornada es el de mayor puntuación.
 *
 * Las reglas 0 y 2 son deliberadamente tacañas: si una semana solo hay una
 * final de Champions y el resto son rondas de copa menor, la Jornada es la
 * final y lo que la acompañe de verdad — no se rellena hasta 7 con relleno.
 */
export function selectForWeek(fixtures: ScoredFixture[]): RankedWeek | null {
  const eligible = fixtures.filter(f => f.score >= MIN_ABSOLUTE_SCORE)
  if (eligible.length === 0) return null

  const sorted = [...eligible].sort(byScoreThenId)
  const best   = sorted[0].score

  let picked = sorted
    .filter(f => f.score >= best * RELATIVE_THRESHOLD)
    .slice(0, MAX_PER_WEEK)

  if (picked.length < MIN_PER_WEEK) {
    picked = sorted
      .filter(f => f.score >= best * HARD_FLOOR_RATIO)
      .slice(0, MIN_PER_WEEK)
  }

  return {
    weekKey:        sorted[0].weekKey,
    matches:        picked,
    featuredEspnId: picked[0].espnId,
  }
}

/**
 * Construye todas las Jornadas de una tanda de fixtures.
 *
 * `skipWeekKeys` son las semanas que YA existen en base de datos: una Jornada
 * publicada no se recalcula jamás. Es la regla de oro del motor — si el cron
 * pudiera reseleccionar, un partido ya pronosticado podría desaparecer de la
 * Jornada (dejando la predicción huérfana) o perder su x2 a mitad de semana.
 * Publicar es un acto irreversible; el cron solo añade semanas nuevas.
 *
 * `horizonDateKey` es el último día del fixture que hemos podido MIRAR (el
 * final de la ventana que se le pidió a ESPN). Una semana solo se publica si
 * cabe entera por debajo de él.
 *
 * ── Por qué existe este parámetro ──────────────────────────────────────────
 * Sin él, la regla de oro se volvía contra sí misma. Una semana entra en la
 * ventana por su LUNES, diez días antes; en esa primera pasada el cron solo ve
 * el lunes de esa semana, publica la Jornada con los partidos de ese único día
 * —y como ya está publicada, jamás vuelve a mirarla—. De martes a domingo no
 * se publica nunca nada.
 *
 * Así se rompió de verdad: la Jornada del 24 al 30 de agosto se publicó el 14
 * con cinco partidos, los cinco del lunes 24, y coronó Partidazo a un
 * Fulham-Chelsea que solo competía contra otros cuatro partidos de lunes. La
 * del 31 igual. Al usuario le aparecían tres "Jornadas" apiladas, dos de ellas
 * un día suelto disfrazado de semana.
 *
 * Exigiendo la semana completa, cada Jornada se publica el jueves anterior con
 * su fixture entero delante y eligiendo entre todos sus partidos.
 */
export function buildRankedWeeks(
  fixtures: ScoredFixture[],
  skipWeekKeys: ReadonlySet<string> = new Set(),
  horizonDateKey?: string,
): RankedWeek[] {
  const byWeek = new Map<string, ScoredFixture[]>()
  for (const fx of fixtures) {
    if (skipWeekKeys.has(fx.weekKey)) continue
    // Semana aún a medio ver: se deja para una pasada futura, cuando su
    // domingo también esté dentro de la ventana.
    if (horizonDateKey && weekEndKey(fx.weekKey) > horizonDateKey) continue
    const bucket = byWeek.get(fx.weekKey)
    if (bucket) bucket.push(fx)
    else byWeek.set(fx.weekKey, [fx])
  }

  const weeks: RankedWeek[] = []
  for (const [, weekFixtures] of [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const week = selectForWeek(weekFixtures)
    if (week) weeks.push(week)
  }
  return weeks
}

/** Añade score + dateKey + weekKey a los fixtures crudos. Paso previo a la
 *  selección. */
export function scoreFixtures(fixtures: FootballFixture[]): ScoredFixture[] {
  return fixtures.map(fx => ({
    ...fx,
    score:   scoreFixture(fx),
    dateKey: toDateKey(fx.isoDate),
    weekKey: toWeekKey(fx.isoDate),
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
