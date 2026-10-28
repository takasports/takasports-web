import { describe, it, expect } from 'vitest'
import {
  resumenH2H,
  calcularRacha,
  localJugoEnCasa,
  competicionCortaH2H,
  esCopaH2H,
  marcadorH2H,
  decimalH2H,
  fechaCortaH2H,
  fechaLargaH2H,
  esPartidoJugadoH2H,
  type PartidoH2H,
  type ResultadoH2H,
} from './h2h-resumen'

// Esta batería tiene un ESPEJO en takasports-app/src/lib/__tests__/h2h-resumen.test.ts.

const LEV = { nombre: 'Levante', abbr: 'LEV', id: '1538' }
const ATH = { nombre: 'Athletic Club', abbr: 'ATH', id: '93' }
const logo = (id: string) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`

const p = (id: string, isoDate: string, comp: string, home: typeof LEV, hs: number | null, away: typeof LEV, as: number | null): PartidoH2H => ({
  id, isoDate, comp,
  home: home.nombre, away: away.nombre,
  homeScore: hs, awayScore: as,
  homeAbbr: home.abbr, awayAbbr: away.abbr,
  homeLogo: logo(home.id), awayLogo: logo(away.id),
})

// Los 5 REALES que devuelve /api/match/soccer_esp.1_401882870 (23/10/2026).
const LEV_ATH: PartidoH2H[] = [
  p('748373', '2026-02-08T15:15:00Z', '2025-26 LALIGA', ATH, 4, LEV, 2),
  p('748278', '2025-11-29T17:30:00Z', '2025-26 LALIGA', LEV, 0, ATH, 2),
  p('610504', '2022-03-07T20:00:00Z', '2021-22 LaLiga', ATH, 3, LEV, 1),
  p('610631', '2021-11-19T20:00:00Z', '2021-22 LaLiga', LEV, 0, ATH, 0),
  p('594725', '2021-03-04T20:00:00Z', '2020-21 Spanish Copa del Rey', LEV, 1, ATH, 2),
]

describe('resumenH2H · Levante-Athletic (5 partidos reales)', () => {
  const r = resumenH2H(LEV_ATH, LEV, ATH)

  it('balance desde el local de hoy', () => {
    expect(r.n).toBe(5)
    expect([r.victoriasLocal, r.empates, r.victoriasVisitante]).toEqual([0, 1, 4])
  })

  it('goles a favor y en contra del local de hoy, por partido y «marcan los dos»', () => {
    expect([r.golesLocal, r.golesVisitante]).toEqual([4, 11])
    expect(decimalH2H(r.golesPorPartido)).toBe('3,0')
    expect(r.ambosMarcan).toBe(3)
  })

  it('según dónde se juega', () => {
    expect(r.enCasa).toEqual({ n: 3, g: 0, e: 1, p: 2 })
    expect(r.fuera).toEqual({ n: 2, g: 0, e: 0, p: 2 })
  })

  it('racha: el Athletic lleva 5 sin perder (4 victorias, 1 empate)', () => {
    expect(r.racha).toEqual({ equipo: 'visitante', tipo: 'sinPerder', n: 5, victorias: 4, empates: 1 })
  })

  it('fichas: racha, mayor goleada sin repetir el último duelo, y último duelo', () => {
    expect(r.fichas.map((f) => f.tipo)).toEqual(['racha', 'mayorGoleada', 'ultimoDuelo'])
    const goleada = r.fichas.find((f) => f.tipo === 'mayorGoleada')
    // 4-2, 0-2 y 3-1 empatan a dos goles de diferencia. Manda el que más marcó
    // el ganador (4-2), pero ya es el último duelo → el siguiente, 3-1.
    expect(goleada && 'partido' in goleada ? goleada.partido.id : null).toBe('610504')
    const ultimo = r.fichas.find((f) => f.tipo === 'ultimoDuelo')
    expect(ultimo).toMatchObject({ ganador: 'visitante', partido: { id: '748373' } })
  })

  it('con 5 se enseña todo', () => {
    expect(r.mostrar).toEqual({
      balance: true, barra: true, goles: true, segunDonde: true,
      barraCasa: true, barraFuera: true, datos: true,
    })
  })

  it('filas G/E/P desde el local de hoy, más reciente primero', () => {
    expect(r.filas.map((f) => f.resultado)).toEqual(['P', 'P', 'P', 'E', 'P'])
    expect(r.filas.map((f) => f.localEnCasa)).toEqual([false, true, false, true, true])
  })

  it('visto desde el otro lado, el balance se invierte', () => {
    const v = resumenH2H(LEV_ATH, ATH, LEV)
    expect([v.victoriasLocal, v.empates, v.victoriasVisitante]).toEqual([4, 1, 0])
    expect([v.golesLocal, v.golesVisitante]).toEqual([11, 4])
    expect(v.racha).toMatchObject({ equipo: 'local', n: 5 })
  })

  it('el orden de entrada no importa', () => {
    const r2 = resumenH2H([...LEV_ATH].reverse(), LEV, ATH)
    expect(r2.filas[0].partido.id).toBe('748373')
    expect(r2.racha).toEqual(r.racha)
  })
})

describe('resumenH2H · reglas para pocos partidos', () => {
  it('0 partidos: nada que enseñar', () => {
    const r = resumenH2H([], LEV, ATH)
    expect(r.n).toBe(0)
    expect(r.fichas).toEqual([])
    expect(Object.values(r.mostrar).some(Boolean)).toBe(false)
  })

  it('1 partido: solo la lista (ni balance, ni barra, ni datos)', () => {
    const r = resumenH2H(LEV_ATH.slice(0, 1), LEV, ATH)
    expect(r.n).toBe(1)
    expect(r.filas).toHaveLength(1)
    expect(r.racha).toBeNull()
    expect(r.mostrar.balance).toBe(false)
    expect(r.mostrar.barra).toBe(false)
    expect(r.mostrar.goles).toBe(false)
    expect(r.mostrar.segunDonde).toBe(false)
    expect(r.mostrar.datos).toBe(false)
  })

  it('2 partidos: números sí, barra y goles no', () => {
    const r = resumenH2H(LEV_ATH.slice(0, 2), LEV, ATH)
    expect(r.mostrar.balance).toBe(true)
    expect(r.mostrar.barra).toBe(false)
    expect(r.mostrar.goles).toBe(false)
    expect(r.mostrar.segunDonde).toBe(false)
    // Racha de 2 victorias del Athletic → hay algo más que el último duelo.
    expect(r.racha).toMatchObject({ equipo: 'visitante', tipo: 'victorias', n: 2 })
    expect(r.mostrar.datos).toBe(true)
  })

  it('2 partidos repartidos: sin racha ni goleada, «Datos» no sale', () => {
    const r = resumenH2H([
      p('a', '2025-01-01', 'LaLiga', LEV, 1, ATH, 0),
      p('b', '2024-01-01', 'LaLiga', ATH, 1, LEV, 0),
    ], LEV, ATH)
    expect(r.racha).toBeNull()
    // Última del Athletic = 'b' (la del Levante es el último duelo).
    expect(r.fichas.map((f) => f.tipo)).toEqual(['ultimaVictoria', 'ultimoDuelo'])
    expect(r.mostrar.datos).toBe(true)
  })

  it('«según dónde» exige partidos en casa Y fuera; cada barra, 2 o más', () => {
    const r = resumenH2H([
      p('a', '2025-03-01', 'LaLiga', LEV, 1, ATH, 0),
      p('b', '2025-02-01', 'LaLiga', LEV, 2, ATH, 2),
      p('c', '2025-01-01', 'LaLiga', ATH, 1, LEV, 0),
    ], LEV, ATH)
    expect(r.mostrar.segunDonde).toBe(true)
    expect(r.mostrar.barraCasa).toBe(true)
    expect(r.mostrar.barraFuera).toBe(false)

    const soloCasa = resumenH2H([
      p('a', '2025-03-01', 'LaLiga', LEV, 1, ATH, 0),
      p('b', '2025-02-01', 'LaLiga', LEV, 2, ATH, 2),
      p('c', '2025-01-01', 'LaLiga', LEV, 0, ATH, 1),
    ], LEV, ATH)
    expect(soloCasa.mostrar.segunDonde).toBe(false)
  })

  it('partidos sin marcador ni se listan ni cuentan (son partidos por jugar)', () => {
    const r = resumenH2H([p('x', '2026-05-01', 'LaLiga', LEV, null, ATH, null), ...LEV_ATH.slice(0, 1)], LEV, ATH)
    expect(r.filas).toHaveLength(1)
    expect(r.filas[0].partido.id).toBe('748373')
    expect(r.n).toBe(1)
  })
})

describe('resumenH2H · salvaguarda de partidos por jugar', () => {
  const AHORA = Date.parse('2026-10-28T12:00:00Z')
  // Lo que mandaba la API con la serie de la NBA: el jugado y los por jugar a 0-0.
  const CHI = { nombre: 'Chicago Bulls', abbr: 'CHI', id: '4' }
  const BOS = { nombre: 'Boston Celtics', abbr: 'BOS', id: '2' }
  const serie: PartidoH2H[] = [
    p('401909870', '2026-10-26T23:30:00Z', 'Regular Season Series', BOS, 134, CHI, 99),
    p('401909278', '2026-10-30T23:30:00Z', 'Regular Season Series', BOS, 0, CHI, 0),
    p('401910222', '2026-12-31T01:00:00Z', 'Regular Season Series', CHI, 0, BOS, 0),
  ]

  it('descarta los de fecha futura aunque traigan un 0-0', () => {
    const r = resumenH2H(serie, BOS, CHI, { ahora: AHORA, umbralGoleada: 10 })
    expect(r.filas.map((f) => f.partido.id)).toEqual(['401909870'])
    expect(r.n).toBe(1)
    expect(r.empates).toBe(0)
  })

  it('acepta un Date como «ahora» y deja pasar lo que ya se jugó', () => {
    const r = resumenH2H(serie, BOS, CHI, { ahora: new Date('2027-01-01T00:00:00Z') })
    expect(r.filas).toHaveLength(3)
  })

  it('esPartidoJugadoH2H: futuro no, sin marcador no, fecha ilegible sí', () => {
    expect(esPartidoJugadoH2H(serie[0], AHORA)).toBe(true)
    expect(esPartidoJugadoH2H(serie[1], AHORA)).toBe(false)
    expect(esPartidoJugadoH2H({ ...serie[0], awayScore: null }, AHORA)).toBe(false)
    expect(esPartidoJugadoH2H({ ...serie[0], isoDate: '' }, AHORA)).toBe(true)
  })

  it('si todo está por jugar, no hay filas (la ficha enseña su estado vacío)', () => {
    expect(resumenH2H(serie.slice(1), BOS, CHI, { ahora: AHORA }).filas).toHaveLength(0)
  })
})

describe('resumenH2H · mayor goleada', () => {
  it('por debajo del umbral no hay «mayor goleada»', () => {
    const r = resumenH2H([
      p('a', '2025-03-01', 'LaLiga', LEV, 1, ATH, 0),
      p('b', '2025-02-01', 'LaLiga', ATH, 2, LEV, 1),
      p('c', '2025-01-01', 'LaLiga', LEV, 1, ATH, 1),
    ], LEV, ATH)
    expect(r.fichas.some((f) => f.tipo === 'mayorGoleada')).toBe(false)
  })

  it('si la única goleada máxima ya está en otra ficha, no se repite', () => {
    const r = resumenH2H([
      p('a', '2025-03-01', 'LaLiga', LEV, 4, ATH, 0),
      p('b', '2025-02-01', 'LaLiga', ATH, 1, LEV, 0),
      p('c', '2025-01-01', 'LaLiga', LEV, 1, ATH, 1),
    ], LEV, ATH)
    expect(r.fichas.map((f) => f.tipo)).toEqual(['ultimaVictoria', 'ultimoDuelo'])
  })

  it('baloncesto: umbral propio (10)', () => {
    const r = resumenH2H([
      p('a', '2025-03-01', 'NBA', LEV, 101, ATH, 99),
      p('b', '2025-02-01', 'NBA', ATH, 120, LEV, 104),
      p('c', '2025-02-15', 'NBA', LEV, 98, ATH, 100),
    ], LEV, ATH, { umbralGoleada: 10 })
    const g = r.fichas.find((f) => f.tipo === 'mayorGoleada')
    expect(g).toMatchObject({ equipo: 'visitante', partido: { id: 'b' } })
  })

  it('nunca más de 4 fichas: cae primero la mayor goleada', () => {
    const r = resumenH2H([
      p('a', '2025-05-01', 'LaLiga', LEV, 1, ATH, 1),
      p('b', '2025-04-01', 'LaLiga', LEV, 2, ATH, 1),
      p('c', '2025-03-01', 'LaLiga', ATH, 1, LEV, 0),
      p('d', '2025-02-01', 'LaLiga', ATH, 5, LEV, 0),
    ], LEV, ATH)
    // racha (Levante, 2 sin perder), última Levante 'b', última Athletic 'c',
    // último duelo 'a'; la goleada 'd' sería la quinta y se queda fuera.
    expect(r.fichas.map((f) => f.tipo)).toEqual(['racha', 'ultimaVictoria', 'ultimaVictoria', 'ultimoDuelo'])
  })

  it('la última victoria no repite el último duelo', () => {
    const r = resumenH2H([
      p('a', '2025-03-01', 'LaLiga', LEV, 1, ATH, 0),
      p('b', '2025-02-01', 'LaLiga', LEV, 1, ATH, 0),
      p('c', '2025-01-01', 'LaLiga', ATH, 1, LEV, 0),
    ], LEV, ATH)
    expect(r.fichas.map((f) => f.tipo)).toEqual(['racha', 'ultimaVictoria', 'ultimoDuelo'])
    expect(r.fichas[1]).toMatchObject({ equipo: 'visitante', partido: { id: 'c' } })
  })
})

describe('calcularRacha', () => {
  const r = (s: string) => calcularRacha(s.split('') as ResultadoH2H[])
  it('victorias seguidas', () => expect(r('GGP')).toEqual({ equipo: 'local', tipo: 'victorias', n: 2, victorias: 2, empates: 0 }))
  it('sin perder con empates en medio', () => expect(r('GEGP')).toEqual({ equipo: 'local', tipo: 'sinPerder', n: 3, victorias: 2, empates: 1 }))
  it('del visitante', () => expect(r('PPEG')).toEqual({ equipo: 'visitante', tipo: 'sinPerder', n: 3, victorias: 2, empates: 1 }))
  it('empezando por empate la lleva quien suma más sin perder', () => expect(r('EPPG')).toMatchObject({ equipo: 'visitante', n: 3 }))
  it('empates y luego victoria: cuenta como «sin perder» de quien ganó', () => expect(r('EEG')).toMatchObject({ equipo: 'local', tipo: 'sinPerder', n: 3, empates: 2 }))
  it('solo empates', () => expect(r('EE')).toMatchObject({ equipo: null, tipo: 'empates', n: 2 }))
  it('una sola no es racha', () => {
    expect(r('GP')).toBeNull()
    expect(r('EG')).toMatchObject({ equipo: 'local', n: 2 })
    expect(r('G')).toBeNull()
  })
})

describe('localJugoEnCasa', () => {
  it('reconoce por nombre aunque cambien acentos o mayúsculas', () => {
    expect(localJugoEnCasa({ ...LEV_ATH[1], home: 'LEVANTE', homeAbbr: undefined, homeLogo: undefined }, LEV, ATH)).toBe(true)
  })
  it('reconoce por sigla y por escudo si el nombre no coincide', () => {
    expect(localJugoEnCasa({ ...LEV_ATH[1], home: 'Levante UD', away: 'Athletic Bilbao' }, LEV, ATH)).toBe(true)
    expect(localJugoEnCasa({ ...LEV_ATH[1], home: 'Levante UD', homeAbbr: undefined, away: 'X', awayAbbr: undefined, awayLogo: undefined }, LEV, ATH)).toBe(true)
  })
  it('si no reconoce a nadie, null (no cuenta)', () => {
    expect(localJugoEnCasa({ ...LEV_ATH[1], home: 'A', away: 'B', homeAbbr: 'A', awayAbbr: 'B', homeLogo: undefined, awayLogo: undefined }, LEV, ATH)).toBeNull()
  })
})

describe('formato', () => {
  it('competición sin temporada ni país', () => {
    expect(competicionCortaH2H('2025-26 LALIGA')).toBe('LaLiga')
    expect(competicionCortaH2H('2020-21 Spanish Copa del Rey')).toBe('Copa del Rey')
    expect(competicionCortaH2H('2024 Liga Profesional Argentina')).toBe('Liga Profesional Argentina')
    expect(competicionCortaH2H('UEFA Champions League')).toBe('Champions')
    expect(competicionCortaH2H('LaLiga')).toBe('LaLiga')
  })
  it('nombres cortos de lo que manda ESPN (temporada y país fuera)', () => {
    expect(competicionCortaH2H('2025-26 English Premier League')).toBe('Premier')
    expect(competicionCortaH2H('Premier League')).toBe('Premier')
    expect(competicionCortaH2H('2014-15 English League Championship')).toBe('Championship')
    expect(competicionCortaH2H('2025-26 German Bundesliga')).toBe('Bundesliga')
    expect(competicionCortaH2H('2025-26 Italian Serie A')).toBe('Serie A')
    expect(competicionCortaH2H('2025-26 French Ligue 1')).toBe('Ligue 1')
    expect(competicionCortaH2H('2025-26 Ligue 1')).toBe('Ligue 1')
    expect(competicionCortaH2H('2024-25 French Coupe de France')).toBe('Copa de Francia')
    expect(competicionCortaH2H('2024-25 English FA Cup')).toBe('FA Cup')
    expect(competicionCortaH2H('2024-25 English Carabao Cup')).toBe('Copa de la Liga')
    expect(competicionCortaH2H('EFL Cup')).toBe('Copa de la Liga')
    expect(competicionCortaH2H('2021-22 German DFB Pokal')).toBe('Copa de Alemania')
    expect(competicionCortaH2H('2024-25 Coppa Italia')).toBe('Copa de Italia')
    expect(competicionCortaH2H('2025-26 UEFA Europa League')).toBe('Europa League')
    expect(competicionCortaH2H('2025-26 UEFA Conference League')).toBe('Conference')
    expect(competicionCortaH2H('2008/09 UEFA Champions League')).toBe('Champions')
    expect(competicionCortaH2H('2008/09 UEFA Cup')).toBe('Copa de la UEFA')
    expect(competicionCortaH2H('NBA')).toBe('NBA')
    expect(competicionCortaH2H('NBA Cup')).toBe('Copa NBA')
    expect(competicionCortaH2H('Regular Season Series')).toBe('Temporada regular')
    expect(competicionCortaH2H('Playoffs')).toBe('Playoffs')
    // Lo que no está en el diccionario sale tal cual (sin temporada ni país).
    expect(competicionCortaH2H('2025-26 Scottish Premiership')).toBe('Premiership')
  })
  it('copas frente a ligas', () => {
    expect(esCopaH2H('2020-21 Spanish Copa del Rey')).toBe(true)
    expect(esCopaH2H('FA Cup')).toBe(true)
    expect(esCopaH2H('2025-26 LALIGA')).toBe(false)
  })
  it('marcador, decimales y fechas', () => {
    expect(marcadorH2H(LEV_ATH[0])).toBe('ATH 4-2 LEV')
    expect(decimalH2H(2.8333)).toBe('2,8')
    expect(fechaCortaH2H('2026-02-08T15:15:00Z')).toBe('8 feb 26')
    expect(fechaLargaH2H('2026-02-08T15:15:00Z')).toBe('8 feb 2026')
    expect(fechaCortaH2H('basura')).toBe('')
  })
})
