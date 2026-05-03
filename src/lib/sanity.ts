import { createClient } from '@sanity/client'
import { createImageUrlBuilder, type SanityImageSource } from '@sanity/image-url'

export const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-01-01',
  useCdn: true,
})

const builder = createImageUrlBuilder(sanityClient)

export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}

// ── Articles ──────────────────────────────────────────────────

// Feed principal — normaliza artículos viejos (status=="publicado") + nuevos de Taka System (tienen headline)
// Los dos usan _type=="article" pero campos diferentes; se mapean a forma común aquí.
export const articlesQuery = `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))] | order(publishedAt desc) {
  _id,
  "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "short_summary": select(defined(headline) => metaDescription, short_summary),
  "imageUrl": select(defined(headline) => imageUrl, null),
  "image": select(defined(headline) => null, image),
  publishedAt,
  "sport": select(defined(headline) => "futbol", sport),
  "category": select(defined(headline) => competition, category),
  "priority": select(defined(headline) => "destacado", priority),
  "isTaka": defined(headline)
}`

// Home — mismo set pero el reordenamiento por prioridad se hace en el servidor (ver page.tsx)
export const homeArticlesQuery = articlesQuery

// Feed sin filtro de status — para preview/editor (usar con token)
export const articlesAllQuery = `*[_type == "article"] | order(publishedAt desc) {
  _id, "slug": slug.current, title, short_summary, publishedAt,
  sport, type, priority, status, category, image
}`

// Artículo detalle — normaliza ambos schemas
export const articleDetailQuery = `*[_type == "article" && (slug.current == $id || _id == $id)][0] {
  _id,
  "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "subtitle": select(defined(headline) => null, subtitle),
  "short_summary": select(defined(headline) => metaDescription, short_summary),
  "imageUrl": select(defined(headline) => imageUrl, null),
  "image": select(defined(headline) => null, image),
  "bodyPortable": select(defined(headline) => body, null),
  "bodyText": select(!defined(headline) => body, null),
  "isTaka": defined(headline),
  "sport": select(defined(headline) => "futbol", sport),
  "category": select(defined(headline) => competition, category),
  tags,
  source_name,
  source_url,
  publishedAt
}`

// Artículos relacionados — incluye ambos schemas
export const relatedArticlesQuery = `*[_type == "article" && _id != $id && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && (sport == $sport || category == $category || (defined(headline) && ($sport == "futbol" || $sport == "Fútbol")))] | order(publishedAt desc)[0...3] {
  _id, "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "imageUrl": select(defined(headline) => imageUrl, null),
  "image": select(defined(headline) => null, image),
  publishedAt,
  "sport": select(defined(headline) => "futbol", sport),
  "category": select(defined(headline) => competition, category)
}`

// Siguiente artículo — incluye ambos schemas
export const nextArticleQuery = `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && publishedAt > $publishedAt] | order(publishedAt asc)[0] {
  _id, "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "short_summary": select(defined(headline) => metaDescription, short_summary),
  "imageUrl": select(defined(headline) => imageUrl, null),
  "image": select(defined(headline) => null, image),
  publishedAt,
  "sport": select(defined(headline) => "futbol", sport),
  "category": select(defined(headline) => competition, category)
}`

// Búsqueda ligera — incluye ambos schemas
export const searchArticlesQuery = `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))] | order(publishedAt desc)[0...120] {
  _id, "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "short_summary": select(defined(headline) => metaDescription, short_summary),
  "imageUrl": select(defined(headline) => imageUrl, null),
  "image": select(defined(headline) => null, image),
  publishedAt,
  "sport": select(defined(headline) => "futbol", sport),
  "category": select(defined(headline) => competition, category)
}`

// Breaking — para LiveStrip (últimas 6h, tipo breaking; solo artículos viejos)
export const breakingQuery = `*[_type == "article" && status == "publicado" && type == "breaking" && publishedAt > $since] | order(publishedAt desc)[0...5] {
  _id, "slug": slug.current, title, sport, publishedAt
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
