import { describe, it, expect } from 'vitest'
import { stripExpiredThumbs, repairExpired, shortcodeOf } from './reel-thumbs'

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

describe('repairExpired', () => {
  const base = { instagram_url: 'https://www.instagram.com/reel/DdhEhBZAk06/', video_url: null as string | null }

  it('portada caducada → la de código corto, que no caduca', () => {
    const r = repairExpired({ ...base, thumbnail_url: `/api/instagram/thumbnail?url=${encodeURIComponent(conOe(AYER))}` })
    expect(r.thumbnail_url).toBe('/api/instagram/thumbnail?sc=DdhEhBZAk06')
    expect(r.shortcode).toBe('DdhEhBZAk06')
  })

  it('sin portada también la rellena', () => {
    expect(repairExpired({ ...base, thumbnail_url: null }).thumbnail_url).toBe('/api/instagram/thumbnail?sc=DdhEhBZAk06')
  })

  it('respeta la portada estable de Storage', () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/reels/thumbs/DdhEhBZAk06.jpg'
    expect(repairExpired({ ...base, thumbnail_url: url }).thumbnail_url).toBe(url)
  })

  it('quita el vídeo caducado y deja el vigente', () => {
    const muerto = `/api/instagram/video?url=${encodeURIComponent(conOe(AYER))}`
    const vivo = `/api/instagram/video?url=${encodeURIComponent(conOe(MAÑANA))}`
    expect(repairExpired({ ...base, thumbnail_url: null, video_url: muerto }).video_url).toBeNull()
    expect(repairExpired({ ...base, thumbnail_url: null, video_url: vivo }).video_url).toBe(vivo)
  })

  it('sin código corto y con portada caducada → null (la tarjeta cae a su degradado)', () => {
    expect(repairExpired({ instagram_url: '', thumbnail_url: conOe(AYER), video_url: null }).thumbnail_url).toBeNull()
  })
})

describe('shortcodeOf', () => {
  it('entiende /reel/, /p/ y /tv/', () => {
    expect(shortcodeOf('https://www.instagram.com/reel/DdhEhBZAk06/')).toBe('DdhEhBZAk06')
    expect(shortcodeOf('https://instagram.com/p/DdXZNB-xDrZ/?igsh=1')).toBe('DdXZNB-xDrZ')
    expect(shortcodeOf('https://example.com/reel/x')).toBeNull()
  })
})
