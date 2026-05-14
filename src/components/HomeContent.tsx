'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import HeroBlock from '@/components/HeroBlock'
import ReelsSection from '@/components/ReelsSection'
import LiveEventsSection from '@/components/LiveEventsSection'
import NewsFeed from '@/components/NewsFeed'
import Sidebar from '@/components/Sidebar'
import type { RankingEntry } from '@/lib/rankings'
import QuinielaModule from '@/components/QuinielaModule'
import CategoriesFilter from '@/components/CategoriesFilter'
import { CATEGORY_TO_SLUG, HOME_SPORT_CATEGORIES, MORE_SPORT_CATEGORIES } from '@/lib/sports'
import type { SportEvent } from '@/lib/types'
import {
  IconQuiniela,
  IconCrackQuiz,
  IconMiOnce,
  IconSopaCracks,
  PreviewQuiniela,
} from '@/components/games/GameVisuals'

const HOME_PAGE_SIZE = 8

// ── Home calendar picker ─────────────────────────────────────
// Filtra a una ventana de actualidad (hoy + próximas ~36h) y
// puntúa cada evento por relevancia editorial. La diversidad
// por deporte deja de ser obligatoria: si el día está cargado
// de fútbol grande, ganará fútbol; si hay un GP o un Major,
// entrará por mérito propio. Cap blando de 2 por deporte para
// evitar que la sección se monopolice un día flojo.
const WINDOW_HOURS = 36
const MAX_PER_SPORT = 2

// Palabras clave en el nombre de la competición → peso de relevancia
const TIER_S = [
  'champions', 'final', 'mundial', 'world cup', 'clásico', 'clasico',
  'super bowl', 'playoffs', 'play-off', 'eliminator',
  'roland garros', 'wimbledon', 'us open', 'australian open', 'grand slam',
  'masters', 'ryder cup', 'the open',
  'gp ', ' gp', 'grand prix', 'fórmula 1', 'formula 1', 'f1',
]
const TIER_A = [
  'laliga', 'la liga', 'premier league', 'serie a', 'bundesliga', 'ligue 1',
  'copa del rey', 'copa america', 'eurocopa', 'europa league', 'conference',
  'nba', 'euroliga', 'euroleague',
  'atp', 'wta', 'atp 1000', 'atp 500',
  'ufc',
  'pga', 'liv golf',
]

function tierScore(comp: string): number {
  const c = (comp ?? '').toLowerCase()
  if (TIER_S.some(k => c.includes(k))) return 100
  if (TIER_A.some(k => c.includes(k))) return 60
  return 25
}

function pickTopEvents(events: SportEvent[], n = 4): SportEvent[] {
  const now = Date.now()
  const windowEnd = now + WINDOW_HOURS * 3600_000

  // 1) Ventana temporal: descartar pasados y muy lejanos
  const inWindow: { ev: SportEvent; score: number; ts: number }[] = []
  const fallback: { ev: SportEvent; score: number; ts: number }[] = []
  for (const ev of events) {
    if (ev.isPast) continue
    const ts = ev.isoDate ? new Date(ev.isoDate).getTime() : NaN
    const base = tierScore(ev.comp)
    if (!Number.isFinite(ts)) {
      fallback.push({ ev, score: base, ts: Number.POSITIVE_INFINITY })
      continue
    }
    if (ts < now - 2 * 3600_000) continue          // ya terminó hace rato
    let score = base
    if (ts <= windowEnd) {
      // Bonus si es hoy mismo (próximas 24h)
      if (ts <= now + 24 * 3600_000) score += 20
      inWindow.push({ ev, score, ts })
    } else {
      fallback.push({ ev, score: base, ts })
    }
  }

  // 2) Orden por score desc, desempate por fecha asc
  const ranked = inWindow.sort((a, b) => b.score - a.score || a.ts - b.ts)

  // 3) Selección con cap blando por deporte
  const perSport = new Map<string, number>()
  const result: SportEvent[] = []
  for (const { ev } of ranked) {
    if (result.length >= n) break
    const used = perSport.get(ev.sport) ?? 0
    if (used >= MAX_PER_SPORT) continue
    perSport.set(ev.sport, used + 1)
    result.push(ev)
  }

  // 4) Si la ventana estaba flojita, completar con lo siguiente más relevante
  if (result.length < n) {
    const pool = [
      ...ranked.filter(r => !result.includes(r.ev)),
      ...fallback.sort((a, b) => b.score - a.score || a.ts - b.ts),
    ]
    for (const { ev } of pool) {
      if (result.length >= n) break
      if (result.includes(ev)) continue
      result.push(ev)
    }
  }

  // 5) Reordenar cronológicamente para mostrar
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
const FEATURED_GAME = {
  href: '/quiniela',
  name: 'Quiniela',
  tagline: 'Predice. Acumula. Domina.',
  cta: 'Jugar jornada',
  accent: '#A78BFA',
  accentDim: '#7C3AED',
}

const SECONDARY_GAMES = [
  {
    href: '/crackquiz',
    name: 'CrackQuiz',
    desc: 'Trivia deportiva',
    Icon: IconCrackQuiz,
    accent: '#FCD34D',
    accentDim: '#D97706',
  },
  {
    href: '/sopa-cracks',
    name: 'Sopa de Cracks',
    desc: 'Encuentra los nombres',
    Icon: IconSopaCracks,
    accent: '#6EE7B7',
    accentDim: '#059669',
  },
  {
    href: '/mionce',
    name: 'Mi Once',
    desc: 'Tu equipo ideal',
    Icon: IconMiOnce,
    accent: '#93C5FD',
    accentDim: '#2563EB',
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {/* Featured: Quiniela */}
        <Link
          href={FEATURED_GAME.href}
          className="group relative overflow-hidden rounded-2xl p-4 md:p-5 md:col-span-2 transition-all hover:-translate-y-0.5"
          style={{
            background: `linear-gradient(135deg, ${FEATURED_GAME.accentDim}38 0%, ${FEATURED_GAME.accentDim}10 55%, rgba(0,0,0,0.2) 100%)`,
            border: `1px solid ${FEATURED_GAME.accent}55`,
            boxShadow: `0 0 32px -12px ${FEATURED_GAME.accent}80, inset 0 1px 0 ${FEATURED_GAME.accent}25`,
            textDecoration: 'none',
          }}
        >
          {/* Decorative big icon */}
          <div
            className="absolute -right-6 -bottom-6 opacity-[0.07] pointer-events-none transition-transform group-hover:scale-110"
            style={{ color: FEATURED_GAME.accent }}
          >
            <IconQuiniela size={160} />
          </div>
          <div className="relative flex flex-col h-full gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: `${FEATURED_GAME.accent}25`,
                    border: `1px solid ${FEATURED_GAME.accent}50`,
                    color: FEATURED_GAME.accent,
                  }}
                >
                  <IconQuiniela size={22} />
                </div>
                <div>
                  <p
                    className="text-[10px] font-black tracking-widest"
                    style={{ color: FEATURED_GAME.accent, fontFamily: 'var(--font-sport)' }}
                  >
                    DESTACADO
                  </p>
                  <h3
                    className="text-[18px] font-black leading-tight"
                    style={{ color: '#fff', fontFamily: 'var(--font-sport)' }}
                  >
                    {FEATURED_GAME.name}
                  </h3>
                </div>
              </div>
              <span
                className="hidden md:inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full whitespace-nowrap"
                style={{
                  background: `${FEATURED_GAME.accent}20`,
                  color: FEATURED_GAME.accent,
                  border: `1px solid ${FEATURED_GAME.accent}40`,
                  fontFamily: 'var(--font-sport)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: FEATURED_GAME.accent }} />
                JORNADA ABIERTA
              </span>
            </div>
            <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {FEATURED_GAME.tagline}
            </p>
            <div className="mt-auto">
              <PreviewQuiniela accent={FEATURED_GAME.accent} accentDim={FEATURED_GAME.accentDim} />
            </div>
            <div
              className="inline-flex items-center self-start gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-lg transition-transform group-hover:translate-x-0.5"
              style={{
                background: FEATURED_GAME.accent,
                color: '#1a0b2e',
                fontFamily: 'var(--font-sport)',
              }}
            >
              {FEATURED_GAME.cta}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5h7M5.5 2L8.5 5l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </Link>

        {/* Secondary games stacked into 3 cols */}
        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SECONDARY_GAMES.map(game => {
            const { Icon } = game
            return (
              <Link
                key={game.href}
                href={game.href}
                className="group relative overflow-hidden rounded-2xl p-4 transition-all hover:-translate-y-0.5"
                style={{
                  background: `linear-gradient(160deg, ${game.accentDim}22 0%, rgba(0,0,0,0.18) 100%)`,
                  border: `1px solid ${game.accent}30`,
                  textDecoration: 'none',
                  minHeight: 124,
                }}
              >
                <div
                  className="absolute -right-3 -bottom-3 opacity-[0.09] pointer-events-none transition-transform group-hover:scale-110 group-hover:opacity-[0.14]"
                  style={{ color: game.accent }}
                >
                  <Icon size={90} />
                </div>
                <div className="relative flex flex-col h-full">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105"
                    style={{
                      background: `${game.accent}20`,
                      border: `1px solid ${game.accent}45`,
                      color: game.accent,
                    }}
                  >
                    <Icon size={22} />
                  </div>
                  <p
                    className="text-[13px] font-black leading-tight"
                    style={{ color: '#fff', fontFamily: 'var(--font-sport)' }}
                  >
                    {game.name}
                  </p>
                  <p className="text-[10.5px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {game.desc}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
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
  topPlayers,
}: {
  articles: Article[]
  reels: SanityReel[]
  events: SportEvent[]
  initialSport?: string
  topPlayers?: RankingEntry[]
}) {
  const router = useRouter()
  const [activeSport, setActiveSport] = useState<string>(initialSport || 'Todo')
  const [contentVisible, setContentVisible] = useState(true)

  const handleSportChange = useCallback((cat: string) => {
    setContentVisible(false)
    setTimeout(() => {
      setActiveSport(cat)
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
  const feedDisplayed = filteredArticles.slice(heroArticles.length)

  return (
    <main className="max-w-[1440px] mx-auto pb-6">

      {/* ── FILTRO GLOBAL — sticky bajo el header ───────────────── */}
      <div
        className="sticky z-40 px-4 sm:px-6 xl:px-10 pt-2 sm:pt-3 pb-0"
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

          {/* Abrir histórico completo en /noticias */}
          <div className="mt-6 flex items-center gap-4">
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <Link
              href={activeSport === 'Todo' ? '/archivo' : `/archivo?sport=${CATEGORY_TO_SLUG[activeSport] ?? ''}`}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:brightness-110 hover:-translate-y-px active:translate-y-0"
              style={{
                background: 'rgba(124,58,237,0.1)',
                color: '#C4B5FD',
                border: '1px solid rgba(124,58,237,0.25)',
                fontFamily: 'var(--font-sport)',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(124,58,237,0.1)',
                textDecoration: 'none',
              }}
            >
              Ver histórico completo
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6h7M6 2.5L9.5 6 6 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

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
          <Sidebar topPlayers={topPlayers} />
        </aside>

      </div>
      </div>{/* end fade wrapper */}

    </main>
  )
}
