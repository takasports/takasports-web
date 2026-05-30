import { sanityClient } from '@/lib/sanity'
import { SITE_URL } from '@/lib/constants'

export const runtime = 'nodejs'
export const revalidate = 86400

function escapeXml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const articles = await sanityClient
    .fetch<Array<{ slug: string; title: string; imageUrl: string | null; imageAlt: string | null }>>(
      `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && defined(imageUrl) && defined(slug)] | order(publishedAt desc)[0...2000] {
        "slug": slug.current,
        "title": coalesce(headline, title),
        imageUrl,
        imageAlt
      }`,
    )
    .catch(() => [] as Array<{ slug: string; title: string; imageUrl: string | null; imageAlt: string | null }>)

  const urls = articles
    .filter(a => a.slug && typeof a.imageUrl === 'string' && a.imageUrl.length > 0)
    .map(
      a => `  <url>
    <loc>${SITE_URL}/noticias/${a.slug}</loc>
    <image:image>
      <image:loc>${escapeXml(a.imageUrl)}</image:loc>
      <image:title>${escapeXml(a.title)}</image:title>
      ${a.imageAlt ? `<image:caption>${escapeXml(a.imageAlt)}</image:caption>` : ''}
    </image:image>
  </url>`,
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800',
    },
  })
}
