// API route — sirve los reels de @taka.sports
// Fuente: bucket público en Supabase Storage (lo refresca cada 6h el WF-10 de n8n).
// Fallbacks: live IG public API → JSON estático en repo.

import { fetchPublicReels, type PublicReel, detectSportPublic, extractTitlePublic } from '@/lib/instagram-public'
import reelsData from '@/lib/reels-data.json'

export const runtime = 'nodejs'
export const dynamic  = 'force-dynamic'

const STORAGE_URL =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '') +
  '/storage/v1/object/public/reels/reels.json'

// Aliases de slugs no canónicos → slug canónico Sanity
const SPORT_ALIASES: Record<string, string> = { wrestling: 'wwe' }

// Señales inequívocas de WWE — sobrescriben clasificaciones incorrectas del almacén
const WWE_OVERRIDE_SIGNALS = [
  'becky lynch', 'roman reigns', 'cody rhodes', 'seth rollins', 'cm punk',
  'undertaker', 'danhausen', 'tiffany stratton', 'jacob fatu', 'iyo sky',
  'liv morgan', 'sami zayn', 'trick williams', 'wrestlemania', 'smackdown',
  'raw ', ' raw', 'samoano', 'wwe', 'aew', 'lucha libre',
]

function normalizeReel(item: PublicReel): PublicReel {
  const text = [item.caption, item.title].filter(Boolean).join(' ').toLowerCase()
  let sport = item.sport
    ? (SPORT_ALIASES[item.sport] ?? item.sport)
    : detectSportPublic(text)
  // Corregir clasificaciones erróneas cuando hay señales inequívocas de WWE
  if (sport !== 'wwe' && WWE_OVERRIDE_SIGNALS.some(s => text.includes(s))) {
    sport = 'wwe'
  }
  const title = item.title || extractTitlePublic(item.caption ?? '')
  return { ...item, sport, title }
}

interface CacheEntry { data: PublicReel[]; ts: number }
const CACHE_TTL = 5 * 60 * 1000
let cache: CacheEntry | null = null

const STORAGE_MAX_AGE_MS = 12 * 60 * 60 * 1000 // 12h — si Supabase está más viejo, usar feed live

async function fetchFromStorage(): Promise<PublicReel[] | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  try {
    const res = await fetch(STORAGE_URL, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    // Comprobar frescura: si el reel más reciente tiene >12h, ignorar Supabase
    const newestTs = data.reduce((max: number, r: PublicReel) => {
      const ts = r.timestamp ? new Date(r.timestamp).getTime() || (Number(r.timestamp) * 1000) : 0
      return ts > max ? ts : max
    }, 0)
    if (newestTs > 0 && Date.now() - newestTs > STORAGE_MAX_AGE_MS) return null
    return data.map(normalizeReel)
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
