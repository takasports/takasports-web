import { describe, it, expect } from 'vitest'
import { stripExpiredThumbs } from './reel-thumbs'

// `oe` es la caducidad de la URL firmada de Instagram, en hex unix.
const conOe = (segundos: number) =>
  `https://instagram.fmad17-1.fna.fbcdn.net/v/t51.71878-15/foo.jpg?oe=${Math.floor(segundos).toString(16).toUpperCase()}&_nc_sid=8b3546`

const AYER = Date.now() / 1000 - 86_400
const MAÑANA = Date.now() / 1000 + 86_400

describe('stripExpiredThumbs', () => {
  it('quita la miniatura caducada y CONSERVA el reel', () => {
    const out = stripExpiredThumbs([{ id: 'a', thumbnail_url: conOe(AYER) }])
    expect(out).toHaveLength(1)
    expect(out[0].thumbnail_url).toBeUndefined()
  })

  it('no toca las que siguen vigentes', () => {
    const url = conOe(MAÑANA)
    expect(stripExpiredThumbs([{ id: 'a', thumbnail_url: url }])[0].thumbnail_url).toBe(url)
  })

  it('deja en paz lo que no es una URL de Instagram', () => {
    const url = 'https://cdn.sanity.io/images/x/y/z.jpg'
    expect(stripExpiredThumbs([{ id: 'a', thumbnail_url: url }])[0].thumbnail_url).toBe(url)
  })

  it('aguanta reels sin miniatura', () => {
    expect(stripExpiredThumbs([{ id: 'a' }, { id: 'b', thumbnail_url: null }])).toHaveLength(2)
  })

  it('también entiende la URL envuelta en el proxy', () => {
    const proxy = `/api/instagram/thumbnail?url=${encodeURIComponent(conOe(AYER))}`
    expect(stripExpiredThumbs([{ id: 'a', thumbnail_url: proxy }])[0].thumbnail_url).toBeUndefined()
  })
})
