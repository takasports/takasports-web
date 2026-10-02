import { describe, it, expect } from 'vitest'
import { esCompeticion, DEPORTES_ESPECTACULO } from './rankings-ui'

describe('esCompeticion', () => {
  it('deja fuera la WWE, venga como venga etiquetada', () => {
    expect(esCompeticion('wwe')).toBe(false)
    expect(esCompeticion('wrestling')).toBe(false)
  })
  it('mantiene los deportes de competición, UFC incluida', () => {
    for (const s of ['futbol', 'baloncesto', 'tenis', 'formula1', 'ufc']) expect(esCompeticion(s)).toBe(true)
  })
  it('el filtro de la votación usa la misma lista', () => {
    expect(DEPORTES_ESPECTACULO).toEqual(['wwe', 'wrestling'])
  })
})
