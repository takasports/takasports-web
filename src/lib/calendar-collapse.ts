// ─────────────────────────────────────────────────────────────────────────────
// Qué llega ABIERTO al calendario.
//
// El plegado de ligas y el resumen del día ya existían (commit `e91e9ce`,
// 26/08/2026, espejo de la app). Lo que faltaba era la regla de arranque: ambos
// lados nacían con `new Set()`, o sea TODO desplegado, así que `/calendario`
// medía ~15.600 px en un iPhone —23 pantallas de scroll— y la tijera solo servía
// si el usuario la usaba quince veces.
//
// Dos reglas, deliberadamente separadas:
//   · `diasAbiertosPorDefecto` — el día de HOY se abre; los demás llegan
//     plegados con su resumen («N partidos · M en vivo · K tuyos»), que ya se
//     pintaba. Vale para Destacados y para Todo.
//   · `ligasAbiertasPorDefecto` — dentro de un día abierto en la vista "Todo",
//     se abre lo que de verdad estás mirando y se pliega la cola.
//
// Son funciones puras y sin estado para poder probarlas: la decisión de qué se
// ve al llegar es demasiado fácil de romper sin querer.
// ─────────────────────────────────────────────────────────────────────────────

/** Cuántas ligas se dejan abiertas por su orden, aunque no tengan directo ni favorito. */
export const LIGAS_ABIERTAS_POR_ORDEN = 3

export interface LigaDelDia {
  /** Nombre de la competición tal y como se agrupa (clave de `byComp`). */
  comp: string
  /** Algún partido de la liga está en juego ahora mismo. */
  enVivo?: boolean
  /** Algún partido tiene un equipo favorito del usuario. */
  conFavorito?: boolean
  /** La liga está fijada por el usuario (`favComps`). */
  fijada?: boolean
}

/**
 * Ligas que arrancan ABIERTAS dentro de un día, en el orden en que se pintan.
 *
 * Abre: las que tienen un partido en vivo, las que tienen un equipo tuyo, las
 * fijadas, y las `LIGAS_ABIERTAS_POR_ORDEN` primeras —la lista ya viene ordenada
 * por relevancia (fijadas → en vivo → por jugar → terminadas)—. El resto, plegado.
 *
 * Con una sola liga en el día no se pliega nada: dejar un día entero detrás de un
 * chevron para ahorrar cuatro filas es peor que no plegar.
 */
export function ligasAbiertasPorDefecto(
  ligas: readonly LigaDelDia[],
  abiertasPorOrden = LIGAS_ABIERTAS_POR_ORDEN,
): ReadonlySet<string> {
  if (ligas.length <= 1) return new Set(ligas.map(l => l.comp))
  const abiertas = new Set<string>()
  ligas.forEach((liga, i) => {
    if (liga.enVivo || liga.conFavorito || liga.fijada || i < abiertasPorOrden) {
      abiertas.add(liga.comp)
    }
  })
  return abiertas
}

/**
 * Días que arrancan ABIERTOS.
 *
 * Solo hoy. Si hoy no está en la lista (calendario abierto en otra fecha, o un
 * día sin partidos), se abre el PRIMERO para no dejar la pantalla entera plegada
 * y con pinta de vacía.
 */
export function diasAbiertosPorDefecto(
  dias: readonly string[],
  hoy: string,
): ReadonlySet<string> {
  if (dias.length === 0) return new Set()
  if (dias.includes(hoy)) return new Set([hoy])
  return new Set([dias[0]])
}

/**
 * Resuelve si algo está abierto combinando la regla con lo que el usuario haya
 * tocado. El override manda SIEMPRE: si alguien pliega hoy, se queda plegado.
 */
export function estaAbierto(
  clave: string,
  porDefecto: ReadonlySet<string>,
  overrides: ReadonlyMap<string, boolean>,
): boolean {
  return overrides.get(clave) ?? porDefecto.has(clave)
}
