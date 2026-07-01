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

  const videos = reels
    .map(r => {
      // Blindaje: un timestamp no parseable tumbaría TODO el sitemap (500).
      // Si no parsea, dejamos publishedIso null (la etiqueta es opcional).
      let publishedIso: string | null = null
      if (r.timestamp) {
        const d = new Date(/^\d+$/.test(r.timestamp) ? parseInt(r.timestamp, 10) * 1000 : r.timestamp)
        if (!Number.isNaN(d.getTime())) publishedIso = d.toISOString()
      }
      const thumbnail = r.thumbnail_url
        ? (r.thumbnail_url.startsWith('http') ? r.thumbnail_url : `${SITE_URL}${r.thumbnail_url}`)
        : `${SITE_URL}/taka-icon.png`
      // No hay fichero de vídeo servible (video_url es null en el feed fusionado):
      // usamos el reproductor EMBEBIBLE de Instagram como player_loc —que Google sí
      // acepta— en vez de un content_loc que apuntaba a la página HTML del post.
      const player = `${r.instagram_url.replace(/\/+$/, '')}/embed/`
      const description = (r.caption?.trim() || r.title || 'Reel de TakaSports').slice(0, 2000)
      return `    <video:video>
      <video:thumbnail_loc>${escapeXml(thumbnail)}</video:thumbnail_loc>
      <video:title>${escapeXml(r.title)}</video:title>
      <video:description>${escapeXml(description)}</video:description>
      <video:player_loc allow_embed="yes">${escapeXml(player)}</video:player_loc>
      ${publishedIso ? `<video:publication_date>${publishedIso}</video:publication_date>` : ''}
      ${r.sport ? `<video:tag>${escapeXml(r.sport)}</video:tag>` : ''}
      <video:live>no</video:live>
    </video:video>`
    })
    .join('\n')

  // Los reels viven TODOS en /reels (una sola página que los reproduce), así que la
  // estructura correcta del sitemap de vídeo es 1 <url> con N <video>. Antes cada
  // entrada apuntaba a /noticias?reel=ID, una URL que NO abría el reel (soft-404).
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url>
    <loc>${SITE_URL}/reels</loc>
${videos}
  </url>
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
