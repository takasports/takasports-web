'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import NoticiasPortada from '@/components/NoticiasPortada'
import NewsPageFeed from '@/components/NewsPageFeed'
import NewsSidebar from '@/components/NewsSidebar'
import ReelsSection from '@/components/ReelsSection'
import CategoriesFilter from '@/components/CategoriesFilter'
import { CATEGORY_TO_SLUG, HOME_SPORT_CATEGORIES, MORE_SPORT_CATEGORIES } from '@/lib/sports'
import { SearchIcon } from '@/components/icons/GameIcons'

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

// ── Federaciones de lucha libre ─────────────────────────────────
// Los artículos de wrestling traen la federación en `category` (mapeado
// desde `competition` en Sanity: "WWE Raw", "AEW Double or Nothing"…).
// Derivamos la federación para ofrecer sub-filtros WWE / AAA / AEW.
type Federation = 'Todo' | 'WWE' | 'AAA' | 'AEW'
const WRESTLING_FEDERATIONS: Federation[] = ['Todo', 'WWE', 'AAA', 'AEW']

function getFederation(category?: string): Federation | null {
  if (!category) return null
  const c = category.toUpperCase()
  if (c.includes('AEW')) return 'AEW'
  if (c.includes('AAA') || c.includes('TRIPLEMAN')) return 'AAA'
  if (c.includes('WWE') || c.includes('NXT') || c.includes('RAW') || c.includes('SMACKDOWN')) return 'WWE'
  return null
}

const FEDERATION_ACCENT: Record<Federation, string> = {
  Todo: '#facc15', WWE: '#e11d2a', AAA: '#22c55e', AEW: '#d4af37',
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
  const [federation, setFederation] = useState<Federation>('Todo')
  const [contentVisible, setContentVisible] = useState(true)
  const [allArticles, setAllArticles] = useState<Article[]>(articles)
  // SSR ya carga 40 artículos (pages 1+2 del API con pageSize 20).
  // La siguiente carga del histórico arranca en page 3.
  const [page, setPage] = useState(2)
  const [hasMore, setHasMore] = useState(articles.length >= 20)
  const [loadingMore, setLoadingMore] = useState(false)
  const activeSportRef = useRef('')

  const handleCategoryChange = useCallback((cat: string) => {
    setContentVisible(false)
    setTimeout(async () => {
      setActiveCategory(cat)
      setTimeFilter('todo')
      setFederation('Todo')
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
  const isWrestling = activeSlug === 'wwe'
  // allArticles already filtered by sport (fetched via API on category change)
  // For the initial SSR render with "Todo", filter client-side by time only
  const timeFiltered = filterByTime(allArticles, timeFilter)
  const filteredArticles = isWrestling && federation !== 'Todo'
    ? timeFiltered.filter(a => getFederation(a.category) === federation)
    : timeFiltered

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
      {/* CABECERA */}
      <div className="px-4 sm:px-6 xl:px-10 pt-6 pb-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="section-accent" />
              <span className="section-label">La actualidad deportiva</span>
            </div>
            <h1
              className="font-black leading-none"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                color: '#F2F2FA',
                letterSpacing: '-0.028em',
              }}
            >
              Noticias
            </h1>
          </div>
          <p className="text-[10px] flex-shrink-0 pb-1" style={{ color: '#3A3A58', fontFamily: 'var(--font-sport)' }}>
            {editorialDate()}{filteredArticles.length > 0 ? ` · ${filteredArticles.length} historias` : ''}
          </p>
        </div>
      </div>

      {/* ── FILTRO DEPORTE — sticky ── */}
      <div
        className="sticky z-40 px-4 sm:px-6 xl:px-10 pt-3 pb-0"
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
        className="px-4 sm:px-6 xl:px-10"
        style={{ opacity: contentVisible ? 1 : 0, transition: 'opacity 110ms ease' }}
      >

      {/* ── SUB-FILTRO FEDERACIÓN (solo lucha libre) ── */}
      {isWrestling && (
        <div className="flex items-center gap-1.5 mt-4 mb-1 overflow-x-auto scrollbar-hide">
          {WRESTLING_FEDERATIONS.map((fed) => {
            const isActive = federation === fed
            const accent = FEDERATION_ACCENT[fed]
            const count = fed === 'Todo'
              ? timeFiltered.length
              : timeFiltered.filter(a => getFederation(a.category) === fed).length
            return (
              <button
                key={fed}
                onClick={() => setFederation(fed)}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all"
                style={{
                  background: isActive ? `${accent}22` : 'rgba(255,255,255,0.04)',
                  color: isActive ? accent : '#6A6A82',
                  border: isActive ? `1px solid ${accent}55` : '1px solid rgba(255,255,255,0.06)',
                  fontFamily: 'var(--font-sport)',
                  cursor: 'pointer',
                }}
              >
                {fed === 'Todo' ? 'Todas' : fed}
                <span className="tabular-nums" style={{ opacity: 0.6 }}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

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
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', color: '#A78BFA' }}
          >
            <SearchIcon size={26} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Todavía no hay noticias de <span style={{ color: '#C4B5FD' }}>{activeCategory}</span> por aquí.
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
          <SectionHeader label="Archivo de noticias" sub={(() => { const n = Math.max(0, filteredArticles.length - 7); return `${n} ${n === 1 ? 'artículo' : 'artículos'}` })()} />

          <div className="flex gap-8 items-start">
            <div className="flex-1 min-w-0">
              <NewsPageFeed
                articles={filteredArticles}
                initialCategory={activeCategory}
                featuredCount={7}
                hideFilter={true}
                onLoadMore={loadMore}
                hasMore={hasMore && timeFilter === 'todo'}
                loadingMore={loadingMore}
              />

              {/* CTA secundario: buscar en archivo histórico */}
              <div className="mt-4 mb-2 flex justify-center">
                <a
                  href={`/archivo${CATEGORY_TO_SLUG[activeCategory] ? `?sport=${CATEGORY_TO_SLUG[activeCategory]}` : ''}`}
                  className="text-[11px] font-semibold tracking-wider transition-opacity hover:opacity-70"
                  style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)', textDecoration: 'none' }}
                >
                  Buscar en el archivo →
                </a>
              </div>
            </div>
            <aside className="hidden lg:block w-[272px] xl:w-[300px] flex-shrink-0 sticky top-24">
              <NewsSidebar articles={allArticles} />
            </aside>
          </div>
        </>
      )}
      </div>{/* end fade wrapper */}

      {/* Paginación — link crawlable a página 2 */}
      <div className="flex justify-end px-4 sm:px-6 xl:px-10 pb-8 pt-2">
        <a
          href="/noticias/pagina/2"
          className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none' }}
        >
          Más noticias →
        </a>
      </div>
    </>
  )
}
