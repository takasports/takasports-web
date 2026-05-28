'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from '@/components/DynamicImage'
import Link from 'next/link'
import { urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { CATEGORY_TO_SLUG, getSportStyle, getSportLabel } from '@/lib/sports'
import SportPlaceholder from '@/components/SportPlaceholder'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import CategoriesFilter from './CategoriesFilter'
import ViewToggle from './ViewToggle'

interface Article {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  category?: string
  sport?: string
  takaStatus?: string | null
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
}

function isNew(publishedAt?: string): boolean {
  if (!publishedAt) return false
  return Date.now() - new Date(publishedAt).getTime() < 7_200_000
}

type DateGroup = 'Hoy' | 'Ayer' | 'Esta semana' | 'Anterior'

function getDateGroup(publishedAt?: string): DateGroup {
  if (!publishedAt) return 'Anterior'
  const diff = Date.now() - new Date(publishedAt).getTime()
  const days = diff / 86_400_000
  if (days < 1) return 'Hoy'
  if (days < 2) return 'Ayer'
  if (days < 7) return 'Esta semana'
  return 'Anterior'
}

function groupByDate(articles: Article[]): { label: DateGroup; items: Article[] }[] {
  const groups: Record<DateGroup, Article[]> = {
    Hoy: [],
    Ayer: [],
    'Esta semana': [],
    Anterior: [],
  }
  for (const a of articles) {
    groups[getDateGroup(a.publishedAt)].push(a)
  }
  const ORDER: DateGroup[] = ['Hoy', 'Ayer', 'Esta semana', 'Anterior']
  return ORDER.filter((l) => groups[l].length > 0).map((l) => ({ label: l, items: groups[l] }))
}


function Thumb({
  url, title, w, h, sport, category,
}: {
  url: string | null; title: string; w: number; h: number; sport?: string; category?: string
}) {
  return url ? (
    <Image src={url} alt={title} width={w} height={h} className="w-full h-full object-cover" />
  ) : (
    <SportPlaceholder sport={sport} category={category} />
  )
}

function DateSeparator({ label }: { label: DateGroup }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span
        className="text-[9px] font-black uppercase tracking-[0.18em] flex-shrink-0"
        style={{ color: '#38384E', fontFamily: 'var(--font-sport)' }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

export default function NewsPageFeed({
  articles,
  initialCategory = 'Todo',
  baseRoute = '/noticias',
  featuredCount = 1,
  hideFilter = false,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}: {
  articles: Article[]
  initialCategory?: string
  baseRoute?: string
  featuredCount?: number
  hideFilter?: boolean
  onLoadMore?: () => void | Promise<void>
  hasMore?: boolean
  loadingMore?: boolean
}) {
  const router = useRouter()
  const [category, setCategory] = useState(initialCategory)
  const [view, setView] = useState<'list' | 'grid'>('list')
  const listRef = useScrollReveal({ threshold: 0, rootMargin: '0px 0px 180px 0px' })
  const gridRef = useScrollReveal({ threshold: 0, rootMargin: '0px 0px 180px 0px' })

  const handleCategorySelect = useCallback(
    (cat: string) => {
      setCategory(cat)
      const slug = CATEGORY_TO_SLUG[cat]
      if (slug) {
        router.replace(`${baseRoute}?sport=${slug}`, { scroll: false })
      } else {
        router.replace(baseRoute, { scroll: false })
      }
    },
    [router, baseRoute],
  )

  // Cuando hideFilter=true el padre ya filtró — usar artículos tal cual
  const activeSlug = CATEGORY_TO_SLUG[category]?.toLowerCase() ?? category.toLowerCase()
  const filtered = hideFilter
    ? articles
    : category === 'Todo'
      ? articles
      : articles.filter((a) => {
          const sportSlug = a.sport?.toLowerCase() ?? ''
          const catSlug = a.category?.toLowerCase() ?? ''
          return sportSlug === activeSlug || catSlug === activeSlug
        })

  // Skip artículos ya mostrados en hero/grid — render TODO el feed,
  // la paginación de histórico la maneja el botón "Cargar más" del padre.
  const feedArticles = filtered.slice(featuredCount)
  const visibleArticles = feedArticles
  const groups = groupByDate(visibleArticles)

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        {!hideFilter && (
          <div className="flex-1 min-w-0 overflow-hidden">
            <CategoriesFilter active={category} onSelect={handleCategorySelect} />
          </div>
        )}
        <div className={`flex items-center gap-3 flex-shrink-0 ${hideFilter ? 'ml-auto' : ''}`}>
          {feedArticles.length > 0 && (
            <span
              className="text-[10px] font-semibold tabular-nums hidden sm:block"
              style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-sport)' }}
            >
              {feedArticles.length} noticias
            </span>
          )}
          <ViewToggle view={view} onToggle={setView} />
        </div>
      </div>

      {/* Empty */}
      {feedArticles.length === 0 && (
        <div className="py-14 flex flex-col items-center gap-3 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No hay noticias en esta categoría todavía.
          </p>
          <button
            onClick={() => handleCategorySelect('Todo')}
            className="text-xs font-semibold px-4 py-2 rounded-full transition-opacity hover:opacity-80"
            style={{
              background: 'rgba(124,58,237,0.15)',
              color: '#C4B5FD',
              border: '1px solid rgba(124,58,237,0.3)',
              fontFamily: 'var(--font-sport)',
              cursor: 'pointer',
            }}
          >
            Ver todas las noticias
          </button>
        </div>
      )}

      {/* LIST — con separadores de fecha */}
      {view === 'list' && feedArticles.length > 0 && (
        <div key={`list-${category}`} ref={listRef} className="feed-animate">
          {groups.map(({ label, items }) => (
            <div key={label}>
              <DateSeparator label={label} />
              <div className="flex flex-col gap-1.5 mb-2">
                {items.map((article) => {
                  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(200).height(130).url() : null)
                  const sportLabel = getSportLabel(article.sport, article.category)
                  const { accent: sportAccent } = getSportStyle(article.sport, article.category)

                  return (
                    <Link
                      key={article._id}
                      href={`/noticias/${article.slug ?? article._id}`}
                      className="news-card flex gap-3.5 rounded-xl p-3"
                      data-reveal
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        textDecoration: 'none',
                      }}
                    >
                      <div className="flex-shrink-0 rounded-lg overflow-hidden w-[88px] h-[64px] lg:w-[112px] lg:h-[80px]">
                        <Thumb
                          url={imgUrl}
                          title={article.title}
                          w={200}
                          h={130}
                          sport={article.sport}
                          category={article.category}
                        />
                      </div>
                      <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            {sportLabel && (
                              <span
                                className="text-[9px] font-black uppercase tracking-widest"
                                style={{ color: sportAccent, fontFamily: 'var(--font-sport)' }}
                              >
                                {sportLabel}
                              </span>
                            )}
                            {isNew(article.publishedAt) && (
                              <span
                                className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                                style={{
                                  background: 'rgba(124,58,237,0.18)',
                                  color: '#A78BFA',
                                  border: '1px solid rgba(124,58,237,0.25)',
                                }}
                              >
                                Nuevo
                              </span>
                            )}
                          </div>
                          <h3
                            className="news-title text-[13px] font-semibold leading-snug line-clamp-2"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {article.title}
                          </h3>
                          {article.short_summary && (
                            <p
                              className="text-[11px] leading-relaxed mt-0.5 line-clamp-1 hidden lg:block"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {article.short_summary}
                            </p>
                          )}
                        </div>
                        {article.publishedAt && (
                          <p className="text-[10px] mt-1" style={{ color: 'var(--text-faint)' }}>
                            {timeAgo(article.publishedAt)}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* GRID — con separadores de fecha */}
      {view === 'grid' && feedArticles.length > 0 && (
        <div key={`grid-${category}`} ref={gridRef} className="feed-animate">
          {groups.map(({ label, items }) => (
            <div key={label} className="mb-3">
              <DateSeparator label={label} />
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-1">
                {items.map((article, idx) => {
                  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(400).height(220).url() : null)
                  const sportLabel = getSportLabel(article.sport, article.category)
                  const { accent } = getSportStyle(article.sport, article.category)
                  // Última card huérfana: ocupa todo el ancho en su grid
                  const isOrphan2 = idx === items.length - 1 && items.length % 2 !== 0
                  const isOrphan3 = idx === items.length - 1 && items.length % 3 === 1

                  return (
                    <Link
                      key={article._id}
                      href={`/noticias/${article.slug ?? article._id}`}
                      className={`news-card rounded-xl overflow-hidden block${isOrphan2 ? ' col-span-2' : ''}${isOrphan3 ? ' lg:col-span-3' : ''}`}
                      data-reveal
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        textDecoration: 'none',
                      }}
                    >
                      <div className="overflow-hidden" style={{ height: 110 }}>
                        <Thumb
                          url={imgUrl}
                          title={article.title}
                          w={400}
                          h={110}
                          sport={article.sport}
                          category={article.category}
                        />
                      </div>
                      <div className="p-3">
                        {sportLabel && (
                          <span
                            className="text-[9px] font-black uppercase tracking-widest"
                            style={{ color: accent, fontFamily: 'var(--font-sport)' }}
                          >
                            {sportLabel}
                          </span>
                        )}
                        <h3
                          className="news-title text-xs font-semibold leading-snug line-clamp-2 mt-0.5"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {article.title}
                        </h3>
                        {article.publishedAt && (
                          <p className="text-[10px] mt-2" style={{ color: 'var(--text-faint)' }}>
                            {timeAgo(article.publishedAt)}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── VER MÁS ── trae histórico vía API */}
      {hasMore && onLoadMore && (
        <div className="mt-6 flex items-center gap-4">
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <button
            onClick={() => { void onLoadMore() }}
            disabled={loadingMore}
            className="flex items-center gap-2.5 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all hover:brightness-110 hover:-translate-y-px active:translate-y-0"
            style={{
              background: 'rgba(124,58,237,0.1)',
              color: '#C4B5FD',
              border: '1px solid rgba(124,58,237,0.25)',
              fontFamily: 'var(--font-sport)',
              cursor: loadingMore ? 'default' : 'pointer',
              boxShadow: '0 4px 20px rgba(124,58,237,0.1)',
            }}
          >
            {loadingMore ? 'Cargando…' : 'Ver más noticias'}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 2v8M2.5 7.5L6 11l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
      )}

    </div>
  )
}
