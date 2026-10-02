import { describe, expect, it } from 'vitest'
import { articleSportForMatch, matchNewsParams, MATCH_NEWS_WINDOW_DAYS } from './match-news'

describe('articleSportForMatch', () => {
  it('traduce el deporte de ESPN al de Sanity', () => {
    expect(articleSportForMatch('soccer')).toBe('futbol')
    expect(articleSportForMatch('racing')).toBe('formula1')
    expect(articleSportForMatch('mma')).toBe('ufc')
    expect(articleSportForMatch('basketball')).toBe('baloncesto')
    expect(articleSportForMatch('tennis')).toBe('tenis')
  })
  it('reconoce el rugby por la liga y descarta lo que Taka no cubre', () => {
    expect(articleSportForMatch('other', 'rugby/164205')).toBe('rugby')
    expect(articleSportForMatch('golf', 'golf/pga')).toBeNull()
    expect(articleSportForMatch(undefined)).toBeNull()
  })
})

describe('matchNewsParams', () => {
  const now = new Date('2026-10-02T12:00:00Z')

  it('Francia–Italia busca solo fútbol y en una ventana alrededor del partido', () => {
    const p = matchNewsParams({ homeTeam: 'Francia', awayTeam: 'Italia', sport: 'soccer', startDate: '2026-09-09T18:45:00Z' }, now)!
    expect(p.sport).toBe('futbol')
    expect(p.home).toBe('francia*')
    expect(p.away).toBe('italia*')
    const days = (Date.parse(p.to) - Date.parse(p.from)) / 86_400_000
    expect(days).toBe(MATCH_NEWS_WINDOW_DAYS * 2)
    expect(p.from).toBe('2026-08-28T18:45:00.000Z')
    expect(p.to).toBe('2026-09-21T18:45:00.000Z')
    expect(p.limit).toBe(4)
  })

  it('sin fecha del partido centra la ventana en hoy', () => {
    const p = matchNewsParams({ homeTeam: 'A', awayTeam: 'B', sport: 'soccer', startDate: 'no-fecha' }, now)!
    expect(p.from).toBe('2026-09-20T12:00:00.000Z')
  })

  it('sin equipos o sin deporte cubierto no hay bloque', () => {
    expect(matchNewsParams({ homeTeam: '', awayTeam: 'B', sport: 'soccer' }, now)).toBeNull()
    expect(matchNewsParams({ homeTeam: 'A', awayTeam: 'B', sport: 'golf' }, now)).toBeNull()
  })
})
