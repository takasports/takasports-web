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
  type?: string
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
}


  // `sizes` importa aunque haya `width`/`height`: sin él, next/image elige el
  // escalón por el `width` declarado (200/400) y no por el hueco real, que en el
  // listado es de 88 px (120 en escritorio). Con los `deviceSizes` bajos que
  // ahora hay en next.config, esto baja la miniatura al escalón de 320.
export default function NewsFeed({
  articles,
  initialCategory = 'Todo',
  limit,
  viewAllHref,
  baseRoute = '/',
  hideFilter = false,
}: {
  articles: Article[]
  initialCategory?: string
  limit?: number
  viewAllHref?: string
  baseRoute?: string
  hideFilter?: boolean
}) {
  const router = useRouter()
  const [category, setCategory] = useState(initialCategory)
  const [view, setView] = useState<'list' | 'grid'>('list')
  const listRef = useScrollReveal({ threshold: 0, rootMargin: '0px 0px 180px 0px' })
  const gridRef = useScrollReveal({ threshold: 0, rootMargin: '0px 0px 180px 0px' })

  const handleCategorySelect = useCallback((cat: string) => {
    setCategory(cat)
    // Persistir en URL
    const slug = CATEGORY_TO_SLUG[cat]
    if (slug) {
      router.replace(`${baseRoute}?sport=${slug}`, { scroll: false })
    } else {
      router.replace(baseRoute, { scroll: false })
    }
  }, [router, baseRoute])

  // Cuando hideFilter=true el padre ya filtra — mostrar todo lo recibido
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

  const displayed = limit ? filtered.slice(0, limit) : filtered
  const hasMore = limit ? filtered.length > limit : false

  return (
    <section id="noticias" className="mt-6">

      {/* Header de sección */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="flex items-center gap-2.5 mb-0.5">
            <span className="section-accent" />
            <h2
              className="font-black leading-none"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.4rem, 2.2vw, 1.9rem)',
                color: '#F0F0F5',
                letterSpacing: '-0.01em',
              }}
            >
              Noticias
            </h2>
          </div>
          <p
            className="text-[11px] leading-none"
            style={{ color: 'var(--text-faint)', marginLeft: 20 }}
          >
            Toda la actualidad deportiva
          </p>
        </div>
        <ViewToggle view={view} onToggle={setView} />
      </div>

      {/* Categorías — oculto cuando el padre gestiona el filtro globalmente */}
      {!hideFilter && (
        <div className="mb-4">
          <CategoriesFilter active={category} onSelect={handleCategorySelect} />
        </div>
      )}

      {/* Empty */}
      {displayed.length === 0 && (
        <div className="py-14 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Sin noticias en esta categoría de momento.
          </p>
        </div>
      )}

      {/* LIST */}
      {view === 'list' && displayed.length > 0 && (
        <div key={`list-${category}`} ref={listRef} className="flex flex-col gap-1.5 feed-animate">
          {displayed.map((article) => (
            <ArticleCard key={article._id} article={article} variant="row" size="md" reveal />
          ))}
        </div>
      )}

      {/* GRID */}
      {view === 'grid' && displayed.length > 0 && (
        <div key={`grid-${category}`} ref={gridRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 feed-animate">
          {displayed.map((article) => (
            <ArticleCard key={article._id} article={article} variant="grid" gridImageHeight={120} reveal />
          ))}
        </div>
      )}

      {/* Ver todos CTA */}
      {(hasMore || viewAllHref) && viewAllHref && (
        <div className="mt-6 flex items-center gap-4">
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <a
            href={viewAllHref}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-90 hover:-translate-y-px"
            style={{
              background: 'rgba(124,58,237,0.12)',
              color: '#C4B5FD',
              border: '1px solid rgba(124,58,237,0.28)',
              fontFamily: 'var(--font-sport)',
              textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(124,58,237,0.12)',
            }}
          >
            Ver todas las noticias
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
      )}
    </section>
  )
}
