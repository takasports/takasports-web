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

interface Reel {
  _id: string
  title?: string
  instagram_url?: string
  thumbnail?: string
  sport?: string
  publishedAt?: string
}

export async function GET() {
  const reels = await sanityClient
    .fetch<Reel[]>(
      `*[_type == "reel" && defined(instagram_url)] | order(publishedAt desc)[0...500] {
        _id, title, instagram_url, thumbnail, sport, publishedAt
      }`,
    )
    .catch(() => [] as Reel[])

  // <loc> debe ser único por reel para que Google no desduplique todo el
  // sitemap a una sola entrada. Usamos /noticias?reel=ID como página
  // contenedora; el id discrimina, el path real sigue siendo la home de
  // noticias (donde el carrusel de reels los muestra).
  const urls = reels
    .filter(r => r.instagram_url && r.title)
    .map(r => `  <url>
    <loc>${SITE_URL}/noticias?reel=${encodeURIComponent(r._id)}</loc>
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
