import { describe, it, expect } from 'vitest'
import { alturaEnMetros } from './player-measures'

describe('alturaEnMetros', () => {
  it('convierte el formato de ESPN a metros', () => {
    expect(alturaEnMetros(`5' 10"`)).toBe('1,78 m')   // Mbappé, el caso medido
    expect(alturaEnMetros(`6' 4"`)).toBe('1,93 m')
    expect(alturaEnMetros(`7' 0"`)).toBe('2,13 m')    // pívot de la NBA
  })

  it('acepta las variantes que ESPN mezcla', () => {
    expect(alturaEnMetros(`5'10`)).toBe('1,78 m')
    expect(alturaEnMetros(`6'`)).toBe('1,83 m')
    expect(alturaEnMetros(`5′ 10″`)).toBe('1,78 m')   // comillas tipográficas
  })

  it('no toca lo que ya viene en métrico', () => {
    expect(alturaEnMetros('1,78 m')).toBe('1,78 m')
    expect(alturaEnMetros('178 cm')).toBe('178 cm')
  })

  it('ante algo que no entiende, devuelve el original en vez de comerse el dato', () => {
    expect(alturaEnMetros('desconocida')).toBe('desconocida')
    expect(alturaEnMetros(`99' 0"`)).toBe(`99' 0"`)   // fuera de rango humano
    expect(alturaEnMetros(`5' 99"`)).toBe(`5' 99"`)   // pulgadas imposibles
  })

  it('sin dato, no inventa', () => {
    expect(alturaEnMetros(undefined)).toBeUndefined()
    expect(alturaEnMetros(null)).toBeUndefined()
    expect(alturaEnMetros('   ')).toBeUndefined()
  })
})
