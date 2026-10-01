import { describe, it, expect } from 'vitest'
import { nombrePorDefecto } from './nombre-publico'

describe('nombrePorDefecto', () => {
  it('no contiene nada del correo y siempre da lo mismo para el mismo usuario', () => {
    const id = 'f7954a21-6466-4837-a5bc-37ac64877997'
    expect(nombrePorDefecto(id)).toMatch(/^Takero \d{4}$/)
    expect(nombrePorDefecto(id)).toBe(nombrePorDefecto(id))
  })

  it('usuarios distintos salen distintos', () => {
    expect(nombrePorDefecto('694310e6-3b42-4350-a61c-763783bc0319'))
      .not.toBe(nombrePorDefecto('f7954a21-6466-4837-a5bc-37ac64877997'))
  })
})
