import type { MetadataRoute } from 'next'
import { sanityClient, allTagsQuery } from '@/lib/sanity'
import { SLUG_TO_LABEL } from '@/lib/sports'
import { getAllRankingEntries } from '@/lib/rankings-search'
import { getAllEntryIdsFromDb } from '@/lib/rankings-data'
import { SITE_URL } from '@/lib/constants'
import { COMPETITIONS } from '@/lib/calendar-competitions'
import { GLOSARIO_TERMS } from '@/lib/glosario-terms'

const BASE_URL = SITE_URL

// Fechas deterministas por sección. Google ignora <lastmod> cuando ve que cambia
// en cada build sin razón. Bumpear estas constantes solo al hacer cambios reales.
const STATIC_LASTMOD = new Date('2026-05-28T00:00:00Z')
const RANKINGS_LASTMOD = new Date('2026-05-28T00:00:00Z')
const SPORT_HUB_FALLBACK_LASTMOD = new Date('2026-05-28T00:00:00Z')
const TAG_LASTMOD = new Date('2026-05-28T00:00:00Z')

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

// Player/team detail pages (deep, automated stat pages — high SEO value).
async function statRoutes(): Promise<MetadataRoute.Sitemap> {
  try {
    const [standRes, playRes] = await Promise.all([
      fetch(`${BASE_URL}/api/stats/standings`, { next: { revalidate: 3600 } }),
      fetch(`${BASE_URL}/api/stats/players`, { next: { revalidate: 3600 } }),
    ])
    const teamUrls = new Set<string>()
    const playerUrls = new Set<string>()

    if (standRes.ok) {
      const s = await standRes.json()
      for (const g of s.football ?? []) {
        const ls = g.leagueSlug as string | undefined
        if (!ls) continue
        for (const r of g.rows ?? []) if (r.teamId)
          teamUrls.add(`${BASE_URL}/equipo/${ls.replace('/', '_')}_${r.teamId}`)
      }
      for (const r of [...(s.nbaEast ?? []), ...(s.nbaWest ?? [])])
        if (r.teamId) teamUrls.add(`${BASE_URL}/equipo/basketball_nba_${r.teamId}`)
    }
    if (playRes.ok) {
      const p = await playRes.json()
      const push = (arr: { playerId?: string; leagueSlug?: string }[] | undefined) => {
        for (const x of arr ?? []) if (x.playerId && x.leagueSlug)
          playerUrls.add(`${BASE_URL}/jugador/${x.leagueSlug.replace('/', '_')}_${x.playerId}`)
      }
      for (const lg of p.leagues ?? []) { push(lg.goals); push(lg.assists) }
      for (const k of Object.keys(p.combined ?? {})) push(p.combined[k])
    }

    return [
      ...[...teamUrls].map(url => ({
        url, lastModified: STATIC_LASTMOD, changeFrequency: 'daily' as const, priority: 0.7,
      })),
      ...[...playerUrls].map(url => ({
        url, lastModified: STATIC_LASTMOD, changeFrequency: 'daily' as const, priority: 0.6,
      })),
    ]
  } catch { return [] }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, tags, dbIds, stats] = await Promise.all([
    sanityClient.fetch<Array<{ slug: string; publishedAt: string; _updatedAt?: string; sport?: string }>>(
      `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))] | order(publishedAt desc) {
        "slug": slug.current, publishedAt, _updatedAt, sport
      }`
    ).catch(() => []),
    sanityClient.fetch<string[]>(allTagsQuery).catch(() => [] as string[]),
    getAllEntryIdsFromDb(2000).catch(() => [] as string[]),
    statRoutes(),
  ])

  const hubLastMod = mostRecent(articles)

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: hubLastMod, changeFrequency: 'hourly', priority: 1 },
    { url: `${BASE_URL}/noticias`, lastModified: hubLastMod, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/calendario`, lastModified: STATIC_LASTMOD, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/estadisticas`, lastModified: STATIC_LASTMOD, changeFrequency: 'hourly', priority: 0.8 },
    // Una entrada por deporte para que Google indexe cada vista por separado
    // (cada una tiene su propio título, description, OG image dinámica y canonical).
    { url: `${BASE_URL}/estadisticas?sport=futbol`,     lastModified: STATIC_LASTMOD, changeFrequency: 'hourly',  priority: 0.85 },
    { url: `${BASE_URL}/estadisticas?sport=baloncesto`, lastModified: STATIC_LASTMOD, changeFrequency: 'hourly',  priority: 0.8 },
    { url: `${BASE_URL}/estadisticas?sport=f1`,         lastModified: STATIC_LASTMOD, changeFrequency: 'daily',   priority: 0.75 },
    { url: `${BASE_URL}/estadisticas?sport=tenis`,      lastModified: STATIC_LASTMOD, changeFrequency: 'hourly',  priority: 0.7 },
    { url: `${BASE_URL}/estadisticas?sport=motogp`,     lastModified: STATIC_LASTMOD, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/estadisticas?sport=ufc`,        lastModified: STATIC_LASTMOD, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/estadisticas?sport=mundial`,    lastModified: STATIC_LASTMOD, changeFrequency: 'daily',   priority: 0.85 },
    // League hubs: tabla + goleadores + asistencias en una vista
    ...['esp.1', 'eng.1', 'ita.1', 'ger.1', 'fra.1'].map(id => ({
      url: `${BASE_URL}/liga/${id}`,
      lastModified: STATIC_LASTMOD,
      changeFrequency: 'hourly' as const,
      priority: 0.85,
    })),
    { url: `${BASE_URL}/rankings`, lastModified: RANKINGS_LASTMOD, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/juegos`, lastModified: STATIC_LASTMOD, changeFrequency: 'weekly', priority: 0.75 },
    { url: `${BASE_URL}/quiniela`, lastModified: STATIC_LASTMOD, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/crackquiz`, lastModified: STATIC_LASTMOD, changeFrequency: 'daily', priority: 0.65 },
    { url: `${BASE_URL}/sopa-cracks`, lastModified: STATIC_LASTMOD, changeFrequency: 'weekly', priority: 0.65 },
    { url: `${BASE_URL}/mionce`, lastModified: STATIC_LASTMOD, changeFrequency: 'weekly', priority: 0.65 },
    { url: `${BASE_URL}/takagrid`, lastModified: STATIC_LASTMOD, changeFrequency: 'daily', priority: 0.65 },
    { url: `${BASE_URL}/reels`, lastModified: STATIC_LASTMOD, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/sobre`, lastModified: STATIC_LASTMOD, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/politica-editorial`, lastModified: STATIC_LASTMOD, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE_URL}/autor/redaccion`, lastModified: hubLastMod, changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE_URL}/glosario`, lastModified: STATIC_LASTMOD, changeFrequency: 'monthly', priority: 0.6 },
    ...GLOSARIO_TERMS.map((t) => ({
      url: `${BASE_URL}/glosario/${t.slug}`,
      lastModified: new Date(t.updatedAt),
      changeFrequency: 'yearly' as const,
      priority: 0.55,
    })),
    ...COMPETITIONS.map((c) => ({
      url: `${BASE_URL}/calendario/${c.slug}`,
      lastModified: STATIC_LASTMOD,
      changeFrequency: 'daily' as const,
      priority: 0.75,
    })),
  ]

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

  // Paginación del hub /noticias: indexable hasta página 20 (ver noticias/pagina/[n]/page.tsx).
  const PAGE_SIZE = 40
  const totalPages = Math.min(Math.ceil(articles.length / PAGE_SIZE), 20)
  const paginatedHubRoutes: MetadataRoute.Sitemap = Array.from(
    { length: Math.max(totalPages - 1, 0) },
    (_, i) => ({
      url: `${BASE_URL}/noticias/pagina/${i + 2}`,
      lastModified: hubLastMod,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    }),
  )

  const tagRoutes: MetadataRoute.Sitemap = (tags as string[])
    .filter(Boolean)
    .map(tag => ({
      url: `${BASE_URL}/tag/${encodeURIComponent(tag)}`,
      lastModified: TAG_LASTMOD,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }))

  return [...staticRoutes, ...sportRoutes, ...rankingDetailRoutes, ...articleRoutes, ...paginatedHubRoutes, ...tagRoutes, ...stats]
}
