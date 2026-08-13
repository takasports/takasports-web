import { describe, it, expect } from 'vitest'
import {
  dateKeyOf, weekKeyOf, dayLabel, jornadaLabel, groupIntoJornadas,
  jornadaProgress, formatCountdown, plenoBonus, PLENO_MIN_MATCHES,
} from './jornada'
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
    // Aunque el kickoff en UTC caiga en otro día, manda lo que dijo el servidor.
    const e = ev({ id: 'a', event_date: '2026-08-22T22:30:00Z', meta: { date_key: '2026-08-23' } })
    expect(dateKeyOf(e)).toBe('2026-08-23')
  })

  it('cae a calcularlo solo cuando falta (archivo del Mundial)', () => {
    // 22:30 UTC del sábado = 00:30 CEST del domingo.
    const e = ev({ id: 'b', event_date: '2026-08-22T22:30:00Z', meta: {} })
    expect(dateKeyOf(e)).toBe('2026-08-23')
  })
})

describe('weekKeyOf', () => {
  it('usa el week_key del servidor y no lo recalcula', () => {
    const e = ev({ id: 'a', event_date: '2026-08-22T19:00:00Z', meta: { week_key: '2026-08-17' } })
    expect(weekKeyOf(e)).toBe('2026-08-17')
  })

  it('cae a calcularlo (lunes de esa semana ISO) cuando falta', () => {
    const e = ev({ id: 'b', event_date: '2026-08-22T19:00:00Z', meta: {} })
    expect(weekKeyOf(e)).toBe('2026-08-17')
  })
})

describe('dayLabel', () => {
  const now = new Date('2026-08-22T10:00:00Z')

  it('dice Hoy y Mañana en vez de la fecha', () => {
    expect(dayLabel('2026-08-22', now)).toBe('Hoy')
    expect(dayLabel('2026-08-23', now)).toBe('Mañana')
  })

  it('para el resto, día de la semana y fecha corta', () => {
    expect(dayLabel('2026-08-25', now)).toBe('martes 25 ago')
  })
})

describe('jornadaLabel', () => {
  // 22-ago-2026 es sábado → semana en curso empieza el lunes 17.
  const now = new Date('2026-08-22T10:00:00Z')

  it('dice "Esta Jornada" para la semana en curso', () => {
    expect(jornadaLabel('2026-08-17', now)).toBe('Esta Jornada')
  })

  it('dice "Próxima Jornada" para la semana siguiente', () => {
    expect(jornadaLabel('2026-08-24', now)).toBe('Próxima Jornada')
  })

  it('para el resto, el rango lunes-domingo dentro del mismo mes', () => {
    expect(jornadaLabel('2026-09-07', now)).toBe('Jornada del 7 al 13 sep')
  })

  it('cuando la semana cruza de mes, cada extremo lleva el suyo', () => {
    expect(jornadaLabel('2026-08-31', now)).toBe('Jornada del 31 ago al 6 sep')
  })
})

describe('groupIntoJornadas', () => {
  const now = new Date('2026-08-22T10:00:00Z')

  it('agrupa por week_key (no por día) y ordena cronológicamente', () => {
    const jornadas = groupIntoJornadas([
      ev({ id: 'c', event_date: '2026-08-24T19:00:00Z', meta: { date_key: '2026-08-24', week_key: '2026-08-24' } }),
      ev({ id: 'a', event_date: '2026-08-22T19:00:00Z', meta: { date_key: '2026-08-22', week_key: '2026-08-17' } }),
      ev({ id: 'b', event_date: '2026-08-22T17:00:00Z', meta: { date_key: '2026-08-22', week_key: '2026-08-17' } }),
    ], now)

    expect(jornadas.map(j => j.weekKey)).toEqual(['2026-08-17', '2026-08-24'])
    // Dentro de la Jornada, por hora de kickoff — es la misma semana entera.
    expect(jornadas[0].events.map(e => e.id)).toEqual(['b', 'a'])
  })

  it('parte cada Jornada en sub-bloques por día', () => {
    const jornadas = groupIntoJornadas([
      ev({ id: 'sab', event_date: '2026-08-22T19:00:00Z', meta: { date_key: '2026-08-22', week_key: '2026-08-17' } }),
      ev({ id: 'dom', event_date: '2026-08-23T19:00:00Z', meta: { date_key: '2026-08-23', week_key: '2026-08-17' } }),
    ], now)
    expect(jornadas[0].days.map(d => d.dateKey)).toEqual(['2026-08-22', '2026-08-23'])
    expect(jornadas[0].days[0].events.map(e => e.id)).toEqual(['sab'])
  })

  it('identifica el Partidazo de cada Jornada', () => {
    const jornadas = groupIntoJornadas([
      ev({ id: 'x', meta: { week_key: '2026-08-17' } }),
      ev({ id: 'star', featured: true, meta: { week_key: '2026-08-17' } }),
    ], now)
    expect(jornadas[0].featured?.id).toBe('star')
  })

  it('el deadline es el cierre del primer partido AÚN por jugar de la semana', () => {
    const jornadas = groupIntoJornadas([
      ev({ id: 'tarde',   event_date: '2026-08-23T21:00:00Z', meta: { week_key: '2026-08-17' } }),
      ev({ id: 'temprano', event_date: '2026-08-22T17:00:00Z', meta: { week_key: '2026-08-17' } }),
    ], now)
    expect(jornadas[0].firstLockAt).toBe(Date.parse('2026-08-22T17:00:00Z') - SOCCER_LOCK_MS)
  })

  it('no propone deadline cuando todos los partidos de la semana ya están bloqueados', () => {
    const late = new Date('2026-08-23T20:00:00Z')
    const jornadas = groupIntoJornadas([
      ev({ id: 'ya', event_date: '2026-08-22T20:30:00Z', meta: { week_key: '2026-08-17' } }),
    ], late)
    expect(jornadas[0].firstLockAt).toBeNull()
  })
})

describe('jornadaProgress', () => {
  it('cuenta cuántos partidos de la Jornada llevan pick, en toda la semana', () => {
    const [jornada] = groupIntoJornadas([
      ev({ id: 'a', meta: { week_key: '2026-08-17' } }),
      ev({ id: 'b', meta: { week_key: '2026-08-17' } }),
      ev({ id: 'c', meta: { week_key: '2026-08-17' } }),
    ], new Date('2026-08-22T10:00:00Z'))
    expect(jornadaProgress(jornada, new Set(['a', 'c']))).toEqual({ done: 2, total: 3 })
  })
})

describe('plenoBonus', () => {
  // Espejo de award_jornada_pleno (migración 125). Si la RPC cambia de escala
  // y esto no, la web anunciaría un premio que el servidor no paga.
  it('no paga pleno en Jornadas demasiado pequeñas', () => {
    expect(plenoBonus(1)).toBe(0)
    expect(plenoBonus(PLENO_MIN_MATCHES - 1)).toBe(0)
  })

  it('escala con el tamaño de la Jornada: clavar nueve vale más que clavar tres', () => {
    expect(plenoBonus(3)).toBe(6)
    expect(plenoBonus(9)).toBe(18)
    expect(plenoBonus(9)).toBeGreaterThan(plenoBonus(3))
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
