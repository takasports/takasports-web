import { describe, it, expect } from 'vitest'
import {
  aggregateTakagridHeatmap,
  averageRarity,
  rarityFor,
  rarityLabel,
  MIN_SAMPLE,
} from './takagrid-heatmap'

/** Partida con las 9 celdas rellenas por el mismo jugador ficticio. */
const play = (picks: (string | null)[]) => ({ payload: { picks } })
const nueve = (id: string) => Array.from({ length: 9 }, () => id)

describe('aggregateTakagridHeatmap', () => {
  it('cuenta elecciones por celda', () => {
    const hm = aggregateTakagridHeatmap([
      play(['messi', 'xavi', null, null, null, null, null, null, null]),
      play(['messi', 'iniesta', null, null, null, null, null, null, null]),
    ])
    expect(hm.totalPlays).toBe(2)
    expect(hm.byCell['0']).toEqual({ picks: { messi: 2 }, plays: 2 })
    expect(hm.byCell['1']).toEqual({ picks: { xavi: 1, iniesta: 1 }, plays: 2 })
    expect(hm.byCell['2']).toBeUndefined()   // nadie resolvió esa celda
  })

  it('ignora partidas antiguas sin picks, y no las cuenta en el total', () => {
    const hm = aggregateTakagridHeatmap([
      { payload: { solved: [true, true, false] } },   // formato viejo
      { payload: null },
      { payload: { picks: 'no-es-array' } },
      play(['messi', null, null, null, null, null, null, null, null]),
    ])
    expect(hm.totalPlays).toBe(1)
    expect(hm.byCell['0'].plays).toBe(1)
  })

  it('no se traga más de nueve celdas ni valores no-string', () => {
    const hm = aggregateTakagridHeatmap([
      play([...nueve('a'), 'desbordado' as string]),
      { payload: { picks: [42, {}, true, 'ok'] } },
    ])
    expect(Object.keys(hm.byCell).length).toBe(9)
    expect(hm.byCell['3'].picks).toEqual({ a: 1, ok: 1 })
  })
})

describe('rarityFor', () => {
  const muestra = (n: number, id: string) =>
    aggregateTakagridHeatmap(Array.from({ length: n }, () => play(nueve(id))))

  it('calla mientras la muestra sea pequeña', () => {
    const hm = muestra(MIN_SAMPLE - 1, 'messi')
    expect(rarityFor(hm, 0, 'messi')).toBeNull()
  })

  it('publica el porcentaje con muestra suficiente', () => {
    const hm = muestra(MIN_SAMPLE, 'messi')
    expect(rarityFor(hm, 0, 'messi')).toBe(100)
  })

  it('devuelve null para un jugador que nadie eligió ahí', () => {
    const hm = muestra(MIN_SAMPLE, 'messi')
    expect(rarityFor(hm, 0, 'zamorano')).toBeNull()
  })

  it('reparte bien entre dos elecciones', () => {
    const rows = [
      ...Array.from({ length: 8 }, () => play(nueve('comun'))),
      ...Array.from({ length: 2 }, () => play(nueve('raro'))),
    ]
    const hm = aggregateTakagridHeatmap(rows)
    expect(rarityFor(hm, 0, 'comun')).toBe(80)
    expect(rarityFor(hm, 0, 'raro')).toBe(20)
  })
})

describe('averageRarity', () => {
  it('promedia solo las celdas resueltas y con muestra', () => {
    const rows = [
      ...Array.from({ length: 9 }, () => play(nueve('comun'))),
      play(['raro', ...Array.from({ length: 8 }, () => 'comun')]),
    ]
    const hm = aggregateTakagridHeatmap(rows)
    // celda 0: comun 9/10 = 90 · raro 1/10 = 10 · resto: comun 100
    expect(averageRarity(hm, ['raro', 'comun', null, null, null, null, null, null, null])).toBe(55)
  })

  it('null si no hay nada medible', () => {
    expect(averageRarity(null, ['messi'])).toBeNull()
    expect(averageRarity(aggregateTakagridHeatmap([]), ['messi'])).toBeNull()
  })
})

describe('rarityLabel', () => {
  it('traduce el porcentaje a algo legible', () => {
    expect(rarityLabel(3)).toBe('Casi nadie')
    expect(rarityLabel(12)).toBe('Poca gente')
    expect(rarityLabel(30)).toBe('Algunos')
    expect(rarityLabel(70)).toBe('La mayoría')
  })
})
