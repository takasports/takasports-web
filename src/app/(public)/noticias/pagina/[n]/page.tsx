import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from '@/components/DynamicImage'
import { sanityClient, urlFor } from '@/lib/sanity'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import { timeAgo } from '@/lib/timeAgo'
import ScrollToTop from '@/components/ScrollToTop'
import { SITE_URL } from '@/lib/constants'

export const revalidate = 3600
export const dynamicParams = true

const PAGE_SIZE = 40

const pagedQuery = `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))]
  | order(publishedAt desc)[$from...$to] {
    _id,
    "slug": slug.current,
    "title": select(defined(headline) => headline, title),
    "short_summary": select(defined(headline) => metaDescription, short_summary),
    "imageUrl": select(defined(headline) => imageUrl, null),
    "image": select(defined(headline) => mainImage, image),
    publishedAt, sport,
    "category": select(defined(headline) => competition, category)
  }`

const totalQuery = `count(*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))])`

export async function generateStaticParams() {
  const total: number = await sanityClient.fetch(totalQuery).catch(() => 0)
  const pages = Math.ceil(total / PAGE_SIZE)
  // Pre-build las primeras 8 páginas; el resto ISR on-demand.
  // Más páginas pre-build = LCP estable en CrUX para las que más se navegan.
  return Array.from({ length: Math.min(pages, 8) }, (_, i) => ({ n: String(i + 2) }))
}

function prevHref(page: number): string {
  return page === 2 ? `${SITE_URL}/noticias` : `${SITE_URL}/noticias/pagina/${page - 1}`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ n: string }>
}): Promise<Metadata> {
  const { n } = await params
  const page = parseInt(n, 10)
  if (isNaN(page) || page < 2) return {}
  return {
    title: `Noticias deportivas — página ${page}`,
    description: `Todas las noticias deportivas, página ${page}. Fútbol, NBA, F1, UFC, tenis y más.`,
    alternates: {
      canonical: `${SITE_URL}/noticias/pagina/${page}`,
    },
    robots: page > 20 ? { index: false } : { index: true, follow: true },
  }
}

interface Article {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  imageUrl?: string | null
  image?: { asset: { _ref: string } } | null
  publishedAt?: string
  sport?: string
  category?: string
}

export default async function NoticiasPageN({
  params,
}: {
  params: Promise<{ n: string }>
}) {
  const { n } = await params
  const page = parseInt(n, 10)
  if (isNaN(page) || page < 2) redirect('/noticias')

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE

  const [articles, total]: [Article[], number] = await Promise.all([
    sanityClient.fetch<Article[]>(pagedQuery, { from, to }).catch(() => []),
    sanityClient.fetch<number>(totalQuery).catch(() => 0),
  ])

  if (articles.length === 0) notFound()

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasPrev = page >= 2
  const hasNext = page < totalPages

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Noticias', item: `${SITE_URL}/noticias` },
      { '@type': 'ListItem', position: 3, name: `Página ${page}`, item: `${SITE_URL}/noticias/pagina/${page}` },
    ],
  }

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Noticias deportivas — Página ${page}`,
    numberOfItems: articles.length,
    itemListElement: articles.map((a, i) => ({
      '@type': 'ListItem',
      position: from + i + 1,
      url: `${SITE_URL}/noticias/${a.slug ?? a._id}`,
      name: a.title,
    })),
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      {/* Señalización rel=prev/next para crawlers (Bing/Yandex la usan; Google ignora pero no daña) */}
      <link rel="prev" href={prevHref(page)} />
      {hasNext && <link rel="next" href={`${SITE_URL}/noticias/pagina/${page + 1}`} />}

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-20 pt-8">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="section-accent" />
          <h1 className="section-label" style={{ fontFamily: 'var(--font-sport)' }}>
            Noticias — Página {page}
          </h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                <div className="relative overflow-hidden" style={{ height: 160, background: 'linear-gradient(145deg,#1a1a2e,#0d0d18)' }}>
                  {imgUrl && (
                    <Image src={imgUrl} alt={article.title} fill className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
                  )}
                </div>
                <div className="p-3 flex flex-col gap-1.5 flex-1">
                  {(article.sport || article.category) && (
                    <span className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
                      {getSportLabel(article.sport, article.category)}
                    </span>
                  )}
                  <h2 className="font-bold leading-snug line-clamp-3 text-sm"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                    {article.title}
                  </h2>
                  {article.publishedAt && (
                    <p className="text-[10px] mt-auto pt-2"
                      style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}>
                      {timeAgo(article.publishedAt)}
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        {/* Paginación */}
        <nav aria-label="Paginación de noticias" className="flex items-center justify-center gap-4 mt-12">
          {hasPrev ? (
            <Link href={page === 2 ? '/noticias' : `/noticias/pagina/${page - 1}`}
              className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Página {page} de {totalPages}
          </span>
          {hasNext && (
            <Link href={`/noticias/pagina/${page + 1}`}
              className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              Siguiente →
            </Link>
          )}
        </nav>
      </div>

      <ScrollToTop />
    </div>
  )
}
