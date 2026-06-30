import { describe, it, expect } from 'vitest'
import { groupDayByCompetition } from './calendar'
import type { SportEvent } from './types'

// Evento mínimo para las pruebas de ordenación (solo importan comp e isoDate).
const ev = (id: string, comp: string, isoDate: string): SportEvent => ({
  id,
  comp,
  home: id,
  away: 'Rival',
  sport: 'Fútbol',
  date: '',
  time: '',
  accent: '',
  isoDate,
})

describe('groupDayByCompetition — orden cronológico dentro de cada liga', () => {
  it('ordena los partidos por hora DENTRO de la liga, sin importar el orden de entrada', () => {
    // Entrada en orden de "relevancia" (NO cronológico): el partidazo de las 22:00
    // llega primero, luego el de las 18:00 y por último el de las 03:00.
    const input = [
      ev('22h', 'Mundial', '2026-07-02T20:00:00Z'),
      ev('18h', 'Mundial', '2026-07-02T16:00:00Z'),
      ev('03h', 'Mundial', '2026-07-02T01:00:00Z'),
    ]
    const { order, byComp } = groupDayByCompetition(input)
    expect(order).toEqual(['Mundial'])
    // Tras agrupar, dentro del Mundial deben quedar por hora ascendente.
    expect(byComp['Mundial'].map(e => e.id)).toEqual(['03h', '18h', '22h'])
  })

  it('mantiene el orden de las LIGAS por primera aparición (no lo reordena por hora)', () => {
    const input = [
      ev('m22', 'Mundial', '2026-07-02T20:00:00Z'),   // Mundial aparece primero
      ev('w06', 'Wimbledon', '2026-07-02T04:00:00Z'), // Wimbledon más temprano, pero aparece después
      ev('m18', 'Mundial', '2026-07-02T16:00:00Z'),
    ]
    const { order } = groupDayByCompetition(input)
    // El orden de ligas NO cambia aunque Wimbledon empiece antes: respeta aparición.
    expect(order).toEqual(['Mundial', 'Wimbledon'])
  })

  it('cada liga queda cronológica aunque las ligas se solapen en el tiempo', () => {
    const input = [
      ev('m22', 'Mundial', '2026-07-02T20:00:00Z'),
      ev('w06', 'Wimbledon', '2026-07-02T04:00:00Z'),
      ev('m03', 'Mundial', '2026-07-02T01:00:00Z'),
      ev('w20', 'Wimbledon', '2026-07-02T18:00:00Z'),
    ]
    const { byComp } = groupDayByCompetition(input)
    expect(byComp['Mundial'].map(e => e.id)).toEqual(['m03', 'm22'])
    expect(byComp['Wimbledon'].map(e => e.id)).toEqual(['w06', 'w20'])
  })

  it('es estable con un único partido y con isoDate ausente', () => {
    const input = [ev('solo', 'F1', '2026-07-02T11:30:00Z'), { ...ev('x', 'F1', ''), isoDate: undefined }]
    const { order, byComp } = groupDayByCompetition(input)
    expect(order).toEqual(['F1'])
    expect(byComp['F1']).toHaveLength(2)
  })
})
