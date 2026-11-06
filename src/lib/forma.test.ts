import { describe, expect, it } from 'vitest'
import { letraForma } from './forma'
import { puestoEspn } from './espn-standings'
import { siglasLiderNBA } from './nba-lideres'

describe('letraForma', () => {
  it('usa G/E/P', () => {
    expect(['W', 'D', 'L'].map(letraForma)).toEqual(['G', 'E', 'P'])
    expect(letraForma(undefined)).toBe('')
  })
})

describe('puestoEspn', () => {
  it('usa rank y, si no existe, la semilla de la NBA', () => {
    expect(puestoEspn({ stats: [{ name: 'rank', value: 3 }] })).toBe(3)
    expect(puestoEspn({ stats: [{ name: 'playoffSeed', value: 1 }] })).toBe(1)
    expect(puestoEspn({ stats: [] })).toBe(999)
  })
})

describe('siglasLiderNBA', () => {
  it('traduce las siglas sin tocar las cifras', () => {
    expect(siglasLiderNBA('6 TO, 39 MIN')).toBe('6 PÉR, 39 MIN')
    expect(siglasLiderNBA('48.5 FG%, 95.3 FT%')).toBe('48.5 TC%, 95.3 TL%')
  })
})
