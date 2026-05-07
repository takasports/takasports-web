import type { MetadataRoute } from 'next'
import { sanityClient, allTagsQuery } from '@/lib/sanity'
import { SLUG_TO_LABEL } from '@/lib/sports'
import { getAllRankingEntries } from '@/lib/rankings-search'
import { SITE_URL } from '@/lib/constants'

const BASE_URL = SITE_URL

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, tags] = await Promise.all([
    sanityClient.fetch<Array<{ slug: string; publishedAt: string }>>(
      `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))] | order(publishedAt desc) {
        "slug": slug.current, publishedAt
      }`
    ).catch(() => []),
    sanityClient.fetch<string[]>(allTagsQuery).catch(() => [] as string[]),
  ])

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    { url: `${BASE_URL}/noticias`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/calendario`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/estadisticas`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/rankings`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/rankings/comparar`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/juegos`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.75 },
    { url: `${BASE_URL}/quiniela`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/crackquiz`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.65 },
    { url: `${BASE_URL}/sopa-cracks`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.65 },
    { url: `${BASE_URL}/mionce`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.65 },
    { url: `${BASE_URL}/takagrid`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.65 },
  ]

  // Rankings filtrados — title dinámico ya cubre el SEO en la misma URL
  const RANKINGS_FILTERED: MetadataRoute.Sitemap = [
    'futbol', 'baloncesto', 'formula1', 'tenis', 'ufc', 'wwe', 'contenido',
  ].flatMap(deporte => [
    { url: `${BASE_URL}/rankings?deporte=${deporte}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7 },
    { url: `${BASE_URL}/rankings?deporte=${deporte}&tab=clubes`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.65 },
  ])

  const rankingDetailRoutes: MetadataRoute.Sitemap = getAllRankingEntries().map(e => ({
    url: `${BASE_URL}/rankings/${e.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

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

  const tagRoutes: MetadataRoute.Sitemap = (tags as string[])
    .filter(Boolean)
    .map(tag => ({
      url: `${BASE_URL}/tag/${encodeURIComponent(tag)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }))

  return [...staticRoutes, ...sportRoutes, ...RANKINGS_FILTERED, ...rankingDetailRoutes, ...articleRoutes, ...tagRoutes]
}
