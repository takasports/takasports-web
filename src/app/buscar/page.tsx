import type { Metadata } from 'next'
import Link from 'next/link'
import Image from '@/components/DynamicImage'
import { sanityClient, urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import { SITE_URL } from '@/lib/constants'

export const revalidate = 0

interface SearchArticle {
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

const searchQuery = `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && (
  title match $q || headline match $q || short_summary match $q || metaDescription match $q
)] | order(publishedAt desc)[0...40] {
  _id, "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "short_summary": select(defined(headline) => metaDescription, short_summary),
  "imageUrl": select(defined(headline) => imageUrl, null),
  "image": select(defined(headline) => mainImage, image),
  publishedAt, sport,
  "category": select(defined(headline) => competition, category)
}`

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}): Promise<Metadata> {
  const { q } = await searchParams
  const title = q ? `Búsqueda: "${q}"` : 'Buscar noticias'
  return {
    title,
    description: 'Busca noticias, análisis y resultados en TakaSports.',
    alternates: { canonical: `${SITE_URL}/buscar` },
    robots: { index: false },
  }
}

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  const results: SearchArticle[] = query.length >= 2
    ? await sanityClient.fetch<SearchArticle[]>(searchQuery, { q: `${query}*` }).catch(() => [])
    : []

  const searchJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SearchResultsPage',
    name: `Búsqueda: ${query}`,
    url: `${SITE_URL}/buscar?q=${encodeURIComponent(query)}`,
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      {query && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(searchJsonLd) }} />
      )}
      <Header />

      <main className="max-w-[1440px] mx-auto px-6 xl:px-10 py-10 pb-24" style={{ maxWidth: 900 }}>
        <h1
          className="font-black mb-2"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', color: '#F8F8FF', letterSpacing: '-0.015em' }}
        >
          Buscar
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          Noticias, análisis y resultados
        </p>

        {/* Search form */}
        <form method="GET" action="/buscar" className="mb-10">
          <div className="relative">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Buscar noticias…"
              autoFocus
              className="w-full rounded-2xl px-5 py-4 pr-14 text-base outline-none"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '1rem',
              }}
            />
            <button
              type="submit"
              className="absolute right-4 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Buscar"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: 'var(--text-primary)' }}>
                <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </form>

        {/* Results */}
        {query.length >= 2 ? (
          results.length > 0 ? (
            <div>
              <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                {results.length} resultado{results.length !== 1 ? 's' : ''} para <strong style={{ color: 'var(--text-secondary)' }}>&ldquo;{query}&rdquo;</strong>
              </p>
              <div className="flex flex-col gap-3">
                {results.map((article) => {
                  const img = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(320).height(200).url() : null)
                  const { accent } = getSportStyle(article.sport, article.category)
                  const href = `/noticias/${article.slug ?? article._id}`
                  return (
                    <Link
                      key={article._id}
                      href={href}
                      className="news-card flex gap-4 rounded-2xl p-4"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', textDecoration: 'none' }}
                    >
                      {img && (
                        <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 96, height: 68 }}>
                          <Image src={img} alt={article.title} width={96} height={68} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex flex-col justify-center min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {(article.sport || article.category) && (
                            <span className="text-[9px] font-black uppercase tracking-widest flex-shrink-0"
                              style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
                              {getSportLabel(article.sport, article.category)}
                            </span>
                          )}
                          {article.publishedAt && (
                            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                              {timeAgo(article.publishedAt)}
                            </span>
                          )}
                        </div>
                        <h2 className="news-title text-sm font-semibold leading-snug line-clamp-2 mb-1" style={{ color: 'var(--text-primary)' }}>
                          {article.title}
                        </h2>
                        {article.short_summary && (
                          <p className="text-xs line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                            {article.short_summary}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-4xl mb-4">🔍</p>
              <p className="font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                Sin resultados para &ldquo;{query}&rdquo;
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Prueba con otras palabras o navega por deporte desde la portada.
              </p>
            </div>
          )
        ) : query.length > 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Escribe al menos 2 caracteres para buscar.
          </p>
        ) : null}
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  )
}
