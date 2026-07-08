import { describe, it, expect } from 'vitest'
import {
  liveFixtureToEvent,
  liveCardsFromFixtures,
  withLiveFirst,
  scoresForEvents,
  namesMatch,
  liveSportPassesFilter,
  isLiveStatus,
  type RawLiveFixture,
} from './live-events'
import type { SportEvent } from './types'

function fx(partial: Partial<RawLiveFixture>): RawLiveFixture {
  return {
    homeTeam: 'Home', awayTeam: 'Away',
    homeGoals: 0, awayGoals: 0,
    status: '2H', elapsed: 30,
    sport: 'soccer', comp: 'Mundial',
    matchRef: 'ref',
    ...partial,
  }
}

function up(partial: Partial<SportEvent> & Pick<SportEvent, 'id' | 'home' | 'away'>): SportEvent {
  return {
    sport: 'Fútbol', comp: 'Mundial', date: 'Hoy', time: '21:00', accent: '#7C3AED',
    ...partial,
  }
}

describe('namesMatch', () => {
  it('casa ignorando acentos y mayúsculas', () => {
    expect(namesMatch('Bosnia y Herzegovina', 'bosnia y herzegovina')).toBe(true)
    expect(namesMatch('Catar', 'CATAR')).toBe(true)
    expect(namesMatch('Perú', 'Peru')).toBe(true)
  })
  it('no casa equipos distintos', () => {
    expect(namesMatch('Suiza', 'Canadá')).toBe(false)
  })
})

describe('liveSportPassesFilter', () => {
  // Regresión: un partido en vivo huérfano (fútbol) NO puede desaparecer de la
  // vista por defecto 'Destacados'. Antes 'Fútbol' !== 'Destacados' lo ocultaba
  // (p. ej. Colombia–Ghana del Mundial en juego, no presente en el SSR).
  it("'Destacados' deja pasar cualquier deporte (es un pseudo-filtro de todos)", () => {
    expect(liveSportPassesFilter('Destacados', 'soccer')).toBe(true)
    expect(liveSportPassesFilter('Destacados', 'basketball')).toBe(true)
    expect(liveSportPassesFilter('Destacados', 'tennis')).toBe(true)
  })
  it("'Todo' deja pasar cualquier deporte", () => {
    expect(liveSportPassesFilter('Todo', 'soccer')).toBe(true)
    expect(liveSportPassesFilter('Todo', 'mma')).toBe(true)
  })
  it('un deporte concreto solo deja pasar sus propias fixtures', () => {
    expect(liveSportPassesFilter('Fútbol', 'soccer')).toBe(true)
    expect(liveSportPassesFilter('Baloncesto', 'basketball')).toBe(true)
    expect(liveSportPassesFilter('Fútbol', 'tennis')).toBe(false)
    expect(liveSportPassesFilter('Tenis', 'soccer')).toBe(false)
  })
})

describe('liveFixtureToEvent', () => {
  it('mapea con id "live:" y etiqueta de deporte', () => {
    const ev = liveFixtureToEvent(fx({ matchRef: 'soccer_x', sport: 'soccer', homeTeam: 'Bosnia', awayTeam: 'Catar' }))
    expect(ev.id).toBe('live:soccer_x')
    expect(ev.sport).toBe('Fútbol')
    expect(ev.home).toBe('Bosnia')
    expect(ev.away).toBe('Catar')
  })
})

describe('isLiveStatus', () => {
  it('EN JUEGO = estado no vacío ni terminal ni programado', () => {
    expect(isLiveStatus('2H')).toBe(true)
    expect(isLiveStatus('HT')).toBe(true)
    expect(isLiveStatus('Q3')).toBe(true)
    expect(isLiveStatus('STATUS_IN_PROGRESS')).toBe(true)
  })
  it('terminado / programado / vacío = NO en juego', () => {
    expect(isLiveStatus('FT')).toBe(false)
    expect(isLiveStatus('Final')).toBe(false)
    expect(isLiveStatus('STATUS_FINAL')).toBe(false)
    expect(isLiveStatus('NS')).toBe(false)
    expect(isLiveStatus('')).toBe(false)
  })
  it('aplazado / previa NO es en juego (antes se colaba como EN DIRECTO)', () => {
    expect(isLiveStatus('PRE_GAME')).toBe(false)
    expect(isLiveStatus('DELAYED')).toBe(false)
    expect(isLiveStatus('RAIN_DELAY')).toBe(false)
    expect(isLiveStatus('POSTPONED')).toBe(false)
    expect(isLiveStatus('FORFEIT')).toBe(false)
  })
})

describe('liveCardsFromFixtures', () => {
  it('solo incluye partidos EN JUEGO con rival (fuera FT, NS, aplazados y sin rival)', () => {
    const cards = liveCardsFromFixtures([
      fx({ status: '2H', homeTeam: 'A', awayTeam: 'B', matchRef: 'r1' }),        // en juego ✓
      fx({ status: 'FT', homeTeam: 'C', awayTeam: 'D', matchRef: 'r2' }),        // terminado ✗
      fx({ status: 'NS', homeTeam: 'E', awayTeam: 'F', matchRef: 'r3' }),        // no empezado ✗
      fx({ status: 'PRE_GAME', homeTeam: 'P', awayTeam: 'Q', matchRef: 'r5' }),  // previa ✗
      fx({ status: 'DELAYED', homeTeam: 'R', awayTeam: 'S', matchRef: 'r6' }),   // aplazado ✗
      fx({ status: '1H', homeTeam: 'G', awayTeam: null, matchRef: 'r4' }),       // sin rival ✗
    ])
    expect(cards).toHaveLength(1)
    expect(cards[0].home).toBe('A')
  })

  it('ordena por importancia (Mundial antes que liga menor)', () => {
    const cards = liveCardsFromFixtures([
      fx({ comp: 'MLS', homeTeam: 'x1', awayTeam: 'y1', matchRef: 'r1' }),
      fx({ comp: 'Mundial', homeTeam: 'España', awayTeam: 'Brasil', matchRef: 'r2' }),
    ])
    expect(cards[0].comp).toBe('Mundial')
  })

  it('respeta el tope', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      fx({ comp: 'MLS', homeTeam: `H${i}`, awayTeam: `A${i}`, matchRef: `r${i}` }))
    expect(liveCardsFromFixtures(many, 6)).toHaveLength(6)
  })
})

describe('withLiveFirst', () => {
  const upcoming: SportEvent[] = [
    up({ id: 'u1', home: 'Suiza', away: 'Canadá' }),
    up({ id: 'u2', home: 'Bosnia y Herzegovina', away: 'Catar' }),
  ]

  it('antepone los vivos y deduplica el próximo del mismo partido', () => {
    const live = liveCardsFromFixtures([
      fx({ homeTeam: 'Bosnia y Herzegovina', awayTeam: 'Catar', matchRef: 'live_bos' }),
    ])
    const out = withLiveFirst(live, upcoming)
    expect(out[0].id).toBe('live:live_bos')          // el vivo, primero
    expect(out).toHaveLength(2)                        // u2 (Bosnia–Catar) deduplicado
    expect(out.some(e => e.id === 'u2')).toBe(false)
    expect(out.some(e => e.id === 'u1')).toBe(true)
  })

  it('sin vivos devuelve los próximos tal cual', () => {
    expect(withLiveFirst([], upcoming)).toEqual(upcoming)
  })
})

describe('scoresForEvents', () => {
  it('asocia el marcador a la tarjeta en vivo por nombre (con acentos)', () => {
    const fixtures = [
      fx({ homeTeam: 'Bosnia y Herzegovina', awayTeam: 'Catar', homeGoals: 2, awayGoals: 1, status: '2H', matchRef: 'live_bos' }),
    ]
    const live = liveCardsFromFixtures(fixtures)
    const scores = scoresForEvents(live, fixtures)
    const s = scores.get('live:live_bos')
    expect(s).toBeTruthy()
    expect(s!.homeGoals).toBe(2)
    expect(s!.awayGoals).toBe(1)
    expect(s!.status).toBe('2H')
  })
})
