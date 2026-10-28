import { describe, it, expect } from 'vitest'
import { categoriaLiderNBA } from './nba-lideres'

describe('categoriaLiderNBA', () => {
  it('traduce lo que manda ESPN (displayName y name, en vivo y antes del partido)', () => {
    expect(categoriaLiderNBA('Points')).toBe('Puntos')
    expect(categoriaLiderNBA('Assists')).toBe('Asistencias')
    expect(categoriaLiderNBA('Rebounds')).toBe('Rebotes')
    expect(categoriaLiderNBA('Steals')).toBe('Robos')
    expect(categoriaLiderNBA('Blocks')).toBe('Tapones')
    expect(categoriaLiderNBA('pointsPerGame')).toBe('Puntos')
    expect(categoriaLiderNBA('  points ')).toBe('Puntos')
  })
  it('lo que no conoce sale tal cual; vacío, vacío', () => {
    expect(categoriaLiderNBA('Efficiency Index')).toBe('Efficiency Index')
    expect(categoriaLiderNBA(undefined)).toBe('')
    expect(categoriaLiderNBA('')).toBe('')
  })
})
