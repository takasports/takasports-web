import { describe, it, expect } from 'vitest'
import { dateKeyOf, fechaLabel, groupIntoFechas, fechaProgress, formatCountdown, plenoBonus, PLENO_MIN_MATCHES } from './fecha'
import { SOCCER_LOCK_MS, type SoccerEvent } from './types'

function ev(over: Partial<SoccerEvent> & { id: string }): SoccerEvent {
  return {
    sport: 'football',
    competition: 'LaLiga',
    event_date: '2026-08-22T19:00:00Z',
    team_home: 'Sevilla',
    team_away: 'Rayo Vallecano',
    featured: false,
    status: 'open',
    result: null,
    ...over,
  }
}

describe('dateKeyOf', () => {
  it('usa el date_key del servidor y no lo recalcula', () => {
    // Aunque el kickoff en UTC caiga en otro día, manda lo que dijo el servidor:
    // es el mismo valor con el que se agrupa la Fecha y se puntuará el pleno.
    const e = ev({ id: 'a', event_date: '2026-08-22T22:30:00Z', meta: { date_key: '2026-08-23' } })
    expect(dateKeyOf(e)).toBe('2026-08-23')
  })

  it('cae a calcularlo solo cuando falta (archivo del Mundial)', () => {
    // 22:30 UTC del sábado = 00:30 CEST del domingo.
    const e = ev({ id: 'b', event_date: '2026-08-22T22:30:00Z', meta: {} })
    expect(dateKeyOf(e)).toBe('2026-08-23')
  })
})

describe('fechaLabel', () => {
  const now = new Date('2026-08-22T10:00:00Z')

  it('dice Hoy y Mañana en vez de la fecha', () => {
    expect(fechaLabel('2026-08-22', now)).toBe('Hoy')
    expect(fechaLabel('2026-08-23', now)).toBe('Mañana')
  })

  it('para el resto, día de la semana y fecha corta', () => {
    expect(fechaLabel('2026-08-25', now)).toBe('martes 25 ago')
  })
})

describe('groupIntoFechas', () => {
  const now = new Date('2026-08-22T10:00:00Z')

  it('agrupa por date_key y ordena cronológicamente', () => {
    const fechas = groupIntoFechas([
      ev({ id: 'c', event_date: '2026-08-23T19:00:00Z', meta: { date_key: '2026-08-23' } }),
      ev({ id: 'a', event_date: '2026-08-22T19:00:00Z', meta: { date_key: '2026-08-22' } }),
      ev({ id: 'b', event_date: '2026-08-22T17:00:00Z', meta: { date_key: '2026-08-22' } }),
    ], now)

    expect(fechas.map(f => f.dateKey)).toEqual(['2026-08-22', '2026-08-23'])
    // Dentro de la Fecha, por hora de kickoff.
    expect(fechas[0].events.map(e => e.id)).toEqual(['b', 'a'])
  })

  it('identifica el Partido del Día de cada Fecha', () => {
    const fechas = groupIntoFechas([
      ev({ id: 'x', meta: { date_key: '2026-08-22' } }),
      ev({ id: 'star', featured: true, meta: { date_key: '2026-08-22' } }),
    ], now)
    expect(fechas[0].featured?.id).toBe('star')
  })

  it('el deadline de la Fecha es el cierre del PRIMER partido, no el del último', () => {
    // Es el momento a partir del cual ya no se puede completar la Fecha entera,
    // que es lo que le importa al usuario (y lo que anuncia la cuenta atrás).
    const fechas = groupIntoFechas([
      ev({ id: 'tarde',   event_date: '2026-08-22T21:00:00Z', meta: { date_key: '2026-08-22' } }),
      ev({ id: 'temprano', event_date: '2026-08-22T17:00:00Z', meta: { date_key: '2026-08-22' } }),
    ], now)
    expect(fechas[0].firstLockAt).toBe(Date.parse('2026-08-22T17:00:00Z') - SOCCER_LOCK_MS)
  })

  it('no propone deadline cuando todos los partidos del día ya están bloqueados', () => {
    // A las 20:00 un partido de las 20:30 lleva bloqueado desde las 19:30.
    const late = new Date('2026-08-22T20:00:00Z')
    const fechas = groupIntoFechas([
      ev({ id: 'ya', event_date: '2026-08-22T20:30:00Z', meta: { date_key: '2026-08-22' } }),
    ], late)
    expect(fechas[0].firstLockAt).toBeNull()
  })
})

describe('fechaProgress', () => {
  it('cuenta cuántos partidos de la Fecha llevan pick', () => {
    const [fecha] = groupIntoFechas([
      ev({ id: 'a', meta: { date_key: '2026-08-22' } }),
      ev({ id: 'b', meta: { date_key: '2026-08-22' } }),
      ev({ id: 'c', meta: { date_key: '2026-08-22' } }),
    ], new Date('2026-08-22T10:00:00Z'))
    expect(fechaProgress(fecha, new Set(['a', 'c']))).toEqual({ done: 2, total: 3 })
  })
})

describe('plenoBonus', () => {
  // Espejo de award_fecha_pleno (migración 124). Si la RPC cambia de escala y
  // esto no, la web anunciaría un premio que el servidor no paga.
  it('no paga pleno en Fechas demasiado pequeñas', () => {
    expect(plenoBonus(1)).toBe(0)
    expect(plenoBonus(PLENO_MIN_MATCHES - 1)).toBe(0)
  })

  it('escala con el tamaño de la Fecha: clavar seis vale más que clavar tres', () => {
    expect(plenoBonus(3)).toBe(6)
    expect(plenoBonus(6)).toBe(12)
    expect(plenoBonus(6)).toBeGreaterThan(plenoBonus(3))
  })
})

describe('formatCountdown', () => {
  it('se adapta a la escala', () => {
    expect(formatCountdown(45 * 60_000)).toBe('45m')
    expect(formatCountdown(2 * 3_600_000 + 14 * 60_000)).toBe('2h 14m')
    expect(formatCountdown(27 * 3_600_000)).toBe('1d 3h')
  })

  it('no muestra tiempos negativos', () => {
    expect(formatCountdown(-5000)).toBe('0m')
  })
})
