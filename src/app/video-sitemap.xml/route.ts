// Versión mínima de video-sitemap: lee SOLO el JSON estático del repo.
// Iteración previa con Sanity + Graph API + IG anónima crasheaba en runtime
// devolviendo 0 bytes. Aislamos al mínimo para asegurar baseline; luego
// añadiremos Sanity y Graph API cuando confirmemos que esto sirve URLs.

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

function escapeXml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const reels = (reelsStatic as StaticReel[]) ?? []

  const urls = reels
    .filter(r => r.instagram_url && (r.title || r.caption))
    .slice(0, 500)
    .map(r => {
      const title = (r.title || r.caption || '').trim().slice(0, 100)
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
      <video:title>${escapeXml(title)}</video:title>
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
