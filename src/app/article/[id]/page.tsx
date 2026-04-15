import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { sanityClient, articleDetailQuery, relatedArticlesQuery, nextArticleQuery, urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { getSportStyle } from '@/lib/sports'
import Header from '@/components/Header'
import ShareButton from './ShareButton'
import BackButton from './BackButton'
import ScrollToTop from '@/components/ScrollToTop'

function readingTime(body?: string): number | null {
  if (!body || body.trim().length === 0) return null
  const words = body.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

interface Article {
  _id: string
  title: string
  subtitle?: string
  body?: string
  short_summary?: string
  image?: { asset: { _ref: string } }
  category?: string
  sport?: string
  tags?: string[]
  source_name?: string
  source_url?: string
  publishedAt?: string
}

interface RelatedArticle {
  _id: string
  title: string
  publishedAt?: string
  sport?: string
  category?: string
  image?: { asset: { _ref: string } }
}

// ── generateMetadata para OG por artículo ──────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const article = await sanityClient.fetch<Article>(articleDetailQuery, { id })
  if (!article) return { title: 'TakaSports' }

  const imgUrl = article.image?.asset
    ? urlFor(article.image).width(1200).height(630).url()
    : undefined

  return {
    title: `${article.title} — TakaSports`,
    description: article.short_summary ?? article.subtitle,
    openGraph: {
      title: article.title,
      description: article.short_summary ?? article.subtitle,
      images: imgUrl ? [{ url: imgUrl, width: 1200, height: 630 }] : [],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.short_summary ?? article.subtitle,
      images: imgUrl ? [imgUrl] : [],
    },
  }
}

// ── Server Component ────────────────────────────────────────
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const article = await sanityClient.fetch<Article>(articleDetailQuery, { id })
  if (!article) return notFound()

  // Fetch relacionados y siguiente en paralelo
  const [relatedFinal, nextArticle] = await Promise.all([
    sanityClient
      .fetch<RelatedArticle[]>(relatedArticlesQuery, {
        id,
        sport: article.sport ?? '',
        category: article.category ?? '',
      })
      .catch(() => [] as RelatedArticle[]),
    article.publishedAt
      ? sanityClient
          .fetch<RelatedArticle & { short_summary?: string }>(nextArticleQuery, {
            publishedAt: article.publishedAt,
          })
          .catch(() => null)
      : Promise.resolve(null),
  ])

  const imgUrl = article.image?.asset
    ? urlFor(article.image).width(1400).height(600).url()
    : null

  const paragraphs = article.body
    ? article.body.split('\n').filter((p) => p.trim().length > 0)
    : []

  const minRead = readingTime(article.body)
  const { accent } = getSportStyle(article.sport, article.category)
  // Usar color de deporte para la etiqueta; si no hay deporte conocido, cae al morado
  const badgeColor = accent
  const badgeBg = `${badgeColor}18`
  const badgeBorder = `${badgeColor}30`

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />

      <main className="max-w-[1440px] mx-auto px-6 xl:px-10 pb-20">

        {/* Back — contextual: usa BackButton (client) que hace router.back() o fallback */}
        <div className="pt-6 pb-4">
          <BackButton />
        </div>

        <article className="max-w-3xl">

          {/* Meta */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            {(article.sport || article.category) && (
              <span
                className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full"
                style={{
                  background: badgeBg,
                  color: badgeColor,
                  border: `1px solid ${badgeBorder}`,
                  fontFamily: 'var(--font-sport)',
                }}
              >
                {article.sport ?? article.category}
              </span>
            )}
            {article.publishedAt && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {timeAgo(article.publishedAt)}
              </span>
            )}
            {minRead && (
              <span
                className="flex items-center gap-1 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5 }}>
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M6 3.5v2.8l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                {minRead} min de lectura
              </span>
            )}
            {/* ShareButton: único componente client en esta página */}
            <ShareButton title={article.title} />
          </div>

          {/* Title */}
          <h1
            className="font-black leading-tight mb-3"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.9rem, 4vw, 3rem)',
              color: '#F8F8FF',
              letterSpacing: '-0.01em',
            }}
          >
            {article.title}
          </h1>

          {/* Subtitle */}
          {article.subtitle && (
            <p
              className="text-lg leading-relaxed mb-6"
              style={{ color: '#9090A4', letterSpacing: '-0.01em' }}
            >
              {article.subtitle}
            </p>
          )}

          {/* Hero image */}
          {imgUrl && (
            <div className="relative w-full rounded-2xl overflow-hidden mb-8" style={{ height: 420 }}>
              <Image src={imgUrl} alt={article.title} fill className="object-cover" priority />
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top,rgba(9,9,15,0.25) 0%,transparent 60%)' }}
              />
            </div>
          )}

          {/* Summary */}
          {article.short_summary && (
            <p
              className="text-base leading-relaxed mb-6 pl-4"
              style={{ color: '#B0B0CC', borderLeft: '3px solid #7C3AED' }}
            >
              {article.short_summary}
            </p>
          )}

          <div className="mb-6" style={{ height: 1, background: 'var(--border)' }} />

          {/* Body */}
          {paragraphs.length > 0 ? (
            <div className="flex flex-col gap-5">
              {paragraphs.map((p, i) => (
                <p key={i} className="text-base leading-relaxed" style={{ color: '#C0C0D4' }}>
                  {p}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
              Contenido completo próximamente.
            </p>
          )}

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-10">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-3 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Source */}
          {article.source_name && (
            <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Fuente:{' '}
                {article.source_url ? (
                  <a
                    href={article.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70 transition-opacity"
                    style={{ color: '#7C3AED' }}
                  >
                    {article.source_name}
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>{article.source_name}</span>
                )}
              </p>
            </div>
          )}
        </article>

        {/* ── Siguiente artículo ── */}
        {nextArticle && (
          <div className="max-w-3xl mt-12">
            <div
              className="pt-8"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                Siguiente artículo
              </p>
              <Link
                href={`/article/${nextArticle._id}`}
                className="news-card flex gap-4 rounded-2xl p-4"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  textDecoration: 'none',
                }}
              >
                {nextArticle.image?.asset && (
                  <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 120, height: 80 }}>
                    <Image
                      src={urlFor(nextArticle.image).width(240).height(160).url()}
                      alt={nextArticle.title}
                      width={120}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex flex-col justify-center flex-1 min-w-0">
                  {(nextArticle.sport || nextArticle.category) && (
                    <span className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}>
                      {nextArticle.sport ?? nextArticle.category}
                    </span>
                  )}
                  <h3 className="news-title text-sm font-semibold leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                    {nextArticle.title}
                  </h3>
                  {nextArticle.publishedAt && (
                    <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-faint)' }}>
                      {timeAgo(nextArticle.publishedAt)}
                    </p>
                  )}
                </div>
                <div className="flex items-center flex-shrink-0" style={{ color: '#7C3AED' }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* ── Artículos relacionados ── */}
        {relatedFinal.length > 0 && (
          <div className="max-w-3xl mt-14">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="section-accent" />
              <h2 className="section-label">También te puede interesar</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {relatedFinal.map((rel) => {
                const relImg = rel.image?.asset
                  ? urlFor(rel.image).width(400).height(220).url()
                  : null
                return (
                  <Link
                    key={rel._id}
                    href={`/article/${rel._id}`}
                    className="news-card rounded-xl overflow-hidden block"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', textDecoration: 'none' }}
                  >
                    <div className="overflow-hidden" style={{ height: 120, background: 'linear-gradient(145deg,#1a1a2e,#120820)' }}>
                      {relImg && (
                        <Image src={relImg} alt={rel.title} width={400} height={120} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="p-3">
                      {(rel.sport || rel.category) && (
                        <span
                          className="text-[9px] font-black uppercase tracking-widest"
                          style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}
                        >
                          {rel.sport ?? rel.category}
                        </span>
                      )}
                      <h3
                        className="news-title text-xs font-semibold leading-snug line-clamp-2 mt-0.5"
                        style={{ color: '#F0F0F5' }}
                      >
                        {rel.title}
                      </h3>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

      </main>

      <ScrollToTop />
    </div>
  )
}
