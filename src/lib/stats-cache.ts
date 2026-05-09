// Stale-while-revalidate cache for /api/stats/* fetches.
// Each entry holds the last successful payload + an expiry. On fetch failure
// we hand back the last good value so the UI doesn't drop to "no disponible".

interface Entry<T> {
  data: T
  expiresAt: number
  // When true, the value is being kept past expiry as a fallback.
  stale: boolean
}

const store = new Map<string, Entry<unknown>>()

export interface SWRResult<T> {
  data: T
  /** true when the value comes from the in-memory fallback after a failed refresh */
  stale: boolean
}

/**
 * Run `fetcher`. If it throws or returns null/undefined, fall back to the last
 * successful value cached under `key`. Successful results are cached for `ttlMs`.
 *
 * The fallback is the whole point: ESPN occasionally returns 502/503 for a few
 * seconds. Without this, every transient error makes a block render empty.
 */
export async function withStaleFallback<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T | null | undefined>,
  fallback: T,
): Promise<SWRResult<T>> {
  const cached = store.get(key) as Entry<T> | undefined
  if (cached && Date.now() < cached.expiresAt) {
    return { data: cached.data, stale: false }
  }
  try {
    const fresh = await fetcher()
    if (fresh === null || fresh === undefined) throw new Error('empty')
    store.set(key, { data: fresh, expiresAt: Date.now() + ttlMs, stale: false })
    return { data: fresh, stale: false }
  } catch {
    if (cached) {
      // Keep the stale value but bump TTL a small amount so we retry soon.
      store.set(key, { ...cached, expiresAt: Date.now() + 60_000, stale: true })
      return { data: cached.data, stale: true }
    }
    return { data: fallback, stale: false }
  }
}
