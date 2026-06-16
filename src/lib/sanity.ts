import { createClient } from '@sanity/client'
import { createImageUrlBuilder, type SanityImageSource } from '@sanity/image-url'

export const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-01-01',
  // useCdn:false → usa la API directa (api.sanity.io) en vez del CDN
  // (apicdn.sanity.io). El CDN tiene su propia cuota mensual que se AGOTÓ
  // (402 plan_limit_reached) y tumbaba todos los builds; la API directa tiene
  // cuota aparte (con margen). Encima cacheamos con ISR de Next (revalidate),
  // así que el volumen real de peticiones es bajo. 2026-06-16.
  useCdn: false,
})

const builder = createImageUrlBuilder(sanityClient)

export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}

// ── Articles ──────────────────────────────────────────────────

// Fragmento de campos comunes de listing (evita repetición en queries)
const LISTING_FIELDS = `
  _id,
  "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "short_summary": select(defined(headline) => metaDescription, short_summary),
  "imageUrl": select(defined(headline) => imageUrl, null),
  "image": select(defined(headline) => mainImage, image),
  publishedAt,
  sport,
  "category": select(defined(headline) => competition, category),
  "isTaka": defined(headline),
  "takaStatus": select(defined(headline) => status, null)
`

// Feed principal — normaliza artículos viejos (status=="publicado") + nuevos de Taka System (tienen headline)
export const articlesQuery = `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))] | order(publishedAt desc)[0...40] {
  ${LISTING_FIELDS},
  "priority": select(defined(headline) => "destacado", priority)
}`

// Feed por deporte — para páginas /[sport] y /noticias?sport=. A2 (2026-06-06): mira sport
// Y competition (igual que /api/articles), para no perder artículos cuyo deporte va en competition.
export const articlesBySportQuery = `*[_type == "article" && (sport == $sport || competition == $sport) && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))] | order(publishedAt desc)[0...40] {
  ${LISTING_FIELDS},
  "priority": select(defined(headline) => "destacado", priority)
}`

// Feed por conjunto de slugs (canónico + aliases) — para destacadas del home.
// Mira tanto `sport` como `category`/`competition` para no perder artículos
// que solo tengan el alias (ej. F1 guardado como sport='f1' o category='formula1').
export const articlesBySlugsQuery = `*[_type == "article"
  && (sport in $slugs || category in $slugs || competition in $slugs)
  && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))
] | order(publishedAt desc)[0...20] {
  ${LISTING_FIELDS},
  "priority": select(defined(headline) => "destacado", priority)
}`

// Feed sin filtro de status — para preview/editor (usar con token)
export const articlesAllQuery = `*[_type == "article"] | order(publishedAt desc) {
  _id, "slug": slug.current, title, short_summary, publishedAt,
  sport, type, priority, status, category, image
}`

// Artículo detalle — normaliza ambos schemas + campos SEO long-form
// Incluye: author, takaStatus, editorialRelated (picks editoriales, expande referencias)
export const articleDetailQuery = `*[_type == "article" && (slug.current == $id || _id == $id)][0] {
  _id,
  _updatedAt,
  "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "seoTitle": select(defined(headline) => seoTitle, null),
  "subtitle": select(defined(headline) => null, subtitle),
  "short_summary": select(defined(headline) => metaDescription, short_summary),
  "imageUrl": select(defined(headline) => imageUrl, null),
  "image": select(defined(headline) => mainImage, image),
  "imageAlt": select(defined(headline) => imageAlt, null),
  "bodyPortable": select(defined(headline) => body, null),
  "bodyText": select(!defined(headline) => body, null),
  "isTaka": defined(headline),
  "author": select(defined(headline) => author, null),
  "takaStatus": select(defined(headline) => status, null),
  sport,
  "category": select(defined(headline) => competition, category),
  tags,
  source_name,
  source_url,
  publishedAt,
  "tldr": select(defined(headline) => tldr, null),
  "faq": select(defined(headline) => faq, null),
  "focusKeyword": select(defined(headline) => focusKeyword, null),
  "secondaryKeywords": select(defined(headline) => secondaryKeywords, null),
  "sourceUrls": select(defined(headline) => sourceUrls, null),
  "editorialRelated": select(defined(headline) => relatedArticles[!(_id in path('drafts.**'))]->{
    _id,
    "slug": slug.current,
    "title": headline,
    "imageUrl": imageUrl,
    "image": mainImage,
    publishedAt,
    sport,
    "category": competition,
    "takaStatus": status
  }, null)
}`

// Artículos relacionados — fallback dinámico cuando editorialRelated está vacío
export const relatedArticlesQuery = `*[_type == "article" && _id != $id && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && (sport == $sport || category == $category)] | order(publishedAt desc)[0...3] {
  _id, "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "imageUrl": select(defined(headline) => imageUrl, null),
  "image": select(defined(headline) => mainImage, image),
  publishedAt,
  sport,
  "category": select(defined(headline) => competition, category),
  "takaStatus": select(defined(headline) => status, null)
}`

// Siguiente artículo — incluye ambos schemas
export const nextArticleQuery = `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && publishedAt > $publishedAt] | order(publishedAt asc)[0] {
  _id, "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "short_summary": select(defined(headline) => metaDescription, short_summary),
  "imageUrl": select(defined(headline) => imageUrl, null),
  "image": select(defined(headline) => mainImage, image),
  publishedAt,
  sport,
  "category": select(defined(headline) => competition, category)
}`

// Búsqueda ligera — incluye ambos schemas
export const searchArticlesQuery = `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))] | order(publishedAt desc)[0...120] {
  _id, "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "short_summary": select(defined(headline) => metaDescription, short_summary),
  "imageUrl": select(defined(headline) => imageUrl, null),
  "image": select(defined(headline) => mainImage, image),
  publishedAt,
  sport,
  "category": select(defined(headline) => competition, category)
}`

// Feed por tag — para páginas /tag/[tag]
export const articlesByTagQuery = `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && $tag in coalesce(tags, [])] | order(publishedAt desc)[0...40] {
  ${LISTING_FIELDS},
  "priority": select(defined(headline) => "destacado", priority)
}`

// Todos los tags únicos — para el sitemap (legacy: generateStaticParams del tag)
export const allTagsQuery = `array::unique(*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && defined(tags)].tags[])`

// Todos los tags CON repetición — para contar frecuencia y podar del sitemap los
// tags finos (frases LLM de un solo uso). El sitemap solo indexa tags con >=3
// artículos; el resto va a noindex,follow. (Fase 0 SEO, jun 2026)
export const allTagsFlatQuery = `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && defined(tags)].tags[]`

// Nº de artículos publicados que llevan un tag concreto — para decidir noindex
// de /tag/[tag] cuando es demasiado fino para merecer indexación.
export const tagCountQuery = `count(*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && $tag in coalesce(tags, [])])`

// Umbral mínimo de artículos para que un tag sea indexable (sitemap + meta robots).
export const MIN_TAG_ARTICLES = 3

// Un tag es "basura" si su slug es numérico puro o de menos de 3 caracteres
// (ej. /tag/2, /tag/a) → nunca indexar.
export function isJunkTag(tag: string): boolean {
  const t = tag.trim()
  if (t.length < 3) return true
  if (/^\d+$/.test(t)) return true
  return false
}

// Feed de noticias relacionadas con una entidad (jugador, equipo, etc.).
// Búsqueda por matching en campos prioritarios (title/headline > summary > body).
// Parámetros:
//   $needle: string con sufijo wildcard, ej. "lamine yamal*"
//   $limit:  número (1-20)
export const articlesByEntityQuery = `*[_type == "article"
  && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))
  && (
    title match $needle
    || headline match $needle
    || short_summary match $needle
    || metaDescription match $needle
  )
] | order(publishedAt desc)[0...$limit] {
  ${LISTING_FIELDS}
}`

// Noticias relacionadas con un partido: artículos que mencionan a cualquiera
// de los dos equipos/jugadores (match prefijo en title/headline/summary/meta).
// Alimenta el bloque "Noticias relacionadas" de /partido — enlace interno
// editorial→fixture, ventaja única de Taka por ser también redacción.
export const articlesByMatchQuery = `*[_type == "article"
  && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))
  && (
    title match $home || headline match $home || short_summary match $home || metaDescription match $home
    || title match $away || headline match $away || short_summary match $away || metaDescription match $away
  )
] | order(publishedAt desc)[0...$limit] {
  ${LISTING_FIELDS}
}`

// Breaking — ticker de últimas horas
// Cubre: artículos viejos con type=="breaking" + artículos Taka con status=="breaking"
export const breakingQuery = `*[_type == "article" && publishedAt > $since && (
  (status == "publicado" && type == "breaking") ||
  (defined(headline) && !(_id in path('drafts.**')) && status == "breaking")
)] | order(publishedAt desc)[0...5] {
  _id,
  "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  sport,
  publishedAt
}`

// ── Reels ─────────────────────────────────────────────────────

export const reelsQuery = `*[_type == "reel"] | order(publishedAt desc) {
  _id, title, instagram_url, thumbnail, sport, category, publishedAt
}`

// ── Events ────────────────────────────────────────────────────

// Próximos y en vivo, hasta 60 días adelante, máx 60 eventos
export const eventsQuery = `*[_type == "event" && status in ["programado", "en_vivo"]] | order(date asc)[0...60] {
  _id, sport, home, away, date, venue, status, stage, broadcast,
  "competition": competition->{ name, "slug": slug.current }
}`

// Próximos eventos filtrados por deporte (hub pages)
export const eventsBySportQuery = `*[_type == "event" && sport == $sport && status in ["programado", "en_vivo"]] | order(date asc)[0...5] {
  _id, sport, home, away, date, venue, status, stage, broadcast,
  "competition": competition->{ name, "slug": slug.current }
}`

// Detalle de un evento Sanity por _id
export const eventDetailQuery = `*[_type == "event" && _id == $id][0] {
  _id, sport, home, away, date, venue, status, stage, broadcast,
  "competition": competition->{ name, "slug": slug.current }
}`

// Artículos relacionados a un evento — mismo deporte, ventana temporal ±7/+2 días
export const relatedByEventQuery = `*[
  _type == "article" &&
  (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) &&
  sport == $sport &&
  publishedAt >= $from &&
  publishedAt <= $to
] | score(
  boost(title match $home, 3),
  boost(title match $away, 3),
  boost(select(defined(headline) => headline, title) match $home, 2),
  boost(select(defined(headline) => headline, title) match $away, 2)
) | order(@.score desc, publishedAt desc)[0...4] {
  _id,
  "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "short_summary": select(defined(headline) => metaDescription, short_summary),
  "imageUrl": select(defined(headline) => imageUrl, null),
  "image": select(defined(headline) => mainImage, image),
  publishedAt,
  sport,
  "category": select(defined(headline) => competition, category)
}`
