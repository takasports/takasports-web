import { describe, it, expect } from 'vitest'
import { selectHubEvents } from './sport-hub-events'
import type { SportEvent } from './types'

const NOW = Date.parse('2026-10-01T15:00:00Z')
const h = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString()

let n = 0
function ev(p: Partial<SportEvent> & { home: string; isoDate: string }): SportEvent {
  n += 1
  return {
    id: `espn-${n}`, away: null, sport: 'Fútbol', comp: 'LaLiga', date: 'Hoy', time: '21:00', accent: '#fff',
    matchRef: `soccer_esp.1_${n}`, ...p,
  }
}

describe('selectHubEvents', () => {
  it('trae los partidos de esta noche al hub de fútbol, con enlace a la ficha', () => {
    const out = selectHubEvents([
      ev({ home: 'Inter', away: 'Barcelona', comp: 'Champions League', isoDate: h(4) }),
      ev({ home: 'Lakers', away: 'Celtics', sport: 'NBA', comp: 'NBA', isoDate: h(10) }),
    ], 'futbol', NOW)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      home: 'Inter', away: 'Barcelona', date: h(4), status: 'programado',
      competition: { name: 'Champions League', slug: '' },
    })
    expect(out[0].href).toMatch(/^\/partido\/soccer_esp\.1_\d+$/)
  })

  it('elige por importancia y pinta en orden cronológico', () => {
    const out = selectHubEvents([
      ev({ home: 'Puebla', away: 'Toluca', comp: 'Liga MX', isoDate: h(1) }),
      ev({ home: 'Mazatlán', away: 'Necaxa', comp: 'Liga MX', isoDate: h(2) }),
      ev({ home: 'Real Madrid', away: 'Barcelona', comp: 'LaLiga', isoDate: h(30) }),
      ev({ home: 'Inter', away: 'Juventus', comp: 'Serie A', isoDate: h(5) }),
    ], 'futbol', NOW, 2)
    expect(out.map(e => e.home)).toEqual(['Inter', 'Real Madrid'])
  })

  it('lo de los próximos tres días va antes que un cartel de dentro de seis', () => {
    const out = selectHubEvents([
      ev({ home: 'Getafe', away: 'Alavés', isoDate: h(20) }),
      ev({ home: 'Real Madrid', away: 'Barcelona', isoDate: h(6 * 24) }),
    ], 'futbol', NOW, 1)
    expect(out.map(e => e.home)).toEqual(['Getafe'])
  })

  it('descarta lo acabado, lo de hace horas, lo que no tiene hora y lo de más de una semana', () => {
    const out = selectHubEvents([
      ev({ home: 'Acabado', away: 'X', isoDate: h(-1), homeScore: 2, awayScore: 0 }),
      ev({ home: 'Viejo', away: 'X', isoDate: h(-3) }),
      ev({ home: 'Sin hora', away: 'X', isoDate: h(5), timeTbd: true }),
      ev({ home: 'Lejano', away: 'X', isoDate: h(8 * 24) }),
      ev({ home: 'En juego', away: 'X', isoDate: h(-1) }),
    ], 'futbol', NOW)
    expect(out.map(e => e.home)).toEqual(['En juego'])
  })

  it('un hub sin ESPN (lucha libre, rugby) no devuelve nada y se queda con Sanity', () => {
    expect(selectHubEvents([ev({ home: 'A', away: 'B', isoDate: h(2) })], 'rugby', NOW)).toEqual([])
  })

  it('F1 y tenis se mapean por su etiqueta del feed', () => {
    const gp = ev({ home: 'Gran Premio de Japón', sport: 'F1', comp: 'Fórmula 1', isoDate: h(48) })
    const out = selectHubEvents([gp], 'formula1', NOW)
    expect(out[0]).toMatchObject({ home: 'Gran Premio de Japón', competition: { name: 'Fórmula 1', slug: '' } })
    expect(out[0].away).toBeUndefined()
    expect(selectHubEvents([ev({ home: 'Sinner', away: 'Alcaraz', sport: 'Tenis', comp: 'ATP', isoDate: h(3) })], 'tenis', NOW)).toHaveLength(1)
  })
})
