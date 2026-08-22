// ── ¿De qué temporada es esto que estamos enseñando? ─────────────────────────
//
// Medido en producción el 21/08/2026: /estadisticas servía el 60-22 de la NBA del
// curso pasado, el Inter campeón de una Serie A ya terminada y la fase liga de una
// Champions cerrada — los tres con el sello ● LIVE. No era un fallo de datos: las
// seis fuentes de /api/stats ya caen a `?season=<año-1>` cuando la temporada nueva
// no dice nada todavía, y hacen bien, porque en agosto ESE es el dato útil. Lo que
// tiraban a la basura era CUÁL habían usado, así que la página presentaba como
// vivo un curso cerrado.
//
// Aquí solo vive esa contabilidad: qué etiqueta lleva una temporada de ESPN y si
// lo que tenemos delante está en marcha, recién empezado o terminado. Quien decide
// qué hacer con el veredicto es la ruta; quien decide si una tabla se puede USAR
// para adornar una fila de calendario sigue siendo standings-window.ts.

import { hasEnoughGames, gamesPlayedPlausible, isSeasonUnderway } from './standings-window'

/** El objeto `season` que ESPN cuelga de sus respuestas de standings/statistics. */
export interface EspnSeason {
  year?: number
  startDate?: string
  endDate?: string
  displayName?: string
}

/**
 * Etiqueta legible de la temporada, tal y como la nombra ESPN.
 *
 * Se lee del `displayName` porque el `year` no significa lo mismo en cada
 * deporte —el fútbol europeo numera por el año de INICIO (2026 → 2026-27) y la
 * NBA por el de FINAL (2027 → 2026-27)—, mientras que el displayName siempre
 * empieza por la etiqueta ya formada: "2025-26 Italian Serie A", "2026-27".
 */
export function seasonLabel(season: EspnSeason | undefined): string | undefined {
  const fromName = season?.displayName?.trim().match(/^(\d{4}(?:[-/]\d{2,4})?)/)?.[1]
  if (fromName) return fromName.replace('/', '-')
  const y = season?.year
  return typeof y === 'number' && Number.isFinite(y) && y > 1900 ? String(y) : undefined
}

/**
 * La temporada anterior a una etiqueta: "2026-27" → "2025-26", "2026" → "2025".
 *
 * Hace falta para el caso feo de ESPN: cambia los METADATOS de temporada antes
 * que las FILAS, así que el 21/08/2026 servía el balance final del curso pasado
 * bajo el rótulo "2026-27". La etiqueta que toca ahí es la de antes, no la que
 * ESPN declara.
 */
export function previousSeasonLabel(label: string | undefined): string | undefined {
  if (!label) return undefined
  const m = label.match(/^(\d{4})(?:-(\d{2,4}))?$/)
  if (!m) return undefined
  const start = Number(m[1]) - 1
  if (!m[2]) return String(start)
  const end = start + 1
  // Conserva el ancho del original ("2026-27" → 2 dígitos, "2026-2027" → 4).
  return `${start}-${m[2].length === 2 ? String(end % 100).padStart(2, '0') : String(end)}`
}

/**
 * Rótulo de una temporada europea a partir de su año de INICIO: 2025 → "2025-26".
 *
 * Hace falta porque el `season` que ESPN devuelve no siempre corresponde a los
 * datos: pedirle `soccer/esp.w.1/statistics?season=2025` sirve los goleadores de
 * 2025-26 rotulados "2026-27 Spanish Liga F". Cuando hemos pedido un año a
 * propósito, ese año es la verdad y el eco de ESPN no pinta nada.
 */
export function labelFromStartYear(y: number): string {
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`
}

export type SeasonVerdict =
  /** Temporada en marcha y con jornadas suficientes: el orden significa algo. */
  | { kind: 'current'; label?: string; played: number }
  /** En marcha pero recién empezada: la tabla existe y aún no dice nada. */
  | { kind: 'early'; label?: string; played: number }
  /** Lo que tenemos delante es un curso CERRADO, venga de donde venga. */
  | { kind: 'finished'; label?: string; played: number }

/**
 * Clasifica unas filas contra la temporada que las acompaña.
 *
 * `season` tiene que ser el objeto de LA MISMA respuesta de la que salieron las
 * filas: si el fetcher cayó a `?season=<año-1>`, el de esa segunda llamada. Es
 * justamente lo que hoy se pierde, y sin ello no hay forma de distinguir "Inter
 * 87 puntos porque va líder" de "Inter 87 puntos porque ganó lo del año pasado".
 */
export function classifySeason(args: {
  rows: readonly { gp: number }[]
  season: EspnSeason | undefined
  now: Date
  /**
   * Año que se le pidió a ESPN a propósito porque la temporada vigente no decía
   * nada. Si está, no hay nada que deducir: son datos de un curso cerrado, diga
   * lo que diga el `season` que ESPN devuelva de vuelta.
   */
  fallbackYear?: number
}): SeasonVerdict {
  const { rows, season, now, fallbackYear } = args
  const played = rows.reduce((m, r) => Math.max(m, r.gp), 0)
  const label = seasonLabel(season)

  if (typeof fallbackYear === 'number') {
    return { kind: 'finished', label: labelFromStartYear(fallbackYear), played }
  }

  // Antes de que arranque: lo que ESPN sirve son las filas del curso anterior,
  // así que la etiqueta correcta es la de antes (NBA el 21/08/2026: declaraba
  // 2026-27, empezaba el 30/09 y devolvía el 60-22 de 2025-26).
  const start = season?.startDate ? Date.parse(season.startDate) : NaN
  if (!Number.isNaN(start) && now.getTime() < start) {
    return { kind: 'finished', label: previousSeasonLabel(label), played }
  }
  // Después de que termine: las filas SON de esa temporada, ya cerrada.
  if (!isSeasonUnderway(season, now)) {
    return { kind: 'finished', label, played }
  }
  // En marcha, pero con más partidos jugados de los que caben en los días
  // transcurridos: son restos del curso anterior que ESPN aún no ha barrido.
  if (!gamesPlayedPlausible(rows, season, now)) {
    return { kind: 'finished', label: previousSeasonLabel(label), played }
  }
  if (!hasEnoughGames(rows)) return { kind: 'early', label, played }
  return { kind: 'current', label, played }
}

/** Texto de la insignia gris para un curso cerrado: "Final 2025-26". */
export function finishedBadge(label: string | undefined): string {
  return label ? `Final ${label}` : 'Temporada anterior'
}

/**
 * Quédate solo con las ligas que hablan de la MISMA temporada.
 *
 * Cualquier bloque que funda varias ligas en un ranking —la Bota de Oro, "equipos
 * más goleadores"— las estaba sumando sin mirar de qué año era cada una. El
 * 21/08/2026 eso daba una Bota de Oro con los 36 goles de Kane del curso pasado
 * arriba y LaLiga, la única liga con datos de ESTE año, fuera del top 12 entera:
 * sus goleadores llevaban 2 goles.
 *
 * La regla es quedarse con el grupo mayoritario (en agosto, las cuatro ligas que
 * aún sirven el curso cerrado; en septiembre, las cinco ya en marcha) y decir de
 * qué temporada es. Los empates caen del lado de la temporada viva.
 */
export function sameSeasonOnly<T extends { season?: { kind: SeasonVerdict['kind']; label?: string } }>(
  items: readonly T[],
): { items: T[]; finished: boolean; label?: string } {
  const closed = items.filter(i => i.season?.kind === 'finished')
  const open = items.filter(i => i.season?.kind !== 'finished')
  if (closed.length > open.length) {
    // El rótulo mayoritario entre las cerradas (normalmente todas el mismo).
    const counts = new Map<string, number>()
    for (const i of closed) {
      const l = i.season?.label
      if (l) counts.set(l, (counts.get(l) ?? 0) + 1)
    }
    const label = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    return { items: closed, finished: true, label }
  }
  return { items: open, finished: false }
}
