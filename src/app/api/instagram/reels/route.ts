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

// Reels: ventana de 7 días (la actualidad estricta de 3d aplica a noticias,
// no a contenido social donde la rotación es más lenta).
const FRESHNESS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function tsToMs(ts: string | undefined | null): number {
  if (!ts) return 0
  const asNum = Number(ts)
  if (Number.isFinite(asNum) && asNum > 0) return asNum * 1000
  const parsed = new Date(ts).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

async function fetchFromStorage(): Promise<PublicReel[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return []
  try {
    const res = await fetch(STORAGE_URL, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map(normalizeReel)
  } catch {
    return []
  }
}

// Funde reels de varias fuentes (Supabase + live IG + estático) dedupando por id
// y filtrando por la ventana de actualidad (≤3 días). Maximiza la cantidad de
// reels visibles sin depender de que una sola fuente esté completa.
function merge(...sources: PublicReel[][]): PublicReel[] {
  const seen = new Map<string, PublicReel>()
  const now = Date.now()
  for (const src of sources) {
    for (const r of src) {
      if (!r?.id || seen.has(r.id)) continue
      const ms = tsToMs(r.timestamp)
      if (ms > 0 && now - ms > FRESHNESS_MAX_AGE_MS) continue
      seen.set(r.id, r)
    }
  }
  return Array.from(seen.values()).sort((a, b) => tsToMs(b.timestamp) - tsToMs(a.timestamp))
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.ts < CACHE_TTL) {
    return Response.json(cache.data)
  }

  // En paralelo: storage + live IG. Mezclamos resultados para maximizar diversidad.
  const [fromStorage, live] = await Promise.all([
    fetchFromStorage(),
    fetchPublicReels().catch(() => []),
  ])

  const merged = merge(fromStorage, live, reelsData as PublicReel[])
  if (merged.length > 0) {
    cache = { data: merged, ts: now }
    return Response.json(merged)
  }

  return Response.json([])
}
