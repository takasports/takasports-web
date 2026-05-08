import { sanityClient } from '@/lib/sanity'
import { SITE_URL } from '@/lib/constants'

export const revalidate = 3600

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
  const twoDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  const articles = await sanityClient
    .fetch<Array<{ slug: string; title: string; publishedAt: string }>>(
      `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && publishedAt > $since] | order(publishedAt desc)[0...1000] {
        "slug": slug.current, title, publishedAt
      }`,
      { since: twoDaysAgo },
    )
    .catch(() => [] as Array<{ slug: string; title: string; publishedAt: string }>)

  const urls = articles
    .filter(a => a.slug && a.title && a.publishedAt)
    .map(
      a => `  <url>
    <loc>${SITE_URL}/noticias/${a.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>TakaSports</news:name>
        <news:language>es</news:language>
      </news:publication>
      <news:publication_date>${new Date(a.publishedAt).toISOString()}</news:publication_date>
      <news:title>${escapeXml(a.title)}</news:title>
    </news:news>
  </url>`,
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
