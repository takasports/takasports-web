import { describe, expect, it, vi } from 'vitest'

// El builder real, con un proyecto fijo: así se comprueba la URL que de verdad
// genera (crop → rect), no un mock que devuelva lo que queramos.
vi.mock('@/lib/sanity', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url')
  const builder = createImageUrlBuilder({ projectId: 'proj', dataset: 'production' })
  return { urlFor: (source: unknown) => builder.image(source as never) }
})

import { resolveCoverUrl, withCoverUrls } from './cover-image'

// Portada real del reportaje de Rafa Ferreira (10/10/2026): retrato 3276×4096
// recortado en el Studio, sin imageUrl.
const REPORTAJE = {
  imageUrl: null,
  image: {
    _type: 'image',
    asset: { _ref: 'image-cc21673ddf7ae2080ff2f1f752621790d15477a0-3276x4096-jpg', _type: 'reference' },
    crop: { _type: 'sanity.imageCrop', bottom: 0.5371, left: 0, right: 0, top: 0.12 },
  },
}

describe('resolveCoverUrl', () => {
  it('construye la URL de Sanity desde el asset cuando no hay imageUrl', () => {
    const url = resolveCoverUrl(REPORTAJE)!
    expect(url).toMatch(
      /^https:\/\/cdn\.sanity\.io\/images\/proj\/production\/cc21673ddf7ae2080ff2f1f752621790d15477a0-3276x4096\.jpg\?/,
    )
    const q = new URL(url).searchParams
    expect(q.get('w')).toBe('1200')
    expect(q.get('h')).toBe('675')
    // El crop del Studio se respeta: el recorte cae DENTRO de la franja elegida
    // (y de 492 a 1896 de 4096), no sobre la foto entera.
    const [x, y, w, h] = q.get('rect')!.split(',').map(Number)
    expect(y).toBeGreaterThanOrEqual(491)
    expect(y + h).toBeLessThanOrEqual(1897)
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x + w).toBeLessThanOrEqual(3276)
    expect(w / h).toBeCloseTo(16 / 9, 1)
  })

  it('respeta el hotspot al recortar a la proporción pedida', () => {
    const conHotspot = {
      image: {
        asset: { _ref: 'image-abc-1000x1000-jpg' },
        hotspot: { x: 0.5, y: 0.1, height: 0.1, width: 0.1 },
      },
    }
    const sinHotspot = { image: { asset: { _ref: 'image-abc-1000x1000-jpg' } } }
    const rect = (row: typeof sinHotspot) => new URL(resolveCoverUrl(row)!).searchParams.get('rect')
    // Cuadrada a 16:9: con el hotspot arriba, el recorte sube.
    expect(rect(conHotspot)).not.toBe(rect(sinHotspot))
    expect(Number(rect(conHotspot)!.split(',')[1])).toBe(0)
  })

  it('admite otro tamaño', () => {
    const q = new URL(resolveCoverUrl(REPORTAJE, { width: 900, height: 600 })!).searchParams
    expect([q.get('w'), q.get('h')]).toEqual(['900', '600'])
  })

  it('no toca un imageUrl que ya viene relleno', () => {
    expect(resolveCoverUrl({ ...REPORTAJE, imageUrl: 'https://x.com/a.jpg' })).toBe('https://x.com/a.jpg')
  })

  it('devuelve null sin foto o con un asset ilegible', () => {
    expect(resolveCoverUrl({})).toBeNull()
    expect(resolveCoverUrl({ imageUrl: null, image: null })).toBeNull()
    expect(resolveCoverUrl({ image: { asset: {} } })).toBeNull()
    expect(resolveCoverUrl({ image: { asset: { _ref: 'no-es-un-asset' } } })).toBeNull()
  })
})

describe('withCoverUrls', () => {
  it('rellena imageUrl y deja intacto el resto del contrato (incluido image)', () => {
    const row = { _id: 'a', slug: 'rafa', title: 'T', ...REPORTAJE }
    const [out] = withCoverUrls([row])
    expect(out.imageUrl).toMatch(/^https:\/\/cdn\.sanity\.io\//)
    const { imageUrl: _a, ...resto } = out
    const { imageUrl: _b, ...original } = row
    expect(resto).toEqual(original)
  })
})
