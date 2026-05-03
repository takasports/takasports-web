import type { MetadataRoute } from 'next'
import { sanityClient } from '@/lib/sanity'
import { SLUG_TO_LABEL } from '@/lib/sports'

const BASE_URL = 'https://takasportsmedia.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await sanityClient.fetch<Array<{ slug: string; publishedAt: string }>>(
    `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))] | order(publishedAt desc) {
      "slug": slug.current, publishedAt
    }`
  ).catch(() => [])

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    { url: `${BASE_URL}/noticias`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/calendario`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/quiniela`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
  ]

  const sportRoutes: MetadataRoute.Sitemap = Object.keys(SLUG_TO_LABEL).map(slug => ({
    url: `${BASE_URL}/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.85,
  }))

  const articleRoutes: MetadataRoute.Sitemap = articles
    .filter(a => a.slug)
    .map(a => ({
      url: `${BASE_URL}/article/${a.slug}`,
      lastModified: a.publishedAt ? new Date(a.publishedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  return [...staticRoutes, ...sportRoutes, ...articleRoutes]
}
