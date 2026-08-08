// Rareza de TakaGrid: qué porcentaje de la comunidad eligió a cada jugador en
// cada celda del grid del día.
//
// Es lo que engancha del género (Immaculate Grid): resolver las nueve celdas
// tiene mérito, pero resolverlas con jugadores que no se le ocurrieron a nadie
// tiene MÁS. Hasta ahora el juego solo sabía contar aciertos, así que dos grids
// de 9/9 eran indistinguibles aunque uno tirara de Messi y el otro de Zamorano.
//
// El agregado se calcula sobre `payload.picks` (playerId por celda, row-major),
// que los clientes envían desde el rediseño de scoring. Las partidas antiguas
// solo llevaban `solved` booleano y aquí se ignoran: cuentan como parte del
// total solo si aportan picks, para que los porcentajes no salgan diluidos.
//
// Módulo puro → testeable sin base de datos.

export const TAKAGRID_CELLS = 9

export interface TakagridPlayRow {
  payload: unknown
}

export interface CellRarity {
  /** playerId → veces que se eligió en esa celda. */
  picks: Record<string, number>
  /** Partidas que aportaron una elección en esa celda (denominador). */
  plays: number
}

export interface TakagridHeatmap {
  /** Índice de celda "0".."8" (row-major) → reparto de elecciones. */
  byCell: Record<string, CellRarity>
  /** Partidas con picks utilizables. */
  totalPlays: number
}

/**
 * Agrega las elecciones por celda. Tolerante con payloads viejos o manipulados:
 * solo cuenta arrays de hasta 9 posiciones con playerIds string.
 */
export function aggregateTakagridHeatmap(rows: readonly TakagridPlayRow[]): TakagridHeatmap {
  const byCell: Record<string, CellRarity> = {}
  let totalPlays = 0

  for (const row of rows) {
    const picks = (row?.payload as { picks?: unknown } | null | undefined)?.picks
    if (!Array.isArray(picks)) continue

    let aportó = false
    picks.slice(0, TAKAGRID_CELLS).forEach((raw, i) => {
      if (typeof raw !== 'string' || raw.length === 0) return
      const key = String(i)
      const cell = byCell[key] ?? (byCell[key] = { picks: {}, plays: 0 })
      cell.picks[raw] = (cell.picks[raw] ?? 0) + 1
      cell.plays += 1
      aportó = true
    })
    if (aportó) totalPlays += 1
  }

  return { byCell, totalPlays }
}

/**
 * Porcentaje (0–100) de partidas que eligieron a ese jugador en esa celda.
 * Devuelve null si aún no hay muestra suficiente para decir nada honesto: con
 * dos partidas, "el 50% eligió a este" no informa, desinforma.
 */
export function rarityFor(
  heatmap: TakagridHeatmap | null,
  cellIndex: number,
  playerId: string,
  minSample = MIN_SAMPLE,
): number | null {
  const cell = heatmap?.byCell?.[String(cellIndex)]
  if (!cell || cell.plays < minSample) return null
  const n = cell.picks[playerId] ?? 0
  if (n === 0) return null
  return Math.round((n / cell.plays) * 100)
}

/** Partidas mínimas en una celda para publicar su porcentaje. */
export const MIN_SAMPLE = 5

/**
 * Rareza media del grid: media de los porcentajes de las celdas acertadas.
 * Cuanto MÁS BAJO, más original ha sido el once de respuestas. Null si no hay
 * ninguna celda con muestra suficiente.
 */
export function averageRarity(
  heatmap: TakagridHeatmap | null,
  picks: readonly (string | null)[],
): number | null {
  const valores: number[] = []
  picks.slice(0, TAKAGRID_CELLS).forEach((pid, i) => {
    if (!pid) return
    const pct = rarityFor(heatmap, i, pid)
    if (pct !== null) valores.push(pct)
  })
  if (valores.length === 0) return null
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length)
}

/** Etiqueta corta para un porcentaje de elección. */
export function rarityLabel(pct: number): string {
  if (pct <= 5) return 'Casi nadie'
  if (pct <= 15) return 'Poca gente'
  if (pct <= 40) return 'Algunos'
  return 'La mayoría'
}
