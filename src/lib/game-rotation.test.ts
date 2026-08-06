// Regresiones de la rotación de contenido en los juegos que sirven UN puzzle
// por fecha. El defecto que blindan: con el dado sembrado anterior, TakaGrid
// llegaba a repetir el MISMO grid dos días seguidos (22-23 de agosto de 2026)
// y Mi Once solo usaba 27 de sus 48 tableros en un año.

import { describe, it, expect } from 'vitest'
import { PUZZLES as GRIDS, puzzleIndexForDay } from './takagrid-puzzles'
import { BOARDS, boardIndexForWeek } from './mionce-challenges'
import { PUZZLES as SOPAS, puzzleIndexForWeek } from './sopa-puzzles'

function dayISO(base: string, add: number): string {
  const d = new Date(`${base}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + add)
  return d.toISOString().slice(0, 10)
}

function weekISO(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** Distancia mínima entre dos apariciones del mismo índice. */
function closestRepeat(seq: readonly number[]): number {
  const last = new Map<number, number>()
  let closest = Infinity
  seq.forEach((x, i) => {
    const prev = last.get(x)
    if (prev !== undefined) closest = Math.min(closest, i - prev)
    last.set(x, i)
  })
  return closest
}

describe('TakaGrid · rotación diaria', () => {
  const seq = Array.from({ length: GRIDS.length * 3 }, (_, i) =>
    puzzleIndexForDay(dayISO('2026-08-08', i)),
  )

  it('no repite un grid hasta pasada media vuelta al catálogo', () => {
    expect(closestRepeat(seq)).toBeGreaterThanOrEqual(Math.floor(GRIDS.length / 2))
  })

  it('no desperdicia catálogo: a la vuelta han salido todos los puzzles', () => {
    // Con el dado anterior, 8 de los 50 puzzles no aparecían en tres meses.
    expect(new Set(seq.slice(0, GRIDS.length * 2)).size).toBe(GRIDS.length)
  })

  it('el 22 y el 23 de agosto ya no son el mismo grid', () => {
    // Caso real que motivó el cambio.
    expect(puzzleIndexForDay('2026-08-22')).not.toBe(puzzleIndexForDay('2026-08-23'))
    expect(puzzleIndexForDay('2026-10-10')).not.toBe(puzzleIndexForDay('2026-10-11'))
  })

  it('los días anteriores al corte no cambian (archivo intacto)', () => {
    // Fórmula vieja: dado sembrado con AAAAMMDD sobre los 50 puzzles que había
    // ENTONCES. Ese 50 está clavado en el código a propósito: si escalara con el
    // catálogo, cada ampliación reescribiría el grid de los días ya jugados.
    const LEGACY_COUNT = 50
    const legacy = (y: number, m: number, d: number) => {
      let t = (y * 10000 + m * 100 + d + 0x6D2B79F5) | 0
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * LEGACY_COUNT)
    }
    expect(puzzleIndexForDay('2026-08-06')).toBe(legacy(2026, 8, 6))
    expect(puzzleIndexForDay('2026-07-01')).toBe(legacy(2026, 7, 1))
    expect(puzzleIndexForDay('2026-03-15')).toBe(legacy(2026, 3, 15))
    // Y siempre dentro del tramo histórico del catálogo.
    expect(puzzleIndexForDay('2026-08-06')).toBeLessThan(LEGACY_COUNT)
  })

  it('es determinista', () => {
    expect(puzzleIndexForDay('2026-09-09')).toBe(puzzleIndexForDay('2026-09-09'))
  })
})

describe('Mi Once · rotación semanal', () => {
  const seq = [
    ...Array.from({ length: 21 }, (_, i) => boardIndexForWeek(weekISO(2026, 33 + i))),
    ...Array.from({ length: 52 }, (_, i) => boardIndexForWeek(weekISO(2027, 1 + i))),
  ]

  it('un año entero sin repetir tablero (antes: 27 de 48, con repeticiones)', () => {
    const year = seq.slice(0, 52)
    expect(new Set(year).size).toBe(year.length)
  })

  it('a la vuelta han salido TODOS los tableros del catálogo', () => {
    // Tres años de semanas reales (no las mismas 52 recicladas, que nunca
    // podrían dar más de 52 tableros distintos).
    const long: number[] = []
    for (const year of [2027, 2028, 2029]) {
      for (let w = 1; w <= 52; w++) long.push(boardIndexForWeek(weekISO(year, w)))
    }
    expect(new Set(long).size).toBe(BOARDS.length)
  })

  it('no repite tablero hasta pasada media vuelta', () => {
    expect(closestRepeat(seq)).toBeGreaterThanOrEqual(Math.floor(BOARDS.length / 2))
  })

  it('el salto de año ISO no rompe la serie', () => {
    expect(boardIndexForWeek('2026-W53')).not.toBe(boardIndexForWeek('2027-W01'))
  })
})

describe('Sopa de Cracks · rotación semanal', () => {
  const seq = [
    ...Array.from({ length: 21 }, (_, i) => puzzleIndexForWeek(weekISO(2026, 33 + i))),
    ...Array.from({ length: 52 }, (_, i) => puzzleIndexForWeek(weekISO(2027, 1 + i))),
  ]

  it('no repite sopa hasta pasada media vuelta', () => {
    expect(closestRepeat(seq)).toBeGreaterThanOrEqual(Math.floor(SOPAS.length / 2))
  })

  it('ya no cae la misma sopa en la misma semana cada año', () => {
    const y2026 = Array.from({ length: 20 }, (_, i) => puzzleIndexForWeek(weekISO(2026, 33 + i)))
    const y2027 = Array.from({ length: 20 }, (_, i) => puzzleIndexForWeek(weekISO(2027, 33 + i)))
    expect(y2026).not.toEqual(y2027)
  })
})
