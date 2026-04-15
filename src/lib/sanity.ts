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

export const articlesQuery = `*[_type == "article"] | order(publishedAt desc) {
  _id, title, short_summary, publishedAt, category, sport, image
}`

export const reelsQuery = `*[_type == "reel"] | order(priority asc) {
  _id, instagram_url, thumbnail, category
}`

export const articleDetailQuery = `*[_type == "article" && _id == $id][0] {
  _id, title, subtitle, body, short_summary,
  image, category, sport, tags,
  source_name, source_url, publishedAt
}`

export const relatedArticlesQuery = `*[_type == "article" && _id != $id && (sport == $sport || category == $category)] | order(publishedAt desc)[0...3] {
  _id, title, publishedAt, sport, category, image
}`

export const nextArticleQuery = `*[_type == "article" && publishedAt > $publishedAt] | order(publishedAt asc)[0] {
  _id, title, short_summary, publishedAt, sport, category, image
}`

// Query ligero para el buscador (solo campos necesarios)
export const searchArticlesQuery = `*[_type == "article"] | order(publishedAt desc)[0...120] {
  _id, title, short_summary, publishedAt, sport, category, image
}`
