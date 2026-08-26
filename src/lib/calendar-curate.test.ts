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

describe('curateDay — política MÍNIMO/ÉLITE unificada', () => {
  it('día flojo (nada élite): garantiza el mínimo (4)', () => {
    const events = Array.from({ length: 10 }, (_, i) => amis(i))
    expect(curateDay(events, { now: NOW })).toHaveLength(4)
  })
  it('amplía mientras el siguiente sea élite (score ≥ 12)', () => {
    // 6 Champions (score 12 = élite) + 4 amistosos → mantiene los 6 élite, corta los amistosos.
    const events = [...Array.from({ length: 6 }, (_, i) => champ(i)), ...Array.from({ length: 4 }, (_, i) => amis(i))]
    expect(curateDay(events, { now: NOW })).toHaveLength(6)
  })
  it('SIN tope: entran todos los buenos que haya en el día', () => {
    // 20 Champions: antes el MAX de 8 recortaba un sábado europeo a ciegas.
    const events = Array.from({ length: 20 }, (_, i) => champ(i))
    expect(curateDay(events, { now: NOW })).toHaveLength(20)
  })
  it('estar EN DIRECTO no cuela un partido flojo', () => {
    // Antes todo directo entraba fuera del corte y el modo se llenaba de rondas
    // previas de Grand Slam en juego. [José Tomás, 26/08/2026]
    const events = [
      ...Array.from({ length: 8 }, (_, i) => champ(i)),
      ev({ sport: 'Fútbol', comp: 'Amistoso', home: 'LIVE', away: 'Z', isoDate: day(9) }),
    ]
    const out = curateDay(events, { now: NOW, isLive: (e) => e.home === 'LIVE' })
    expect(out).toHaveLength(8)
    expect(out.some((e) => e.home === 'LIVE')).toBe(false)
  })
  it('un torneo de nota 11 no cualifica por estar en juego', () => {
    // US Open = 11: con el bonus de directo llegaría a 12,5 y se colaría entero,
    // rondas previas incluidas. El mérito se mide SIN el bonus.
    const previa = Array.from({ length: 6 }, (_, i) =>
      ev({ sport: 'Tenis', comp: 'US Open', home: `Q${i}`, away: `R${i}`, isoDate: day(8 + (i % 6)) }),
    )
    const out = curateDay(previa, { now: NOW, isLive: () => true })
    expect(out).toHaveLength(4) // solo el mínimo del día
  })
  it('el directo ORDENA: adelanta a su igual que aún no ha empezado', () => {
    const enJuego = ev({ sport: 'Fútbol', comp: 'Champions', home: 'EN JUEGO', away: 'B', isoDate: day(10) })
    const porJugar = ev({ sport: 'Fútbol', comp: 'Champions', home: 'POR JUGAR', away: 'D', isoDate: day(9) })
    const out = curateDay([porJugar, enJuego], { now: NOW, isLive: (e) => e.home === 'EN JUEGO' })
    expect(out[0].home).toBe('EN JUEGO')
  })
  it('los días ya jugados se curan IGUAL que los futuros', () => {
    // Antes salían completos: como la app aterriza en el pasado, "Destacados"
    // parecía no filtrar nada. Para verlos todos está el modo "Todo".
    const past = Array.from({ length: 10 }, (_, i) => ev({ sport: 'Fútbol', comp: 'Amistoso', home: `P${i}`, away: `Q${i}`, isoDate: `2026-02-20T18:00:00Z` }))
    expect(curateDay(past, { now: NOW })).toHaveLength(4)
  })
  it('tus EQUIPOS entran todos, por flojo que sea el partido', () => {
    const events = [
      ...Array.from({ length: 6 }, (_, i) => amis(i)),
      ...Array.from({ length: 5 }, (_, i) => ev({ sport: 'Fútbol', comp: 'Amistoso', home: 'Real Betis', away: `R${i}`, isoDate: day(8 + (i % 6)) })),
    ]
    const out = curateDay(events, { now: NOW, equiposSeguidos: ['Real Betis'] })
    expect(out.filter((e) => e.home === 'Real Betis')).toHaveLength(5)
  })
  it('un tope explícito (escaparates estrechos) se sigue respetando', () => {
    const events = Array.from({ length: 20 }, (_, i) => champ(i))
    expect(curateDay(events, { now: NOW, max: 5 })).toHaveLength(5)
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
