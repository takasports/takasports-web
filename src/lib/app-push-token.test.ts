import { describe, expect, it } from 'vitest'
import { filaRegistro, sanearPlataforma, sanearTemas } from './app-push-token'

describe('sanearTemas', () => {
  it('sin el campo → null (no tocar los que hubiera)', () => {
    expect(sanearTemas(undefined)).toBeNull()
  })
  it('filtra raíces desconocidas, formato y duplicados; minúsculas', () => {
    expect(sanearTemas(['Noticias:Futbol', 'noticias:futbol', 'noticias', 'admin', 'noticias:', 'x y', 3])).toEqual([
      'noticias:futbol', 'noticias',
    ])
  })
  it('tope de 10 y lo que no es lista queda vacío', () => {
    const muchos = Array.from({ length: 15 }, (_, i) => `noticias:d${i}`)
    expect(sanearTemas(muchos)).toHaveLength(10)
    expect(sanearTemas('noticias')).toEqual([])
  })
})

describe('sanearPlataforma', () => {
  it('solo ios/android', () => {
    expect(sanearPlataforma('ios')).toBe('ios')
    expect(sanearPlataforma('web')).toBeNull()
  })
})

describe('filaRegistro', () => {
  const ahoraIso = '2026-10-03T10:00:00.000Z'
  it('token nuevo sin sesión: sin dueño y con sus temas', () => {
    expect(filaRegistro({ token: 't', platform: 'ios', temas: ['noticias:futbol'], userId: null, existente: null, ahoraIso }))
      .toEqual({ token: 't', user_id: null, platform: 'ios', topics: ['noticias:futbol'], updated_at: ahoraIso })
  })
  it('sin sesión NO desvincula un token que ya tenía dueño', () => {
    const f = filaRegistro({ token: 't', platform: null, temas: [], userId: null, existente: { user_id: 'u1', topics: ['quiniela'], platform: 'ios' }, ahoraIso })
    expect(f.user_id).toBe('u1')
    expect(f.platform).toBe('ios')
    expect(f.topics).toEqual([])
  })
  it('con sesión lo vincula; sin `topics` conserva los que había', () => {
    const f = filaRegistro({ token: 't', platform: 'android', temas: null, userId: 'u2', existente: { user_id: null, topics: ['noticias'], platform: null }, ahoraIso })
    expect(f.user_id).toBe('u2')
    expect(f.topics).toEqual(['noticias'])
  })
})
