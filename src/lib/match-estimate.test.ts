import { describe, it, expect } from 'vitest'
import { estimateOutcome, matchDominance } from './match-estimate'
import type { FormResult } from './past-events'

const W: FormResult = 'W', D: FormResult = 'D', L: FormResult = 'L'

describe('estimateOutcome — probabilidad 1·X·2', () => {
  it('devuelve null sin base suficiente', () => {
    expect(estimateOutcome({})).toBeNull()
    expect(estimateOutcome({ homePpg: 2 })).toBeNull()           // falta away
    expect(estimateOutcome({ homeForm: [W, W], awayForm: [L] })).toBeNull() // <3 resultados
  })

  it('los tres porcentajes SIEMPRE suman 100', () => {
    const cases = [
      { homePpg: 2.5, awayPpg: 0.5 },
      { homePpg: 0.4, awayPpg: 2.7 },
      { homePpg: 1.4, awayPpg: 1.4 },
      { homeForm: [W, W, W, D, W], awayForm: [L, L, D, L, L] },
    ]
    for (const c of cases) {
      const r = estimateOutcome(c)!
      expect(r).not.toBeNull()
      expect(r.home + r.draw + r.away).toBe(100)
    }
  })

  it('el equipo mucho más fuerte tiene mayor probabilidad', () => {
    const r = estimateOutcome({ homePpg: 2.6, awayPpg: 0.6 })!
    expect(r.home).toBeGreaterThan(r.away)
    expect(r.home).toBeGreaterThan(r.draw)
  })

  it('con equipos iguales, la ventaja de local inclina hacia el local', () => {
    const r = estimateOutcome({ homePpg: 1.5, awayPpg: 1.5 })!
    expect(r.home).toBeGreaterThan(r.away)
  })

  it('un visitante muy superior supera al local pese a la ventaja de campo', () => {
    const r = estimateOutcome({ homePpg: 0.5, awayPpg: 2.8 })!
    expect(r.away).toBeGreaterThan(r.home)
  })

  it('combina tabla y forma (forma reciente desinfla a un líder en mala racha)', () => {
    const soloTabla = estimateOutcome({ homePpg: 2.4, awayPpg: 1.2 })!
    const conMalaForma = estimateOutcome({
      homePpg: 2.4, awayPpg: 1.2,
      homeForm: [L, L, L, L, D], awayForm: [W, W, W, D, W],
    })!
    expect(conMalaForma.home).toBeLessThan(soloTabla.home)
  })
})

describe('matchDominance — reparto posesión + tiros', () => {
  it('devuelve null sin métricas reconocibles', () => {
    expect(matchDominance([])).toBeNull()
    expect(matchDominance([{ label: 'Faltas', home: '10', away: '8' }])).toBeNull()
  })

  it('reparte la posesión y suma 100', () => {
    const r = matchDominance([{ label: 'Posesión %', home: '60', away: '40' }])!
    expect(r.home).toBe(60)
    expect(r.away).toBe(40)
    expect(r.basis).toContain('posesión')
  })

  it('promedia posesión y tiros a puerta', () => {
    const r = matchDominance([
      { label: 'Posesión %', home: '40', away: '60' },   // 40% local
      { label: 'Tiros a puerta', home: '2', away: '8' },  // 20% local
    ])!
    expect(r.home).toBe(30) // media de 40% y 20%
    expect(r.away).toBe(70)
    expect(r.basis).toEqual(['posesión', 'tiros a puerta'])
  })
})
