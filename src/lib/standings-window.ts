// ── ¿Sirve HOY esta clasificación? ──────────────────────────────────────────
//
// El calendario enseña puesto y puntos en la fila, y eso solo vale si la tabla
// habla de la temporada QUE SE ESTÁ JUGANDO. ESPN no lo pone fácil:
//
//  · Antes de arrancar sirve la tabla de la temporada ANTERIOR bajo los metadatos
//    de la NUEVA. Comprobado el 21/08/2026: `basketball/nba` declaraba
//    season 2026-27 (empieza el 30/09) y devolvía 60-22 con 82 partidos jugados,
//    que es el balance final del curso pasado.
//  · Recién empezada, la tabla existe pero no dice nada: ese mismo día la Premier
//    daba "1º AFC Bournemouth" con todos a 0 puntos y orden alfabético.
//
// De ahí las dos condiciones, que juntas hacen que esto se encienda y se apague
// SOLO, sin cron ni fecha a mano: la temporada tiene que estar en marcha (hoy
// dentro de su ventana) y alguien tiene que haber jugado ya unas jornadas.
//
// Al terminar una temporada, ESPN adelanta la ventana a la siguiente: la tabla
// vieja deja de cumplir la primera condición y la nueva no cumple la segunda
// hasta que se juegue. El hueco entre medias queda cubierto sin tocar nada.

/** Jornadas jugadas a partir de las cuales la tabla dice algo. */
export const STANDINGS_MIN_GP = 3

export interface SeasonWindow {
  /** ISO-8601. */
  startDate?: string
  endDate?: string
}

/** ¿Estamos DENTRO de la temporada que describe la tabla? */
export function isSeasonUnderway(season: SeasonWindow | undefined, now: Date): boolean {
  // Sin ventana no podemos decidir: dejamos pasar y que decida el mínimo de
  // jornadas (comportamiento previo, ninguna liga se queda peor que antes).
  if (!season?.startDate && !season?.endDate) return true
  const t = now.getTime()
  if (season.startDate) {
    const start = Date.parse(season.startDate)
    if (!Number.isNaN(start) && t < start) return false
  }
  if (season.endDate) {
    const end = Date.parse(season.endDate)
    if (!Number.isNaN(end) && t > end) return false
  }
  return true
}

/**
 * Margen sobre los días transcurridos: nadie juega más partidos que días lleva
 * la temporada (ni siquiera la NBA, con ~82 en ~250 días), pero se deja holgura
 * por husos horarios y por un arranque con doble jornada.
 */
const GP_MARGIN_DAYS = 2

/**
 * ¿Es POSIBLE haber jugado tantas jornadas en lo que lleva la temporada?
 *
 * Es la red de seguridad del caso feo: ESPN cambia los METADATOS de temporada
 * antes que las FILAS. El 21/08/2026 la NBA ya declaraba la 2026-27 (que empieza
 * el 30/09) y seguía sirviendo el 60-22 del curso anterior. Si esas filas viejas
 * siguieran ahí el 2 de octubre, la ventana de temporada ya no las frenaría —
 * pero 82 partidos en 2 días son imposibles, y eso sí las delata.
 */
export function gamesPlayedPlausible(
  rows: Array<{ gp: number }>,
  season: SeasonWindow | undefined,
  now: Date,
): boolean {
  if (!season?.startDate) return true
  const start = Date.parse(season.startDate)
  if (Number.isNaN(start)) return true
  const days = Math.floor((now.getTime() - start) / 86_400_000)
  if (days < 0) return false
  const maxGp = rows.reduce((m, r) => Math.max(m, r.gp), 0)
  return maxGp <= days + GP_MARGIN_DAYS
}

/** ¿Ha jugado alguien lo suficiente como para que el orden signifique algo? */
export function hasEnoughGames(rows: Array<{ gp: number }>): boolean {
  return rows.some(r => r.gp >= STANDINGS_MIN_GP)
}

/**
 * Verdadero solo si la tabla se puede enseñar hoy. Es el único interruptor:
 * en cuanto ESPN publica jornadas de la temporada en curso se enciende solo, y
 * cuando la temporada termina se apaga solo.
 */
export function standingsUsable(
  rows: Array<{ gp: number }>,
  season: SeasonWindow | undefined,
  now: Date,
): boolean {
  if (rows.length === 0) return false
  if (!isSeasonUnderway(season, now)) return false
  if (!gamesPlayedPlausible(rows, season, now)) return false
  return hasEnoughGames(rows)
}
