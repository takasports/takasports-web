'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import NoticiasPortada from '@/components/NoticiasPortada'
import NewsPageFeed from '@/components/NewsPageFeed'
import NewsSidebar from '@/components/NewsSidebar'
import ReelsSection from '@/components/ReelsSection'
import CategoriesFilter from '@/components/CategoriesFilter'
import { CATEGORY_TO_SLUG, HOME_SPORT_CATEGORIES, MORE_SPORT_CATEGORIES } from '@/lib/sports'

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

interface SanityReel {
  _id?: string
  id?: string
  instagram_url?: string
  thumbnail?: { asset: { _ref: string } }
  thumbnail_url?: string
  video_url?: string
  sport?: string
  category?: string
  title?: string
  publishedAt?: string
  timestamp?: string
}

function editorialDate(): string {
  const now = new Date()
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}`
}

function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between mt-6 mb-4 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2.5">
        <span className="section-accent" />
        <h2 className="section-label">{label}</h2>
      </div>
      {sub && (
        <span className="text-[10px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>{sub}</span>
      )}
    </div>
  )
}

type TimeFilter = 'todo' | 'hoy' | 'semana'

function filterByTime<T extends { publishedAt?: string }>(items: T[], tf: TimeFilter): T[] {
  if (tf === 'todo') return items
  return items.filter(a => {
    if (!a.publishedAt) return tf === 'semana'
    const days = (Date.now() - new Date(a.publishedAt).getTime()) / 86_400_000
    return tf === 'hoy' ? days < 1 : days < 7
  })
}

export default function NoticiasContent({
  articles,
  reels,
  initialCategory = 'Todo',
}: {
  articles: Article[]
  reels: SanityReel[]
  initialCategory?: string
}) {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState(initialCategory)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('todo')
  const [contentVisible, setContentVisible] = useState(true)
  const [allArticles, setAllArticles] = useState<Article[]>(articles)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(articles.length === 20)
  const [loadingMore, setLoadingMore] = useState(false)
  const activeSportRef = useRef('')

  const handleCategoryChange = useCallback((cat: string) => {
    setContentVisible(false)
    setTimeout(async () => {
      setActiveCategory(cat)
      setTimeFilter('todo')
      setContentVisible(true)
      const slug = CATEGORY_TO_SLUG[cat]?.toLowerCase() ?? ''
      activeSportRef.current = slug
      if (slug) {
        router.replace(`/noticias?sport=${slug}`, { scroll: false })
      } else {
        router.replace('/noticias', { scroll: false })
      }
      // Fetch page 1 for the new sport filter
      try {
        const url = slug ? `/api/articles?page=1&sport=${slug}` : '/api/articles?page=1'
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setAllArticles(data.articles)
          setPage(1)
          setHasMore(data.hasMore)
        }
      } catch { /* keep SSR articles */ }
    }, 110)
  }, [router])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    const slug = activeSportRef.current
    try {
      const url = slug ? `/api/articles?page=${nextPage}&sport=${slug}` : `/api/articles?page=${nextPage}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setAllArticles(prev => [...prev, ...data.articles])
        setPage(nextPage)
        setHasMore(data.hasMore)
      }
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, page])

  const activeSlug = CATEGORY_TO_SLUG[activeCategory]?.toLowerCase() ?? ''
  // allArticles already filtered by sport (fetched via API on category change)
  // For the initial SSR render with "Todo", filter client-side by time only
  const filteredArticles = filterByTime(allArticles, timeFilter)

  const now = Date.now()
  const hasToday = allArticles.some(a => a.publishedAt && (now - new Date(a.publishedAt).getTime()) / 86_400_000 < 1)
  const hasWeek  = allArticles.some(a => a.publishedAt && (now - new Date(a.publishedAt).getTime()) / 86_400_000 < 7)
  const timePills: { key: TimeFilter; label: string }[] = [
    { key: 'todo', label: 'Ver todo' },
    ...(hasToday ? [{ key: 'hoy' as TimeFilter, label: 'Hoy' }] : []),
    ...(hasWeek  ? [{ key: 'semana' as TimeFilter, label: 'Esta semana' }] : []),
  ]
  const showTimePills = timePills.length > 1

  return (
    <>
      {/* ── MASTHEAD PERIÓDICO ── */}
      <div className="px-6 xl:px-10 pt-7 pb-0">
        {/* Línea doble superior — marca de periódico */}
        <div style={{ borderTop: '3px solid #F2F2FA', borderBottom: '1px solid #F2F2FA', padding: '3px 0', marginBottom: 10 }} />

        {/* Cabecera: fecha — título — contador */}
        <div className="flex items-baseline justify-between gap-4">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.12em] flex-shrink-0"
            style={{ color: '#3A3A58', fontFamily: 'var(--font-sport)' }}
          >
            {editorialDate()}
          </p>

          <h1
            className="font-black text-center flex-1 leading-none"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.2rem, 5vw, 3.6rem)',
              color: '#F2F2FA',
              letterSpacing: '-0.03em',
            }}
          >
            Noticias
          </h1>

          <p
            className="text-[10px] font-semibold text-right flex-shrink-0"
            style={{ color: '#3A3A58', fontFamily: 'var(--font-sport)' }}
          >
            {filteredArticles.length > 0 ? `${filteredArticles.length} historias` : ' '}
          </p>
        </div>

        {/* Línea inferior con deporte activo como subtítulo */}
        <div className="flex items-center gap-3 mt-2 mb-0">
          <div style={{ flex: 1, height: 1, background: '#F2F2FA22' }} />
          <span
            className="text-[9px] font-black uppercase tracking-[0.2em] flex-shrink-0"
            style={{ color: '#2E2E46', fontFamily: 'var(--font-sport)' }}
          >
            {activeCategory === 'Todo' ? 'Todas las disciplinas' : activeCategory}
          </span>
          <div style={{ flex: 1, height: 1, background: '#F2F2FA22' }} />
        </div>
      </div>

      {/* ── FILTRO DEPORTE — sticky ── */}
      <div
        className="sticky z-40 px-6 xl:px-10 pt-3 pb-0"
        style={{
          top: 56,
          background: 'rgba(9,9,15,0.96)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <CategoriesFilter
          active={activeCategory}
          onSelect={handleCategoryChange}
          categories={HOME_SPORT_CATEGORIES}
          moreCategories={MORE_SPORT_CATEGORIES}
        />
      </div>

      {/* ── Contenido con fade ── */}
      <div
        className="px-6 xl:px-10"
        style={{ opacity: contentVisible ? 1 : 0, transition: 'opacity 110ms ease' }}
      >

      {/* ── FILTRO TEMPORAL ── */}
      {showTimePills && (
        <div className="flex items-center gap-1.5 mt-4 mb-2">
          {timePills.map(({ key, label }) => {
            const isActive = timeFilter === key
            return (
              <button
                key={key}
                onClick={() => setTimeFilter(key)}
                className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all"
                style={{
                  background: isActive ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                  color: isActive ? '#C4B5FD' : '#4A4A6A',
                  border: isActive ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  fontFamily: 'var(--font-sport)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* ── SIN RESULTADOS ── */}
      {filteredArticles.length === 0 && (
        <div className="py-20 flex flex-col items-center gap-4 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}
          >
            🔍
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No hay noticias de <span style={{ color: '#C4B5FD' }}>{activeCategory}</span> todavía.
          </p>
          <button
            onClick={() => handleCategoryChange('Todo')}
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

      {filteredArticles.length > 0 && (
        <>
          {/* ── PORTADA EDITORIAL ── */}
          <NoticiasPortada articles={filteredArticles} />

          {/* ── REELS ── */}
          <SectionHeader label="En vídeo" sub={reels.length > 0 ? `${reels.length} reels` : undefined} />
          <div className="mb-0">
            <ReelsSection reels={reels} initialSport={activeSlug} />
          </div>

          {/* ── ARCHIVO — LAYOUT 2 COLS ── */}
          <SectionHeader label="Archivo de noticias" sub={`${filteredArticles.length} ${filteredArticles.length === 1 ? 'artículo' : 'artículos'}`} />

          <div className="flex gap-8 items-start">
            <div className="flex-1 min-w-0">
              <NewsPageFeed
                articles={filteredArticles}
                initialCategory={activeCategory}
                featuredCount={5}
                hideFilter={true}
              />

              {/* ── CARGAR MÁS ── */}
              {hasMore && timeFilter === 'todo' && (
                <div className="flex justify-center mt-8 mb-4">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all"
                    style={{
                      background: loadingMore ? 'rgba(255,255,255,0.04)' : 'rgba(124,58,237,0.12)',
                      color: loadingMore ? '#3A3A52' : '#C4B5FD',
                      border: loadingMore ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(124,58,237,0.3)',
                      fontFamily: 'var(--font-sport)',
                      cursor: loadingMore ? 'default' : 'pointer',
                    }}
                  >
                    {loadingMore ? 'Cargando…' : 'Cargar más noticias'}
                  </button>
                </div>
              )}
            </div>
            <aside className="hidden lg:block w-[272px] xl:w-[300px] flex-shrink-0 sticky top-24">
              <NewsSidebar articles={allArticles} />
            </aside>
          </div>
        </>
      )}
      </div>{/* end fade wrapper */}
    </>
  )
}
