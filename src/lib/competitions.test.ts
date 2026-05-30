import { describe, it, expect } from 'vitest'
import { getLiveLabel } from './competitions'

describe('getLiveLabel — estados terminales', () => {
  const TERMINALES = [
    'FT', 'FINAL', 'FINAL_PEN', 'FINAL_AET', 'POST_GAME', 'END_OF_REGULATION',
    'ABANDONED', 'WALKOVER', 'RETIRED', 'CANCELED', 'POSTPONED', 'SUSPENDED', 'FORFEIT',
  ]
  for (const s of TERMINALES) {
    it(`"${s}" → "Final" (nunca "EN VIVO")`, () => {
      expect(getLiveLabel(s, null)).toBe('Final')
      expect(getLiveLabel(s, 90)).toBe('Final')
    })
  }
})

describe('getLiveLabel — estados pre-partido', () => {
  for (const s of ['NS', 'STATUS_SCHEDULED', 'PRE_GAME', 'DELAYED']) {
    it(`"${s}" → "Próximo"`, () => {
      expect(getLiveLabel(s, null)).toBe('Próximo')
    })
  }
})

describe('getLiveLabel — estados en vivo (fútbol)', () => {
  it('HT → Descanso', () => {
    expect(getLiveLabel('HT', null)).toBe('Descanso')
  })
  it('1H con minuto → "23\'"', () => {
    expect(getLiveLabel('1H', 23)).toBe("23'")
  })
  it('1H sin minuto → "1T"', () => {
    expect(getLiveLabel('1H', null)).toBe('1T')
  })
  it('2H con minuto → "67\'"', () => {
    expect(getLiveLabel('2H', 67)).toBe("67'")
  })
  it('2H sin minuto → "2T"', () => {
    expect(getLiveLabel('2H', null)).toBe('2T')
  })
  it('OT con minuto → "Prórr. 95\'"', () => {
    expect(getLiveLabel('OT', 95)).toBe("Prórr. 95'")
  })
  it('OT sin minuto → "Prórroga"', () => {
    expect(getLiveLabel('OT', null)).toBe('Prórroga')
  })
})

describe('getLiveLabel — basket (Q-quarters)', () => {
  it('Q1 con elapsed → "Q1 · 8\'"', () => {
    expect(getLiveLabel('Q1', 8)).toBe("Q1 · 8'")
  })
  it('Q4 sin elapsed → "Q4"', () => {
    expect(getLiveLabel('Q4', null)).toBe('Q4')
  })
  it('INT → Intervalo', () => {
    expect(getLiveLabel('INT', null)).toBe('Intervalo')
  })
})

describe('getLiveLabel — tenis (sets ganados)', () => {
  it('LIVE 1-0 sets → "Set 2"', () => {
    expect(getLiveLabel('LIVE', null, { sport: 'tennis', homeScore: 1, awayScore: 0 })).toBe('Set 2')
  })
  it('LIVE 0-0 sets → "Set 1"', () => {
    expect(getLiveLabel('LIVE', null, { sport: 'tenis', homeScore: 0, awayScore: 0 })).toBe('Set 1')
  })
})

describe('getLiveLabel — fallback genérico', () => {
  it('LIVE con elapsed → "45\'"', () => {
    expect(getLiveLabel('LIVE', 45)).toBe("45'")
  })
  it('LIVE sin elapsed → "EN VIVO"', () => {
    // Este es el único caso donde el fallback "EN VIVO" es correcto —
    // status explícitamente LIVE sin tiempo y sin sport tenis.
    expect(getLiveLabel('LIVE', null)).toBe('EN VIVO')
  })
})
