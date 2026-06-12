import { describe, it, expect } from 'vitest'
import { getCompetition, matchesCompetition, FEATURED_COMPETITIONS } from './calendar-competitions'

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
