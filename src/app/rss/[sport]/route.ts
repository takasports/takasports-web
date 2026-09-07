import { sanityClient } from '@/lib/sanity'
import { SITE_URL, LOGO_URL, SITE_NAME, REPORTAJE_GROQ_FILTER } from '@/lib/constants'
import { SLUG_TO_LABEL } from '@/lib/sports'

// RSS por deporte: /rss/futbol.xml, /rss/tenis.xml…
//
// Hasta ahora solo existía `/rss.xml`, con las 50 últimas noticias de todo el
// sitio. Para alguien que solo sigue F1 —o para un agregador que quiera una
// sola vertical— eso es ruido, y es la razón habitual de no suscribirse.
//
// Sirve el MISMO documento en `/rss/futbol` y en `/rss/futbol.xml`: la
// extensión es lo que espera quien busca un feed a mano, pero la ruta sin ella
// es la que sale natural al enlazarlo desde el código. Se resuelve quitando el
// sufijo, no duplicando rutas.
//
// `dynamicParams = false` es deliberado: sin eso, cualquier cadena inventada
// (/rss/loquesea.xml) devolvería un feed vacío con 200, que es exactamente el
// tipo de URL infinita que ensucia el rastreo. Fuera de la lista, 404.

export const runtime = 'nodejs'
export const revalidate = 3600
export const dynamicParams = false

/** Un feed por cada deporte con hub propio; misma lista que `/[sport]`. */
export function generateStaticParams() {
  return Object.keys(SLUG_TO_LABEL).flatMap(sport => [{ sport }, { sport: `${sport}.xml` }])
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
  imageUrl: string | null
}

// Mismo filtro de publicados que `/rss.xml`, acotado por deporte. El `sport` de
// Sanity guarda el slug canónico, así que se compara contra él directamente.
const RSS_QUERY = `*[_type == "article"
  && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))${REPORTAJE_GROQ_FILTER}
  && defined(slug.current)
  && sport == $sport] | order(publishedAt desc)[0...50] {
  _id,
  "title": coalesce(headline, title),
  "slug": slug.current,
  publishedAt,
  "excerpt": coalesce(metaDescription, short_summary),
  "imageUrl": select(defined(headline) => imageUrl, null)
}`

export async function GET(_request: Request, { params }: { params: Promise<{ sport: string }> }) {
  const { sport: crudo } = await params
  const sport = crudo.replace(/\.xml$/, '')
  const label = SLUG_TO_LABEL[sport]

  // No debería ocurrir con dynamicParams=false, pero si alguien añade un slug a
  // la lista sin label, mejor un 404 que un feed sin nombre.
  if (!label) {
    return new Response('Not found', { status: 404 })
  }

  const articles = await sanityClient
    .fetch<RssArticle[]>(RSS_QUERY, { sport })
    .catch(() => [] as RssArticle[])

  const items = articles
    .filter(a => a.slug && a.title && a.publishedAt)
    .map(a => {
      const url = `${SITE_URL}/noticias/${a.slug}`
      const mediaTag = a.imageUrl
        ? `\n    <media:content url="${escapeXml(a.imageUrl)}" medium="image" />`
        : ''
      return `  <item>
    <title>${escapeXml(a.title)}</title>
    <link>${url}</link>
    <description>${escapeXml(a.excerpt ?? '')}</description>
    <pubDate>${toRfc822(a.publishedAt)}</pubDate>
    <guid isPermaLink="true">${url}</guid>
    <category>${escapeXml(label)}</category>${mediaTag}
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
    <title>${SITE_NAME} — ${escapeXml(label)}</title>
    <link>${SITE_URL}/${sport}</link>
    <description>Todas las noticias de ${escapeXml(label)} en ${SITE_NAME}: actualidad, resultados y análisis.</description>
    <language>es-es</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss/${sport}.xml" rel="self" type="application/rss+xml" />
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
