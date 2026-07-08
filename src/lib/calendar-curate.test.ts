import { describe, it, expect } from 'vitest'
import { toSportSlug, eventMatchesFollowed, filterByFollowed, curateDay, type CurateEvent } from './calendar-curate'

describe('toSportSlug — un solo mapeador para los vocabularios dispersos', () => {
  it('etiqueta española del feed → slug', () => {
    expect(toSportSlug('Fútbol')).toBe('futbol')
    expect(toSportSlug('Baloncesto')).toBe('baloncesto')
    expect(toSportSlug('NBA')).toBe('baloncesto')
    expect(toSportSlug('F1')).toBe('formula1')
    expect(toSportSlug('Fórmula 1')).toBe('formula1')
    expect(toSportSlug('UFC')).toBe('ufc')
    expect(toSportSlug('Tenis')).toBe('tenis')
  })
  it('slug ESPN inglés (live/upcoming) → slug', () => {
    expect(toSportSlug('soccer')).toBe('futbol')
    expect(toSportSlug('basketball')).toBe('baloncesto')
    expect(toSportSlug('mma')).toBe('ufc')
    expect(toSportSlug('racing')).toBe('formula1')
    expect(toSportSlug('tennis')).toBe('tenis')
    expect(toSportSlug('atp')).toBe('tenis')
    expect(toSportSlug('wta')).toBe('tenis')
  })
  it('leagueSlug ESPN con prefijo → slug', () => {
    expect(toSportSlug('soccer/esp.1')).toBe('futbol')
    expect(toSportSlug('racing/f1')).toBe('formula1')
    expect(toSportSlug('tennis/atp')).toBe('tenis')
  })
  it('SportSlug canónico se mantiene', () => {
    for (const s of ['futbol', 'baloncesto', 'formula1', 'tenis', 'ufc', 'wwe', 'rugby']) {
      expect(toSportSlug(s)).toBe(s)
    }
  })
  it('desconocido/vacío → null', () => {
    expect(toSportSlug('curling')).toBeNull()
    expect(toSportSlug('')).toBeNull()
    expect(toSportSlug(null)).toBeNull()
  })
})

const ev = (o: Partial<CurateEvent>): CurateEvent => ({ sport: 'Fútbol', comp: 'Amistoso', home: 'X', away: 'Y', ...o })

describe('eventMatchesFollowed / filterByFollowed — reglas del dueño', () => {
  it('sin deportes NI equipos seguidos → pasa TODO', () => {
    const events = [ev({ sport: 'Tenis' }), ev({ sport: 'Fútbol' })]
    expect(filterByFollowed(events, {})).toHaveLength(2)
    expect(filterByFollowed(events, { deportesSeguidos: [], equiposSeguidos: [] })).toHaveLength(2)
  })
  it('filtra por deporte seguido (normalizando vocabularios)', () => {
    const events = [ev({ sport: 'Fútbol' }), ev({ sport: 'soccer' }), ev({ sport: 'Tenis' }), ev({ sport: 'basketball' })]
    const out = filterByFollowed(events, { deportesSeguidos: ['futbol'] })
    expect(out).toHaveLength(2) // los dos de fútbol (label ES + slug ESPN)
  })
  it('(b) Mundial se muestra SIEMPRE aunque no sigas fútbol', () => {
    const mundial = ev({ sport: 'Fútbol', comp: 'Mundial' })
    expect(eventMatchesFollowed(mundial, { deportesSeguidos: ['tenis'] })).toBe(true)
  })
  it('(b) los directos se muestran SIEMPRE', () => {
    const live = ev({ sport: 'Baloncesto', comp: 'NBA' })
    expect(eventMatchesFollowed(live, { deportesSeguidos: ['tenis'] }, { isLive: () => true })).toBe(true)
    expect(eventMatchesFollowed(live, { deportesSeguidos: ['tenis'] }, { isLive: () => false })).toBe(false)
  })
  it('(c) un equipo seguido pasa aunque su deporte NO esté seguido', () => {
    const e = ev({ sport: 'Baloncesto', comp: 'NBA', home: 'Los Angeles Lakers', away: 'Celtics' })
    expect(eventMatchesFollowed(e, { deportesSeguidos: ['futbol'], equiposSeguidos: ['Lakers'] })).toBe(true)
    expect(eventMatchesFollowed(e, { deportesSeguidos: ['futbol'] })).toBe(false)
  })
})

// Eventos de HOY (2026-03-01) salvo el marcado como pasado.
const NOW = Date.parse('2026-03-01T12:00:00Z')
const day = (h: number) => `2026-03-01T${String(h).padStart(2, '0')}:00:00Z`
const champ = (i: number) => ev({ sport: 'Fútbol', comp: 'Champions', home: `A${i}`, away: `B${i}`, isoDate: day(8 + (i % 6)) })
const amis = (i: number) => ev({ sport: 'Fútbol', comp: 'Amistoso', home: `C${i}`, away: `D${i}`, isoDate: day(8 + (i % 6)) })

describe('curateDay — política MIN/ÉLITE/MÁX unificada', () => {
  it('día flojo (nada élite): garantiza el mínimo (4)', () => {
    const events = Array.from({ length: 10 }, (_, i) => amis(i))
    expect(curateDay(events, { now: NOW })).toHaveLength(4)
  })
  it('amplía mientras el siguiente sea élite (score ≥ 12), hasta el tope', () => {
    // 6 Champions (score 12 = élite) + 4 amistosos → mantiene los 6 élite, corta los amistosos.
    const events = [...Array.from({ length: 6 }, (_, i) => champ(i)), ...Array.from({ length: 4 }, (_, i) => amis(i))]
    expect(curateDay(events, { now: NOW })).toHaveLength(6)
  })
  it('respeta el tope (max) pero los DIRECTOS entran igual fuera de tope', () => {
    // 8 Champions (llenan el tope de 8) + 1 amistoso EN VIVO → el directo se muestra igual (9).
    const events = [
      ...Array.from({ length: 8 }, (_, i) => champ(i)),
      ev({ sport: 'Fútbol', comp: 'Amistoso', home: 'LIVE', away: 'Z', isoDate: day(9) }),
    ]
    const out = curateDay(events, { now: NOW, isLive: (e) => e.home === 'LIVE' })
    expect(out).toHaveLength(9)
    expect(out.some((e) => e.home === 'LIVE')).toBe(true)
  })
  it('días ya jugados se muestran COMPLETOS (sin recortar)', () => {
    const past = Array.from({ length: 10 }, (_, i) => ev({ sport: 'Fútbol', comp: 'Amistoso', home: `P${i}`, away: `Q${i}`, isoDate: `2026-02-20T18:00:00Z` }))
    expect(curateDay(past, { now: NOW })).toHaveLength(10)
  })
  it('filtra por seguidos ANTES de curar', () => {
    const events = [
      ...Array.from({ length: 5 }, (_, i) => ev({ sport: 'Tenis', comp: 'ATP', home: `T${i}`, away: `U${i}`, isoDate: day(8 + i % 6) })),
      ...Array.from({ length: 5 }, (_, i) => amis(i)),
    ]
    // Solo sigo fútbol → los 5 de tenis se van; quedan fútbol, curados a min 4.
    const out = curateDay(events, { now: NOW, deportesSeguidos: ['futbol'] })
    expect(out.every((e) => toSportSlug(e.sport) === 'futbol')).toBe(true)
    expect(out).toHaveLength(4)
  })
})
