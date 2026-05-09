import { describe, it, expect, vi } from 'vitest'
import { withStaleFallback } from './stats-cache'

describe('withStaleFallback', () => {
  it('returns fresh data on first successful fetch', async () => {
    const r = await withStaleFallback('a', 1000, async () => 'fresh', 'fallback')
    expect(r).toEqual({ data: 'fresh', stale: false })
  })

  it('caches and returns same data within TTL', async () => {
    const fetcher = vi.fn(async () => 'first')
    const a = await withStaleFallback('b', 1000, fetcher, 'fallback')
    const b = await withStaleFallback('b', 1000, fetcher, 'fallback')
    expect(a.data).toBe('first')
    expect(b.data).toBe('first')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('returns stale data when fetch throws and a previous success exists', async () => {
    let counter = 0
    const fetcher = vi.fn(async () => {
      counter++
      if (counter === 1) return 'good'
      throw new Error('boom')
    })
    const first = await withStaleFallback('c', 1, fetcher, 'fallback')
    expect(first.data).toBe('good')
    await new Promise(r => setTimeout(r, 5))
    const second = await withStaleFallback('c', 1, fetcher, 'fallback')
    expect(second.data).toBe('good')
    expect(second.stale).toBe(true)
  })

  it('falls back to caller-supplied default when no cache exists', async () => {
    const r = await withStaleFallback('d', 1000, async () => { throw new Error('x') }, 'safe')
    expect(r).toEqual({ data: 'safe', stale: false })
  })

  it('treats null/undefined as failures and falls back', async () => {
    const r = await withStaleFallback('e', 1000, async () => null, 'safe')
    expect(r.data).toBe('safe')
  })
})
