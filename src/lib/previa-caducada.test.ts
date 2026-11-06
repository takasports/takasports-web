import { describe, expect, it } from 'vitest'
import { previaCaducada, sinPreviasDelante } from './previa-caducada'

const AHORA = Date.parse('2026-11-06T12:00:00Z')
const jugada = { id: 'a', type: 'previa', kickoffIso: '2026-11-03T20:00:00Z' }
const futura = { id: 'b', type: 'previa', kickoffIso: '2026-11-07T20:00:00Z' }
const noticia = { id: 'c', type: 'noticia', kickoffIso: null }

describe('previaCaducada', () => {
  it('solo caduca una previa cuyo partido ya ha empezado', () => {
    expect(previaCaducada(jugada, AHORA)).toBe(true)
    expect(previaCaducada(futura, AHORA)).toBe(false)
    expect(previaCaducada(noticia, AHORA)).toBe(false)
    expect(previaCaducada({ type: 'previa' }, AHORA)).toBe(false)
  })
})

describe('sinPreviasDelante', () => {
  it('baja las caducadas sin perder nada ni cambiar el resto del orden', () => {
    expect(sinPreviasDelante([jugada, futura, noticia], AHORA).map(a => a.id)).toEqual(['b', 'c', 'a'])
  })
  it('sin caducadas devuelve la lista tal cual', () => {
    const lista = [futura, noticia]
    expect(sinPreviasDelante(lista, AHORA)).toBe(lista)
  })
})
