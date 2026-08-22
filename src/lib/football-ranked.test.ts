import { describe, it, expect } from 'vitest'
import {
  RANKED_FOOTBALL_SOURCES,
  MIN_PER_WEEK,
  MAX_PER_WEEK,
  MIN_ABSOLUTE_SCORE,
  toDateKey,
  toWeekKey,
  scoreFixture,
  scoreFixtures,
  selectForWeek,
  buildRankedWeeks,
  weekEndKey,
  rankedFootballId,
  type FootballFixture,
} from './football-ranked'

// ── Helpers ──────────────────────────────────────────────────────────────────

let seq = 0
// Equipos DISTINTOS por defecto en cada fixture. Antes todos salían
// Getafe-Alaves y, desde que la selección aplica "un equipo, un partido"
// (oneMatchPerTeam), una tanda sintética colapsaba a un único partido y los
// tests de cupos medían otra cosa. Los que quieran un equipo concreto lo pasan.
function fx(over: Partial<FootballFixture> = {}): FootballFixture {
  seq += 1
  return {
    espnId:     over.espnId    ?? `e${String(seq).padStart(3, '0')}`,
    isoDate:    over.isoDate   ?? '2026-08-15T19:00Z',
    comp:       over.comp      ?? 'LaLiga',
    leagueSlug: over.leagueSlug ?? 'soccer/esp.1',
    home:       over.home      ?? `Local ${seq}`,
    away:       over.away      ?? `Visitante ${seq}`,
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

// ── Agrupación por día y por semana ─────────────────────────────────────────

describe('toDateKey', () => {
  it('agrupa por el día de Madrid, que es el que la UI imprime', () => {
    // 22:30 UTC del sábado = 00:30 CEST del domingo → bloque del domingo.
    expect(toDateKey('2026-08-15T22:30Z')).toBe('2026-08-16')
    // Un Champions de las 21:00 CEST sigue en su propio día.
    expect(toDateKey('2026-08-15T19:00Z')).toBe('2026-08-15')
  })
})

describe('toWeekKey', () => {
  it('agrupa lun-dom bajo el lunes de esa semana', () => {
    // Sábado 15 y domingo 16 de agosto de 2026 caen en la misma semana ISO:
    // el lunes 10 de agosto.
    expect(toWeekKey('2026-08-15T19:00Z')).toBe('2026-08-10')
    expect(toWeekKey('2026-08-16T17:00Z')).toBe('2026-08-10')
    // El lunes siguiente ya es otra semana.
    expect(toWeekKey('2026-08-17T19:00Z')).toBe('2026-08-17')
  })

  it('un lunes se pertenece a sí mismo', () => {
    expect(toWeekKey('2026-08-10T12:00Z')).toBe('2026-08-10')
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

  it('sube un derbi por encima de dos equipos de la misma liga sin rivalidad', () => {
    // Sevilla y Betis no son marquee por sí solos: sin el boost de rivalidad,
    // el derbi puntuaría exactamente igual que cualquier otro partido de LaLiga.
    const derbi = scoreFixture(fx({ comp: 'LaLiga', home: 'Sevilla',  away: 'Real Betis' }))
    const gris  = scoreFixture(fx({ comp: 'LaLiga', home: 'Getafe',   away: 'Alaves'     }))
    expect(derbi).toBeGreaterThan(gris)
  })

  it('reconoce el cruce en cualquier orden (local o visitante)', () => {
    const a = scoreFixture(fx({ comp: 'Serie A', home: 'Inter',  away: 'Milan' }))
    const b = scoreFixture(fx({ comp: 'Serie A', home: 'Milan',  away: 'Inter' }))
    expect(a).toBe(b)
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

// ── Selección por Jornada ────────────────────────────────────────────────────

describe('selectForWeek', () => {
  it('no pasa del techo de 9 aunque la semana tenga varias ligas enteras', () => {
    const week = scoreFixtures(Array.from({ length: 15 }, () => fx({ comp: 'LaLiga' })))
    const jornada = selectForWeek(week)!
    expect(jornada.matches).toHaveLength(MAX_PER_WEEK)
  })

  it('devuelve todo cuando la semana tiene menos partidos que el mínimo', () => {
    const week = scoreFixtures([fx({ comp: 'LaLiga' }), fx({ comp: 'LaLiga' })])
    const jornada = selectForWeek(week)!
    expect(jornada.matches).toHaveLength(2)
  })

  it('prefiere una Jornada corta de partidazos antes que rellenarla con morralla', () => {
    // Final de Champions + tres partidos de copa menor: el relleno NO entra,
    // ni siquiera para llegar al mínimo de 7.
    const week = scoreFixtures([
      fx({ espnId: 'ucl', comp: 'Champions', stage: 'Final', home: 'Real Madrid', away: 'Liverpool' }),
      fx({ comp: 'Copa Francia' }),
      fx({ comp: 'Copa Francia' }),
      fx({ comp: 'Copa Francia' }),
    ])
    const jornada = selectForWeek(week)!
    expect(jornada.matches.map(m => m.espnId)).toEqual(['ucl'])
    expect(jornada.matches.length).toBeLessThan(MIN_PER_WEEK)
  })

  it('deja pasar toda la parrilla top cuando compiten de tú a tú', () => {
    // Todos por encima del 60% del mejor → entran por la regla principal, sin
    // necesidad de la de rescate.
    const week = scoreFixtures([
      fx({ espnId: 'a', comp: 'Premier',  home: 'Arsenal', away: 'Chelsea' }),
      fx({ espnId: 'b', comp: 'LaLiga' }),
      fx({ espnId: 'c', comp: 'Serie A' }),
      fx({ espnId: 'd', comp: 'Bundesliga' }),
    ])
    expect(selectForWeek(week)!.matches).toHaveLength(4)
  })

  it('rescata hasta el mínimo a los que se quedan a las puertas del corte', () => {
    // Final de Champions en prime time = 16,5; Copa del Rey en prime time = 7,5.
    // El 7,5 no llega al 60% del mejor (9,9) pero sí supera el suelo absoluto,
    // así que la Jornada se completa con ellos en vez de quedarse en un partido.
    const week = scoreFixtures([
      fx({ espnId: 'ucl', comp: 'Champions', stage: 'Final', home: 'Ajax',   away: 'Benfica' }),
      fx({ espnId: 'c1',  comp: 'Copa Rey',  home: 'Eibar',  away: 'Mirandes' }),
      fx({ espnId: 'c2',  comp: 'Copa Rey',  home: 'Burgos', away: 'Huesca' }),
      fx({ espnId: 'c3',  comp: 'Copa Rey',  home: 'Lugo',   away: 'Racing' }),
      fx({ espnId: 'c4',  comp: 'Copa Rey',  home: 'Cadiz',  away: 'Ferrol' }),
      fx({ espnId: 'c5',  comp: 'Copa Rey',  home: 'Leonesa', away: 'Ponferradina' }),
      fx({ espnId: 'c6',  comp: 'Copa Rey',  home: 'Sanse',  away: 'Alcorcon' }),
    ])
    const jornada = selectForWeek(week)!
    expect(jornada.matches).toHaveLength(MIN_PER_WEEK)
    expect(jornada.matches[0].espnId).toBe('ucl')
    expect(jornada.featuredEspnId).toBe('ucl')
  })

  it('marca como Partidazo de la Jornada el de mayor puntuación, y está entre los elegidos', () => {
    const week = scoreFixtures([
      fx({ espnId: 'gris',    comp: 'LaLiga' }),
      fx({ espnId: 'clasico', comp: 'LaLiga', home: 'Real Madrid', away: 'Barcelona' }),
      fx({ espnId: 'otro',    comp: 'LaLiga' }),
    ])
    const jornada = selectForWeek(week)!
    expect(jornada.featuredEspnId).toBe('clasico')
    expect(jornada.matches.map(m => m.espnId)).toContain(jornada.featuredEspnId)
  })

  it('desempata por id para que dos ejecuciones elijan el mismo destacado', () => {
    // Dos partidos idénticos en puntuación: sin desempate estable, el Partidazo
    // de la Jornada dependería del orden en que ESPN devolviera el JSON.
    const base = { comp: 'LaLiga', home: 'Getafe', away: 'Alaves', isoDate: '2026-08-15T19:00Z' }
    const asc  = selectForWeek(scoreFixtures([fx({ ...base, espnId: 'aaa' }), fx({ ...base, espnId: 'bbb' })]))!
    const desc = selectForWeek(scoreFixtures([fx({ ...base, espnId: 'bbb' }), fx({ ...base, espnId: 'aaa' })]))!
    expect(asc.featuredEspnId).toBe('aaa')
    expect(desc.featuredEspnId).toBe('aaa')
  })

  it('devuelve null si la semana está vacía', () => {
    expect(selectForWeek([])).toBeNull()
  })

  it('NO publica una semana en la que no hay nada que merezca destacarse', () => {
    // El bug que destapó la prueba contra ESPN real: una jornada de segunda
    // ronda de Carabao Cup coronaba un Bristol City - Walsall como Partido del
    // Día ×2. Antes que un destacado que no destaca, no hay Jornada.
    const week = scoreFixtures([
      fx({ comp: 'Carabao Cup', home: 'Bristol City',    away: 'Walsall' }),
      fx({ comp: 'Carabao Cup', home: 'Wycombe Wanderers', away: 'Stevenage' }),
      fx({ comp: 'Carabao Cup', home: 'Grimsby Town',    away: 'Blackpool' }),
    ])
    expect(selectForWeek(week)).toBeNull()
  })

  it('aplica el suelo también dentro de una semana buena', () => {
    // Un partidazo no arrastra consigo a la morralla de la misma semana.
    const week = scoreFixtures([
      fx({ espnId: 'liga', comp: 'LaLiga',       home: 'Real Madrid',  away: 'Sevilla' }),
      fx({ espnId: 'copa', comp: 'Carabao Cup',  home: 'Grimsby Town', away: 'Blackpool' }),
    ])
    expect(selectForWeek(week)!.matches.map(m => m.espnId)).toEqual(['liga'])
  })

  it('deja pasar la Supercopa de Europa, que antes puntuaba como copa menor', () => {
    // 'Super Cup' no tenía entrada en LEAGUE_IMPORTANCE y caía al default (4):
    // un PSG - Aston Villa por un título europeo se quedaba fuera de su Jornada.
    const week = scoreFixtures([
      fx({ comp: 'Super Cup', home: 'Paris Saint-Germain', away: 'Aston Villa' }),
    ])
    expect(selectForWeek(week)).not.toBeNull()
  })
})

// ── Calidad del emparejamiento ───────────────────────────────────────────────

describe('selectForWeek · el partido lo hacen LOS DOS equipos', () => {
  // El fallo que decidía el Partidazo a cara o cruz: el peso de los grandes era
  // binario (+2 si CUALQUIERA de los dos lo era), así que un Crystal
  // Palace-Manchester City empataba con un Barcelona-Athletic y el desempate
  // acababa siendo el orden alfabético del id de ESPN.
  it('un cruce entre dos nombres gana a un grande contra un chico', () => {
    const week = selectForWeek(scoreFixtures([
      fx({ espnId: 'a', comp: 'Premier', home: 'Crystal Palace', away: 'Manchester City' }),
      fx({ espnId: 'b', comp: 'LaLiga',  home: 'Barcelona',      away: 'Athletic Club' }),
    ]))!
    expect(week.featuredEspnId).toBe('b')
  })

  it('sigue ganando aunque el desempate por id favoreciera al otro', () => {
    // 'a' iría primero por id: si empataran en puntos, ganaría el equivocado.
    const week = selectForWeek(scoreFixtures([
      fx({ espnId: 'a', comp: 'LaLiga', home: 'Real Madrid', away: 'Levante' }),
      fx({ espnId: 'z', comp: 'LaLiga', home: 'Sevilla',     away: 'Atlético Madrid' }),
    ]))!
    expect(week.featuredEspnId).toBe('z')
  })

  it('ningún partido baja de puntuación respecto al modelo binario', () => {
    // Importa porque MIN_ABSOLUTE_SCORE es un listón ABSOLUTO calibrado sobre
    // la escala vieja: si algún cruce bajara, dejaría de publicarse sin que
    // nadie hubiera decidido excluirlo.
    const unGrande = scoreFixtures([fx({ comp: 'Premier', home: 'Burnley', away: 'Liverpool' })])[0]
    expect(unGrande.score).toBeGreaterThanOrEqual(MIN_ABSOLUTE_SCORE)
    const dosGrandes = scoreFixtures([fx({ comp: 'Premier', home: 'Newcastle United', away: 'Liverpool' })])[0]
    expect(dosGrandes.score).toBeGreaterThan(unGrande.score)
  })
})

describe('selectForWeek · un equipo, un partido', () => {
  it('en una semana con doblete se queda con el mejor de ese equipo', () => {
    // Pasó de verdad: la Jornada del 24 al 30 traía Real Madrid-Real Sociedad
    // Y Real Madrid-Málaga, gastando dos plazas de nueve en el mismo equipo.
    const week = selectForWeek(scoreFixtures([
      fx({ espnId: 'bueno', comp: 'LaLiga', home: 'Real Madrid', away: 'Real Sociedad' }),
      fx({ espnId: 'peor',  comp: 'LaLiga', home: 'Real Madrid', away: 'Málaga' }),
    ]))!
    expect(week.matches.map(m => m.espnId)).toEqual(['bueno'])
  })

  it('descarta el doblete tanto si el equipo repite en casa como fuera', () => {
    const week = selectForWeek(scoreFixtures([
      fx({ espnId: 'bueno', comp: 'LaLiga', home: 'Barcelona', away: 'Athletic Club' }),
      fx({ espnId: 'peor',  comp: 'LaLiga', home: 'Elche',     away: 'Barcelona' }),
    ]))!
    expect(week.matches.map(m => m.espnId)).toEqual(['bueno'])
  })

  it('no deja la Jornada corta por descartar: sigue llenando con lo siguiente', () => {
    const fixtures = [
      fx({ espnId: 'r1', comp: 'LaLiga', home: 'Real Madrid', away: 'Sevilla' }),
      fx({ espnId: 'r2', comp: 'LaLiga', home: 'Real Madrid', away: 'Levante' }),
      ...Array.from({ length: 8 }, (_, i) => fx({ comp: 'Premier' })),
    ]
    const week = selectForWeek(scoreFixtures(fixtures))!
    expect(week.matches.length).toBeGreaterThanOrEqual(MIN_PER_WEEK)
    expect(week.matches.filter(m => m.home === 'Real Madrid')).toHaveLength(1)
  })
})

// ── Jornadas de una tanda ────────────────────────────────────────────────────

describe('buildRankedWeeks', () => {
  it('parte la tanda en un bloque por semana (lun-dom), en orden cronológico', () => {
    const weeks = buildRankedWeeks(scoreFixtures([
      // 17-ago-2026 (lunes) → semana del 17.
      fx({ isoDate: '2026-08-17T19:00Z' }),
      // 15 y 16-ago-2026 (sáb/dom) → semana del 10.
      fx({ isoDate: '2026-08-15T19:00Z' }),
      fx({ isoDate: '2026-08-16T17:00Z' }),
    ]))
    expect(weeks.map(w => w.weekKey)).toEqual(['2026-08-10', '2026-08-17'])
    expect(weeks[0].matches).toHaveLength(2)
  })

  it('da un Partidazo por Jornada, no uno por tanda', () => {
    const weeks = buildRankedWeeks(scoreFixtures([
      fx({ isoDate: '2026-08-15T19:00Z' }),
      fx({ isoDate: '2026-08-17T19:00Z' }),
    ]))
    expect(weeks).toHaveLength(2)
    expect(new Set(weeks.map(w => w.featuredEspnId)).size).toBe(2)
  })

  it('NUNCA recalcula una semana ya publicada', () => {
    // La regla de oro: si el cron pudiera reseleccionar, un partido ya
    // pronosticado podría desaparecer de la Jornada o perder su x2 a mitad de
    // semana.
    const fixtures = scoreFixtures([
      fx({ isoDate: '2026-08-15T19:00Z' }),
      fx({ isoDate: '2026-08-17T19:00Z' }),
    ])
    const weeks = buildRankedWeeks(fixtures, new Set(['2026-08-10']))
    expect(weeks.map(w => w.weekKey)).toEqual(['2026-08-17'])
  })

  it('es idempotente: la misma tanda produce exactamente la misma selección', () => {
    const fixtures = scoreFixtures([
      fx({ espnId: 'a', comp: 'Champions', isoDate: '2026-08-15T19:00Z', home: 'Bayern', away: 'Inter' }),
      fx({ espnId: 'b', comp: 'LaLiga',    isoDate: '2026-08-15T17:00Z' }),
      fx({ espnId: 'c', comp: 'Premier',   isoDate: '2026-08-15T15:00Z', home: 'Arsenal', away: 'Everton' }),
      fx({ espnId: 'd', comp: 'Serie A',   isoDate: '2026-08-17T19:00Z' }),
    ])
    expect(buildRankedWeeks(fixtures)).toEqual(buildRankedWeeks([...fixtures].reverse()))
  })
})

// ── Horizonte: no publicar una semana a medio ver ────────────────────────────

describe('weekEndKey', () => {
  it('devuelve el domingo de la semana cuyo lunes se le pasa', () => {
    expect(weekEndKey('2026-08-24')).toBe('2026-08-30')
    // Cambio de mes por el medio.
    expect(weekEndKey('2026-08-31')).toBe('2026-09-06')
  })
})

describe('buildRankedWeeks · horizonte', () => {
  // Este es el fallo que se llevó por delante la sección: una semana entra en
  // la ventana de 10 días por su LUNES, así que en la primera pasada el cron
  // solo veía ese día. Publicaba la Jornada con los partidos del lunes y, como
  // publicar es irreversible, el resto de la semana no se publicaba jamás.
  const semanaDel24 = () => scoreFixtures([
    fx({ espnId: 'lun', isoDate: '2026-08-24T19:00Z', comp: 'Premier', home: 'Fulham',   away: 'Chelsea' }),
    fx({ espnId: 'sab', isoDate: '2026-08-29T17:00Z', comp: 'LaLiga',  home: 'Barcelona', away: 'Sevilla' }),
    fx({ espnId: 'dom', isoDate: '2026-08-30T19:00Z', comp: 'Premier', home: 'Arsenal',   away: 'Liverpool' }),
  ])

  it('aplaza la semana mientras solo se le vea el lunes', () => {
    // Horizonte = lunes 24: el sábado y el domingo aún no se han mirado.
    expect(buildRankedWeeks(semanaDel24(), new Set(), '2026-08-24')).toEqual([])
  })

  it('la publica entera en cuanto su domingo entra en la ventana', () => {
    const weeks = buildRankedWeeks(semanaDel24(), new Set(), '2026-08-30')
    expect(weeks).toHaveLength(1)
    expect(weeks[0].matches).toHaveLength(3)
  })

  it('el Partidazo se elige entre TODA la semana, no entre los del primer día', () => {
    // Con horizonte corto el único candidato sería el lunes; con la semana
    // entera delante gana el partido de más nivel, caiga el día que caiga.
    const weeks = buildRankedWeeks(semanaDel24(), new Set(), '2026-08-30')
    expect(weeks[0].featuredEspnId).not.toBe('lun')
  })

  it('sin horizonte se comporta como antes (los consumidores que no lo pasan)', () => {
    expect(buildRankedWeeks(semanaDel24())).toHaveLength(1)
  })
})

// ── Identidad ────────────────────────────────────────────────────────────────

describe('rankedFootballId', () => {
  it('no colisiona con el archivo del Mundial 2026, que comparte tabla y origen', () => {
    expect(rankedFootballId('727123')).toBe('fb-espn-727123')
    expect(rankedFootballId('727123')).not.toBe('wc26-espn-727123')
  })
})
