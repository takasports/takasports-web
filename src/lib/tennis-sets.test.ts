import { describe, it, expect } from 'vitest'
import { parseSetsWon, parseCurrentSetScore, formatTennisSets } from './tennis-sets'

describe('parseSetsWon', () => {
  it('cuenta los sets ganados por cada jugador', () => {
    expect(parseSetsWon('6-4 3-6 6-2')).toEqual([2, 1])
    expect(parseSetsWon('6-4')).toEqual([1, 0])
    expect(parseSetsWon('4-6 2-6')).toEqual([0, 2])
  })
  it('el tiebreak no descuadra el recuento', () => {
    expect(parseSetsWon('7-6(4) 6-7(8) 7-5')).toEqual([2, 1])
  })
  it('sin marcador devuelve cero a cero', () => {
    expect(parseSetsWon(undefined)).toEqual([0, 0])
    expect(parseSetsWon('')).toEqual([0, 0])
  })
  it('ignora trozos no numéricos sin romperse', () => {
    expect(parseSetsWon('6-4 ret.')).toEqual([1, 0])
  })
})

describe('parseCurrentSetScore', () => {
  it('devuelve el set abierto', () => {
    expect(parseCurrentSetScore('6-4 3-2')).toBe('3-2')
    expect(parseCurrentSetScore('6-4 6-6')).toBe('6-6')   // camino al tiebreak
    expect(parseCurrentSetScore('6-4 5-4')).toBe('5-4')   // 6 aún no, sigue vivo
  })
  it('con todos los sets cerrados no hay set en curso', () => {
    expect(parseCurrentSetScore('6-4 6-2')).toBeNull()
    expect(parseCurrentSetScore('7-5')).toBeNull()
  })
  it('un set ganado en tiebreak está cerrado', () => {
    // 7-6 sin paréntesis solo tiene 1 de ventaja: sin el tiebreak parecería abierto.
    expect(parseCurrentSetScore('7-6(4)')).toBeNull()
  })
  it('sin marcador devuelve null', () => {
    expect(parseCurrentSetScore(undefined)).toBeNull()
    expect(parseCurrentSetScore('   ')).toBeNull()
  })
})

describe('formatTennisSets', () => {
  it('marca con * solo el set en juego', () => {
    expect(formatTennisSets('6-4 7-5 3-2')).toBe('6-4 7-5 *3-2')
  })
  it('un partido acabado no lleva ninguna marca', () => {
    expect(formatTennisSets('6-4 6-2')).toBe('6-4 6-2')
  })
  it('conserva los sets de tiebreak como cerrados', () => {
    expect(formatTennisSets('7-6(4) 6-7(8) 2-1')).toBe('7-6 6-7 *2-1')
  })
  it('el primer set recién empezado va marcado', () => {
    expect(formatTennisSets('1-0')).toBe('*1-0')
    expect(formatTennisSets('0-0')).toBe('*0-0')
  })
  it('sin marcador devuelve cadena vacía', () => {
    expect(formatTennisSets(undefined)).toBe('')
    expect(formatTennisSets('')).toBe('')
  })
})
