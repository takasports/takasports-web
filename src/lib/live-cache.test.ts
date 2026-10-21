import { describe, it, expect } from 'vitest'
import { liveCacheHeaders, scoreboardFetchInit, LIVE_MEMORY_TTL_MS } from './live-cache'

describe('liveCacheHeaders', () => {
  it('en directo: s-maxage 20 (mismas ejecuciones que antes) y swr 10 (antes 40)', () => {
    expect(liveCacheHeaders(true)['Cache-Control']).toBe('public, s-maxage=20, stale-while-revalidate=10')
    expect(liveCacheHeaders(true)['CDN-Cache-Control']).toBe('public, s-maxage=20, stale-while-revalidate=10')
  })
  it('sin directo: intacto', () => {
    expect(liveCacheHeaders(false)['Cache-Control']).toBe('public, s-maxage=120, stale-while-revalidate=300')
  })
})

describe('scoreboardFetchInit', () => {
  it('liga con partido en juego → sin Data Cache (que va una vuelta atrasado)', () => {
    expect(scoreboardFetchInit(true)).toEqual({ cache: 'no-store' })
  })
  it('liga sin directo → 20 s de Data Cache, como siempre', () => {
    expect(scoreboardFetchInit(false)).toEqual({ next: { revalidate: 20 } })
  })
  it('la memoria en directo no pasa de 10 s', () => {
    expect(LIVE_MEMORY_TTL_MS).toBeLessThanOrEqual(10_000)
  })
})
