// Política de indexación de etiquetas.
//
// Estos tests fijan una decisión tomada CON DATOS (Search Console, 90 días a
// 31/08/2026: 609 etiquetas con impresiones → 6 clics). Si alguien baja el
// umbral sin volver a medir, el test se lo recuerda.

import { describe, it, expect } from 'vitest'
import { MIN_TAG_ARTICLES, isJunkTag, esTagIndexable } from './tag-policy'

describe('MIN_TAG_ARTICLES', () => {
  it('no vuelve a bajar sin volver a medir', () => {
    // Con 3 se indexaban 1.976 etiquetas (28% del sitemap) para 6 clics en 90
    // días. Si esto baja, hay que traer datos nuevos de Search Console.
    expect(MIN_TAG_ARTICLES).toBeGreaterThanOrEqual(10)
  })
})

describe('isJunkTag', () => {
  it('descarta slugs numéricos puros', () => {
    expect(isJunkTag('2')).toBe(true)
    expect(isJunkTag('2026')).toBe(true)
  })
  it('descarta slugs de menos de tres caracteres', () => {
    expect(isJunkTag('a')).toBe(true)
    expect(isJunkTag('ab')).toBe(true)
  })
  it('deja pasar una etiqueta normal', () => {
    expect(isJunkTag('laliga')).toBe(false)
    expect(isJunkTag('mundial 2026')).toBe(false)
  })
  it('no se deja engañar por espacios', () => {
    expect(isJunkTag('  a  ')).toBe(true)
  })
})

describe('esTagIndexable', () => {
  it('indexa un tema recurrente de verdad', () => {
    expect(esTagIndexable('laliga', 487)).toBe(true)
    expect(esTagIndexable('fichajes', 10)).toBe(true)
  })

  it('deja fuera la etiqueta de nombre suelto, que le robaba la consulta a la ficha', () => {
    // "karim adeyemi" se comía 324 impresiones sin un solo clic, compitiendo
    // con /jugador/ por la misma búsqueda.
    expect(esTagIndexable('karim adeyemi', 4)).toBe(false)
    expect(esTagIndexable('morten hjulmand', 2)).toBe(false)
  })

  it('la basura no entra ni con muchos artículos', () => {
    expect(esTagIndexable('2026', 500)).toBe(false)
    expect(esTagIndexable('a', 500)).toBe(false)
  })

  it('justo por debajo del umbral no entra', () => {
    expect(esTagIndexable('algo', MIN_TAG_ARTICLES - 1)).toBe(false)
    expect(esTagIndexable('algo', MIN_TAG_ARTICLES)).toBe(true)
  })
})
