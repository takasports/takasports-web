// ── Contexto de agosto: el puesto del AÑO PASADO ────────────────────────────
//
// `standingsUsable` apaga la clasificación mientras la tabla no diga nada, y
// hace bien: el 21/08/2026 LaLiga llevaba 2 jornadas y su tabla decía "1º
// Alavés". Pero el efecto medido ese día fue que 170 de 718 eventos del feed
// llevaban clasificación y los otros 548 no: TODAS las ligas europeas —LaLiga,
// Premier, Serie A, Bundesliga, Ligue 1, Championship…, unos 380 partidos, el
// 53% del feed— salían sin ningún contexto. Justo las que le importan al lector.
//
// El dato que sí sirve en la jornada 1 es dónde acabó cada equipo el curso
// pasado, y ESPN lo sirve en el MISMO endpoint con `?season=<año-1>`
// (comprobado: LaLiga 2025 → Barcelona 1º 94 pts, Madrid 2º 86). Coste 0.
//
// Se etiqueta SIEMPRE como pasado ("2º el año pasado") — nunca se disfraza de
// tabla viva— y se apaga solo en cuanto la de verdad gana sentido.
//
// El caso bonito: un equipo que no aparece en la tabla del año pasado es que
// estaba en otra categoría. Ahí la fila dice "Recién ascendido", que es
// exactamente lo que uno quiere saber de un equipo que no reconoce.

import type { TeamStanding } from './types'

/** Partidos a partir de los cuales una tabla parece de temporada TERMINADA. */
export const FINISHED_MIN_GP = 10

export interface SeasonRow {
  name: string
  abbr?: string
  rank: number
  pts: number
  gp: number
  group?: string
}

/**
 * ¿Estas filas son de una temporada completa? Protege del caso en que ESPN
 * devuelva para `?season=<año-1>` una tabla a medias (o vacía): preferimos no
 * enseñar nada antes que anunciar como "final del año pasado" una foto de
 * la jornada 3. Se exige que LA MITAD de los equipos haya jugado bastante,
 * no solo uno, porque un único registro alto puede ser un resto de datos.
 */
export function seasonLooksComplete(rows: readonly { gp: number }[]): boolean {
  if (rows.length === 0) return false
  const jugados = rows.filter(r => r.gp >= FINISHED_MIN_GP).length
  return jugados * 2 >= rows.length
}

/** Año de la temporada anterior a la que declara ESPN. */
export function previousSeasonYear(season: { year?: number } | undefined): number | undefined {
  const y = season?.year
  return typeof y === 'number' && Number.isFinite(y) && y > 1900 ? y - 1 : undefined
}

/**
 * ¿Faltar en la tabla del año pasado significa haber ASCENDIDO?
 *
 * Solo en la PRIMERA división doméstica de fútbol, y con una única tabla.
 *
 * Lo de "primera división" no es escrúpulo teórico: se vio en los datos. En la
 * Championship (`soccer/eng.2`) faltar es ambiguo — puedes venir de League One
 * O haber BAJADO de la Premier, y la prueba con el feed real del 21/08/2026
 * etiquetaba al Wolverhampton de "Recién ascendido" cuando había descendido.
 * En una primera división no hay ambigüedad: si no estabas, subiste.
 *
 * Los otros dos casos que quedan fuera: en la Champions faltar es no haberse
 * clasificado, y en una liga por conferencias el equipo puede estar sin más en
 * la otra tabla.
 */
export function canPromote(leagueSlug: string, rows: readonly SeasonRow[]): boolean {
  if (!leagueSlug.startsWith('soccer/')) return false
  if (!/\.1$/.test(leagueSlug)) return false   // deja fuera .2 y uefa.champions
  const grupos = new Set(rows.map(r => r.group ?? ''))
  return grupos.size <= 1
}

const asStanding = (r: SeasonRow, of: number): TeamStanding => ({
  rank: r.rank,
  pts: r.pts,
  of,
  group: r.group,
  lastSeason: true,
})

const ascendido = (): TeamStanding => ({ rank: 0, pts: 0, lastSeason: true, promoted: true })

/**
 * Empareja a los dos equipos con la tabla del año pasado.
 *
 * Mismo espíritu que la regla "los dos o ninguno" de la tabla viva —enseñar el
 * puesto de uno solo parece un fallo—, con una excepción que SÍ informa: si uno
 * está y el otro no, y en esa liga eso significa que subió de categoría, la fila
 * dice "3º el año pasado" contra "Recién ascendido". Eso no es asimetría: es la
 * comparación entera.
 */
export function pairLastSeason(
  home: SeasonRow | undefined,
  away: SeasonRow | undefined,
  opts: { canPromote: boolean; of: number },
): { home: TeamStanding; away: TeamStanding } | null {
  if (home && away) {
    // Grupos distintos → puestos no comparables (misma razón que en la viva).
    if ((home.group ?? '') !== (away.group ?? '')) return null
    return { home: asStanding(home, opts.of), away: asStanding(away, opts.of) }
  }
  if (!opts.canPromote) return null
  if (home && !away) return { home: asStanding(home, opts.of), away: ascendido() }
  if (away && !home) return { home: ascendido(), away: asStanding(away, opts.of) }
  return null   // ninguno de los dos: nada que contar
}
