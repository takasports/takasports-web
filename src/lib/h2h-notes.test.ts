import { describe, it, expect } from 'vitest'
import { leagueSlugFromMatchRef, h2hCandidates } from './h2h-notes'
import type { SportEvent } from './types'

describe('leagueSlugFromMatchRef', () => {
  it('reconstruye el slug de ESPN desde el matchRef', () => {
    // matchRef = `${slug.replace('/','_')}_${espnId}` (ver lib/espn.ts)
    expect(leagueSlugFromMatchRef('soccer_esp.1_706123')).toBe('soccer/esp.1')
    expect(leagueSlugFromMatchRef('soccer_uefa.champions_99')).toBe('soccer/uefa.champions')
    expect(leagueSlugFromMatchRef('basketball_nba_401')).toBe('basketball/nba')
  })

  it('distingue la liga femenina de la masculina (importa para el H2H)', () => {
    expect(leagueSlugFromMatchRef('soccer_esp.w.1_55')).toBe('soccer/esp.w.1')
  })

  it('devuelve undefined si el ref no tiene la forma esperada', () => {
    expect(leagueSlugFromMatchRef(undefined)).toBeUndefined()
    expect(leagueSlugFromMatchRef('')).toBeUndefined()
    expect(leagueSlugFromMatchRef('singuiones')).toBeUndefined()
    expect(leagueSlugFromMatchRef('solo_uno')).toBeUndefined()
  })
})

const ev = (over: Partial<SportEvent>): SportEvent => ({
  id: over.id ?? 'x', home: 'A', away: 'B', sport: 'Fútbol', comp: 'LaLiga',
  date: '', time: '', accent: '', ...over,
})

describe('h2hCandidates', () => {
  const top = { rank: 1, pts: 40 }
  const second = { rank: 2, pts: 38 }
  const mid = { rank: 11, pts: 20 }

  it('solo elige cruces CON motivo de tabla', () => {
    const list = [
      ev({ id: 'conmotivo', homeStanding: top, awayStanding: second }),
      ev({ id: 'sinmotivo', homeStanding: top, awayStanding: mid }),
      ev({ id: 'sintabla' }),
    ]
    expect(h2hCandidates(list).map(e => e.id)).toEqual(['conmotivo'])
  })

  it('descarta eventos sin rival y los ya jugados', () => {
    const list = [
      ev({ id: 'carrera', away: null, homeStanding: top, awayStanding: second }),
      ev({ id: 'pasado', isPast: true, homeStanding: top, awayStanding: second }),
    ]
    expect(h2hCandidates(list)).toEqual([])
  })

  it('respeta el tope de consultas', () => {
    const list = Array.from({ length: 30 }, (_, i) =>
      ev({ id: `e${i}`, homeStanding: top, awayStanding: second }),
    )
    expect(h2hCandidates(list, 5)).toHaveLength(5)
    expect(h2hCandidates(list)).toHaveLength(20) // tope por defecto
  })
})
