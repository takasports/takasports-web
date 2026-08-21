import { describe, it, expect } from 'vitest'
import { findTennisRank, buildTennisStats, temporadaOrdinal } from './tennis-profile'

// Recorte FIEL de lo que devuelve ESPN (tennis/wta/rankings, 21/08/2026).
const RANKINGS = {
  rankings: [
    {
      name: 'WTA',
      ranks: [
        { current: 1, previous: 1, points: 8670.0, trend: '-', athlete: { id: '3038', displayName: 'Aryna Sabalenka' } },
        {
          current: 2, previous: 4, points: 8316.0, trend: '+2',
          athlete: {
            id: '3126', displayName: 'Elena Rybakina',
            flag: 'https://a.espncdn.com/i/teamlogos/countries/500/kaz.png',
            flagAltText: 'Kazakhstan',
            headshot: 'https://a.espncdn.com/i/headshots/tennis/players/full/3126.png',
          },
        },
      ],
    },
  ],
}

describe('findTennisRank', () => {
  it('encuentra al jugador y trae puesto, puntos y bandera', () => {
    const r = findTennisRank(RANKINGS, '3126')
    expect(r?.current).toBe(2)
    expect(r?.previous).toBe(4)
    expect(r?.points).toBe(8316)
    expect(r?.flagAlt).toBe('Kazakhstan')
  })

  it('quien no está en el top-150 devuelve null, no un puesto inventado', () => {
    expect(findTennisRank(RANKINGS, '99999')).toBeNull()
  })

  it('recorre TODAS las listas: individuales no siempre es la primera', () => {
    const varias = { rankings: [{ name: 'Dobles', ranks: [] }, RANKINGS.rankings[0]] }
    expect(findTennisRank(varias, '3038')?.current).toBe(1)
  })

  it('aguanta basura sin reventar', () => {
    expect(findTennisRank(null, '1')).toBeNull()
    expect(findTennisRank({}, '1')).toBeNull()
    expect(findTennisRank({ rankings: 'no' }, '1')).toBeNull()
    expect(findTennisRank({ rankings: [{ ranks: [{ athlete: { id: '1' } }] }] }, '1')).toBeNull()
  })
})

describe('temporadaOrdinal', () => {
  it('"10th Season" → "10ª"', () => expect(temporadaOrdinal('10th Season')).toBe('10ª'))
  it('sin dato, nada', () => expect(temporadaOrdinal(undefined)).toBeUndefined())
  it('un formato inesperado no inventa un ordinal', () => {
    expect(temporadaOrdinal('Rookie')).toBeUndefined()
  })
})

describe('buildTennisStats', () => {
  it('el ranking manda y los puntos van con separador de miles', () => {
    const s = buildTennisStats(findTennisRank(RANKINGS, '3126'), {}, 'WTA')
    expect(s[0]).toEqual({ label: 'Ranking WTA', value: 'Nº 2' })
    // En español los números de CUATRO cifras NO se agrupan (CLDR).
    expect(s[1]).toEqual({ label: 'Puntos', value: '8316' })
  })

  it('a partir de cinco cifras sí agrupa, y con PUNTO (no coma)', () => {
    const j = { rankings: [{ ranks: [{ current: 1, previous: 1, points: 12345, athlete: { id: 'x' } }] }] }
    const s = buildTennisStats(findTennisRank(j, 'x'), {}, 'ATP')
    expect(s[1]).toEqual({ label: 'Puntos', value: '12.345' })
  })

  it('la semana anterior solo aparece si CAMBIÓ el puesto', () => {
    const subio = buildTennisStats(findTennisRank(RANKINGS, '3126'), {}, 'WTA')
    expect(subio.some(x => x.label === 'Semana anterior')).toBe(true)
    const igual = buildTennisStats(findTennisRank(RANKINGS, '3038'), {}, 'WTA')
    expect(igual.some(x => x.label === 'Semana anterior')).toBe(false)
  })

  it('la mano se traduce, no se enseña "RIGHT"', () => {
    expect(buildTennisStats(null, { hand: 'RIGHT' }, 'ATP')).toEqual([{ label: 'Mano', value: 'Diestra' }])
    expect(buildTennisStats(null, { hand: 'LEFT' }, 'ATP')).toEqual([{ label: 'Mano', value: 'Zurda' }])
  })

  it('sin ranking pero con biografía sigue habiendo algo que contar', () => {
    const s = buildTennisStats(null, { hand: 'RIGHT', debutYear: 2016, experience: '10th Season' }, 'ATP')
    expect(s.map(x => x.label)).toEqual(['Mano', 'Debut', 'Temporada'])
  })

  it('sin NADA devuelve vacío: la página ya sabe enseñar su estado vacío', () => {
    expect(buildTennisStats(null, {}, 'ATP')).toEqual([])
  })

  it('caso completo, en el orden en que se leen', () => {
    const s = buildTennisStats(
      findTennisRank(RANKINGS, '3126'),
      { hand: 'RIGHT', debutYear: 2019, experience: '8th Season' },
      'WTA',
    )
    expect(s.map(x => `${x.label}: ${x.value}`)).toEqual([
      'Ranking WTA: Nº 2', 'Puntos: 8316', 'Semana anterior: Nº 4',
      'Mano: Diestra', 'Debut: 2019', 'Temporada: 8ª',
    ])
  })
})
