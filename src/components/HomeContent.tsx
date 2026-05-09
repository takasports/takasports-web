'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import HeroBlock from '@/components/HeroBlock'
import ReelsSection from '@/components/ReelsSection'
import LiveEventsSection from '@/components/LiveEventsSection'
import NewsFeed from '@/components/NewsFeed'
import Sidebar from '@/components/Sidebar'
import QuinielaModule from '@/components/QuinielaModule'
import CategoriesFilter from '@/components/CategoriesFilter'
import { CATEGORY_TO_SLUG, HOME_SPORT_CATEGORIES, MORE_SPORT_CATEGORIES } from '@/lib/sports'
import type { SportEvent } from '@/lib/types'

const HOME_PAGE_SIZE = 8

// Sport priority for the home event preview: guarantees diversity
const EVENT_SPORT_PRIORITY = ['Fútbol', 'Baloncesto', 'F1', 'Tenis', 'UFC']

function pickTopEvents(events: SportEvent[], n = 4): SportEvent[] {
  // Group by sport keeping date order within each group
  const byPriority = new Map<string, SportEvent[]>()
  for (const ev of events) {
    const key = EVENT_SPORT_PRIORITY.includes(ev.sport) ? ev.sport : 'other'
    if (!byPriority.has(key)) byPriority.set(key, [])
    byPriority.get(key)!.push(ev)
  }
  const result: SportEvent[] = []
  // First pass: 1 event per sport in priority order
  for (const sport of EVENT_SPORT_PRIORITY) {
    if (result.length >= n) break
    const list = byPriority.get(sport) ?? []
    if (list.length > 0) result.push(list[0])
  }
  // Second pass: fill remaining slots with the next football match (most popular)
  if (result.length < n) {
    const football = byPriority.get('Fútbol') ?? []
    for (let i = 1; i < football.length && result.length < n; i++) result.push(football[i])
  }
  // Re-sort by date so cards appear chronologically
  return result
    .sort((a, b) => (a.isoDate ?? '').localeCompare(b.isoDate ?? ''))
    .slice(0, n)
}

interface Article {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  category?: string
  sport?: string
  priority?: string
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
}

interface SanityReel {
  _id?: string
  instagram_url?: string
  thumbnail?: { asset: { _ref: string } }
  sport?: string
  category?: string
  title?: string
  publishedAt?: string
}

// ── Sección Juegos ──────────────────────────────────────────────
const GAMES = [
  {
    href: '/crackquiz',
    emoji: '🧠',
    name: 'CrackQuiz',
    desc: 'Demuestra tus conocimientos',
    accent: '#FCD34D',
    bg: 'rgba(252,211,77,0.07)',
    border: 'rgba(252,211,77,0.18)',
  },
  {
    href: '/quiniela',
    emoji: '🎯',
    name: 'Quiniela',
    desc: 'Predice los resultados',
    accent: '#7C3AED',
    bg: 'rgba(124,58,237,0.07)',
    border: 'rgba(124,58,237,0.2)',
  },
  {
    href: '/sopa-cracks',
    emoji: '🔤',
    name: 'Sopa de Cracks',
    desc: 'Encuentra los jugadores',
    accent: '#6EE7B7',
    bg: 'rgba(110,231,183,0.07)',
    border: 'rgba(110,231,183,0.18)',
  },
  {
    href: '/mionce',
    emoji: '⚽',
    name: 'Mi Once',
    desc: 'Arma tu equipo ideal',
    accent: '#22c55e',
    bg: 'rgba(34,197,94,0.07)',
    border: 'rgba(34,197,94,0.18)',
  },
]

function GamesSection() {
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="section-accent" />
          <h2 className="section-label">Juegos</h2>
        </div>
        <Link
          href="/juegos"
          className="text-[11px] font-semibold transition-opacity hover:opacity-70"
          style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)', textDecoration: 'none' }}
        >
          Ver todos →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {GAMES.map(game => (
          <Link
            key={game.href}
            href={game.href}
            className="group flex flex-col items-center gap-2.5 p-4 rounded-2xl transition-all hover:-translate-y-1 hover:brightness-110"
            style={{
              background: game.bg,
              border: `1px solid ${game.border}`,
              textDecoration: 'none',
            }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl transition-transform group-hover:scale-110"
              style={{ background: `${game.accent}15`, border: `1px solid ${game.accent}30` }}
            >
              {game.emoji}
            </div>
            <div className="text-center">
              <p className="text-[12px] font-black" style={{ color: game.accent, fontFamily: 'var(--font-sport)' }}>
                {game.name}
              </p>
              <p className="text-[10px] mt-0.5 leading-tight" style={{ color: '#686884' }}>
                {game.desc}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function SectionCTA({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-opacity hover:opacity-70"
      style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)', textDecoration: 'none' }}
    >
      {label}
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M1.5 5h7M5.5 2L8.5 5l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  )
}


export default function HomeContent({
  articles,
  reels,
  events,
  initialSport = '',
}: {
  articles: Article[]
  reels: SanityReel[]
  events: SportEvent[]
  initialSport?: string
}) {
  const router = useRouter()
  const [activeSport, setActiveSport] = useState<string>(initialSport || 'Todo')
  const [displayCount, setDisplayCount] = useState(HOME_PAGE_SIZE)
  const [contentVisible, setContentVisible] = useState(true)

  const handleSportChange = useCallback((cat: string) => {
    setContentVisible(false)
    setTimeout(() => {
      setActiveSport(cat)
      setDisplayCount(HOME_PAGE_SIZE)
      setContentVisible(true)
      const slug = CATEGORY_TO_SLUG[cat]
      if (slug) {
        router.replace(`/?sport=${slug}`, { scroll: false })
      } else {
        router.replace('/', { scroll: false })
      }
    }, 110)
  }, [router])

  // Filtrar artículos por deporte activo
  const activeSlug = CATEGORY_TO_SLUG[activeSport]?.toLowerCase() ?? ''
  const filteredArticles = activeSport === 'Todo' || !activeSlug
    ? articles
    : articles.filter((a) => {
        const s = a.sport?.toLowerCase() ?? ''
        const c = a.category?.toLowerCase() ?? ''
        return s === activeSlug || c === activeSlug
      })

  // Filtrar reels (ReelsSection tiene su propio estado, pasamos initialSport vacío y reels ya filtrados)
  const filteredReels = activeSport === 'Todo' || !activeSlug
    ? reels
    : reels.filter((r) => {
        const s = r.sport?.toLowerCase() ?? r.category?.toLowerCase() ?? ''
        return s === activeSlug
      })

  const heroArticles = filteredArticles.slice(0, 8)
  const feedDisplayed = filteredArticles.slice(0, displayCount)
  const feedHasMore = displayCount < filteredArticles.length

  return (
    <main className="max-w-[1440px] mx-auto pb-6">

      {/* ── FILTRO GLOBAL — sticky bajo el header ───────────────── */}
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
          active={activeSport}
          onSelect={handleSportChange}
          categories={HOME_SPORT_CATEGORIES}
          moreCategories={MORE_SPORT_CATEGORIES}
        />
      </div>

      {/* ── Contenido principal con fade al cambiar deporte ─────── */}
      <div
        className="px-4 sm:px-6 xl:px-10"
        style={{
          opacity: contentVisible ? 1 : 0,
          transition: 'opacity 110ms ease',
        }}
      >

        {/* ── 1. PORTADA ─────────────────────────────────────────── */}
        {heroArticles.length > 0 && (
          <div className="mt-4 relative">
            <div
              className="absolute -inset-x-10 -top-12 h-72 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse 80% 100% at 50% 0%, rgba(124,58,237,0.09) 0%, transparent 70%)',
                zIndex: 0,
              }}
            />
            <div className="relative z-10">
              <HeroBlock articles={heroArticles} />
            </div>
          </div>
        )}

        {/* Sin resultados para este filtro */}
        {heroArticles.length === 0 && activeSport !== 'Todo' && (
          <div className="mt-12 py-16 flex flex-col items-center gap-4 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}
            >
              🔍
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No hay noticias de <span style={{ color: '#C4B5FD' }}>{activeSport}</span> todavía.
            </p>
            <button
              onClick={() => handleSportChange('Todo')}
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

        {/* ── 2. CALENDARIO ──────────────────────────────────────── */}
        <div className="mt-6">
          <LiveEventsSection preview={true} events={pickTopEvents(events, 4)} />
        </div>

        {/* ── 3. REELS ───────────────────────────────────────────── */}
        <div className="mt-6">
          <ReelsSection reels={filteredReels} initialSport={activeSlug} />
        </div>

        {/* ── 3.5 JUEGOS ─────────────────────────────────────────── */}
        <GamesSection />

        {/* ── 4. FEED + SIDEBAR ──────────────────────────────────── */}
        <div className="flex gap-8 mt-10 items-start min-h-0">

        <div className="flex-1 min-w-0">
          <NewsFeed
            articles={feedDisplayed}
            baseRoute="/"
            hideFilter={true}
          />

          {/* Load more inline */}
          {feedHasMore && (
            <div className="mt-6 flex items-center gap-4">
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <button
                onClick={() => setDisplayCount(prev => prev + HOME_PAGE_SIZE)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:brightness-110 hover:-translate-y-px active:translate-y-0"
                style={{
                  background: 'rgba(124,58,237,0.1)',
                  color: '#C4B5FD',
                  border: '1px solid rgba(124,58,237,0.25)',
                  fontFamily: 'var(--font-sport)',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(124,58,237,0.1)',
                }}
              >
                Ver más noticias
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2.5 7.5L6 11l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          )}

          {/* Quiniela — solo mobile */}
          <div className="lg:hidden mt-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="section-accent" />
                <h2 className="section-label">Quiniela</h2>
              </div>
              <SectionCTA href="/quiniela" label="Ver quiniela" />
            </div>
            <QuinielaModule />
          </div>
        </div>

        {/* Sidebar — solo desktop */}
        <aside className="w-72 xl:w-80 flex-shrink-0 hidden lg:block sticky top-20 self-start pt-6">
          <Sidebar />
        </aside>

      </div>
      </div>{/* end fade wrapper */}

    </main>
  )
}
