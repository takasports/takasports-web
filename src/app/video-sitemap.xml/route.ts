// video-sitemap: combina JSON estático del repo (fallback garantizado) con
// reels curados en Sanity (frescos). NO usa fetchPublicReels ni Graph API:
// ambas hacían crashear la función con 0 bytes en producción (timeout o
// edge runtime). Los reels frescos de IG ya viven en el carrusel del home
// vía /api/instagram/reels — el sitemap solo necesita lo indexable.

import { sanityClient } from '@/lib/sanity'
import reelsStatic from '@/lib/reels-data.json'
import { SITE_URL } from '@/lib/constants'

export const runtime = 'nodejs'
export const revalidate = 3600

interface StaticReel {
  id: string
  instagram_url: string
  thumbnail_url?: string | null
  timestamp?: string
  caption?: string
  title?: string
  sport?: string
}

interface SanityReel {
  _id: string
  title?: string
  instagram_url?: string
  thumbnail?: string
  sport?: string
  publishedAt?: string
}

interface MergedReel {
  id: string
  instagram_url: string
  thumbnail_url: string | null
  timestamp: string | null
  title: string
  sport?: string
}

function escapeXml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const sanityRows = await sanityClient
    .fetch<SanityReel[]>(
      `*[_type == "reel" && defined(instagram_url) && defined(title)] | order(publishedAt desc)[0...500] {
        _id, title, instagram_url, thumbnail, sport, publishedAt
      }`,
    )
    .catch(() => [] as SanityReel[])

  const merged: MergedReel[] = []
  const seen = new Set<string>()

  // Sanity primero (más fresco si hay)
  for (const r of sanityRows) {
    if (!r.instagram_url || !r.title) continue
    if (seen.has(r.instagram_url)) continue
    seen.add(r.instagram_url)
    merged.push({
      id: r._id,
      instagram_url: r.instagram_url,
      thumbnail_url: r.thumbnail ?? null,
      timestamp: r.publishedAt ?? null,
      title: r.title.trim().slice(0, 100),
      sport: r.sport,
    })
  }

  // JSON estático como fallback garantizado
  for (const r of (reelsStatic as StaticReel[])) {
    if (!r.instagram_url) continue
    if (seen.has(r.instagram_url)) continue
    const title = (r.title || r.caption || '').trim()
    if (!title) continue
    seen.add(r.instagram_url)
    merged.push({
      id: r.id,
      instagram_url: r.instagram_url,
      thumbnail_url: r.thumbnail_url ?? null,
      timestamp: r.timestamp ?? null,
      title: title.slice(0, 100),
      sport: r.sport,
    })
  }

  const reels = merged.slice(0, 500)

  const urls = reels
    .map(r => {
      const publishedIso = r.timestamp
        ? new Date(/^\d+$/.test(r.timestamp) ? parseInt(r.timestamp, 10) * 1000 : r.timestamp).toISOString()
        : null
      const thumbnail = r.thumbnail_url
        ? (r.thumbnail_url.startsWith('http') ? r.thumbnail_url : `${SITE_URL}${r.thumbnail_url}`)
        : `${SITE_URL}/taka-icon.png`
      return `  <url>
    <loc>${SITE_URL}/noticias?reel=${encodeURIComponent(r.id)}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(thumbnail)}</video:thumbnail_loc>
      <video:title>${escapeXml(r.title)}</video:title>
      <video:content_loc>${escapeXml(r.instagram_url)}</video:content_loc>
      ${publishedIso ? `<video:publication_date>${publishedIso}</video:publication_date>` : ''}
      ${r.sport ? `<video:tag>${escapeXml(r.sport)}</video:tag>` : ''}
      <video:live>no</video:live>
    </video:video>
  </url>`
    })
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
