import { describe, it, expect } from 'vitest'
import { WOMENS_SLUGS, isWomensSlug, WOMENS_COMPS, isWomensComp } from './football-leagues'
import { isWomensPastRow } from './past-events'

// Reproduce EXACTAMENTE cómo el job de sync (lib/espn.ts · fetchLeaguePast)
// codifica el slug de liga dentro de cada fila de past_events. Si esa
// codificación cambia, este helper debe acompañarla — de ahí el cross-check.
const refOf = (slug: string, eventId: string) => `${slug.replace('/', '_')}_${eventId}`
const idOf  = (slug: string, eventId: string) => `espn-past-${slug.replace(/\//g, '-')}-${eventId}`

describe('género de liga · isWomensSlug / WOMENS_SLUGS', () => {
  it('reconoce las competiciones femeninas registradas', () => {
    expect(isWomensSlug('soccer/esp.w.1')).toBe(true)         // Liga F
    expect(isWomensSlug('soccer/fifa.friendly.w')).toBe(true) // Amistoso femenino
  })

  it('NO marca masculino/mixto como femenino', () => {
    for (const slug of ['soccer/esp.1', 'soccer/fifa.friendly', 'soccer/eng.1', 'basketball/nba']) {
      expect(isWomensSlug(slug), slug).toBe(false)
    }
    expect(isWomensSlug(undefined)).toBe(false)
    expect(isWomensSlug(null)).toBe(false)
  })

  // El motivo de usar un set explícito en lugar de un test de substring '.w.':
  // el amistoso femenino termina en '.w' (sin punto final) y se escaparía.
  it('detecta femenino aunque el slug no contenga la subcadena ".w."', () => {
    expect('soccer/fifa.friendly.w'.includes('.w.')).toBe(false)
    expect(isWomensSlug('soccer/fifa.friendly.w')).toBe(true)
  })

  it('WOMENS_SLUGS deriva del flag y no incluye al masculino homónimo', () => {
    expect(WOMENS_SLUGS.has('soccer/esp.w.1')).toBe(true)
    expect(WOMENS_SLUGS.has('soccer/esp.1')).toBe(false)
  })
})

describe('género por etiqueta · WOMENS_COMPS / isWomensComp', () => {
  // El calendario solo tiene `comp` (no slug) en cada evento; esta es la vía
  // para no cruzar la forma del club masculino con su homónimo femenino.
  it('reconoce las etiquetas de competición femeninas', () => {
    expect(isWomensComp('Liga F')).toBe(true)
    expect(isWomensComp('Amistoso (F)')).toBe(true)
    expect(WOMENS_COMPS.has('Liga F')).toBe(true)
  })

  it('NO marca etiquetas masculinas/mixtas', () => {
    for (const comp of ['LaLiga', 'Premier', 'Amistoso', 'Champions', 'NBA']) {
      expect(isWomensComp(comp), comp).toBe(false)
    }
    expect(isWomensComp(undefined)).toBe(false)
    expect(isWomensComp(null)).toBe(false)
  })
})

describe('género de fila · isWomensPastRow', () => {
  it('clasifica por match_ref (prefijo exacto, no substring)', () => {
    expect(isWomensPastRow({ match_ref: refOf('soccer/esp.w.1', '727461') })).toBe(true)
    expect(isWomensPastRow({ match_ref: refOf('soccer/fifa.friendly.w', '99') })).toBe(true)
    // 'esp.1' (LaLiga masculina) NO debe confundirse con 'esp.w.1'.
    expect(isWomensPastRow({ match_ref: refOf('soccer/esp.1', '727461') })).toBe(false)
    expect(isWomensPastRow({ match_ref: refOf('soccer/fifa.friendly', '99') })).toBe(false)
    expect(isWomensPastRow({ match_ref: refOf('basketball/nba', '55') })).toBe(false)
  })

  it('cae al id cuando no hay match_ref', () => {
    expect(isWomensPastRow({ id: idOf('soccer/esp.w.1', '727461') })).toBe(true)
    expect(isWomensPastRow({ id: idOf('soccer/esp.1', '727461') })).toBe(false)
    expect(isWomensPastRow({ match_ref: null, id: idOf('soccer/esp.w.1', '1') })).toBe(true)
  })

  it('fila sin identificadores → no femenino (por defecto masculino/mixto)', () => {
    expect(isWomensPastRow({})).toBe(false)
    expect(isWomensPastRow({ match_ref: null, id: null })).toBe(false)
  })

  // El bug que arreglamos: Clásico femenino y masculino comparten nombres pero
  // distinto slug → distinto género de fila.
  it('separa el Clásico femenino del masculino', () => {
    const fem = { match_ref: refOf('soccer/esp.w.1', '101') } // Real Madrid vs Barcelona (Liga F)
    const masc = { match_ref: refOf('soccer/esp.1', '202') }  // Real Madrid vs Barcelona (LaLiga)
    expect(isWomensPastRow(fem)).toBe(true)
    expect(isWomensPastRow(masc)).toBe(false)
  })
})
