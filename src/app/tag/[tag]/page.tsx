import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { sanityClient, articlesByTagQuery } from '@/lib/sanity'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import { timeAgo } from '@/lib/timeAgo'
import Image from '@/components/DynamicImage'
import { urlFor } from '@/lib/sanity'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import { SITE_URL } from '@/lib/constants'

export const revalidate = 3600

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

  return {
    title,
    description,
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
      site: '@takasports',
    },
  }
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>
}) {
  const { tag } = await params
  const decoded = decodeURIComponent(tag)

  const articles = await sanityClient
    .fetch<Article[]>(articlesByTagQuery, { tag: decoded } as Record<string, string>)
    .catch(() => [] as Article[])

  if (articles.length === 0) notFound()

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Noticias', item: `${SITE_URL}/noticias` },
      { '@type': 'ListItem', position: 3, name: `#${decoded}`, item: `${SITE_URL}/tag/${tag}` },
    ],
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Header />
      <LiveStrip />

      <main className="max-w-[1440px] mx-auto px-6 xl:px-10 pb-20">

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

        {/* Grid de artículos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((article) => {
            const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(600).height(340).url() : null)
            const { accent } = getSportStyle(article.sport, article.category)
            const href = `/article/${article.slug ?? article._id}`
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

      </main>

      <Footer />
      <ScrollToTop />
    </div>
  )
}
