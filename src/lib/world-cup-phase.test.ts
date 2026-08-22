import { describe, it, expect } from 'vitest'
import { worldCupPhase, WC_START, WC_END } from './world-cup-phase'

describe('worldCupPhase', () => {
  it('antes del primer partido', () => {
    expect(worldCupPhase(new Date('2026-05-30T12:00:00Z'))).toBe('antes')
    expect(worldCupPhase(new Date(WC_START.getTime() - 1))).toBe('antes')
  })

  it('durante el torneo', () => {
    expect(worldCupPhase(WC_START)).toBe('en-curso')
    expect(worldCupPhase(new Date('2026-07-04T20:00:00Z'))).toBe('en-curso')
    expect(worldCupPhase(new Date('2026-07-19T19:00:00Z'))).toBe('en-curso')   // la final
  })

  it('después de la final ya no está en juego', () => {
    // El fallo real: el 21/08/2026 la pestaña seguía marcada "EN JUEGO".
    expect(worldCupPhase(new Date('2026-08-21T23:00:00Z'))).toBe('terminado')
    expect(worldCupPhase(new Date(WC_END.getTime() + 1))).toBe('terminado')
  })
})
