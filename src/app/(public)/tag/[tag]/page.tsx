import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import Link from 'next/link'
import { sanityClient, articlesByTagsQuery } from '@/lib/sanity'
import { esTagIndexable } from '@/lib/tag-policy'
import { getTagIndex } from '@/lib/tag-index'
import { resolverTagParam, tagSlug, type GrupoTag } from '@/lib/tag-slug'
import { adminSupabase } from '@/lib/supabase-admin'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import { timeAgo } from '@/lib/timeAgo'
import Image from '@/components/DynamicImage'
import { urlFor } from '@/lib/sanity'
import ScrollToTop from '@/components/ScrollToTop'
import { SITE_URL, REPORTAJE_GROQ_FILTER } from '@/lib/constants'

/**
 * `decodeURIComponent` lanza con una secuencia mal formada (`/tag/%E0%A4%A`), y
 * eso daba 500 cuatro veces en septiembre de 2026, siempre por enlaces rotos de
 * fuera: ahora es un 404 (resolverTagParam devuelve null).
 */
async function resolverTag(param: string): Promise<{ grupo: GrupoTag; redirigir: boolean } | null> {
  return resolverTagParam(param, await getTagIndex())
}

// Render dinámico, a propósito. Cuando la URL llevaba el texto crudo de la
// etiqueta, con ISR Next metía el pathname en la cabecera `x-next-cache-tags`,
// y una cabecera HTTP solo admite Latin-1: `/tag/luka modrić`, `/tag/466m€`…
// reventaban con 500. La URL buena ya es un slug ASCII (lib/tag-slug.ts), pero
// las viejas siguen llegando y tienen que entrar aquí para redirigir, así que
// la página sigue sin ISR. Lo caro —el índice de etiquetas— va cacheado.
export const dynamic = 'force-dynamic'
// Tags nuevos detectados en runtime también se renderizan (no 404).
export const dynamicParams = true

// El pre-render de las 50 etiquetas más recientes (F3.5, jun 2026) se retira
// con `force-dynamic`: son incompatibles, y era justo el camino que servía bien
// los tags con acentos raros mientras el resto caía en ISR y devolvía 500.
// Se ahorra además una consulta a Sanity por build.

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
  // Sin redirect ni notFound aquí: los decide la página, que es la que puede
  // emitir un 308/404 de verdad. Esto solo rellena la cabecera.
  const resuelto = await resolverTag(tag).catch(() => null)
  if (!resuelto) return { title: 'Etiqueta no encontrada', robots: { index: false, follow: true } }
  const { grupo } = resuelto
  const decoded = grupo.etiqueta
  const title = `#${decoded} — noticias y artículos`
  const description = `Todos los artículos etiquetados con #${decoded} en TakaSports. Noticias, análisis y cobertura deportiva.`
  const canonical = `${SITE_URL}/tag/${grupo.slug}`

  // Tags finos (frases de un solo uso) o basura → noindex,follow: no merecen
  // indexarse y son la mayor fuente de "Descubierta sin indexar" y soft-404,
  // pero conservamos follow para no perder el paso de enlaces. (Fase 0 SEO)
  // ¿La etiqueta ES un jugador con ficha? `ilike` sin comodines compara sin
  // distinguir mayúsculas, que es justo lo que hace falta: las etiquetas se
  // guardan en minúscula y los nombres como los publica ESPN.
  const duplicaFicha = await (async () => {
    const db = adminSupabase()
    if (!db) return false
    const { data } = await db
      .from('sport_entities')
      .select('id')
      .eq('type', 'player')
      .ilike('name', decoded)
      .limit(1)
    return (data?.length ?? 0) > 0
  })().catch(() => false)
  const thin = !esTagIndexable(decoded, grupo.articulos, duplicaFicha)

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

const relatedTagsQuery = `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))${REPORTAJE_GROQ_FILTER} && count(coalesce(tags, [])[@ in $variantes]) > 0][0...80] { tags }`

/** Etiquetas que más acompañan a esta, agrupadas por slug como las páginas. */
function topRelatedTags(
  rows: Array<{ tags?: string[] | null }>,
  index: Record<string, GrupoTag>,
  currentSlug: string,
  limit = 8,
): Array<{ slug: string; tag: string; count: number }> {
  const counter = new Map<string, number>()
  for (const row of rows) {
    if (!Array.isArray(row.tags)) continue
    for (const t of row.tags) {
      if (!t || typeof t !== 'string') continue
      const slug = tagSlug(t)
      if (!slug || slug === currentSlug) continue
      counter.set(slug, (counter.get(slug) ?? 0) + 1)
    }
  }
  return Array.from(counter.entries())
    .map(([slug, count]) => ({ slug, tag: index[slug]?.etiqueta ?? slug, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>
}) {
  const { tag } = await params
  const resuelto = await resolverTag(tag)
  if (!resuelto) notFound()
  const { grupo, redirigir } = resuelto
  if (redirigir) permanentRedirect(`/tag/${grupo.slug}`)
  const decoded = grupo.etiqueta
  const variantes = { variantes: grupo.variantes }

  // Sin .catch en los artículos: si Sanity falla es un 500 (Google reintenta),
  // no una lista vacía que acabe en un 404 de una etiqueta que sí existe.
  const [articles, relatedRows, index] = await Promise.all([
    sanityClient.fetch<Article[]>(articlesByTagsQuery, variantes),
    sanityClient
      .fetch<Array<{ tags?: string[] | null }>>(relatedTagsQuery, variantes)
      .catch(() => [] as Array<{ tags?: string[] | null }>),
    getTagIndex(),
  ])

  if (articles.length === 0) notFound()

  const relatedTags = topRelatedTags(relatedRows, index, grupo.slug)

  const tagUrl = `${SITE_URL}/tag/${grupo.slug}`
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
              {relatedTags.map(({ slug: rs, tag: rt, count }) => (
                <Link
                  key={rs}
                  prefetch={false}
                  href={`/tag/${rs}`}
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
                    <p className="text-[10px] mt-auto pt-2" style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }} suppressHydrationWarning>
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
