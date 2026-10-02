import { describe, expect, it } from 'vitest'
import { excludeCurrentArticle } from './related-articles'

describe('excludeCurrentArticle', () => {
  const current = { _id: 'abc123', slug: 'mi-noticia' }

  it('quita la propia noticia por _id', () => {
    const out = excludeCurrentArticle([{ _id: 'abc123', slug: 'otra' }, { _id: 'z', slug: 'z' }], current)
    expect(out.map((a) => a._id)).toEqual(['z'])
  })

  it('quita la propia noticia por slug aunque el _id no coincida', () => {
    const out = excludeCurrentArticle([{ _id: 'otro', slug: 'mi-noticia' }, { _id: 'z', slug: 'z' }], current)
    expect(out.map((a) => a._id)).toEqual(['z'])
  })

  it('trata el borrador como la misma pieza', () => {
    const out = excludeCurrentArticle([{ _id: 'drafts.abc123', slug: 'x' }], current)
    expect(out).toEqual([])
  })

  it('el bug original: con el slug como _id no se excluía nada', () => {
    // Antes se pasaba el slug de la URL como $id → `_id != "mi-noticia"` siempre cierto.
    const lista = [{ _id: 'abc123', slug: 'mi-noticia' }]
    expect(excludeCurrentArticle(lista, { _id: 'mi-noticia' })).toHaveLength(1)
    expect(excludeCurrentArticle(lista, current)).toEqual([])
  })

  it('tolera listas vacías o nulas y artículos sin slug', () => {
    expect(excludeCurrentArticle(null, current)).toEqual([])
    expect(excludeCurrentArticle([{ _id: 'q' }], { _id: null, slug: null })).toEqual([{ _id: 'q' }])
  })
})
