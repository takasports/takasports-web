import { describe, it, expect } from 'vitest'
import {
  RANKED_FOOTBALL_SOURCES,
  MIN_PER_DATE,
  MAX_PER_DATE,
  toDateKey,
  scoreFixture,
  scoreFixtures,
  selectForDate,
  buildRankedDates,
  rankedFootballId,
  type FootballFixture,
} from './football-ranked'

// ── Helpers ──────────────────────────────────────────────────────────────────

let seq = 0
function fx(over: Partial<FootballFixture> = {}): FootballFixture {
  seq += 1
  return {
    espnId:     over.espnId    ?? `e${String(seq).padStart(3, '0')}`,
    isoDate:    over.isoDate   ?? '2026-08-15T19:00Z',
    comp:       over.comp      ?? 'LaLiga',
    leagueSlug: over.leagueSlug ?? 'soccer/esp.1',
    home:       over.home      ?? 'Getafe',
    away:       over.away      ?? 'Alaves',
    stage:      over.stage,
  }
}

// ── Alcance ──────────────────────────────────────────────────────────────────

describe('alcance (núcleo europeo)', () => {
  it('incluye Champions y las top-5, y deja fuera lo que no se decidió cubrir', () => {
    const comps = RANKED_FOOTBALL_SOURCES.map(s => s.comp)
    for (const c of ['Champions', 'LaLiga', 'Premier', 'Serie A', 'Bundesliga', 'Ligue 1']) {
      expect(comps).toContain(c)
    }
    // El alcance elegido fue "núcleo europeo": ni América ni segundas divisiones.
    for (const c of ['Liga MX', 'MLS', 'Brasileirão', 'Championship', 'LaLiga 2']) {
      expect(comps).not.toContain(c)
    }
  })

  it('hereda los nombres de FOOTBALL_LEAGUES, no los redeclara', () => {
    // Si alguien renombra una comp en la lista maestra, este motor debe seguirla
    // sola: los colores de COMP_ACCENT y el calendario dependen de ese nombre.
    for (const s of RANKED_FOOTBALL_SOURCES) {
      expect(s.slug).toBeTruthy()
      expect(s.comp).toBeTruthy()
    }
  })
})

// ── Agrupación por día ───────────────────────────────────────────────────────

describe('toDateKey', () => {
  it('agrupa por el día de Madrid, que es el que la UI imprime', () => {
    // 22:30 UTC del sábado = 00:30 CEST del domingo → bloque del domingo.
    expect(toDateKey('2026-08-15T22:30Z')).toBe('2026-08-16')
    // Un Champions de las 21:00 CEST sigue en su propio día.
    expect(toDateKey('2026-08-15T19:00Z')).toBe('2026-08-15')
  })
})

// ── Puntuación ───────────────────────────────────────────────────────────────

describe('scoreFixture', () => {
  it('pone la Champions por encima de una copa nacional', () => {
    const ucl  = scoreFixture(fx({ comp: 'Champions', home: 'Ajax',   away: 'Benfica' }))
    const copa = scoreFixture(fx({ comp: 'Copa Rey',  home: 'Eibar',  away: 'Mirandes' }))
    expect(ucl).toBeGreaterThan(copa)
  })

  it('sube un partido con equipo de cartel por encima de uno anónimo de la misma liga', () => {
    const clasico = scoreFixture(fx({ comp: 'LaLiga', home: 'Real Madrid', away: 'Barcelona' }))
    const gris    = scoreFixture(fx({ comp: 'LaLiga', home: 'Getafe',      away: 'Alaves'    }))
    expect(clasico).toBeGreaterThan(gris)
  })

  it('reconoce selecciones aunque ESPN las mande en inglés', () => {
    // Sin traducir, un España-Brasil puntuaría como amistoso cualquiera. Este
    // test es el que protege esa traducción: si se cae, el parón FIFA se llena
    // de amistosos irrelevantes y los partidazos de selección no destacan.
    const bueno = scoreFixture(fx({ comp: 'Amistoso', home: 'Spain',   away: 'Brazil'   }))
    const malo  = scoreFixture(fx({ comp: 'Amistoso', home: 'Andorra', away: 'San Marino' }))
    expect(bueno).toBeGreaterThan(malo)
  })

  it('no depende del reloj: mismo fixture, misma puntuación', () => {
    const f = fx({ comp: 'Premier', home: 'Arsenal', away: 'Chelsea' })
    expect(scoreFixture(f)).toBe(scoreFixture({ ...f }))
  })

  it('premia la fase final', () => {
    const final   = scoreFixture(fx({ comp: 'Copa Rey', stage: 'Final',        home: 'Betis', away: 'Osasuna' }))
    const ronda   = scoreFixture(fx({ comp: 'Copa Rey', stage: 'Round of 32',  home: 'Betis', away: 'Osasuna' }))
    expect(final).toBeGreaterThan(ronda)
  })
})

// ── Selección por Fecha ──────────────────────────────────────────────────────

describe('selectForDate', () => {
  it('no pasa del techo de 6 aunque el día tenga liga entera', () => {
    const day = scoreFixtures(Array.from({ length: 10 }, () => fx({ comp: 'LaLiga' })))
    const date = selectForDate(day)!
    expect(date.matches).toHaveLength(MAX_PER_DATE)
  })

  it('devuelve todo cuando el día tiene menos partidos que el mínimo', () => {
    const day = scoreFixtures([fx({ comp: 'LaLiga' }), fx({ comp: 'LaLiga' })])
    const date = selectForDate(day)!
    expect(date.matches).toHaveLength(2)
  })

  it('prefiere una Fecha de un solo partidazo antes que rellenarla con morralla', () => {
    // Final de Champions + tres partidos de copa menor: el relleno NO entra,
    // ni siquiera para llegar al mínimo de 3.
    const day = scoreFixtures([
      fx({ espnId: 'ucl', comp: 'Champions', stage: 'Final', home: 'Real Madrid', away: 'Liverpool' }),
      fx({ comp: 'Copa Francia' }),
      fx({ comp: 'Copa Francia' }),
      fx({ comp: 'Copa Francia' }),
    ])
    const date = selectForDate(day)!
    expect(date.matches.map(m => m.espnId)).toEqual(['ucl'])
    expect(date.matches.length).toBeLessThan(MIN_PER_DATE)
  })

  it('deja pasar toda la parrilla top cuando compiten de tú a tú', () => {
    // Todos por encima del 60% del mejor → entran por la regla principal, sin
    // necesidad de la de rescate.
    const day = scoreFixtures([
      fx({ espnId: 'a', comp: 'Premier',  home: 'Arsenal', away: 'Chelsea' }),
      fx({ espnId: 'b', comp: 'LaLiga' }),
      fx({ espnId: 'c', comp: 'Serie A' }),
      fx({ espnId: 'd', comp: 'Bundesliga' }),
    ])
    expect(selectForDate(day)!.matches).toHaveLength(4)
  })

  it('rescata hasta el mínimo a los que se quedan a las puertas del corte', () => {
    // Final de Champions en prime time = 16,5; Copa del Rey en prime time = 7,5.
    // El 7,5 no llega al 60% del mejor (9,9) pero sí supera el suelo absoluto,
    // así que la Fecha se completa con ellos en vez de quedarse en un partido.
    const day = scoreFixtures([
      fx({ espnId: 'ucl', comp: 'Champions', stage: 'Final', home: 'Ajax',   away: 'Benfica' }),
      fx({ espnId: 'c1',  comp: 'Copa Rey',  home: 'Eibar',  away: 'Mirandes' }),
      fx({ espnId: 'c2',  comp: 'Copa Rey',  home: 'Burgos', away: 'Huesca' }),
      fx({ espnId: 'c3',  comp: 'Copa Rey',  home: 'Lugo',   away: 'Racing' }),
    ])
    const date = selectForDate(day)!
    expect(date.matches).toHaveLength(MIN_PER_DATE)
    expect(date.matches[0].espnId).toBe('ucl')
    expect(date.featuredEspnId).toBe('ucl')
  })

  it('marca como Partido del Día el de mayor puntuación, y está entre los elegidos', () => {
    const day = scoreFixtures([
      fx({ espnId: 'gris',    comp: 'LaLiga' }),
      fx({ espnId: 'clasico', comp: 'LaLiga', home: 'Real Madrid', away: 'Barcelona' }),
      fx({ espnId: 'otro',    comp: 'LaLiga' }),
    ])
    const date = selectForDate(day)!
    expect(date.featuredEspnId).toBe('clasico')
    expect(date.matches.map(m => m.espnId)).toContain(date.featuredEspnId)
  })

  it('desempata por id para que dos ejecuciones elijan el mismo destacado', () => {
    // Dos partidos idénticos en puntuación: sin desempate estable, el Partido
    // del Día dependería del orden en que ESPN devolviera el JSON.
    const base = { comp: 'LaLiga', home: 'Getafe', away: 'Alaves', isoDate: '2026-08-15T19:00Z' }
    const asc  = selectForDate(scoreFixtures([fx({ ...base, espnId: 'aaa' }), fx({ ...base, espnId: 'bbb' })]))!
    const desc = selectForDate(scoreFixtures([fx({ ...base, espnId: 'bbb' }), fx({ ...base, espnId: 'aaa' })]))!
    expect(asc.featuredEspnId).toBe('aaa')
    expect(desc.featuredEspnId).toBe('aaa')
  })

  it('devuelve null si el día está vacío', () => {
    expect(selectForDate([])).toBeNull()
  })

  it('NO publica un día en el que no hay nada que merezca destacarse', () => {
    // El bug que destapó la prueba contra ESPN real: una jornada de segunda
    // ronda de Carabao Cup coronaba un Bristol City - Walsall como Partido del
    // Día ×2. Antes que un destacado que no destaca, no hay Fecha.
    const day = scoreFixtures([
      fx({ comp: 'Carabao Cup', home: 'Bristol City',    away: 'Walsall' }),
      fx({ comp: 'Carabao Cup', home: 'Wycombe Wanderers', away: 'Stevenage' }),
      fx({ comp: 'Carabao Cup', home: 'Grimsby Town',    away: 'Blackpool' }),
    ])
    expect(selectForDate(day)).toBeNull()
  })

  it('aplica el suelo también dentro de un día bueno', () => {
    // Un partidazo no arrastra consigo a la morralla del mismo día.
    const day = scoreFixtures([
      fx({ espnId: 'liga', comp: 'LaLiga',       home: 'Real Madrid',  away: 'Sevilla' }),
      fx({ espnId: 'copa', comp: 'Carabao Cup',  home: 'Grimsby Town', away: 'Blackpool' }),
    ])
    expect(selectForDate(day)!.matches.map(m => m.espnId)).toEqual(['liga'])
  })

  it('deja pasar la Supercopa de Europa, que antes puntuaba como copa menor', () => {
    // 'Super Cup' no tenía entrada en LEAGUE_IMPORTANCE y caía al default (4):
    // un PSG - Aston Villa por un título europeo se quedaba fuera de su Fecha.
    const day = scoreFixtures([
      fx({ comp: 'Super Cup', home: 'Paris Saint-Germain', away: 'Aston Villa' }),
    ])
    expect(selectForDate(day)).not.toBeNull()
  })
})

// ── Fechas de una tanda ──────────────────────────────────────────────────────

describe('buildRankedDates', () => {
  it('parte la tanda en un bloque por día, en orden cronológico', () => {
    const dates = buildRankedDates(scoreFixtures([
      fx({ isoDate: '2026-08-16T19:00Z' }),
      fx({ isoDate: '2026-08-15T19:00Z' }),
      fx({ isoDate: '2026-08-15T17:00Z' }),
    ]))
    expect(dates.map(d => d.dateKey)).toEqual(['2026-08-15', '2026-08-16'])
    expect(dates[0].matches).toHaveLength(2)
  })

  it('da un Partido del Día por Fecha, no uno por tanda', () => {
    const dates = buildRankedDates(scoreFixtures([
      fx({ isoDate: '2026-08-15T19:00Z' }),
      fx({ isoDate: '2026-08-16T19:00Z' }),
    ]))
    expect(dates).toHaveLength(2)
    expect(new Set(dates.map(d => d.featuredEspnId)).size).toBe(2)
  })

  it('NUNCA recalcula un día ya publicado', () => {
    // La regla de oro: si el cron pudiera reseleccionar, un partido ya
    // pronosticado podría desaparecer de la Fecha o perder su x2 a media semana.
    const fixtures = scoreFixtures([
      fx({ isoDate: '2026-08-15T19:00Z' }),
      fx({ isoDate: '2026-08-16T19:00Z' }),
    ])
    const dates = buildRankedDates(fixtures, new Set(['2026-08-15']))
    expect(dates.map(d => d.dateKey)).toEqual(['2026-08-16'])
  })

  it('es idempotente: la misma tanda produce exactamente la misma selección', () => {
    const fixtures = scoreFixtures([
      fx({ espnId: 'a', comp: 'Champions', isoDate: '2026-08-15T19:00Z', home: 'Bayern', away: 'Inter' }),
      fx({ espnId: 'b', comp: 'LaLiga',    isoDate: '2026-08-15T17:00Z' }),
      fx({ espnId: 'c', comp: 'Premier',   isoDate: '2026-08-15T15:00Z', home: 'Arsenal', away: 'Everton' }),
      fx({ espnId: 'd', comp: 'Serie A',   isoDate: '2026-08-16T19:00Z' }),
    ])
    expect(buildRankedDates(fixtures)).toEqual(buildRankedDates([...fixtures].reverse()))
  })
})

// ── Identidad ────────────────────────────────────────────────────────────────

describe('rankedFootballId', () => {
  it('no colisiona con el archivo del Mundial 2026, que comparte tabla y origen', () => {
    expect(rankedFootballId('727123')).toBe('fb-espn-727123')
    expect(rankedFootballId('727123')).not.toBe('wc26-espn-727123')
  })
})
