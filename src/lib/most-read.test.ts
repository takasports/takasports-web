import { describe, it, expect } from 'vitest'
import { slugDeUrl } from './most-read'

describe('slugDeUrl', () => {
  it('saca el slug de una URL de artículo', () => {
    expect(slugDeUrl('https://www.takasportsmedia.com/noticias/malas-noticias-para-rafa-jodar'))
      .toBe('malas-noticias-para-rafa-jodar')
  })

  it('ignora lo que no es un artículo', () => {
    // Search Console mezcla calendario, rankings y glosario en las páginas top.
    expect(slugDeUrl('https://www.takasportsmedia.com/calendario/dia/2026-09-02')).toBeNull()
    expect(slugDeUrl('https://www.takasportsmedia.com/')).toBeNull()
    expect(slugDeUrl('https://www.takasportsmedia.com/glosario/prorroga')).toBeNull()
  })

  it('no se queda con la query ni con el ancla', () => {
    expect(slugDeUrl('https://www.takasportsmedia.com/noticias/algo?utm=x')).toBe('algo')
    expect(slugDeUrl('https://www.takasportsmedia.com/noticias/algo#comentarios')).toBe('algo')
  })

  it('descodifica los acentos que Search Console escapa', () => {
    expect(slugDeUrl('https://www.takasportsmedia.com/noticias/mart%C3%ADnez-ficha')).toBe('martínez-ficha')
  })
})
