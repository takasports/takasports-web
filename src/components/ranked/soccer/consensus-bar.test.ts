import { describe, it, expect } from 'vitest'
import { toPercents, CONSENSUS_MIN_VOTES } from './ConsensusBar'

describe('reparto del consenso', () => {
  it('los tres porcentajes SUMAN 100 siempre', () => {
    // Redondeando cada uno por su cuenta salían 99 o 101, y un reparto que no
    // suma cien se lee como un error aunque la barra se pinte bien.
    const casos = [
      { p1: 1, px: 1, p2: 1, total: 3 },
      { p1: 2, px: 1, p2: 0, total: 3 },
      { p1: 5, px: 3, p2: 1, total: 9 },
      { p1: 7, px: 0, p2: 0, total: 7 },
      { p1: 1, px: 1, p2: 0, total: 2 },
      { p1: 11, px: 11, p2: 11, total: 33 },
    ]
    for (const c of casos) {
      const p = toPercents(c)
      expect(p.p1 + p.px + p.p2, JSON.stringify(c)).toBe(100)
    }
  })

  it('el reparto refleja los votos', () => {
    expect(toPercents({ p1: 3, px: 1, p2: 0, total: 4 })).toEqual({ p1: 75, px: 25, p2: 0 })
  })

  it('unanimidad es 100 en una sola opción', () => {
    expect(toPercents({ p1: 0, px: 0, p2: 5, total: 5 })).toEqual({ p1: 0, px: 0, p2: 100 })
  })

  it('sin votos no inventa nada', () => {
    expect(toPercents({ p1: 0, px: 0, p2: 0, total: 0 })).toEqual({ p1: 0, px: 0, p2: 0 })
  })

  it('el mínimo de muestra es mayor que uno', () => {
    // "El 100% ha puesto al Madrid" sobre un voto no es consenso, es una
    // persona — y enseñarlo haría parecer la sección más viva de lo que está.
    expect(CONSENSUS_MIN_VOTES).toBeGreaterThan(1)
  })
})
