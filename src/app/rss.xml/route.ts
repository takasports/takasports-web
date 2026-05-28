import { sanityClient } from '@/lib/sanity'
import { SITE_URL, LOGO_URL, SITE_NAME } from '@/lib/constants'

export const runtime = 'nodejs'
export const revalidate = 3600

const SPORT_LABELS: Record<string, string> = {
  futbol: 'Fútbol',
  baloncesto: 'Baloncesto',
  f1: 'Fórmula 1',
  tenis: 'Tenis',
  ufc: 'UFC',
  wwe: 'WWE',
  rugby: 'Rugby',
  formula1: 'Fórmula 1',
}

function escapeXml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toRfc822(iso: string): string {
  return new Date(iso).toUTCString()
}

interface RssArticle {
  _id: string
  title: string
  slug: string
  publishedAt: string
  excerpt: string | null
  sport: string | null
  imageUrl: string | null
}

const RSS_QUERY = `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && defined(slug.current)] | order(publishedAt desc)[0...50] {
  _id,
  "title": coalesce(headline, title),
  "slug": slug.current,
  publishedAt,
  "excerpt": coalesce(metaDescription, short_summary),
  sport,
  "imageUrl": select(defined(headline) => imageUrl, null)
}`

export async function GET() {
  const articles = await sanityClient
    .fetch<RssArticle[]>(RSS_QUERY)
    .catch(() => [] as RssArticle[])

  const items = articles
    .filter(a => a.slug && a.title && a.publishedAt)
    .map(a => {
      const url = `${SITE_URL}/noticias/${a.slug}`
      const sportLabel = a.sport ? (SPORT_LABELS[a.sport] ?? a.sport) : null
      const mediaTag = a.imageUrl
        ? `\n    <media:content url="${escapeXml(a.imageUrl)}" medium="image" />`
        : ''
      const categoryTag = sportLabel
        ? `\n    <category>${escapeXml(sportLabel)}</category>`
        : ''

      return `  <item>
    <title>${escapeXml(a.title)}</title>
    <link>${url}</link>
    <description>${escapeXml(a.excerpt ?? '')}</description>
    <pubDate>${toRfc822(a.publishedAt)}</pubDate>
    <guid isPermaLink="true">${url}</guid>${categoryTag}${mediaTag}
  </item>`
    })
    .join('\n')

  const lastBuildDate = articles[0]?.publishedAt
    ? toRfc822(articles[0].publishedAt)
    : new Date().toUTCString()

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:media="http://search.yahoo.com/mrss/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME} — Noticias deportivas</title>
    <link>${SITE_URL}</link>
    <description>Noticias deportivas de actualidad: fútbol, NBA, F1, UFC y tenis. Resultados en vivo, calendario y rankings.</description>
    <language>es-es</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${LOGO_URL}</url>
      <title>${SITE_NAME}</title>
      <link>${SITE_URL}</link>
    </image>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
