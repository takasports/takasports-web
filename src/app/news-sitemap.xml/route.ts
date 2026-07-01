import { sanityClient } from '@/lib/sanity'
import { SITE_URL } from '@/lib/constants'

// Fuerza nodejs runtime: las queries a Sanity vía sanityClient van mejor
// fuera de edge, y evitamos sorpresas si Next cambia default en el futuro.
export const runtime = 'nodejs'
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

// coalesce(headline, title): los artículos del Taka System usan `headline`
// y `title` queda null. Si proyectamos title directo, esos artículos salen
// sin título y se filtran fuera del sitemap. Con coalesce capturamos ambos
// esquemas en una sola query.
const ARTICLE_QUERY = `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && publishedAt > $since] | order(publishedAt desc)[0...1000] {
  "slug": slug.current,
  "title": coalesce(headline, title),
  publishedAt
}`

// Fallback: cuando la ventana 72h está vacía (gap de publicación o desajuste
// de fechas) tiramos de los últimos 50. Filtro permite cualquiera de los dos
// campos de título; el proyect coalesce los devuelve unificados.
const FALLBACK_QUERY = `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && defined(slug.current) && (defined(title) || defined(headline)) && defined(publishedAt)] | order(publishedAt desc)[0...50] {
  "slug": slug.current,
  "title": coalesce(headline, title),
  publishedAt
}`

export async function GET() {
  // Google News allows articles up to 2 days old — use 72h to avoid edge cases
  // near the cache TTL boundary (revalidate = 3600, so a stale cache could miss
  // articles published close to the 48h mark).
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  let articles = await sanityClient
    .fetch<Array<{ slug: string; title: string; publishedAt: string }>>(
      ARTICLE_QUERY,
      { since },
    )
    .catch(() => [] as Array<{ slug: string; title: string; publishedAt: string }>)

  // Fallback: if the 72h window is empty (e.g. publishing gap or date mismatch),
  // include the last 50 articles so the sitemap is never empty.
  if (articles.length === 0) {
    articles = await sanityClient
      .fetch<Array<{ slug: string; title: string; publishedAt: string }>>(FALLBACK_QUERY)
      .catch(() => [])
  }

  const urls = articles
    .filter(a => a.slug && a.title && a.publishedAt)
    .map(a => {
      // Blindaje: una sola fecha no parseable tumbaría TODO el sitemap (500).
      // Si no parsea, saltamos solo esa URL en vez de reventar la respuesta.
      const d = new Date(a.publishedAt)
      if (Number.isNaN(d.getTime())) return null
      return `  <url>
    <loc>${SITE_URL}/noticias/${a.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>TakaSports</news:name>
        <news:language>es</news:language>
      </news:publication>
      <news:publication_date>${d.toISOString()}</news:publication_date>
      <news:title>${escapeXml(a.title)}</news:title>
    </news:news>
  </url>`
    })
    .filter(Boolean)
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
