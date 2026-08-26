import { describe, it, expect } from 'vitest'
import { parseMatchRef } from './match-ref'
import { FOOTBALL_LEAGUES } from './football-leagues'

describe('parseMatchRef', () => {
  it('parsea las ligas de slug simple', () => {
    expect(parseMatchRef('soccer_esp.1_401882917')).toEqual({
      leagueSlug: 'soccer/esp.1',
      eventId: '401882917',
    })
    expect(parseMatchRef('tennis_atp_184610')).toEqual({
      leagueSlug: 'tennis/atp',
      eventId: '184610',
    })
    expect(parseMatchRef('mma_ufc_600060735')).toEqual({
      leagueSlug: 'mma/ufc',
      eventId: '600060735',
    })
  })

  // La regresión que rompió las copas: partir por TODOS los '_' troceaba el
  // propio slug de ESPN y la ficha salía como "Partido no encontrado".
  it('conserva los guiones bajos que van DENTRO del slug de liga', () => {
    expect(parseMatchRef('soccer_eng.league_cup_401908119')).toEqual({
      leagueSlug: 'soccer/eng.league_cup',
      eventId: '401908119',
    })
    expect(parseMatchRef('soccer_esp.copa_del_rey_401234567')).toEqual({
      leagueSlug: 'soccer/esp.copa_del_rey',
      eventId: '401234567',
    })
    expect(parseMatchRef('soccer_fra.coupe_de_france_401234567')).toEqual({
      leagueSlug: 'soccer/fra.coupe_de_france',
      eventId: '401234567',
    })
  })

  // Guardia contra el catálogo real: si mañana se añade una liga con guiones
  // bajos, este test la cubre sola.
  it('reconstruye el slug de TODAS las ligas del catálogo', () => {
    for (const { slug } of FOOTBALL_LEAGUES) {
      const ref = `${slug.replace('/', '_')}_401908119`
      expect(parseMatchRef(ref)).toEqual({ leagueSlug: slug, eventId: '401908119' })
    }
  })

  it('rechaza lo que no tiene forma de ref', () => {
    expect(parseMatchRef('')).toBeNull()
    expect(parseMatchRef('soccer')).toBeNull()
    expect(parseMatchRef('soccer_401908119')).toBeNull()   // falta la liga
    expect(parseMatchRef('_esp.1_401882917')).toBeNull()   // sin deporte
    expect(parseMatchRef('soccer_esp.1_')).toBeNull()      // sin eventId
  })
})
