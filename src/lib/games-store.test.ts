import { describe, it, expect, beforeEach, vi } from 'vitest'

// Minimal in-memory localStorage + window stub (env is 'node' in vitest.config).
// Must run BEFORE importing games-store, since the module reads `typeof window`.
function makeMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)) },
    removeItem: (k: string) => { map.delete(k) },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
  }
}
;(globalThis as unknown as { window: object }).window = {}
;(globalThis as unknown as { localStorage: Storage }).localStorage = makeMemoryStorage()

import { currentWeekISO, currentDayISO, recordPlay, getMyPlay } from './games-store'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('period helpers', () => {
  it('currentWeekISO produces YYYY-Www', () => {
    const v = currentWeekISO(new Date('2026-05-15T12:00:00Z'))
    expect(v).toMatch(/^\d{4}-W\d{2}$/)
  })

  it('currentDayISO produces YYYY-MM-DD in local time', () => {
    const v = currentDayISO(new Date('2026-05-15T12:00:00Z'))
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('ISO week handles year boundary (2026-01-01 is W01)', () => {
    expect(currentWeekISO(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-W01')
  })
})

describe('recordPlay — local reconciliation', () => {
  it('writes to localStorage with score', async () => {
    // Stub network so we don't depend on server.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const res = await recordPlay({ gameId: 'crackquiz', period: '2026-W20', score: 50 })
    expect(res.local).toBe(true)
    expect(res.score).toBe(50)

    const raw = localStorage.getItem('ts_games:play:crackquiz:2026-W20')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!).score).toBe(50)
  })

  it('keeps the higher local score on subsequent lower play', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await recordPlay({ gameId: 'crackquiz', period: '2026-W20', score: 80 })
    const res = await recordPlay({ gameId: 'crackquiz', period: '2026-W20', score: 30 })
    expect(res.score).toBe(80)
  })

  it('queues the play when server call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const res = await recordPlay({ gameId: 'takagrid', period: '2026-05-15', score: 9 })
    expect(res.persisted).toBe(false)
    expect(res.queued).toBe(true)
    expect(JSON.parse(localStorage.getItem('ts_games:queue')!)).toHaveLength(1)
  })

  it('does not queue when server confirms persisted', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ persisted: true }) }) // /api/games/plays
      .mockResolvedValueOnce({ ok: true, json: async () => ({ streak: null }) })    // /api/games/streak ping
    )
    const res = await recordPlay({ gameId: 'mionce', period: '2026-W20', score: 5 })
    expect(res.persisted).toBe(true)
    expect(res.queued).toBe(false)
    expect(localStorage.getItem('ts_games:queue')).toBeNull()
  })
})

describe('getMyPlay — server/local reconciliation', () => {
  it('falls back to local when server fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    localStorage.setItem('ts_games:play:sopacracks:2026-W20', JSON.stringify({
      game_id: 'sopacracks', period: '2026-W20', score: 42, payload: {}, duration_ms: null,
    }))
    const play = await getMyPlay('sopacracks', '2026-W20')
    expect(play?.score).toBe(42)
  })

  it('caches server result locally when higher', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ play: { game_id: 'sopacracks', period: '2026-W20', score: 99, payload: {}, duration_ms: null } }),
    }))
    const play = await getMyPlay('sopacracks', '2026-W20')
    expect(play?.score).toBe(99)
    const cached = JSON.parse(localStorage.getItem('ts_games:play:sopacracks:2026-W20')!)
    expect(cached.score).toBe(99)
  })
})
