import { describe, it, expect } from 'vitest'
import { buildPlayerIndex, lookupPlayerId, normalizePlayerName } from './match-player-index'

const alineacion = [
  { id: '149622', name: 'Jan Oblak' },
  { id: '231388', name: 'Julián Álvarez' },
  { id: '45843', name: 'Koke' },
  { id: '90000', name: 'Carlos Martín' },
]

describe('normalizePlayerName', () => {
  it('ignora acentos, mayúsculas y signos', () => {
    expect(normalizePlayerName('Julián Álvarez')).toBe('julianalvarez')
    expect(normalizePlayerName("N'Golo Kanté")).toBe('ngolokante')
  })
})

describe('buildPlayerIndex + lookupPlayerId', () => {
  const idx = buildPlayerIndex(alineacion)

  it('encuentra por nombre completo', () => {
    expect(lookupPlayerId(idx, 'Julián Álvarez')).toBe('231388')
    expect(lookupPlayerId(idx, 'Jan Oblak')).toBe('149622')
  })

  it('encuentra por apellido, que es como suele nombrar la crónica', () => {
    expect(lookupPlayerId(idx, 'Álvarez')).toBe('231388')
    expect(lookupPlayerId(idx, 'Oblak')).toBe('149622')
  })

  it('tolera una grafía sin acentos', () => {
    expect(lookupPlayerId(idx, 'Julian Alvarez')).toBe('231388')
  })

  it('funciona con mononimios', () => {
    expect(lookupPlayerId(idx, 'Koke')).toBe('45843')
  })

  it('un apellido COMPARTIDO no enlaza a nadie (mejor sin enlace que al que no es)', () => {
    const conDosMartin = buildPlayerIndex([
      ...alineacion,
      { id: '90001', name: 'Rodrigo Martín' },
    ])
    expect(lookupPlayerId(conDosMartin, 'Martín')).toBeUndefined()
    // Los nombres completos siguen resolviendo.
    expect(lookupPlayerId(conDosMartin, 'Carlos Martín')).toBe('90000')
    expect(lookupPlayerId(conDosMartin, 'Rodrigo Martín')).toBe('90001')
  })

  it('un jugador que no está en la alineación se queda sin enlace', () => {
    expect(lookupPlayerId(idx, 'Lionel Messi')).toBeUndefined()
  })

  it('no se rompe con entradas vacías o incompletas', () => {
    expect(lookupPlayerId(idx, undefined)).toBeUndefined()
    expect(lookupPlayerId(idx, '   ')).toBeUndefined()
    const idxSucio = buildPlayerIndex([{ id: '', name: 'Sin id' }, { id: '7', name: '' }])
    expect(idxSucio.size).toBe(0)
  })

  it('el apellido no pisa a un jugador cuyo nombre completo ya es ese', () => {
    const idx2 = buildPlayerIndex([
      { id: '1', name: 'Koke' },
      { id: '2', name: 'Sergio Koke' },
    ])
    expect(lookupPlayerId(idx2, 'Koke')).toBe('1')
  })
})
