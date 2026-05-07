// API route — sirve los reels de @taka.sports
// Fuente: bucket público en Supabase Storage (lo refresca cada 6h el WF-10 de n8n).
// Fallbacks: live IG public API → JSON estático en repo.

import { fetchPublicReels, type PublicReel } from '@/lib/instagram-public'
import reelsData from '@/lib/reels-data.json'

export const runtime = 'nodejs'
export const dynamic  = 'force-dynamic'

const STORAGE_URL =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '') +
  '/storage/v1/object/public/reels/reels.json'

interface CacheEntry { data: PublicReel[]; ts: number }
const CACHE_TTL = 5 * 60 * 1000
let cache: CacheEntry | null = null

async function fetchFromStorage(): Promise<PublicReel[] | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  try {
    const res = await fetch(STORAGE_URL, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) && data.length > 0 ? data : null
  } catch {
    return null
  }
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.ts < CACHE_TTL) {
    return Response.json(cache.data)
  }

  const fromStorage = await fetchFromStorage()
  if (fromStorage) {
    cache = { data: fromStorage, ts: now }
    return Response.json(fromStorage)
  }

  const live = await fetchPublicReels().catch(() => [])
  if (live.length > 0) {
    cache = { data: live, ts: now }
    return Response.json(live)
  }

  const staticReels = reelsData as PublicReel[]
  if (staticReels.length > 0) {
    cache = { data: staticReels, ts: now }
    return Response.json(staticReels)
  }

  return Response.json([])
}
