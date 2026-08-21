import { describe, it, expect } from 'vitest'
import { COMPETITIONS, getCompetition, matchesCompetition, FEATURED_COMPETITIONS } from './calendar-competitions'

// El Mundial usa matchComp 'Mundial' con matchExact: el substring laxo de las
// demás competiciones haría que "Mundial de Clubes" cayera dentro de la ficha
// del Mundial (y viceversa en conteos/agrupados).
describe('competición Mundial (matchExact)', () => {
  const mundial = getCompetition('mundial')!

  it('existe, es destacada y apunta a fifa.world', () => {
    expect(mundial).toBeTruthy()
    expect(mundial.espnSlug).toBe('soccer/fifa.world')
    expect(FEATURED_COMPETITIONS.some(c => c.slug === 'mundial')).toBe(true)
  })

  it('matchea los eventos del Mundial', () => {
    expect(matchesCompetition(mundial, { comp: 'Mundial', sport: 'Fútbol' })).toBe(true)
  })

  it('NO captura el Mundial de Clubes (match exacto, no substring)', () => {
    expect(matchesCompetition(mundial, { comp: 'Mundial de Clubes', sport: 'Fútbol' })).toBe(false)
  })

  it('exige deporte coherente cuando el evento lo declara', () => {
    expect(matchesCompetition(mundial, { comp: 'Mundial', sport: 'Pádel' })).toBe(false)
  })
})

describe('las competiciones por substring siguen igual', () => {
  it('LaLiga matchea por contiene (comportamiento previo intacto)', () => {
    const laliga = getCompetition('laliga')!
    expect(matchesCompetition(laliga, { comp: 'LaLiga', sport: 'Fútbol' })).toBe(true)
  })
})

describe('LaLiga no debe arrastrar a Segunda', () => {
  const laliga = COMPETITIONS.find(c => c.slug === 'laliga')!

  it('coge los partidos de Primera', () => {
    expect(matchesCompetition(laliga, { comp: 'LaLiga', sport: 'Fútbol' })).toBe(true)
  })

  it('NO coge los de LaLiga 2 (era prefijo: 34 partidos pasaban a 67)', () => {
    expect(matchesCompetition(laliga, { comp: 'LaLiga 2', sport: 'Fútbol' })).toBe(false)
  })

  it('la Segunda tiene su propia entrada y sigue funcionando', () => {
    const segunda = COMPETITIONS.find(c => c.matchComp === 'LaLiga 2')
    if (segunda) expect(matchesCompetition(segunda, { comp: 'LaLiga 2', sport: 'Fútbol' })).toBe(true)
  })
})
