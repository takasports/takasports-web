// API route — sirve los reels de @taka.sports
// Fuentes (fundidas y dedupadas por shortcode):
//   1. Graph API oficial (token OAuth) — no la bloquea el 401 anónimo
//   2. Supabase Storage (lo refresca cada 6h el WF-10 de n8n)
//   3. IG public API anónima (suele dar 401) → JSON estático en repo

import { fetchPublicReels, type PublicReel, detectSportPublic, extractTitlePublic } from '@/lib/instagram-public'
import { fetchInstagramReels } from '@/lib/instagram'
import { getIgToken } from '@/lib/ig-token'
import reelsData from '@/lib/reels-data.json'

// La Graph API oficial no devuelve video_url ni proxea el thumbnail; el
// frontend ya cae al embed oficial de IG cuando falta video_url.
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

// Clave canónica para dedupar entre fuentes: el shortcode del permalink
// (/reel/CODE/ o /p/CODE/) es estable; el id difiere entre Graph y la
// API anónima para el MISMO reel, así que dedupar por id no bastaría.
function keyOf(r: PublicReel): string {
  const m = r.instagram_url?.match(/\/(?:reel|p|tv)\/([^/?#]+)/i)
  return m ? m[1] : r.id
}

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
// IG suele rate-limitar peticiones anónimas: prolongamos el cache para
// preservar el resultado bueno (~50+ reels) entre llamadas y limitar
// presión sobre los endpoints públicos.
const CACHE_TTL = 30 * 60 * 1000
let cache: CacheEntry | null = null

// Timestamp (ms) del reel más reciente de un conjunto. Sirve para decidir
// qué resultado es "mejor": el que tenga contenido más nuevo, NO el que
// tenga más items (comparar por cantidad congelaba instancias serverless
// con un cache grande-pero-viejo cuando IG live empezaba a dar 401).
function newestMs(arr: PublicReel[]): number {
  let max = 0
  for (const r of arr) {
    const ms = tsToMs(r.timestamp)
    if (ms > max) max = ms
  }
  return max
}

// Reels: ventana de 60 días. Los reels son contenido social organico, no
// breaking news; el usuario quiere que la sección se mantenga llena para
// dar sensación de catálogo. La actualidad estricta de 3d aplica sólo a
// noticias long-form.
const FRESHNESS_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000

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

// Funde reels de varias fuentes dedupando por shortcode del permalink y
// filtrando por la ventana de actualidad. El orden de las fuentes importa:
// la primera que aporte un shortcode gana, así que va primero la oficial.
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

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.ts < CACHE_TTL) {
    return Response.json(cache.data)
  }

  // En paralelo: Graph oficial + storage + live IG anónima.
  // La oficial va primero en el merge (gana el dedupe por shortcode).
  const igToken = await getIgToken()
  const [official, fromStorage, live] = await Promise.all([
    fetchInstagramReels(igToken).then(rs => rs.map(toPublicReel)).catch(() => []),
    fetchFromStorage(),
    fetchPublicReels().catch(() => []),
  ])

  const merged = merge(official, fromStorage, live, reelsData as PublicReel[])

  // Conservamos el cache previo SOLO si su reel más reciente es más nuevo
  // que el de la mezcla actual (p.ej. storage falló puntualmente y la mezcla
  // quedó con datos viejos). Comparar por frescura —no por cantidad— evita
  // que una instancia se congele con un cache grande pero obsoleto.
  if (cache && merged.length > 0 && newestMs(cache.data) > newestMs(merged)) {
    return Response.json(cache.data)
  }

  if (merged.length > 0) {
    cache = { data: merged, ts: now }
    return Response.json(merged)
  }

  if (cache) return Response.json(cache.data)

  return Response.json([])
}
