import { describe, it, expect } from 'vitest'
import { buildSoccerH2H, buildBasketballH2H } from './espn-h2h'
import nba from '@/lib/espn-h2h-nba.fixture.json'

const team = (id: string, displayName: string, abbreviation: string) =>
  ({ id, displayName, abbreviation, logo: `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png` })
const LEV = team('1538', 'Levante', 'LEV')
const ATH = team('93', 'Athletic Club', 'ATH')
const ev = (id: string, date: string, comp: string, home: ReturnType<typeof team>, hs: string, away: ReturnType<typeof team>, as: string, completed = true) => ({
  id, date, status: completed ? 'post' : 'pre', statusType: { completed }, competitionName: comp,
  competitors: [{ homeAway: 'home', score: hs, team: home }, { homeAway: 'away', score: as, team: away }],
})

// Recorte REAL del summary de ESPN del Levante-Athletic (LaLiga, 21/10/2026):
// sin headToHeadGames; el cara a cara viene en seasonseries.
const LEV_ATH = {
  header: { id: '401882870' },
  seasonseries: [{
    type: 'head-to-head', summary: 'ATH leads series 4-0-1',
    events: [
      ev('748373', '2026-02-08T15:15:00Z', '2025-26 LALIGA', ATH, '4', LEV, '2'),
      ev('748278', '2025-11-29T17:30:00Z', '2025-26 LALIGA', LEV, '0', ATH, '2'),
      ev('610504', '2022-03-07T20:00:00Z', '2021-22 LaLiga', ATH, '3', LEV, '1'),
      ev('610631', '2021-11-19T20:00:00Z', '2021-22 LaLiga', LEV, '0', ATH, '0'),
      ev('594725', '2021-03-04T20:00:00Z', '2020-21 Spanish Copa del Rey', LEV, '1', ATH, '2'),
    ],
  }],
}

describe('buildSoccerH2H · seasonseries (forma actual de ESPN)', () => {
  it('lee los 5 enfrentamientos y el balance desde el local del partido (Levante)', () => {
    const r = buildSoccerH2H(LEV_ATH, '1538')!
    expect(r.matches).toHaveLength(5)
    expect({ wins: r.wins, draws: r.draws, losses: r.losses }).toEqual({ wins: 0, draws: 1, losses: 4 })
    expect(r.matches[0]).toMatchObject({
      id: '748373', isoDate: '2026-02-08T15:15:00Z', comp: '2025-26 LALIGA',
      home: 'Athletic Club', away: 'Levante', homeScore: 4, awayScore: 2, homeAbbr: 'ATH', awayAbbr: 'LEV',
    })
    expect(r.matches[4].comp).toBe('2020-21 Spanish Copa del Rey')
  })

  it('ordena del más reciente al más antiguo aunque ESPN no lo haga', () => {
    const rev = { ...LEV_ATH, seasonseries: [{ ...LEV_ATH.seasonseries[0], events: [...LEV_ATH.seasonseries[0].events].reverse() }] }
    expect(buildSoccerH2H(rev, '1538')!.matches.map(m => m.id)).toEqual(['748373', '748278', '610504', '610631', '594725'])
  })

  it('no cuenta el propio partido ni los que están por jugarse', () => {
    const j = {
      header: { id: '999' },
      seasonseries: [{ type: 'head-to-head', events: [
        ev('999', '2026-10-21T18:00:00Z', 'LALIGA', LEV, '1', ATH, '0'),
        ev('998', '2027-02-01T18:00:00Z', 'LALIGA', ATH, '0', LEV, '0', false),
        ev('748373', '2026-02-08T15:15:00Z', 'LALIGA', ATH, '4', LEV, '2'),
      ] }],
    }
    const r = buildSoccerH2H(j, '1538')!
    expect(r.matches.map(m => m.id)).toEqual(['748373'])
    expect(r.losses).toBe(1)
  })

  it('traduce los nombres (selecciones) con la función que recibe', () => {
    const ESP = team('164', 'Spain', 'ESP'), CRO = team('477', 'Croatia', 'CRO')
    const j = { seasonseries: [{ type: 'head-to-head', events: [ev('1', '2024-06-15T16:00:00Z', '2024 European Championship', ESP, '3', CRO, '0')] }] }
    const tr = (s: string) => ({ Spain: 'España', Croatia: 'Croacia' } as Record<string, string>)[s] ?? s
    const r = buildSoccerH2H(j, '477', tr)!
    expect(r.matches[0]).toMatchObject({ home: 'España', away: 'Croacia' })
    expect(r.losses).toBe(1)
  })

  it('sin seasonseries ni headToHeadGames → undefined (la web cae a su archivo)', () => {
    expect(buildSoccerH2H({ header: { id: '1' } }, '1538')).toBeUndefined()
    expect(buildSoccerH2H({ seasonseries: [{ type: 'head-to-head', events: [] }] }, '1538')).toBeUndefined()
  })
})

describe('buildSoccerH2H · headToHeadGames (forma antigua, por si vuelve)', () => {
  it('sigue leyéndola y deduplica el cruce que aparece en ambos equipos', () => {
    const e = { id: '5', gameDate: '2025-01-01T00:00Z', homeTeamId: '1538', awayTeamId: '93', homeTeamScore: '2', awayTeamScore: '1', leagueName: 'LaLiga', opponent: ATH }
    const j = {
      headToHeadGames: [
        { team: LEV, events: [e] },
        { team: ATH, events: [{ ...e, opponent: LEV }] },
      ],
      seasonseries: LEV_ATH.seasonseries,
    }
    const r = buildSoccerH2H(j, '1538')!
    expect(r.matches).toHaveLength(1)
    expect(r.matches[0]).toMatchObject({ home: 'Levante', away: 'Athletic Club', homeScore: 2, awayScore: 1, comp: 'LaLiga' })
    expect(r.wins).toBe(1)
  })
})

// ── Baloncesto ──────────────────────────────────────────────────────

describe('buildBasketballH2H · serie de la temporada (fixture REAL CHI @ BOS)', () => {
  it('solo cuenta el partido JUGADO: ni los por jugar (0-0) ni el de la ficha', () => {
    // La serie trae 4 cruces: 1 terminado (BOS 134-99 CHI), el propio partido
    // (401909278, por jugar) y 2 más por jugar. Todos los pendientes vienen 0-0.
    expect(nba.seasonseries[0].events).toHaveLength(4)
    const r = buildBasketballH2H(nba, '2')!   // 2 = Boston Celtics (local)
    expect(r.matches).toHaveLength(1)
    expect(r.matches[0]).toMatchObject({
      id: '401909870', home: 'Boston Celtics', away: 'Chicago Bulls',
      homeScore: 134, awayScore: 99, homeAbbr: 'BOS', awayAbbr: 'CHI',
    })
    expect(r.matches.some(m => m.id === nba.header.id)).toBe(false)
    expect({ wins: r.wins, draws: r.draws, losses: r.losses }).toEqual({ wins: 1, draws: 0, losses: 0 })
  })

  it('el balance se cuenta desde el local del partido actual', () => {
    const r = buildBasketballH2H(nba, '4')!   // 4 = Chicago Bulls
    expect({ wins: r.wins, draws: r.draws, losses: r.losses }).toEqual({ wins: 0, draws: 0, losses: 1 })
  })

  it('una serie sin ningún partido jugado no da cara a cara (antes: cuatro 0-0)', () => {
    const sinJugar = {
      header: nba.header,
      seasonseries: [{ ...nba.seasonseries[0], events: nba.seasonseries[0].events.slice(1) }],
    }
    expect(buildBasketballH2H(sinJugar, '2')).toBeUndefined()
  })

  it('no se fía del marcador: un 0-0 «completed: false» no entra aunque traiga score', () => {
    const futuro = nba.seasonseries[0].events[2]
    expect(futuro.statusType.completed).toBe(false)
    expect(futuro.competitors.map(c => c.score)).toEqual(['0', '0'])
    const r = buildBasketballH2H({ header: { id: 'otro' }, seasonseries: nba.seasonseries }, '2')!
    expect(r.matches.map(m => m.id)).toEqual(['401909870'])
  })
})
