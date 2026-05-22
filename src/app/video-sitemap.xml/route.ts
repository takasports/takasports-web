// video-sitemap: usa getMergedReels() de lib/reels-feed.ts — la misma
// fusión que sirve /api/instagram/reels al home. Eso garantiza que el
// sitemap indexe lo mismo que el usuario ve, con la red de seguridad
// del JSON estático y timeouts por fuente para evitar crashes.

import { getMergedReels } from '@/lib/reels-feed'
import { SITE_URL } from '@/lib/constants'

export const runtime = 'nodejs'
export const revalidate = 3600

function escapeXml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const reels = (await getMergedReels().catch(() => [])).slice(0, 500)

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
