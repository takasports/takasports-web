import { describe, it, expect } from 'vitest'
import { planToken, isAuthError, alertDue, graphToReels, publicThumbUrl, type TokenRecord } from './ig-sync-core'

const NOW = Date.UTC(2026, 9, 2, 12)
const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString()
const rec = (daysLeft: number | null, ageDays: number | null): TokenRecord => ({
  value: 'x',
  expiresAt: daysLeft === null ? null : iso(NOW + daysLeft * DAY),
  updatedAt: ageDays === null ? null : iso(NOW - ageDays * DAY),
  source: ageDays === null ? 'env' : 'store',
})

describe('planToken', () => {
  it('sin token → missing, nada que renovar', () => {
    expect(planToken(null, NOW)).toMatchObject({ refresh: false, state: 'missing' })
  })
  it('recién autorizado (59 días) → no se toca', () => {
    expect(planToken(rec(59, 1), NOW)).toMatchObject({ refresh: false, state: 'ok' })
  })
  it('con ≤50 días se renueva', () => {
    expect(planToken(rec(50, 10), NOW)).toMatchObject({ refresh: true, state: 'ok' })
  })
  it('con ≤7 días avisa (y sigue intentando renovar)', () => {
    expect(planToken(rec(6, 54), NOW)).toMatchObject({ refresh: true, state: 'expiring' })
  })
  it('caducado → no se puede renovar, hay que reautorizar', () => {
    expect(planToken(rec(-1, 61), NOW)).toMatchObject({ refresh: false, state: 'expired' })
  })
  it('Meta no deja renovar un token de menos de 24 h', () => {
    expect(planToken(rec(5, 0.5), NOW).refresh).toBe(false)
  })
  it('token de la env (sin fecha) → se renueva para meterlo en el almacén con fecha', () => {
    expect(planToken(rec(null, null), NOW)).toMatchObject({ refresh: true, state: 'ok', daysLeft: null })
  })
})

describe('isAuthError', () => {
  it('190 u OAuthException piden reautorizar', () => {
    expect(isAuthError({ code: 190 })).toBe(true)
    expect(isAuthError({ type: 'OAuthException', code: 10 })).toBe(true)
  })
  it('lo demás es pasajero', () => {
    expect(isAuthError({ code: 4, type: 'IGApiException' })).toBe(false)
    expect(isAuthError(null)).toBe(false)
  })
})

describe('alertDue', () => {
  it('no repite un aviso antes de 24 h', () => {
    expect(alertDue(iso(NOW - 3 * 3_600_000), NOW)).toBe(false)
    expect(alertDue(iso(NOW - 25 * 3_600_000), NOW)).toBe(true)
    expect(alertDue(undefined, NOW)).toBe(true)
  })
})

describe('graphToReels', () => {
  it('solo vídeos, enlace canónico al reel y del más nuevo al más viejo', () => {
    const out = graphToReels([
      { id: '1', media_type: 'IMAGE', permalink: 'https://www.instagram.com/p/AAAAA1/' },
      { id: '2', media_type: 'VIDEO', media_product_type: 'REELS', shortcode: 'DdXZNB-xDrZ', timestamp: '2026-09-16T22:48:17+0000', thumbnail_url: 'https://x.cdninstagram.com/a.jpg' },
      { id: '3', media_type: 'VIDEO', permalink: 'https://www.instagram.com/reel/DdhEhBZAk06/', timestamp: '2026-09-20T17:04:17+0000' },
      { id: '4', media_type: 'VIDEO' }, // sin código corto: fuera
    ])
    expect(out.map((r) => r.id)).toEqual(['3', '2'])
    expect(out[0].instagram_url).toBe('https://www.instagram.com/reel/DdhEhBZAk06/')
    expect(out[1].rawThumb).toBe('https://x.cdninstagram.com/a.jpg')
  })
})

describe('publicThumbUrl', () => {
  it('apunta al bucket público reels', () => {
    expect(publicThumbUrl('https://abc.supabase.co/', 'DdhEhBZAk06'))
      .toBe('https://abc.supabase.co/storage/v1/object/public/reels/thumbs/DdhEhBZAk06.jpg')
  })
})
