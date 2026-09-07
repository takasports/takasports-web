import { describe, it, expect } from 'vitest'
import { COMPETITIONS, getCompetition, matchesCompetition, FEATURED_COMPETITIONS, currentSeasonLabel, seasonLabelOf, eventNoun } from './calendar-competitions'

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


describe('Champions vs Championship — la subcadena traicionera', () => {
  const champions = getCompetition('champions')!
  it('la Championship inglesa NO entra en Champions', () => {
    expect(matchesCompetition(champions, { comp: 'Championship', sport: 'Fútbol' })).toBe(false)
  })
  it('la Champions de verdad sigue entrando', () => {
    expect(matchesCompetition(champions, { comp: 'Champions', sport: 'Fútbol' })).toBe(true)
    expect(matchesCompetition(champions, { comp: 'UEFA Champions League', sport: 'Fútbol' })).toBe(true)
  })
})

// ── Etiqueta de temporada ────────────────────────────────────────────────────
// Estaba escrita a mano en las 17 competiciones y caducaba sola: en septiembre
// de 2026 doce páginas indexadas seguían anunciando «2025-2026» en el <title>.

describe('currentSeasonLabel', () => {
  it('las de año natural son el año, sin más', () => {
    expect(currentSeasonLabel('calendar', new Date('2026-09-06T12:00:00Z'))).toBe('2026')
    expect(currentSeasonLabel('calendar', new Date('2026-01-02T12:00:00Z'))).toBe('2026')
  })

  it('de julio a diciembre la temporada partida es y/y+1', () => {
    expect(currentSeasonLabel('split', new Date('2026-07-01T12:00:00Z'))).toBe('2026-2027')
    expect(currentSeasonLabel('split', new Date('2026-09-06T12:00:00Z'))).toBe('2026-2027')
    expect(currentSeasonLabel('split', new Date('2026-12-31T23:00:00Z'))).toBe('2026-2027')
  })

  it('de enero a junio sigue siendo la que empezó el año anterior', () => {
    expect(currentSeasonLabel('split', new Date('2027-01-01T12:00:00Z'))).toBe('2026-2027')
    expect(currentSeasonLabel('split', new Date('2027-05-30T12:00:00Z'))).toBe('2026-2027')
    expect(currentSeasonLabel('split', new Date('2027-06-30T23:00:00Z'))).toBe('2026-2027')
  })

  it('el corte cae exactamente entre el 30 de junio y el 1 de julio', () => {
    expect(currentSeasonLabel('split', new Date('2027-06-30T23:59:59Z'))).toBe('2026-2027')
    expect(currentSeasonLabel('split', new Date('2027-07-01T00:00:00Z'))).toBe('2027-2028')
  })
})

describe('seasonLabelOf', () => {
  const sep2026 = new Date('2026-09-06T12:00:00Z')

  it('LaLiga en septiembre de 2026 es 2026-2027, no la temporada pasada', () => {
    expect(seasonLabelOf(COMPETITIONS.find(c => c.slug === 'laliga')!, sep2026)).toBe('2026-2027')
  })

  it('la F1 se nombra por año natural', () => {
    expect(seasonLabelOf(COMPETITIONS.find(c => c.slug === 'f1')!, sep2026)).toBe('2026')
  })

  it('todas las competiciones declaran un tipo de temporada válido', () => {
    for (const c of COMPETITIONS) {
      expect(['calendar', 'split']).toContain(c.seasonKind)
      expect(seasonLabelOf(c, sep2026)).toMatch(/^\d{4}(-\d{4})?$/)
    }
  })
})

describe('eventNoun', () => {
  it('la F1 tiene carreras y la UFC peleas, no partidos', () => {
    expect(eventNoun('F1')).toBe('carreras')
    expect(eventNoun('UFC')).toBe('peleas')
  })

  it('el resto de deportes juegan partidos', () => {
    expect(eventNoun('Fútbol')).toBe('partidos')
    expect(eventNoun('NBA')).toBe('partidos')
    expect(eventNoun('Tenis')).toBe('partidos')
  })

  it('MotoGP hereda "carreras" porque comparte el deporte F1 en la config', () => {
    expect(eventNoun(COMPETITIONS.find(c => c.slug === 'motogp')!.sport)).toBe('carreras')
  })
})
