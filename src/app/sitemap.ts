import type { MetadataRoute } from 'next'
import { sanityClient, allTagsQuery } from '@/lib/sanity'
import { SLUG_TO_LABEL } from '@/lib/sports'
import { getAllRankingEntries } from '@/lib/rankings-search'
import { getAllEntryIdsFromDb } from '@/lib/rankings-data'
import { SITE_URL } from '@/lib/constants'

const BASE_URL = SITE_URL

// Fechas deterministas por sección. Google ignora <lastmod> cuando ve que cambia
// en cada build sin razón. Bumpear estas constantes solo al hacer cambios reales.
const STATIC_LASTMOD = new Date('2026-05-09T00:00:00Z')
const RANKINGS_LASTMOD = new Date('2026-05-09T00:00:00Z')
const SPORT_HUB_FALLBACK_LASTMOD = new Date('2026-05-09T00:00:00Z')
const TAG_LASTMOD = new Date('2026-05-09T00:00:00Z')

function mostRecent(items: Array<{ publishedAt?: string; _updatedAt?: string }>): Date {
  let max = 0
  for (const a of items) {
    const t = Math.max(
      a._updatedAt ? Date.parse(a._updatedAt) : 0,
      a.publishedAt ? Date.parse(a.publishedAt) : 0,
    )
    if (t > max) max = t
  }
  return max ? new Date(max) : STATIC_LASTMOD
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, tags, dbIds] = await Promise.all([
    sanityClient.fetch<Array<{ slug: string; publishedAt: string; _updatedAt?: string; sport?: string }>>(
      `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))] | order(publishedAt desc) {
        "slug": slug.current, publishedAt, _updatedAt, sport
      }`
    ).catch(() => []),
    sanityClient.fetch<string[]>(allTagsQuery).catch(() => [] as string[]),
    getAllEntryIdsFromDb(2000).catch(() => [] as string[]),
  ])

  const hubLastMod = mostRecent(articles)

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: hubLastMod, changeFrequency: 'hourly', priority: 1 },
    { url: `${BASE_URL}/noticias`, lastModified: hubLastMod, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/calendario`, lastModified: STATIC_LASTMOD, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/estadisticas`, lastModified: STATIC_LASTMOD, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${BASE_URL}/rankings`, lastModified: RANKINGS_LASTMOD, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/juegos`, lastModified: STATIC_LASTMOD, changeFrequency: 'weekly', priority: 0.75 },
    { url: `${BASE_URL}/quiniela`, lastModified: STATIC_LASTMOD, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/crackquiz`, lastModified: STATIC_LASTMOD, changeFrequency: 'daily', priority: 0.65 },
    { url: `${BASE_URL}/sopa-cracks`, lastModified: STATIC_LASTMOD, changeFrequency: 'weekly', priority: 0.65 },
    { url: `${BASE_URL}/mionce`, lastModified: STATIC_LASTMOD, changeFrequency: 'weekly', priority: 0.65 },
    { url: `${BASE_URL}/takagrid`, lastModified: STATIC_LASTMOD, changeFrequency: 'daily', priority: 0.65 },
    { url: `${BASE_URL}/sobre`, lastModified: STATIC_LASTMOD, changeFrequency: 'monthly', priority: 0.5 },
  ]

  // Rankings filtrados — title dinámico ya cubre el SEO en la misma URL
  const RANKINGS_FILTERED: MetadataRoute.Sitemap = [
    'futbol', 'baloncesto', 'formula1', 'tenis', 'ufc', 'wwe', 'contenido',
  ].map(deporte => (
    { url: `${BASE_URL}/rankings?deporte=${deporte}`, lastModified: RANKINGS_LASTMOD, changeFrequency: 'weekly' as const, priority: 0.7 }
  ))

  // Combina entradas estáticas curadas + entradas auto-generadas de DB (top 2000)
  const staticIds = new Set(getAllRankingEntries().map(e => e.id))
  const allRankingIds = [
    ...getAllRankingEntries().map(e => e.id),
    ...dbIds.filter(id => !staticIds.has(id)),
  ]
  const rankingDetailRoutes: MetadataRoute.Sitemap = allRankingIds.map(id => ({
    url: `${BASE_URL}/rankings/${id}`,
    lastModified: RANKINGS_LASTMOD,
    changeFrequency: 'weekly' as const,
    priority: staticIds.has(id) ? 0.7 : 0.55,
  }))

  // lastmod del hub de cada deporte = artículo más reciente de ese deporte
  const sportRoutes: MetadataRoute.Sitemap = Object.keys(SLUG_TO_LABEL).map(slug => {
    const sportArticles = articles.filter(a => a.sport === slug)
    return {
      url: `${BASE_URL}/${slug}`,
      lastModified: sportArticles.length > 0 ? mostRecent(sportArticles) : SPORT_HUB_FALLBACK_LASTMOD,
      changeFrequency: 'hourly' as const,
      priority: 0.85,
    }
  })

  const articleRoutes: MetadataRoute.Sitemap = articles
    .filter(a => a.slug)
    .map(a => ({
      url: `${BASE_URL}/noticias/${a.slug}`,
      lastModified: a._updatedAt
        ? new Date(a._updatedAt)
        : a.publishedAt
          ? new Date(a.publishedAt)
          : STATIC_LASTMOD,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  const tagRoutes: MetadataRoute.Sitemap = (tags as string[])
    .filter(Boolean)
    .map(tag => ({
      url: `${BASE_URL}/tag/${encodeURIComponent(tag)}`,
      lastModified: TAG_LASTMOD,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }))

  return [...staticRoutes, ...sportRoutes, ...RANKINGS_FILTERED, ...rankingDetailRoutes, ...articleRoutes, ...tagRoutes]
}
