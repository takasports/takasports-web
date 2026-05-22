import { sanityClient } from '@/lib/sanity'
import { SITE_URL } from '@/lib/constants'

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

// Shape del endpoint /api/instagram/reels (que ya mezcla 4 fuentes con
// fallback: Sanity → Graph API → Supabase Storage → JSON estático).
interface IgEndpointReel {
  id: string
  title?: string
  caption?: string
  instagram_url: string
  thumbnail_url?: string | null
  sport?: string
  timestamp?: string
}

export async function GET() {
  // Doble fuente:
  //  1. Sanity directo (rápido, sin token).
  //  2. /api/instagram/reels — endpoint propio que ya mezcla las 4 fuentes
  //     con fallback (Graph API token + Supabase Storage + JSON estático).
  //     Es la MISMA URL que llama el home, así que sitemap y carrusel
  //     siempre coinciden. Llamada interna en cada revalidación del sitemap
  //     (ISR 3600s, no es hot path).
  const [sanityRows, igRows] = await Promise.all([
    sanityClient
      .fetch<SanityReel[]>(
        `*[_type == "reel" && defined(instagram_url)] | order(publishedAt desc)[0...500] {
          _id, title, instagram_url, thumbnail, sport, publishedAt
        }`,
      )
      .catch(() => [] as SanityReel[]),
    fetch(`${SITE_URL}/api/instagram/reels`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then((data: unknown): IgEndpointReel[] => Array.isArray(data) ? data as IgEndpointReel[] : [])
      .catch(() => [] as IgEndpointReel[]),
  ])

  const merged: SitemapReel[] = []
  const seen = new Set<string>()

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

  for (const r of igRows) {
    if (!r.instagram_url) continue
    if (seen.has(r.instagram_url)) continue
    const title = (r.title || r.caption || '').trim()
    if (!title) continue
    seen.add(r.instagram_url)
    merged.push({
      id: r.id,
      title: title.slice(0, 100),
      instagram_url: r.instagram_url,
      thumbnail: r.thumbnail_url ?? undefined,
      sport: r.sport || undefined,
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
