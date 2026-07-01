import { describe, it, expect } from 'vitest'
import { getEffectiveTrend } from './rankings-ui'
import type { RankingEntry } from './rankings'

// Construye una entry mínima; getDisplayScore devuelve `score` directo si es > 0,
// así controlamos el score mostrado sin necesitar factores.
const entry = (over: Partial<RankingEntry>): RankingEntry =>
  ({ id: 't', rank: 1, name: 'Test', subtitle: '', trend: 'flat', ...over }) as RankingEntry

describe('getEffectiveTrend — la flecha sigue al cambio real de score (metodología §4)', () => {
  it('sin scorePrev cae a la tendencia editorial de la DB', () => {
    expect(getEffectiveTrend(entry({ score: 90, trend: 'up2' }))).toBe('up2')
  })

  it('NO contradice al número: trend curado "up" pero el score bajó fuerte → down2 (caso Ferrari del informe)', () => {
    // 87.3 → 81.5 (−5.8) con trend curado 'up': antes salía ↑ junto a un −5.8 rojo
    expect(getEffectiveTrend(entry({ score: 81.5, scorePrev: 87.3, trend: 'up' }))).toBe('down2')
  })

  it('subida leve (+1..3) → up', () => {
    expect(getEffectiveTrend(entry({ score: 89, scorePrev: 87, trend: 'flat' }))).toBe('up')
  })

  it('subida fuerte (≥3) → up2', () => {
    expect(getEffectiveTrend(entry({ score: 91, scorePrev: 87, trend: 'flat' }))).toBe('up2')
  })

  it('bajada leve (−1..3) → down', () => {
    expect(getEffectiveTrend(entry({ score: 85, scorePrev: 87, trend: 'up' }))).toBe('down')
  })

  it('variación menor de 1 punto → flat', () => {
    expect(getEffectiveTrend(entry({ score: 87.4, scorePrev: 87, trend: 'up2' }))).toBe('flat')
  })
})
