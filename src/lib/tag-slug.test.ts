import { describe, expect, it } from 'vitest'
import { agruparTags, resolverTagParam, tagHref, tagSlug } from './tag-slug'

describe('tagSlug', () => {
  it('pasa espacios, mayúsculas y acentos a un slug ASCII', () => {
    expect(tagSlug('Real Madrid')).toBe('real-madrid')
    expect(tagSlug('fútbol')).toBe('futbol')
    expect(tagSlug('luka modrić')).toBe('luka-modric')
    expect(tagSlug('466m€')).toBe('466m')
  })

  it('una etiqueta sin letras ni números no tiene URL', () => {
    expect(tagSlug('€€')).toBe('')
    expect(tagHref('€€')).toBeNull()
    expect(tagHref('Liga MX')).toBe('/tag/liga-mx')
  })
})

describe('agruparTags', () => {
  it('funde las variantes de una misma etiqueta y suma sus apariciones', () => {
    const g = agruparTags(['fútbol', 'futbol', 'fútbol', 'Fútbol', 'tenis'])
    expect(g.size).toBe(2)
    expect(g.get('futbol')).toEqual({
      slug: 'futbol',
      etiqueta: 'fútbol',
      variantes: ['fútbol', 'Fútbol', 'futbol'],
      articulos: 4,
    })
  })

  it('a igualdad de usos muestra la grafía con tilde', () => {
    expect(agruparTags(['futbol', 'fútbol']).get('futbol')?.etiqueta).toBe('fútbol')
  })

  it('ignora lo que no es texto o no da slug', () => {
    expect(agruparTags([null, 3, '  ', '€€']).size).toBe(0)
  })
})

describe('resolverTagParam', () => {
  const index = Object.fromEntries(agruparTags(['Real Madrid', 'real madrid', 'fútbol']))

  it('el slug es la URL buena: no redirige', () => {
    expect(resolverTagParam('real-madrid', index)).toMatchObject({ redirigir: false, grupo: { slug: 'real-madrid' } })
  })

  it('las URLs viejas con el texto crudo redirigen al slug', () => {
    expect(resolverTagParam('real%20madrid', index)).toMatchObject({ redirigir: true, grupo: { slug: 'real-madrid' } })
    expect(resolverTagParam('Real%20Madrid', index)?.redirigir).toBe(true)
    expect(resolverTagParam('f%C3%BAtbol', index)).toMatchObject({ redirigir: true, grupo: { slug: 'futbol' } })
  })

  it('etiqueta inexistente o URL ilegible: null (404)', () => {
    expect(resolverTagParam('baloncesto', index)).toBeNull()
    expect(resolverTagParam('%E0%A4%A', index)).toBeNull()
  })
})
