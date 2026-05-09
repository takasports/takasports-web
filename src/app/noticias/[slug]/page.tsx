import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from '@/components/DynamicImage'
import Link from 'next/link'
import { PortableText } from '@portabletext/react'
import { sanityClient, articleDetailQuery, relatedArticlesQuery, nextArticleQuery, urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ShareButton from '@/app/article/[id]/ShareButton'
import BackButton from '@/app/article/[id]/BackButton'
import ScrollToTop from '@/components/ScrollToTop'
import ReadingProgress from '@/app/article/[id]/ReadingProgress'
import ReadTracker from '@/app/article/[id]/ReadTracker'
import { SITE_URL, LOGO_URL, ICON_URL } from '@/lib/constants'

export const revalidate = 3600

// Pre-build los 50 artículos más recientes para LCP/INP estables en CrUX.
// Los demás se generan ISR on-demand.
export async function generateStaticParams() {
  const slugs = await sanityClient
    .fetch<Array<{ slug: string }>>(
      `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && defined(slug.current)] | order(publishedAt desc)[0...50] {
        "slug": slug.current
      }`,
    )
    .catch(() => [] as Array<{ slug: string }>)
  return slugs.filter(s => s.slug).map(s => ({ slug: s.slug }))
}

function readingTime(body?: string | null): number | null {
  if (!body || body.trim().length === 0) return null
  const words = body.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

interface FaqItem { q: string; a: string }
interface SourceRef { name?: string; url?: string }

interface RelatedArticle {
  _id: string
  slug?: string
  title: string
  publishedAt?: string
  sport?: string
  category?: string
  takaStatus?: string | null
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
}

interface Article {
  _id: string
  _updatedAt?: string
  slug?: string
  title: string
  subtitle?: string
  bodyText?: string
  bodyPortable?: Array<{ _type: string; _key?: string; [key: string]: unknown }>
  short_summary?: string
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
  imageAlt?: string | null
  isTaka?: boolean
  author?: string | null
  takaStatus?: string | null
  category?: string
  sport?: string
  tags?: string[]
  source_name?: string
  source_url?: string
  publishedAt?: string
  tldr?: string[] | null
  faq?: FaqItem[] | null
  focusKeyword?: string | null
  secondaryKeywords?: string[] | null
  sourceUrls?: SourceRef[] | null
  editorialRelated?: RelatedArticle[] | null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await sanityClient.fetch<Article>(articleDetailQuery, { id: slug })
  if (!article) return { title: 'TakaSports' }

  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(1200).height(630).url() : undefined)
  const canonical = `${SITE_URL}/noticias/${article.slug ?? slug}`

  return {
    title: article.title,
    description: article.short_summary ?? article.subtitle,
    alternates: { canonical },
    openGraph: {
      title: article.title,
      description: article.short_summary ?? article.subtitle,
      url: canonical,
      images: imgUrl ? [{ url: imgUrl, width: 1200, height: 630 }] : [],
      type: 'article',
      publishedTime: article.publishedAt,
      siteName: 'TakaSports',
      locale: 'es_ES',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.short_summary ?? article.subtitle,
      images: imgUrl ? [imgUrl] : [],
      site: '@takasportsx',
      creator: '@takasportsx',
    },
  }
}

function renderBodyBlock(text: string, i: number) {
  if (/^\*\*(.+)\*\*$/.test(text)) {
    const heading = text.slice(2, -2)
    return (
      <h3
        key={i}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.3rem',
          fontWeight: 800,
          color: '#E8E8F4',
          letterSpacing: '-0.01em',
          marginTop: '1.75rem',
          marginBottom: '-0.5rem',
        }}
      >
        {heading}
      </h3>
    )
  }
  return (
    <p key={i} style={{ color: '#B8B8D0', fontSize: '1.125rem', lineHeight: 1.8 }}>
      {text}
    </p>
  )
}

function StatusBadge({ status, accent }: { status: string; accent: string }) {
  if (status === 'breaking') {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full animate-pulse"
        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', fontFamily: 'var(--font-sport)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Breaking
      </span>
    )
  }
  if (status === 'featured') {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
        style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}35`, fontFamily: 'var(--font-sport)' }}
      >
        ⭐ Destacado
      </span>
    )
  }
  return null
}

function ArticleSidebar({
  article,
  badgeColor,
  badgeBg,
  badgeBorder,
  nextArticle,
  related,
}: {
  article: Article
  badgeColor: string
  badgeBg: string
  badgeBorder: string
  nextArticle: (RelatedArticle & { short_summary?: string }) | null
  related: RelatedArticle[]
}) {
  return (
    <aside className="hidden lg:flex flex-col gap-6 sticky top-20 self-start">

      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex flex-col gap-3">
          {article.publishedAt && (
            <div className="flex items-start gap-2.5">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ opacity: 0.4, flexShrink: 0, marginTop: 2 }}>
                <rect x="1" y="2" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M4 1v2M9 1v2M1 5h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <div>
                <p className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(article.publishedAt).toLocaleDateString('es-ES', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                  {timeAgo(article.publishedAt)}
                </p>
              </div>
            </div>
          )}

          {article.author && (
            <div className="flex items-center gap-2.5">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}>
                <circle cx="6.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M1.5 11.5c0-2.485 2.239-4.5 5-4.5s5 2.015 5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{article.author}</p>
            </div>
          )}

          {article.source_name && (
            <div className="flex items-center gap-2.5">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ opacity: 0.4 }}>
                <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M6.5 4v3l2 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              {article.source_url ? (
                <a
                  href={article.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] hover:opacity-70 transition-opacity"
                  style={{ color: badgeColor }}
                >
                  {article.source_name}
                </a>
              ) : (
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{article.source_name}</p>
              )}
            </div>
          )}
        </div>

        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            {article.tags.map((tag) => (
              <Link
                key={tag}
                href={`/tag/${encodeURIComponent(tag)}`}
                className="text-[10px] px-2.5 py-1 rounded-full transition-colors hover:border-purple-500/40 hover:text-purple-300"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)', textDecoration: 'none' }}
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <ShareButton title={article.title} />
        </div>
      </div>

      {nextArticle && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
            Siguiente
          </p>
          <Link
            href={`/noticias/${nextArticle.slug ?? nextArticle._id}`}
            className="news-card flex gap-3 rounded-xl p-3 block"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', textDecoration: 'none' }}
          >
            {(nextArticle.imageUrl || nextArticle.image?.asset) && (
              <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 72, height: 52 }}>
                <Image
                  src={nextArticle.imageUrl ?? urlFor(nextArticle.image!).width(144).height(104).url()}
                  alt={nextArticle.title}
                  width={72}
                  height={52}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex flex-col justify-center min-w-0">
              {(nextArticle.sport || nextArticle.category) && (
                <span className="text-[9px] font-black uppercase tracking-widest mb-0.5"
                  style={{ color: getSportStyle(nextArticle.sport, nextArticle.category).accent, fontFamily: 'var(--font-sport)' }}>
                  {getSportLabel(nextArticle.sport, nextArticle.category)}
                </span>
              )}
              <h3 className="news-title text-xs font-semibold leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                {nextArticle.title}
              </h3>
            </div>
          </Link>
        </div>
      )}

      {related.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
            También te puede interesar
          </p>
          <div className="flex flex-col gap-2">
            {related.map((rel) => {
              const relImg = rel.imageUrl ?? (rel.image?.asset ? urlFor(rel.image).width(200).height(120).url() : null)
              const { accent } = getSportStyle(rel.sport, rel.category)
              return (
                <Link
                  key={rel._id}
                  href={`/noticias/${rel.slug ?? rel._id}`}
                  className="news-card flex gap-3 rounded-xl p-3"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', textDecoration: 'none' }}
                >
                  {relImg && (
                    <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 72, height: 52 }}>
                      <Image src={relImg} alt={rel.title} width={72} height={52} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
                      {getSportLabel(rel.sport, rel.category)}
                    </span>
                    <h3 className="news-title text-xs font-semibold leading-snug line-clamp-2 mt-0.5" style={{ color: 'var(--text-primary)' }}>
                      {rel.title}
                    </h3>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

    </aside>
  )
}

export default async function NoticiaPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const id = slug

  const article = await sanityClient.fetch<Article>(articleDetailQuery, { id })
  if (!article) return notFound()

  // Usar picks editoriales si existen; si no, query dinámica por sport/category
  const [relatedFinal, nextArticle] = await Promise.all([
    article.editorialRelated && article.editorialRelated.length > 0
      ? Promise.resolve(article.editorialRelated)
      : sanityClient
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

  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(1400).height(600).url() : null)
  const canonical = `${SITE_URL}/noticias/${article.slug ?? id}`

  // Google News / Top Stories prioriza artículos con imágenes en 16:9, 4:3 y 1:1
  function multiRatioImages(): string[] | undefined {
    if (article.image?.asset) {
      return [
        urlFor(article.image).width(1200).height(675).url(), // 16:9
        urlFor(article.image).width(1200).height(900).url(), // 4:3
        urlFor(article.image).width(1200).height(1200).url(), // 1:1
      ]
    }
    return imgUrl ? [imgUrl] : undefined
  }
  const articleImages = multiRatioImages()

  function bodyWordCount(): number | undefined {
    if (article.bodyText) return article.bodyText.trim().split(/\s+/).length
    if (article.bodyPortable && article.bodyPortable.length > 0) {
      const text = article.bodyPortable
        .filter((b) => b._type === 'block' && Array.isArray(b.children))
        .flatMap((b) => (b.children as Array<{ _type: string; text?: string }>))
        .filter((c) => c._type === 'span')
        .map((c) => c.text ?? '')
        .join(' ')
      return text.trim().split(/\s+/).length
    }
    return undefined
  }

  const articleAuthor = article.author ?? 'Redacción TakaSports'

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.short_summary ?? undefined,
    image: articleImages,
    datePublished: article.publishedAt,
    dateModified: article._updatedAt ?? article.publishedAt,
    inLanguage: 'es-ES',
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    keywords: [article.focusKeyword, ...(article.secondaryKeywords ?? []), ...(article.tags ?? [])]
      .filter(Boolean)
      .join(', ') || undefined,
    articleSection: article.category ?? undefined,
    wordCount: bodyWordCount(),
    articleBody: (() => {
      if (article.bodyText) return article.bodyText.slice(0, 500) || undefined
      if (article.bodyPortable) {
        const text = article.bodyPortable
          .filter((b) => b._type === 'block' && Array.isArray(b.children))
          .flatMap((b) => (b.children as Array<{ _type: string; text?: string }>))
          .filter((c) => c._type === 'span')
          .map((c) => c.text ?? '')
          .join(' ')
        return text.slice(0, 500) || undefined
      }
      return undefined
    })(),
    isAccessibleForFree: true,
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '[aria-label="Claves rápidas"]'],
    },
    author: {
      '@type': 'Person',
      name: articleAuthor,
      worksFor: { '@type': 'Organization', name: 'TakaSports', url: SITE_URL },
    },
    publisher: {
      '@type': 'Organization',
      name: 'TakaSports',
      logo: { '@type': 'ImageObject', url: ICON_URL },
    },
  }

  const sportSlug = article.sport ?? null
  const sportLabel = sportSlug ? getSportLabel(sportSlug, article.category) : null
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Noticias', item: `${SITE_URL}/noticias` },
      ...(sportSlug && sportLabel
        ? [{ '@type': 'ListItem', position: 3, name: sportLabel, item: `${SITE_URL}/${sportSlug}` }]
        : []),
      {
        '@type': 'ListItem',
        position: sportSlug ? 4 : 3,
        name: article.title,
        item: canonical,
      },
    ],
  }

  const faqJsonLd = article.faq && article.faq.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: article.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  } : null

  const paragraphs = article.bodyText
    ? article.bodyText.split('\n').filter((p) => p.trim().length > 0)
    : []

  const wc = bodyWordCount()
  const minRead = wc ? Math.max(1, Math.round(wc / 200)) : readingTime(article.bodyText)
  const { accent } = getSportStyle(article.sport, article.category)
  const badgeColor = accent
  const badgeBg = `${badgeColor}18`
  const badgeBorder = `${badgeColor}30`

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}
      <ReadingProgress accent={accent} />
      <ReadTracker item={{
        slug: article.slug ?? id,
        title: article.title,
        sport: article.sport,
        category: article.category,
        publishedAt: article.publishedAt,
        imageUrl: (imgUrl as string | undefined) ?? undefined,
      }} />
      <Header />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-20">
        <div className="lg:grid lg:gap-12 lg:items-start mx-auto" style={{ gridTemplateColumns: 'minmax(0,1fr) 268px', maxWidth: 1160 }}>

          <div className="pt-6 pb-5 lg:col-span-2 flex items-center gap-3">
            <BackButton />
            {sportSlug && sportLabel && (
              <nav className="hidden sm:flex items-center gap-1.5 text-[11px] min-w-0" aria-label="Breadcrumb">
                <Link href="/" className="hover:opacity-70 transition-opacity flex-shrink-0" style={{ color: 'var(--text-faint)', textDecoration: 'none' }}>
                  TakaSports
                </Link>
                <span style={{ color: 'var(--text-faint)' }}>/</span>
                <Link href={`/${sportSlug}`} className="hover:opacity-70 transition-opacity flex-shrink-0 font-semibold" style={{ color: accent, textDecoration: 'none' }}>
                  {sportLabel}
                </Link>
                <span style={{ color: 'var(--text-faint)' }}>/</span>
                <span className="truncate" style={{ color: 'var(--text-muted)' }}>{article.title}</span>
              </nav>
            )}
          </div>

          <article>

            <div className="flex items-center justify-between gap-2 mb-4 lg:hidden">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                {article.takaStatus && article.takaStatus !== 'normal' && (
                  <StatusBadge status={article.takaStatus} accent={badgeColor} />
                )}
                {(article.sport || article.category) && (
                  <span
                    className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full flex-shrink-0"
                    style={{ background: badgeBg, color: badgeColor, border: `1px solid ${badgeBorder}`, fontFamily: 'var(--font-sport)' }}
                  >
                    {getSportLabel(article.sport, article.category)}
                  </span>
                )}
                {article.publishedAt && (
                  <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {timeAgo(article.publishedAt)}
                  </span>
                )}
                {minRead && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontFamily: 'var(--font-sport)' }}
                  >
                    {minRead} min
                  </span>
                )}
              </div>
              <ShareButton title={article.title} />
            </div>

            <div className="hidden lg:flex items-center gap-3 mb-4">
              {article.takaStatus && article.takaStatus !== 'normal' && (
                <StatusBadge status={article.takaStatus} accent={badgeColor} />
              )}
              {(article.sport || article.category) && (
                <span
                  className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full"
                  style={{ background: badgeBg, color: badgeColor, border: `1px solid ${badgeBorder}`, fontFamily: 'var(--font-sport)' }}
                >
                  {getSportLabel(article.sport, article.category)}
                </span>
              )}
              {minRead && (
                <span
                  className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontFamily: 'var(--font-sport)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.6 }}>
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M6 3.5v2.8l1.8 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  {minRead} min de lectura
                </span>
              )}
            </div>

            <h1
              className="font-black leading-tight mb-3"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.75rem, 5vw, 3rem)',
                color: '#F8F8FF',
                letterSpacing: '-0.015em',
              }}
            >
              {article.title}
            </h1>

            {article.subtitle && (
              <p
                className="leading-relaxed mb-6"
                style={{ fontSize: '1.25rem', color: '#7A7A96', letterSpacing: '-0.015em', fontWeight: 400 }}
              >
                {article.subtitle}
              </p>
            )}

            {imgUrl && (
              <div
                className="relative w-full rounded-2xl overflow-hidden mb-8"
                style={{ height: 'clamp(240px, 52vw, 480px)' }}
              >
                <Image src={imgUrl} alt={article.imageAlt ?? article.title} fill className="object-cover" priority sizes="(max-width: 768px) 100vw, 850px" />
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top,rgba(9,9,15,0.2) 0%,transparent 50%)' }}
                />
              </div>
            )}

            {article.tldr && article.tldr.length > 0 && (
              <aside
                className="mb-8 rounded-2xl p-5"
                style={{
                  background: `linear-gradient(135deg, ${badgeColor}10, ${badgeColor}05)`,
                  border: `1px solid ${badgeBorder}`,
                  maxWidth: 680,
                }}
                aria-label="Claves rápidas"
              >
                <p
                  className="text-[10px] font-black uppercase tracking-widest mb-3"
                  style={{ color: badgeColor, fontFamily: 'var(--font-sport)' }}
                >
                  Claves en 30 segundos
                </p>
                <ul className="flex flex-col gap-2">
                  {article.tldr.map((item, i) => (
                    <li key={i} className="flex gap-2.5" style={{ color: '#D4D4E5', fontSize: '0.95rem', lineHeight: 1.55 }}>
                      <span style={{ color: badgeColor, flexShrink: 0, fontWeight: 800 }}>›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            )}

            {article.short_summary && (
              <p
                className="leading-relaxed mb-8 pl-5"
                style={{
                  fontSize: '1.125rem',
                  color: '#B0B0CC',
                  borderLeft: `3px solid ${badgeColor}`,
                  fontStyle: 'italic',
                  maxWidth: 680,
                }}
              >
                {article.short_summary}
              </p>
            )}

            {article.bodyPortable && article.bodyPortable.length > 0 ? (
              <div style={{ maxWidth: 680 }}>
                <PortableText
                  value={article.bodyPortable}
                  components={{
                    types: {
                      image: ({ value }) => {
                        const src = value?.asset ? urlFor(value).width(700).url() : null
                        if (!src) return null
                        return (
                          <figure style={{ margin: '2rem 0' }}>
                            <div style={{ borderRadius: '0.75rem', overflow: 'hidden' }}>
                              <Image
                                src={src}
                                alt={value?.alt ?? ''}
                                width={700}
                                height={420}
                                className="w-full h-auto object-cover"
                              />
                            </div>
                            {value?.caption && (
                              <figcaption style={{ fontSize: '0.8rem', color: '#6A6A8A', marginTop: '0.5rem', textAlign: 'center', fontStyle: 'italic' }}>
                                {value.caption}
                              </figcaption>
                            )}
                          </figure>
                        )
                      },
                    },
                    block: {
                      normal: ({ children }) => (
                        <p style={{ color: '#B8B8D0', fontSize: '1.125rem', lineHeight: 1.8, marginBottom: '1.5rem' }}>{children}</p>
                      ),
                      h1: ({ children }) => (
                        <h1 style={{ color: '#E8E8F4', fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.015em', marginTop: '2rem', marginBottom: '0.75rem' }}>{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 style={{ color: '#E8E8F4', fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', marginTop: '1.75rem', marginBottom: '0.5rem' }}>{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 style={{ color: '#E8E8F4', fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginTop: '1.5rem', marginBottom: '0.5rem' }}>{children}</h3>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote style={{ borderLeft: `3px solid ${badgeColor}`, paddingLeft: '1rem', color: '#8A8AA8', fontStyle: 'italic', margin: '1.5rem 0' }}>{children}</blockquote>
                      ),
                    },
                    marks: {
                      strong: ({ children }) => <strong style={{ color: '#E8E8F4', fontWeight: 700 }}>{children}</strong>,
                      em: ({ children }) => <em style={{ color: '#C4B5FD' }}>{children}</em>,
                      link: ({ value, children }) => (
                        <a href={value?.href} target="_blank" rel="noopener noreferrer" style={{ color: '#8B5CF6', textDecoration: 'underline' }}>{children}</a>
                      ),
                    },
                    list: {
                      bullet: ({ children }) => <ul style={{ color: '#B8B8D0', paddingLeft: '1.5rem', marginBottom: '1rem', listStyleType: 'disc' }}>{children}</ul>,
                      number: ({ children }) => <ol style={{ color: '#B8B8D0', paddingLeft: '1.5rem', marginBottom: '1rem', listStyleType: 'decimal' }}>{children}</ol>,
                    },
                    listItem: {
                      bullet: ({ children }) => <li style={{ marginBottom: '0.35rem', lineHeight: 1.7 }}>{children}</li>,
                      number: ({ children }) => <li style={{ marginBottom: '0.35rem', lineHeight: 1.7 }}>{children}</li>,
                    },
                  }}
                />
              </div>
            ) : paragraphs.length > 0 ? (
              <div className="flex flex-col gap-6" style={{ maxWidth: 680 }}>
                {paragraphs.map((p, i) => renderBodyBlock(p, i))}
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--text-muted)', maxWidth: 680 }}>
                Contenido completo próximamente.
              </p>
            )}

            <div className="lg:hidden">
              {article.tags && article.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-10">
                  {article.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/tag/${encodeURIComponent(tag)}`}
                      className="text-xs px-3 py-1 rounded-full transition-colors hover:border-purple-500/40 hover:text-purple-300"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)', textDecoration: 'none' }}
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              )}
              {article.author && (
                <div className="mt-6 pt-6 flex items-center gap-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ opacity: 0.35, flexShrink: 0 }}>
                    <circle cx="6.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M1.5 11.5c0-2.485 2.239-4.5 5-4.5s5 2.015 5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{article.author}</p>
                </div>
              )}
              {article.source_name && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Fuente:{' '}
                    {article.source_url ? (
                      <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity" style={{ color: badgeColor }}>
                        {article.source_name}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>{article.source_name}</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="lg:hidden">
              {nextArticle && (
                <div className="mt-12 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                    Siguiente artículo
                  </p>
                  <Link
                    href={`/noticias/${nextArticle.slug ?? nextArticle._id}`}
                    className="news-card flex gap-4 rounded-2xl p-4"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', textDecoration: 'none' }}
                  >
                    {(nextArticle.imageUrl || nextArticle.image?.asset) && (
                      <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 100, height: 70 }}>
                        <Image src={nextArticle.imageUrl ?? urlFor(nextArticle.image!).width(200).height(140).url()} alt={nextArticle.title} width={100} height={70} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex flex-col justify-center flex-1 min-w-0">
                      {(nextArticle.sport || nextArticle.category) && (
                        <span className="text-[9px] font-black uppercase tracking-widest mb-1"
                          style={{ color: getSportStyle(nextArticle.sport, nextArticle.category).accent, fontFamily: 'var(--font-sport)' }}>
                          {getSportLabel(nextArticle.sport, nextArticle.category)}
                        </span>
                      )}
                      <h3 className="news-title text-sm font-semibold leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                        {nextArticle.title}
                      </h3>
                    </div>
                    <div className="flex items-center flex-shrink-0" style={{ color: '#7C3AED' }}>
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </Link>
                </div>
              )}

              {relatedFinal.length > 0 && (
                <div className="mt-10">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="section-accent" />
                    <h2 className="section-label">También te puede interesar</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {relatedFinal.map((rel) => {
                      const relImg = rel.imageUrl ?? (rel.image?.asset ? urlFor(rel.image).width(400).height(220).url() : null)
                      const { accent: relAccent } = getSportStyle(rel.sport, rel.category)
                      return (
                        <Link key={rel._id} href={`/noticias/${rel.slug ?? rel._id}`}
                          className="news-card rounded-xl overflow-hidden block"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', textDecoration: 'none' }}>
                          <div className="overflow-hidden" style={{ height: 110, background: 'linear-gradient(145deg,#1a1a2e,#120820)' }}>
                            {relImg && <Image src={relImg} alt={rel.title} width={400} height={110} className="w-full h-full object-cover" />}
                          </div>
                          <div className="p-3">
                            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: relAccent, fontFamily: 'var(--font-sport)' }}>
                              {getSportLabel(rel.sport, rel.category)}
                            </span>
                            <h3 className="news-title text-xs font-semibold leading-snug line-clamp-2 mt-0.5" style={{ color: '#F0F0F5' }}>
                              {rel.title}
                            </h3>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

          </article>

          <ArticleSidebar
            article={article}
            badgeColor={badgeColor}
            badgeBg={badgeBg}
            badgeBorder={badgeBorder}
            nextArticle={nextArticle}
            related={relatedFinal}
          />

        </div>

        {nextArticle && (
          <div className="mx-auto mt-16" style={{ maxWidth: 1160 }}>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2.5rem' }}>
              <p
                className="text-[10px] font-black uppercase tracking-widest mb-4"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
              >
                Siguiente artículo
              </p>
              <Link
                href={`/noticias/${nextArticle.slug ?? nextArticle._id}`}
                className="group flex items-center gap-5 rounded-2xl p-4 transition-all hover:brightness-110"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', textDecoration: 'none' }}
              >
                {(nextArticle.imageUrl || nextArticle.image?.asset) && (
                  <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 120, height: 80 }}>
                    <Image
                      src={nextArticle.imageUrl ?? urlFor(nextArticle.image!).width(240).height(160).url()}
                      alt={nextArticle.title}
                      width={120}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {(nextArticle.sport || nextArticle.category) && (
                    <span
                      className="text-[9px] font-black uppercase tracking-widest block mb-1"
                      style={{ color: getSportStyle(nextArticle.sport, nextArticle.category).accent, fontFamily: 'var(--font-sport)' }}
                    >
                      {getSportLabel(nextArticle.sport, nextArticle.category)}
                    </span>
                  )}
                  <h3
                    className="font-black leading-snug line-clamp-2"
                    style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 2vw, 1.25rem)' }}
                  >
                    {nextArticle.title}
                  </h3>
                </div>
                <div className="flex-shrink-0 ml-4 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: '#7C3AED' }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M5 11h12M12 5l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </Link>
            </div>
          </div>
        )}

        {sportSlug && sportLabel && (
          <div className="mx-auto mt-10 mb-4" style={{ maxWidth: 1160 }}>
            <Link
              href={`/${sportSlug}`}
              className="group flex items-center justify-between gap-4 rounded-2xl px-6 py-4 transition-all hover:brightness-110"
              style={{ background: `linear-gradient(135deg, ${badgeColor}12, ${badgeColor}06)`, border: `1px solid ${badgeBorder}`, textDecoration: 'none' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: badgeColor, fontFamily: 'var(--font-sport)' }}>
                  Más sobre
                </span>
                <span className="font-black text-sm" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
                  {sportLabel}
                </span>
              </div>
              <svg className="flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: badgeColor }}>
                <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        )}

      </main>

      <Footer />
      <ScrollToTop />
    </div>
  )
}
