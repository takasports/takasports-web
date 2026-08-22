// ── ¿En qué momento del Mundial 2026 estamos? ───────────────────────────────
//
// La pantalla solo sabía CUÁNDO EMPIEZA: pasada esa fecha, la pestaña se quedaba
// clavada en "EN JUEGO" y la cuenta atrás en "● EN CURSO" para siempre. Medido el
// 21/08/2026: el torneo había terminado 33 días antes —ESPN da la final el
// 19/07/2026, España 1-0 Argentina— y el sitio seguía anunciándolo como en directo.
//
// La ventana de temporada de ESPN no sirve para taparlo: para `soccer/fifa.world`
// declara endDate 2026-12-31, cinco meses después del último partido. Así que las
// dos fechas son constantes, igual que ya lo era la de inicio: un Mundial tiene
// calendario fijo y conocido de antemano.

/** Primer partido: México–? en el Azteca. */
export const WC_START = new Date('2026-06-11T17:00:00Z')

/** Final en el MetLife (19/07/2026). Verificado contra el scoreboard de ESPN. */
export const WC_END = new Date('2026-07-19T23:59:59Z')

export type WorldCupPhase = 'antes' | 'en-curso' | 'terminado'

export function worldCupPhase(now: Date): WorldCupPhase {
  const t = now.getTime()
  if (t < WC_START.getTime()) return 'antes'
  if (t > WC_END.getTime()) return 'terminado'
  return 'en-curso'
}
