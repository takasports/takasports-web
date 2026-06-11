import type { Metadata } from 'next'
import Link from 'next/link'
import Image from '@/components/DynamicImage'
import { sanityClient, urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import ScrollToTop from '@/components/ScrollToTop'
import { SITE_URL } from '@/lib/constants'

// Búsqueda cachea 60s por query: la mayoría de hits son del mismo término
// (Google indexa, usuarios repiten). 60s da freshness razonable y evita
// que cada hit invoque la función.
export const revalidate = 60

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

type RangeKey = '24h' | '7d' | '30d'

const SPORT_FACETS: Array<{ slug: string; label: string }> = [
  { slug: 'futbol', label: 'Fútbol' },
  { slug: 'baloncesto', label: 'Baloncesto' },
  { slug: 'formula1', label: 'F1' },
  { slug: 'ufc', label: 'UFC' },
  { slug: 'tenis', label: 'Tenis' },
  { slug: 'wwe', label: 'WWE' },
  { slug: 'rugby', label: 'Rugby' },
]

const RANGE_FACETS: Array<{ key: RangeKey; label: string; ms: number }> = [
  { key: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: '7 días', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: '30d', label: '30 días', ms: 30 * 24 * 60 * 60 * 1000 },
]

function buildSearchQuery(params: { sport?: string; range?: RangeKey }) {
  const filters: string[] = []
  if (params.sport) filters.push('(sport == $sport || category == $sport)')
  if (params.range) filters.push('publishedAt >= $fromDate')
  const filterStr = filters.length ? ' && ' + filters.join(' && ') : ''

  return `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**')))) && (
    title match $q || headline match $q || short_summary match $q || metaDescription match $q
  )${filterStr}] | order(publishedAt desc)[0...40] {
    _id, "slug": slug.current,
    "title": select(defined(headline) => headline, title),
    "short_summary": select(defined(headline) => metaDescription, short_summary),
    "imageUrl": select(defined(headline) => imageUrl, null),
    "image": select(defined(headline) => mainImage, image),
    publishedAt, sport,
    "category": select(defined(headline) => competition, category)
  }`
}

function buildHref(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const merged = { ...base, ...patch }
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(merged)) {
    if (v && v.length > 0) sp.set(k, v)
  }
  const qs = sp.toString()
  return qs ? `/buscar?${qs}` : '/buscar'
}

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
  searchParams: Promise<{ q?: string; sport?: string; range?: string }>
}) {
  const sp = await searchParams
  const query = sp.q?.trim() ?? ''
  const sportFilter = sp.sport && SPORT_FACETS.some(s => s.slug === sp.sport) ? sp.sport : undefined
  const rangeFilter = (RANGE_FACETS.find(r => r.key === sp.range)?.key) as RangeKey | undefined

  const queryParams: Record<string, string> = { q: `${query}*` }
  if (sportFilter) queryParams.sport = sportFilter
  if (rangeFilter) {
    const cutoff = RANGE_FACETS.find(r => r.key === rangeFilter)!.ms
    queryParams.fromDate = new Date(Date.now() - cutoff).toISOString()
  }

  const results: SearchArticle[] = query.length >= 2
    ? await sanityClient
        .fetch<SearchArticle[]>(buildSearchQuery({ sport: sportFilter, range: rangeFilter }), queryParams)
        .catch(() => [])
    : []

  const baseParams = { q: query || undefined, sport: sportFilter, range: rangeFilter }
  const hasFilter = Boolean(sportFilter || rangeFilter)

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

      <div className="mx-auto px-4 sm:px-6 xl:px-10 py-10 pb-24" style={{ maxWidth: 900 }}>
        <h1
          className="font-black mb-2"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', color: '#F8F8FF', letterSpacing: '-0.015em' }}
        >
          Buscar
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          Noticias, análisis y resultados
        </p>

        {/* Search form — preserva filtros activos como hidden inputs */}
        <form method="GET" action="/buscar" className="mb-6">
          <div className="relative">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Buscar noticias…"
              autoFocus
              className="w-full rounded-2xl px-5 py-4 pr-14 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '1rem',
              }}
            />
            {sportFilter && <input type="hidden" name="sport" value={sportFilter} />}
            {rangeFilter && <input type="hidden" name="range" value={rangeFilter} />}
            <button
              type="submit"
              className="absolute right-4 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)] rounded-md"
              aria-label="Buscar"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: 'var(--text-primary)' }}>
                <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </form>

        {/* Facetas: deporte + rango temporal */}
        {query.length >= 2 && (
          <div className="flex flex-col gap-3 mb-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="section-label" style={{ marginRight: 6 }}>Deporte</span>
              <FacetChip
                active={!sportFilter}
                href={buildHref(baseParams, { sport: undefined })}
                label="Todos"
              />
              {SPORT_FACETS.map(s => (
                <FacetChip
                  key={s.slug}
                  active={sportFilter === s.slug}
                  href={buildHref(baseParams, { sport: s.slug })}
                  label={s.label}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="section-label" style={{ marginRight: 6 }}>Cuándo</span>
              <FacetChip
                active={!rangeFilter}
                href={buildHref(baseParams, { range: undefined })}
                label="Todo"
              />
              {RANGE_FACETS.map(r => (
                <FacetChip
                  key={r.key}
                  active={rangeFilter === r.key}
                  href={buildHref(baseParams, { range: r.key })}
                  label={r.label}
                />
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {query.length >= 2 ? (
          results.length > 0 ? (
            <div>
              <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                {results.length} resultado{results.length !== 1 ? 's' : ''} para{' '}
                <strong style={{ color: 'var(--text-secondary)' }}>&ldquo;{query}&rdquo;</strong>
                {hasFilter && (
                  <>
                    {' · '}
                    <Link href={buildHref({ q: query }, { sport: undefined, range: undefined })} style={{ color: 'var(--purple-light)', textDecoration: 'underline' }}>
                      Quitar filtros
                    </Link>
                  </>
                )}
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
              <p className="font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                Sin resultados para &ldquo;{query}&rdquo;
                {hasFilter ? ' con los filtros aplicados' : ''}
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                {hasFilter
                  ? 'Prueba quitando los filtros o cambiando las palabras.'
                  : 'Prueba con otras palabras o navega por deporte desde la portada.'}
              </p>
              {hasFilter && (
                <Link
                  href={buildHref({ q: query }, { sport: undefined, range: undefined })}
                  className="inline-block"
                  style={{
                    fontFamily: 'var(--font-sport)',
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--purple-light)',
                    textDecoration: 'underline',
                  }}
                >
                  Quitar filtros
                </Link>
              )}
            </div>
          )
        ) : query.length > 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Escribe al menos 2 caracteres para buscar.
          </p>
        ) : null}
      </div>

      <ScrollToTop />
    </div>
  )
}

function FacetChip({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 12px',
        borderRadius: 'var(--radius-full)',
        background: active ? 'var(--purple)' : 'rgba(255,255,255,0.05)',
        color: active ? '#fff' : 'var(--text-secondary)',
        border: active ? '1px solid var(--purple)' : '1px solid var(--border)',
        fontFamily: 'var(--font-sport)',
        fontSize: 12,
        fontWeight: active ? 700 : 600,
        letterSpacing: '0.03em',
        textDecoration: 'none',
        transition: 'background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)',
      }}
    >
      {label}
    </Link>
  )
}
