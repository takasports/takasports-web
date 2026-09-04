import { describe, it, expect } from 'vitest'
import { agruparPorDeporte } from './rankings-por-deporte'

const e = (id: string, sport?: string) => ({ id, sport })

const ORDEN = ['futbol', 'baloncesto', 'formula1', 'tenis', 'ufc']

describe('agruparPorDeporte', () => {
  it('agrupa por deporte respetando el orden base cuando no sigues nada', () => {
    const g = agruparPorDeporte(
      [e('a', 'tenis'), e('b', 'futbol'), e('c', 'ufc'), e('d', 'futbol')],
      ORDEN,
    )
    expect(g.map(x => x.sport)).toEqual(['futbol', 'tenis', 'ufc'])
    expect(g[0].entries.map(x => x.id)).toEqual(['b', 'd'])
  })

  it('sube los deportes que sigues, manteniendo el orden base dentro de cada mitad', () => {
    const g = agruparPorDeporte(
      [e('a', 'futbol'), e('b', 'baloncesto'), e('c', 'tenis'), e('d', 'ufc')],
      ORDEN,
      ['ufc', 'tenis'],
    )
    expect(g.map(x => x.sport)).toEqual(['tenis', 'ufc', 'futbol', 'baloncesto'])
    expect(g[0].seguido).toBe(true)
    expect(g[2].seguido).toBe(false)
  })

  it('un deporte que no está en el orden base va al final, no se pierde', () => {
    // La lucha libre sale en «Todos» de deportistas aunque no tenga su hueco en
    // la lista de deportes del track: Roman Reigns es hoy el nº 1 global.
    const g = agruparPorDeporte([e('reigns', 'wwe'), e('bellingham', 'futbol')], ORDEN)
    expect(g.map(x => x.sport)).toEqual(['futbol', 'wwe'])
  })

  it('conserva el orden de entrada dentro del grupo y corta a `porGrupo`', () => {
    const g = agruparPorDeporte(
      [e('1', 'futbol'), e('2', 'futbol'), e('3', 'futbol'), e('4', 'futbol')],
      ORDEN,
      [],
      3,
    )
    expect(g[0].entries.map(x => x.id)).toEqual(['1', '2', '3'])
    expect(g[0].total).toBe(4)
  })

  it('ignora las entradas sin deporte (siguen en la lista completa de abajo)', () => {
    const g = agruparPorDeporte([e('x'), e('y', 'futbol')], ORDEN)
    expect(g.map(s => s.sport)).toEqual(['futbol'])
    expect(g[0].total).toBe(1)
  })

  it('devuelve lista vacía sin entradas', () => {
    expect(agruparPorDeporte([], ORDEN)).toEqual([])
  })
})
