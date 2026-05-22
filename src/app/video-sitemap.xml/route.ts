import { sanityClient } from '@/lib/sanity'
import { fetchInstagramReels, type TakaReel } from '@/lib/instagram'
import { fetchPublicReels, type PublicReel } from '@/lib/instagram-public'
import { getIgToken } from '@/lib/ig-token'
import reelsStatic from '@/lib/reels-data.json'
import { SITE_URL } from '@/lib/constants'

// Forzamos nodejs runtime: getIgToken() usa fetch a Supabase con headers
// específicos y el import del JSON estático puede fallar en edge.
export const runtime = 'nodejs'
export const revalidate = 3600

function escapeXml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

interface SanityReel {
  _id: string
  title?: string
  instagram_url?: string
  thumbnail?: string
  sport?: string
  publishedAt?: string
}

// Shape unificado para sitemap (mismo render independientemente del origen).
interface SitemapReel {
  id: string
  title: string
  instagram_url: string
  thumbnail?: string
  sport?: string
  publishedAt?: string
}

// Shape compartido del JSON estático y de PublicReel.
interface FallbackReel {
  id: string
  instagram_url: string
  thumbnail_url?: string | null
  timestamp?: string
  caption?: string
  title?: string
  sport?: string
}

function takeTitle(r: { title?: string; caption?: string }): string {
  const t = (r.title || r.caption || '').trim()
  return t ? t.slice(0, 100) : ''
}

export async function GET() {
  // Estrategia escalonada con fallback garantizado al JSON del repo:
  //  1. Sanity directo
  //  2. Graph API con token (la fuente preferida en runtime real)
  //  3. IG anónima (suele dar 401, intento por si acaso)
  //  4. JSON estático del repo (reels-data.json) — SIEMPRE funciona
  //
  // Dedupe por instagram_url. La frescura no importa para el sitemap; lo
  // crítico es que NUNCA quede vacío para que Google pueda indexar reels.
  const igToken = await getIgToken().catch(() => null)
  const [sanityRows, official, anonymous] = await Promise.all([
    sanityClient
      .fetch<SanityReel[]>(
        `*[_type == "reel" && defined(instagram_url)] | order(publishedAt desc)[0...500] {
          _id, title, instagram_url, thumbnail, sport, publishedAt
        }`,
      )
      .catch(() => [] as SanityReel[]),
    igToken
      ? fetchInstagramReels(igToken).catch(() => [] as TakaReel[])
      : Promise.resolve([] as TakaReel[]),
    fetchPublicReels().catch(() => [] as PublicReel[]),
  ])

  const merged: SitemapReel[] = []
  const seen = new Set<string>()

  // 1. Sanity
  for (const r of sanityRows) {
    if (!r.instagram_url || !r.title) continue
    if (seen.has(r.instagram_url)) continue
    seen.add(r.instagram_url)
    merged.push({
      id: r._id,
      title: r.title,
      instagram_url: r.instagram_url,
      thumbnail: r.thumbnail,
      sport: r.sport,
      publishedAt: r.publishedAt,
    })
  }

  // 2. Graph API oficial
  for (const r of official) {
    if (!r.instagram_url) continue
    if (seen.has(r.instagram_url)) continue
    const title = takeTitle(r)
    if (!title) continue
    seen.add(r.instagram_url)
    merged.push({
      id: r.id,
      title,
      instagram_url: r.instagram_url,
      thumbnail: r.thumbnail_url ?? undefined,
      sport: r.sport || undefined,
      publishedAt: r.timestamp,
    })
  }

  // 3. IG anónima (suele dar 401, defensivo)
  for (const r of anonymous) {
    if (!r.instagram_url) continue
    if (seen.has(r.instagram_url)) continue
    const title = takeTitle(r)
    if (!title) continue
    seen.add(r.instagram_url)
    merged.push({
      id: r.id,
      title,
      instagram_url: r.instagram_url,
      thumbnail: r.thumbnail_url ?? undefined,
      sport: r.sport || undefined,
      publishedAt: r.timestamp,
    })
  }

  // 4. JSON estático — garantiza que el sitemap nunca quede vacío
  const staticReels = (reelsStatic as FallbackReel[]) ?? []
  for (const r of staticReels) {
    if (!r.instagram_url) continue
    if (seen.has(r.instagram_url)) continue
    const title = takeTitle(r)
    if (!title) continue
    seen.add(r.instagram_url)
    merged.push({
      id: r.id,
      title,
      instagram_url: r.instagram_url,
      thumbnail: r.thumbnail_url ?? undefined,
      sport: r.sport,
      publishedAt: r.timestamp,
    })
  }

  const reels = merged.slice(0, 500)

  // <loc> debe ser único por reel para que Google no desduplique todo el
  // sitemap a una sola entrada. Usamos /noticias?reel=ID como página
  // contenedora; el id discrimina, el path real sigue siendo la home de
  // noticias (donde el carrusel de reels los muestra).
  const urls = reels
    .filter(r => r.instagram_url && r.title)
    .map(r => `  <url>
    <loc>${SITE_URL}/noticias?reel=${encodeURIComponent(r.id)}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(r.thumbnail ?? `${SITE_URL}/taka-icon.png`)}</video:thumbnail_loc>
      <video:title>${escapeXml(r.title)}</video:title>
      <video:content_loc>${escapeXml(r.instagram_url)}</video:content_loc>
      ${r.publishedAt ? `<video:publication_date>${new Date(r.publishedAt).toISOString()}</video:publication_date>` : ''}
      ${r.sport ? `<video:tag>${escapeXml(r.sport)}</video:tag>` : ''}
      <video:live>no</video:live>
    </video:video>
  </url>`)
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
