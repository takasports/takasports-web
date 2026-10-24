import { describe, expect, it } from 'vitest'
import { imagenPrincipal } from './imagen-noticia'

const SITE = 'https://www.takasportsmedia.com'

describe('imagenPrincipal', () => {
  it('la foto de un medio de terceros va por el proxy a 1200 px en JPEG', () => {
    const r = imagenPrincipal('https://e00-marca.uecdn.es/fotos/a b.jpg', SITE)
    expect(r).toEqual({
      url: `${SITE}/api/image-proxy?url=${encodeURIComponent('https://e00-marca.uecdn.es/fotos/a b.jpg')}&w=1200&f=jpeg`,
      esPlaca: false,
    })
  })

  it('las placas de previa/crónica se quedan como están, en absoluto', () => {
    expect(imagenPrincipal('/api/og/previa/soccer_esp.1_123', SITE)).toEqual({
      url: `${SITE}/api/og/previa/soccer_esp.1_123`,
      esPlaca: true,
    })
    expect(imagenPrincipal(`${SITE}/api/og/cronica/x`, SITE)?.esPlaca).toBe(true)
  })

  it('Sanity y nuestro dominio no pasan por el proxy', () => {
    const sanity = 'https://cdn.sanity.io/images/p/production/abc-1600x900.jpg'
    expect(imagenPrincipal(sanity, SITE)).toEqual({ url: sanity, esPlaca: false })
    expect(imagenPrincipal('/portadas/x.jpg', SITE)).toEqual({ url: `${SITE}/portadas/x.jpg`, esPlaca: false })
  })

  it('sin imagen o con basura: null', () => {
    expect(imagenPrincipal(null, SITE)).toBeNull()
    expect(imagenPrincipal('  ', SITE)).toBeNull()
    expect(imagenPrincipal('no es una url', SITE)).toBeNull()
  })
})
