// Feed unificado de reels — fusiona las 4 fuentes con fallback escalonado
// y cache in-memory por instancia serverless. Extraído del route handler
// /api/instagram/reels para que el video-sitemap pueda reusar la misma
// lógica sin duplicar fuentes.
//
// Prioridad de fuentes (gana el shortcode primero):
//   1. Sanity CMS         — reels curados, no depende de Instagram
//   2. Graph API oficial  — token OAuth (preferida para frescos)
//   3. Supabase Storage   — refresca el WF-10 de n8n
//   4. IG anónima         — suele dar 401 (defensiva)
//   + JSON estático del repo como red de seguridad final.

import { fetchPublicReels, type PublicReel, detectSportPublic, extractTitlePublic } from './instagram-public'
import { fetchInstagramReels } from './instagram'
import { getIgToken } from './ig-token'
import { sanityClient, reelsQuery, urlFor } from './sanity'
import reelsData from './reels-data.json'

interface SanityReelDoc {
  _id: string
  title?: string
  instagram_url?: string
  thumbnail?: unknown
  sport?: string
  publishedAt?: string
}

// Timeout duro por fuente. Sin esto, una fuente lenta (IG anónima cuelga,
// Supabase Storage tarda) puede consumir todo el budget de la serverless
// function y devolver 0 bytes (el bug que vimos en video-sitemap).
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const t = setTimeout(() => resolve(fallback), ms)
    promise.then(
      v => { clearTimeout(t); resolve(v) },
      () => { clearTimeout(t); resolve(fallback) },
    )
  })
}

// NOTA: a fecha de 2026-05-22 Sanity tiene 0 documentos de tipo `reel`
// (verificado con count(*[_type=="reel"]) = 0). El editor publica los reels
// directamente en Instagram. Mantenemos este fetch como red de seguridad
// por si en el futuro se cura algún reel desde el Studio.
async function fetchSanityReels(): Promise<PublicReel[]> {
  try {
    const docs = await sanityClient.fetch<SanityReelDoc[]>(reelsQuery)
    if (!Array.isArray(docs)) return []
    return docs
      .filter(d => d.instagram_url)
      .map(d => {
        let thumb: string | null = null
        try { if (d.thumbnail) thumb = urlFor(d.thumbnail).width(640).url() } catch { /* sin thumb */ }
        return {
          id:            d._id,
          instagram_url: d.instagram_url!,
          thumbnail_url: thumb,
          video_url:     null,
          timestamp:     d.publishedAt ?? new Date().toISOString(),
          caption:       d.title ?? '',
          sport:         d.sport ?? '',
          title:         d.title ?? 'Reel',
        }
      })
  } catch {
    return []
  }
}

function toPublicReel(r: {
  id: string; instagram_url: string; thumbnail_url: string | null
  timestamp: string; caption: string; sport: string; title: string
}): PublicReel {
  const thumb = r.thumbnail_url
  return {
    ...r,
    thumbnail_url: thumb && /^https?:\/\//.test(thumb)
      ? `/api/instagram/thumbnail?url=${encodeURIComponent(thumb)}`
      : thumb,
    video_url: null,
  }
}

function keyOf(r: PublicReel): string {
  const m = r.instagram_url?.match(/\/(?:reel|p|tv)\/([^/?#]+)/i)
  return m ? m[1] : r.id
}

const STORAGE_URL =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '') +
  '/storage/v1/object/public/reels/reels.json'

const SPORT_ALIASES: Record<string, string> = { wrestling: 'wwe' }

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
  if (sport !== 'wwe' && WWE_OVERRIDE_SIGNALS.some(s => text.includes(s))) {
    sport = 'wwe'
  }
  const title = item.title || extractTitlePublic(item.caption ?? '')
  return { ...item, sport, title }
}

interface CacheEntry { data: PublicReel[]; ts: number }
const CACHE_TTL = 30 * 60 * 1000
let cache: CacheEntry | null = null

const FRESHNESS_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000

function tsToMs(ts: string | undefined | null): number {
  if (!ts) return 0
  const asNum = Number(ts)
  if (Number.isFinite(asNum) && asNum > 0) return asNum * 1000
  const parsed = new Date(ts).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function newestMs(arr: PublicReel[]): number {
  let max = 0
  for (const r of arr) {
    const ms = tsToMs(r.timestamp)
    if (ms > max) max = ms
  }
  return max
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

function merge(...sources: PublicReel[][]): PublicReel[] {
  const seen = new Map<string, PublicReel>()
  const now = Date.now()
  for (const src of sources) {
    for (const r of src) {
      if (!r?.id) continue
      const key = keyOf(r)
      if (seen.has(key)) continue
      const ms = tsToMs(r.timestamp)
      if (ms > 0 && now - ms > FRESHNESS_MAX_AGE_MS) continue
      seen.set(key, r)
    }
  }
  return Array.from(seen.values()).sort((a, b) => tsToMs(b.timestamp) - tsToMs(a.timestamp))
}

/**
 * Devuelve la lista mezclada de reels, con cache de 30 min in-memory.
 * Cada fuente tiene timeout de 5s para que ninguna pueda colgar la
 * función completa. Si todo falla, devuelve el JSON estático del repo.
 */
export async function getMergedReels(): Promise<PublicReel[]> {
  const now = Date.now()
  if (cache && now - cache.ts < CACHE_TTL) {
    return cache.data
  }

  const igToken = await withTimeout(getIgToken(), 3000, null as string | null)

  const [sanity, official, fromStorage, live] = await Promise.all([
    withTimeout(fetchSanityReels(), 5000, [] as PublicReel[]),
    igToken
      ? withTimeout(
          fetchInstagramReels(igToken).then(rs => rs.map(toPublicReel)),
          5000,
          [] as PublicReel[],
        )
      : Promise.resolve([] as PublicReel[]),
    withTimeout(fetchFromStorage(), 6000, [] as PublicReel[]),
    withTimeout(fetchPublicReels().catch(() => [] as PublicReel[]), 5000, [] as PublicReel[]),
  ])

  const merged = merge(sanity, official, fromStorage, live, reelsData as PublicReel[])

  // Mantén el cache previo si su contenido más reciente supera al actual
  // (defensa contra mezclas que retroceden por fallos puntuales de fuentes).
  if (cache && merged.length > 0 && newestMs(cache.data) > newestMs(merged)) {
    return cache.data
  }

  if (merged.length > 0) {
    cache = { data: merged, ts: now }
    return merged
  }

  if (cache) return cache.data

  // Último recurso: el JSON del repo, normalizado al mismo shape.
  return (reelsData as PublicReel[]).map(normalizeReel)
}
