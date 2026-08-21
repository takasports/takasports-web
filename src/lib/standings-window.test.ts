import { describe, it, expect } from 'vitest'
import {
  isSeasonUnderway, hasEnoughGames, standingsUsable, gamesPlayedPlausible, STANDINGS_MIN_GP,
} from './standings-window'

const table = (...gps: number[]) => gps.map(gp => ({ gp }))
const at = (iso: string) => new Date(iso)

// Ventanas REALES leídas de ESPN el 21/08/2026.
const NBA = { startDate: '2026-09-30T07:00Z', endDate: '2027-06-26T06:59Z' }
const LALIGA = { startDate: '2026-06-01T04:00Z', endDate: '2027-06-01T03:59Z' }
const BRASIL = { startDate: '2026-01-01T05:05Z', endDate: '2026-12-31T04:59Z' }

describe('isSeasonUnderway', () => {
  it('antes del pistoletazo, no', () => {
    expect(isSeasonUnderway(NBA, at('2026-08-21T10:00Z'))).toBe(false)
    expect(isSeasonUnderway(NBA, at('2026-09-29T23:00Z'))).toBe(false)
  })

  it('dentro de la ventana, sí', () => {
    expect(isSeasonUnderway(NBA, at('2026-10-15T10:00Z'))).toBe(true)
    expect(isSeasonUnderway(LALIGA, at('2026-08-21T10:00Z'))).toBe(true)
    expect(isSeasonUnderway(BRASIL, at('2026-08-21T10:00Z'))).toBe(true)
  })

  it('pasada la fecha de cierre, no (temporada terminada)', () => {
    expect(isSeasonUnderway(NBA, at('2027-07-01T10:00Z'))).toBe(false)
    expect(isSeasonUnderway(BRASIL, at('2027-01-05T10:00Z'))).toBe(false)
  })

  it('sin ventana no bloquea (decide el mínimo de jornadas)', () => {
    expect(isSeasonUnderway(undefined, at('2026-08-21T10:00Z'))).toBe(true)
    expect(isSeasonUnderway({}, at('2026-08-21T10:00Z'))).toBe(true)
  })

  it('una fecha ilegible se ignora en vez de bloquear', () => {
    expect(isSeasonUnderway({ startDate: 'ni idea' }, at('2026-08-21T10:00Z'))).toBe(true)
  })
})

describe('hasEnoughGames', () => {
  it('pretemporada (todos a cero) no basta', () => {
    expect(hasEnoughGames(table(0, 0, 0))).toBe(false)
  })
  it('una o dos jornadas tampoco', () => {
    expect(hasEnoughGames(table(2, 2, 1))).toBe(false)
  })
  it('a partir del umbral sí', () => {
    expect(hasEnoughGames(table(STANDINGS_MIN_GP, 1))).toBe(true)
    expect(hasEnoughGames(table(23, 22))).toBe(true)
  })
})

describe('standingsUsable — los dos casos reales del 21/08/2026', () => {
  const hoy = at('2026-08-21T10:00Z')

  it('NBA: tabla del curso PASADO servida antes de empezar el nuevo → no se usa', () => {
    // 82 partidos jugados: pasaría de sobra el mínimo de jornadas, y aun así
    // no debe enseñarse porque la temporada 2026-27 no ha arrancado.
    expect(standingsUsable(table(82, 82, 82), NBA, hoy)).toBe(false)
  })

  it('LaLiga: temporada en marcha pero con 2 jornadas → todavía no', () => {
    expect(standingsUsable(table(2, 2, 1), LALIGA, hoy)).toBe(false)
  })

  it('Brasileirão: en marcha y con 23 jornadas → sí', () => {
    expect(standingsUsable(table(23, 23, 22), BRASIL, hoy)).toBe(true)
  })
})

describe('standingsUsable — el ciclo completo de una temporada NBA', () => {
  it('se enciende sola al jugarse las primeras jornadas y se apaga al acabar', () => {
    // Verano: no ha empezado (aunque ESPN sirva la tabla vieja, con 82 jugados).
    expect(standingsUsable(table(82), NBA, at('2026-08-21T00:00Z'))).toBe(false)
    // Semana 1: ya empezó, pero solo 2 partidos → aún no.
    expect(standingsUsable(table(2, 2), NBA, at('2026-10-05T00:00Z'))).toBe(false)
    // Semana 3: en marcha y con jornadas suficientes → ENCENDIDO, sin tocar nada.
    expect(standingsUsable(table(8, 7), NBA, at('2026-10-20T00:00Z'))).toBe(true)
    // Playoffs: sigue dentro de la ventana.
    expect(standingsUsable(table(82, 82), NBA, at('2027-05-01T00:00Z'))).toBe(true)
    // Julio siguiente: temporada cerrada → APAGADO, sin tocar nada.
    expect(standingsUsable(table(82, 82), NBA, at('2027-07-15T00:00Z'))).toBe(false)
  })

  it('sin filas nunca se usa', () => {
    expect(standingsUsable([], NBA, at('2026-10-20T00:00Z'))).toBe(false)
  })
})

describe('gamesPlayedPlausible — la red para las filas rezagadas', () => {
  it('82 partidos a los dos días de empezar es imposible → tabla vieja', () => {
    // El caso feo: ESPN cambia los metadatos de temporada ANTES que las filas.
    expect(gamesPlayedPlausible(table(82, 82), NBA, at('2026-10-02T12:00Z'))).toBe(false)
    expect(standingsUsable(table(82, 82), NBA, at('2026-10-02T12:00Z'))).toBe(false)
  })

  it('en cuanto las filas son de la temporada nueva, pasa', () => {
    expect(gamesPlayedPlausible(table(3, 2), NBA, at('2026-10-06T12:00Z'))).toBe(true)
    expect(standingsUsable(table(4, 3), NBA, at('2026-10-06T12:00Z'))).toBe(true)
  })

  it('una temporada avanzada no se ve afectada', () => {
    expect(gamesPlayedPlausible(table(82, 80), NBA, at('2027-05-01T12:00Z'))).toBe(true)
    expect(gamesPlayedPlausible(table(23, 22), BRASIL, at('2026-08-21T12:00Z'))).toBe(true)
    expect(gamesPlayedPlausible(table(2, 1), LALIGA, at('2026-08-21T12:00Z'))).toBe(true)
  })

  it('sin fecha de inicio no bloquea', () => {
    expect(gamesPlayedPlausible(table(82), {}, at('2026-10-02T12:00Z'))).toBe(true)
  })
})
