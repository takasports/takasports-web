import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { sanityClient, articlesByTagQuery, allTagsQuery, tagCountQuery, MIN_TAG_ARTICLES, isJunkTag } from '@/lib/sanity'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import { timeAgo } from '@/lib/timeAgo'
import Image from '@/components/DynamicImage'
import { urlFor } from '@/lib/sanity'
import ScrollToTop from '@/components/ScrollToTop'
import { SITE_URL } from '@/lib/constants'

export const revalidate = 3600
// Tags nuevos detectados en runtime también se renderizan vía ISR (no 404).
export const dynamicParams = true

// F3.5 (jun 2026): pre-generamos páginas de tags para que Next las trate
// como SSG cacheables en lugar de Dynamic. Tags nuevos no listados aquí
// caen al primer hit vía ISR (dynamicParams=true).
export async function generateStaticParams() {
  const tags = await sanityClient
    .fetch<string[]>(allTagsQuery)
    .catch(() => [] as string[])
  return tags.filter(Boolean).slice(0, 200).map((tag) => ({ tag: encodeURIComponent(tag) }))
}

interface Article {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  sport?: string
  category?: string
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>
}): Promise<Metadata> {
  const { tag } = await params
  const decoded = decodeURIComponent(tag)
  const title = `#${decoded} — noticias y artículos`
  const description = `Todos los artículos etiquetados con #${decoded} en TakaSports. Noticias, análisis y cobertura deportiva.`
  const canonical = `${SITE_URL}/tag/${tag}`

  // Tags finos (frases de un solo uso) o basura → noindex,follow: no merecen
  // indexarse y son la mayor fuente de "Descubierta sin indexar" y soft-404,
  // pero conservamos follow para no perder el paso de enlaces. (Fase 0 SEO)
  const count = await sanityClient
    .fetch<number>(tagCountQuery, { tag: decoded } as Record<string, string>)
    .catch(() => 0)
  const thin = isJunkTag(decoded) || count < MIN_TAG_ARTICLES

  return {
    title,
    description,
    ...(thin ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical },
    openGraph: {
      title: `#${decoded} | TakaSports`,
      description,
      url: canonical,
      siteName: 'TakaSports',
      locale: 'es_ES',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `#${decoded} | TakaSports`,
      description,
      site: '@takasportsx',
    },
  }
}

const relatedTagsQuery = `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && $tag in coalesce(tags, [])][0...80] { tags }`

function topRelatedTags(rows: Array<{ tags?: string[] | null }>, currentTag: string, limit = 8): Array<{ tag: string; count: number }> {
  const counter = new Map<string, number>()
  const currentLower = currentTag.toLowerCase()
  for (const row of rows) {
    if (!Array.isArray(row.tags)) continue
    for (const t of row.tags) {
      if (!t || typeof t !== 'string') continue
      if (t.toLowerCase() === currentLower) continue
      counter.set(t, (counter.get(t) ?? 0) + 1)
    }
  }
  return Array.from(counter.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>
}) {
  const { tag } = await params
  const decoded = decodeURIComponent(tag)

  const [articles, relatedRows] = await Promise.all([
    sanityClient
      .fetch<Article[]>(articlesByTagQuery, { tag: decoded } as Record<string, string>)
      .catch(() => [] as Article[]),
    sanityClient
      .fetch<Array<{ tags?: string[] | null }>>(relatedTagsQuery, { tag: decoded } as Record<string, string>)
      .catch(() => [] as Array<{ tags?: string[] | null }>),
  ])

  if (articles.length === 0) notFound()

  const relatedTags = topRelatedTags(relatedRows, decoded)

  const tagUrl = `${SITE_URL}/tag/${tag}`
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Noticias', item: `${SITE_URL}/noticias` },
      { '@type': 'ListItem', position: 3, name: `#${decoded}`, item: tagUrl },
    ],
  }
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `#${decoded} — TakaSports`,
    description: `Todos los artículos etiquetados con #${decoded} en TakaSports.`,
    url: tagUrl,
    inLanguage: 'es-ES',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': `${SITE_URL}/#organization` },
  }
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Artículos con la etiqueta #${decoded}`,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: Math.min(articles.length, 20),
    itemListElement: articles.slice(0, 20).map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: a.slug ? `${SITE_URL}/noticias/${a.slug}` : undefined,
      name: a.title,
      image: a.imageUrl ?? (a.image?.asset ? urlFor(a.image).width(1200).height(630).url() : undefined),
    })),
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-20">

        {/* Header */}
        <div className="pt-10 pb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="section-accent" />
            <span className="section-label">Etiqueta</span>
          </div>
          <h1
            className="font-black leading-tight mb-2"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              color: '#F8F8FF',
              letterSpacing: '-0.02em',
            }}
          >
            #{decoded}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {articles.length} {articles.length === 1 ? 'artículo' : 'artículos'}
          </p>
        </div>

        {/* Tags relacionados (co-ocurrencia) */}
        {relatedTags.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="section-label">Tags relacionados</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {relatedTags.map(({ tag: rt, count }) => (
                <Link
                  key={rt}
                  href={`/tag/${encodeURIComponent(rt)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--font-sport)',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                    textDecoration: 'none',
                    transition: 'border-color var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)',
                  }}
                >
                  #{rt}
                  <span style={{ color: 'var(--text-faint)', fontSize: 10, fontWeight: 700 }}>{count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Grid de artículos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((article) => {
            const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(600).height(340).url() : null)
            const { accent } = getSportStyle(article.sport, article.category)
            const href = `/noticias/${article.slug ?? article._id}`
            return (
              <Link
                key={article._id}
                href={href}
                className="news-card rounded-2xl overflow-hidden flex flex-col"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', textDecoration: 'none' }}
              >
                {/* Imagen */}
                <div className="relative overflow-hidden" style={{ height: 180, background: 'linear-gradient(145deg,#1a1a2e,#0d0d18)' }}>
                  {imgUrl && (
                    <Image
                      src={imgUrl}
                      alt={article.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  )}
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to top, rgba(9,9,15,0.5) 0%, transparent 50%)' }}
                  />
                </div>

                {/* Contenido */}
                <div className="p-4 flex flex-col gap-2 flex-1">
                  {(article.sport || article.category) && (
                    <span
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: accent, fontFamily: 'var(--font-sport)' }}
                    >
                      {getSportLabel(article.sport, article.category)}
                    </span>
                  )}
                  <h2
                    className="news-title font-bold leading-snug line-clamp-2"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: '1rem' }}
                  >
                    {article.title}
                  </h2>
                  {article.short_summary && (
                    <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                      {article.short_summary}
                    </p>
                  )}
                  {article.publishedAt && (
                    <p className="text-[10px] mt-auto pt-2" style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}>
                      {timeAgo(article.publishedAt)}
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

      </div>

      <ScrollToTop />
    </div>
  )
}
