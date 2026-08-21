import { describe, it, expect } from 'vitest'
import { standingsAreMeaningful, STANDINGS_MIN_GP } from './espn-standings'

const table = (...gps: number[]) => gps.map(gp => ({ gp }))

describe('standingsAreMeaningful', () => {
  it('tabla vacía no vale', () => {
    expect(standingsAreMeaningful([])).toBe(false)
  })

  it('pretemporada: todos a 0 jugados → la tabla es alfabética, no vale', () => {
    // Caso real Premier 21/08/2026: 20 equipos, 0 partidos, "1º AFC Bournemouth".
    expect(standingsAreMeaningful(table(...Array(20).fill(0)))).toBe(false)
  })

  it('1-2 jornadas siguen siendo ruido', () => {
    // Caso real LaLiga 21/08/2026: 2 jornadas, "líder" Alavés con 4 pts.
    expect(standingsAreMeaningful(table(2, 2, 1, 2))).toBe(false)
  })

  it('a partir del umbral la tabla ya dice algo', () => {
    expect(standingsAreMeaningful(table(STANDINGS_MIN_GP, 2, 2))).toBe(true)
    // Caso real Brasileirão 21/08/2026: 23 jornadas.
    expect(standingsAreMeaningful(table(23, 23, 22))).toBe(true)
  })

  it('basta con que UN equipo llegue al umbral (calendarios desiguales)', () => {
    expect(standingsAreMeaningful(table(0, 1, 4))).toBe(true)
  })
})
