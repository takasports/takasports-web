'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORY_TO_SLUG } from '@/lib/sports'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import ArticleCard from '@/components/news/ArticleCard'
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

type DateGroup = 'Hoy' | 'Ayer' | 'Esta semana' | 'Anterior'

// `ahora` llega SELLADO POR EL SERVIDOR (prop `renderedAt`), no de `Date.now()`.
// Estos separadores son ESTRUCTURA —cada grupo es una sección del listado—, y
// /noticias va con `revalidate = 300`: si cada lado mirara su propio reloj, un
// artículo que cruzase las 24 h, las 48 h o los 7 días entre el render cacheado
// y la hidratación cambiaría de grupo. React lo trata como fallo de hidratación
// (#418), tira el árbol y repinta la página entera en cliente.
function getDateGroup(publishedAt: string | undefined, ahora: number): DateGroup {
  if (!publishedAt) return 'Anterior'
  const diff = ahora - new Date(publishedAt).getTime()
  const days = diff / 86_400_000
  if (days < 1) return 'Hoy'
  if (days < 2) return 'Ayer'
  if (days < 7) return 'Esta semana'
  return 'Anterior'
}

function groupByDate(articles: Article[], ahora: number): { label: DateGroup; items: Article[] }[] {
  const groups: Record<DateGroup, Article[]> = {
    Hoy: [],
    Ayer: [],
    'Esta semana': [],
    Anterior: [],
  }
  for (const a of articles) {
    groups[getDateGroup(a.publishedAt, ahora)].push(a)
  }
  const ORDER: DateGroup[] = ['Hoy', 'Ayer', 'Esta semana', 'Anterior']
  return ORDER.filter((l) => groups[l].length > 0).map((l) => ({ label: l, items: groups[l] }))
}


  // `sizes` importa aunque haya `width`/`height`: sin él, next/image elige el
  // escalón por el `width` declarado (200/400) y no por el hueco real, que en el
  // listado es de 88 px (120 en escritorio). Con los `deviceSizes` bajos que
  // ahora hay en next.config, esto baja la miniatura al escalón de 320.
function DateSeparator({ label }: { label: DateGroup }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span
        className="text-[9px] font-black uppercase tracking-[0.18em] flex-shrink-0"
        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
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
  renderedAt,
}: {
  articles: Article[]
  initialCategory?: string
  baseRoute?: string
  featuredCount?: number
  hideFilter?: boolean
  onLoadMore?: () => void | Promise<void>
  hasMore?: boolean
  loadingMore?: boolean
  /** Momento del render en el SERVIDOR (epoch ms). Único reloj de los
   *  separadores de fecha, para que el HTML cacheado y la hidratación coincidan. */
  renderedAt: number
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
  const groups = groupByDate(visibleArticles, renderedAt)

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
                {items.map((article) => (
                  <ArticleCard key={article._id} article={article} variant="row" size="md" reveal />
                ))}
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
                  // Última tarjeta huérfana: ocupa todo el ancho de su rejilla.
                  const orphan2 = idx === items.length - 1 && items.length % 2 !== 0
                  const orphan3 = idx === items.length - 1 && items.length % 3 === 1
                  return (
                    <ArticleCard
                      key={article._id}
                      article={article}
                      variant="grid"
                      gridImageHeight={110}
                      reveal
                      className={`${orphan2 ? 'col-span-2' : ''}${orphan3 ? ' lg:col-span-3' : ''}`}
                    />
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
