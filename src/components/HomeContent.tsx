'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import HeroBlock from '@/components/HeroBlock'
import ReelsSection from '@/components/ReelsSection'
import LiveEventsSection from '@/components/LiveEventsSection'
import NewsFeed from '@/components/NewsFeed'
import ReportajesBlock, { type Reportaje } from '@/components/ReportajesBlock'
import Sidebar from '@/components/Sidebar'
import type { RankingEntry } from '@/lib/rankings'
import QuinielaTeaser from '@/components/QuinielaTeaser'
import RetoDelDia from '@/components/games/RetoDelDia'
import { RANKED_FUTBOL_ENABLED } from '@/lib/feature-flags'
import CategoriesFilter from '@/components/CategoriesFilter'
import { CATEGORY_TO_SLUG, HOME_SPORT_CATEGORIES, MORE_SPORT_CATEGORIES, SLUG_TO_LABEL, hubHrefForCategory } from '@/lib/sports'
import type { SportEvent } from '@/lib/types'
import {
  IconCrackQuiz,
  IconMiOnce,
  IconSopaCracks,
} from '@/components/games/GameVisuals'
import { SearchIcon } from '@/components/icons/GameIcons'
import { getEventHighlightScore } from '@/lib/competitions'
import TuDia from '@/components/TuDia'
import SectionHeader from '@/components/ui/SectionHeader'

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

// `now` llega SELLADO POR EL SERVIDOR (prop `renderedAt`), no de `Date.now()`.
// La portada va con `revalidate = 300`: si cada lado mirara su propio reloj, un
// partido que cruzara el corte de "ya terminó" entre el render cacheado y la
// hidratación cambiaría los Destacados y React tiraría la portada entera por
// fallo de hidratación (#418).
function pickTopEvents(events: SportEvent[], now: number, n = 4): SportEvent[] {
  const windowEnd = now + WINDOW_HOURS * 3600_000

  // 0) Deduplicar: mismo partido puede llegar dos veces (courts distintas
  //    en tenis, feeds duplicados). Clave = home+away+fecha normalizada.
  const seen = new Set<string>()
  const unique = events.filter(ev => {
    const key = `${ev.home}|${ev.away ?? ''}|${ev.isoDate?.slice(0, 13) ?? ev.date}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // 1) Ventana temporal: descartar pasados y muy lejanos
  const inWindow: { ev: SportEvent; score: number; ts: number }[] = []
  const fallback: { ev: SportEvent; score: number; ts: number }[] = []
  for (const ev of unique) {
    if (ev.isPast) continue
    const ts = ev.isoDate ? new Date(ev.isoDate).getTime() : NaN
    // Mismo ranking de Destacados que /calendario: liga top + equipos/selecciones
    // de renombre + finales/semis + prime time (escala ~0-18).
    const base = getEventHighlightScore({ comp: ev.comp, home: ev.home, away: ev.away, isoDate: ev.isoDate })
    if (!Number.isFinite(ts)) {
      fallback.push({ ev, score: base, ts: Number.POSITIVE_INFINITY })
      continue
    }
    if (ts < now - 2 * 3600_000) continue          // ya terminó hace rato
    let score = base
    if (ts <= windowEnd) {
      // Pequeño empujón si es hoy mismo (próximas 24h) — proporcional a la escala.
      if (ts <= now + 24 * 3600_000) score += 4
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

  // 5) Inicio = escaparate: dejar el orden por relevancia (más destacado
  //    primero). `result` ya viene en orden de score; /calendario sí va por hora.
  return result.slice(0, n)
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
// La Quiniela se embebe en vivo (es el "contenido" del bloque).
// Los otros 3 juegos viven en una tira fina como atajo de navegación.
const SECONDARY_GAMES = [
  {
    href: '/crackquiz',
    name: 'CrackQuiz',
    Icon: IconCrackQuiz,
    accent: '#FCD34D',
  },
  {
    href: '/sopa-cracks',
    name: 'Sopa de Cracks',
    Icon: IconSopaCracks,
    accent: '#6EE7B7',
  },
  {
    href: '/mionce',
    name: 'Mi Once',
    Icon: IconMiOnce,
    accent: '#93C5FD',
  },
]

// ── Banner de La Fecha ──────────────────────────────────────────
// CTA destacado sobre la sección de Juegos, el más visible de la portada.
// Anunciaba "Predicciones del Mundial" con badge "Nuevo" y llevaba a /mundial:
// el torneo acabó el 19-jul-2026, así que la portada empujaba a un cuadro
// cerrado. Ahora lleva a La Fecha, que es lo que se puede jugar hoy.
function GamesSection() {
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader>Juegos</SectionHeader>
        <Link
          href="/juegos"
          className="text-[11px] font-semibold transition-opacity hover:opacity-70"
          style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)', textDecoration: 'none' }}
        >
          Ver todos →
        </Link>
      </div>
      {/* Reto del día — acceso de un toque al primer juego diario pendiente */}
      <RetoDelDia />

      {/* Quiniela teaser — solo con Ranked Fútbol activo. Con el flag off,
          /quiniela redirige al Mundial → la jornada de LaLiga que muestra no
          se puede jugar, así que no lo enseñamos. */}
      {RANKED_FUTBOL_ENABLED && <QuinielaTeaser />}

      {/* Otros juegos: tira fina como atajo de navegación */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {SECONDARY_GAMES.map(game => {
          const { Icon } = game
          return (
            <Link
              key={game.href}
              href={game.href}
              // Vertical (icono arriba, nombre debajo centrado): paridad con la app
              // (GamesSection). El texto usa todo el ancho de la pastilla y envuelve a
              // 2 líneas en vez de truncar ("Sopa de Cracks" cabía cortado en móvil).
              className="group flex flex-col items-center text-center gap-2 px-2 py-3 rounded-xl transition-all hover:-translate-y-0.5"
              style={{
                background: `linear-gradient(140deg, ${game.accent}10, rgba(9,9,15,0.9))`,
                border: `1px solid ${game.accent}22`,
                // Vidrio: canto de luz arriba + sombra de elevación (§5.2).
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 8px 20px -12px rgba(0,0,0,0.6)',
                textDecoration: 'none',
              }}
            >
              <div
                className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                style={{
                  background: `${game.accent}14`,
                  border: `1px solid ${game.accent}35`,
                  color: game.accent,
                }}
              >
                <Icon size={18} />
              </div>
              <div className="w-full min-w-0">
                <p
                  className="text-[12px] font-black text-center line-clamp-2"
                  style={{ color: '#fff', fontFamily: 'var(--font-sport)' }}
                >
                  {game.name}
                </p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Liga Taka — ranking general al que suman todos los juegos */}
      <Link
        href="/liga-taka"
        className="group mt-3 flex items-center gap-3 rounded-xl px-4 py-3 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        style={{
          background: 'linear-gradient(135deg, rgba(167,139,250,0.14), rgba(147,197,253,0.06))',
          border: '1px solid rgba(167,139,250,0.28)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 20px -12px rgba(0,0,0,0.6)',
          textDecoration: 'none',
        }}
      >
        <span className="text-xl flex-shrink-0" aria-hidden="true">⚡</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black leading-tight" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
            Liga Taka
          </p>
          <p className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
            El ranking general — todos tus puntos en una tabla
          </p>
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest flex-shrink-0 transition-opacity group-hover:opacity-70" style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}>
          Ver →
        </span>
      </Link>
    </section>
  )
}

function SectionCTA({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-opacity hover:opacity-70"
      style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)', textDecoration: 'none' }}
    >
      {label}
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M1.5 5h7M5.5 2L8.5 5l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  )
}


// Aliases: deportes que en Sanity pueden venir con un slug equivalente al
// canónico del filtro (ej. NBA tagged como categoría dentro de Baloncesto,
// "wrestling" llegando vía captions de Instagram, F1 abreviado).
const SLUG_ALIASES: Record<string, string[]> = {
  baloncesto: ['nba', 'euroliga', 'bcl', 'acb'],
  wwe: ['wrestling'],
  formula1: ['f1'],
}

export default function HomeContent({
  articles,
  reels,
  events,
  topPlayers,
  featuredBySport = {},
  reportajes = [],
  masLeidas,
  eventosDeHoy = [],
  renderedAt,
}: {
  articles: Article[]
  reels: SanityReel[]
  events: SportEvent[]
  topPlayers?: RankingEntry[]
  featuredBySport?: Record<string, Article[]>
  reportajes?: Reportaje[]
  /**
   * Bloque "Lo más leído", renderizado en el SERVIDOR y pasado como nodo: sus
   * datos vienen de Search Console y no deben viajar al cliente ni convertir
   * este componente en asíncrono. Va en la columna principal y no en la barra
   * lateral porque esa es `hidden lg:block`, o sea invisible justo para el
   * móvil, que es de donde viene casi todo el tráfico.
   */
  masLeidas?: React.ReactNode
  /** Partidos de hoy en versión flaca, ya filtrados en el servidor, para "Tu día". */
  eventosDeHoy?: SportEvent[]
  /** Momento del render en el SERVIDOR (epoch ms). Único reloj para lo que se
   *  pinta en SSR, para que el HTML cacheado y la hidratación coincidan. */
  renderedAt: number
}) {
  const router = useRouter()
  const [activeSport, setActiveSport] = useState<string>('Todo')
  const [contentVisible, setContentVisible] = useState(true)

  // Top de eventos del calendario — se calcula 1 vez por cambio de `events`
  // (antes se recomputaba en cada render, y además 2 veces: calendario + sidebar).
  const topEvents = useMemo(() => pickTopEvents(events, renderedAt, 4), [events, renderedAt])

  // F3.5 (jun 2026): preseleccionado por `?sport=X` se lee client-side al
  // montar. Antes se leía via searchParams en el server (forzaba dynamic).
  // Ahora el server page es estático y este efecto aplica el filtro tras
  // hidratar. Trade-off: parpadeo brevísimo en hidratación si el user llega
  // directo a /?sport=futbol — aceptable para ganar ISR + CDN caching.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const slug = params.get('sport')
    if (!slug) return
    const label = SLUG_TO_LABEL[slug.toLowerCase()]
    if (label) setActiveSport(label)
  }, [])

  const handleSportChange = useCallback((cat: string) => {
    // Los chips del home FILTRAN las noticias in-place (no navegan). Las
    // pantallas tipo hub (banner + índice + eventos) se reservan a los enlaces
    // de deporte del footer (/futbol, /ufc…).
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

  // Filtrar artículos por deporte activo (con aliases: nba→baloncesto, wrestling→wwe, f1→formula1)
  const activeSlug = CATEGORY_TO_SLUG[activeSport]?.toLowerCase() ?? ''
  const acceptedSlugs = activeSlug
    ? new Set<string>([activeSlug, ...(SLUG_ALIASES[activeSlug] ?? [])])
    : new Set<string>()

  const matchesActive = (s?: string, c?: string) => {
    const ss = s?.toLowerCase() ?? ''
    const cc = c?.toLowerCase() ?? ''
    return acceptedSlugs.has(ss) || acceptedSlugs.has(cc)
  }

  const directFiltered = activeSport === 'Todo' || !activeSlug
    ? articles
    : articles.filter((a) => matchesActive(a.sport, a.category))

  // Combinar las recientes filtradas con las destacadas prefetcheadas del
  // servidor, deduplicado por _id. Así, aunque solo haya 1 noticia reciente
  // de un deporte en las 40 últimas, el hero se completa con sus destacadas.
  const fallback = featuredBySport[activeSlug] ?? []
  const filteredArticles = activeSport === 'Todo' || !activeSlug
    ? directFiltered
    : (() => {
        const seen = new Set<string>()
        const merged: Article[] = []
        for (const a of [...directFiltered, ...fallback]) {
          if (seen.has(a._id)) continue
          seen.add(a._id)
          merged.push(a)
        }
        return merged
      })()

  // Filtrar reels (ReelsSection tiene su propio estado, pasamos initialSport vacío y reels ya filtrados)
  const filteredReels = activeSport === 'Todo' || !activeSlug
    ? reels
    : reels.filter((r) => matchesActive(r.sport, r.category))

  const heroArticles = filteredArticles.slice(0, 8)
// La portada enseña DIEZ noticias, no el archivo entero. Medido el 04/09/2026:
// el feed traía 37 tarjetas y 3.360 px — el 41% de una portada de 8.201 px (9,7
// pantallas de iPhone)— repitiendo lo que ya está en /noticias. Con diez, la
// portada baja a ~6,6 pantallas y el que quiere más tiene el botón justo debajo.
// [José Tomás, 04/09/2026]
const NOTICIAS_EN_PORTADA = 10
  const feedDisplayed = filteredArticles.slice(heroArticles.length, heroArticles.length + NOTICIAS_EN_PORTADA)
  // La tira-carrusel del hero arranca tras los 3 destacados y sigue trayendo
  // noticias que no aparecen al principio (la 9, 10, 11…), hasta un máximo.
  const heroStripPool = filteredArticles.slice(3, 23)

  return (
    <main id="main" className="max-w-[1440px] mx-auto pb-6">

      {/* ── FILTRO GLOBAL — sticky bajo el header ───────────────── */}
      <div
        className="sticky z-40 px-4 sm:px-6 xl:px-10 pt-2 sm:pt-3 pb-0"
        style={{
          // Se ancla a la altura REAL de la consola (Header + Último momento + En
          // directo), que varía cuando "Último momento" se colapsa al scrollear.
          // Antes era top:56 fijo → dejaba un hueco bajo la cabecera en la home.
          top: 'var(--console-h, 56px)',
          background: 'rgba(9,9,15,0.96)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {/* Los chips LLEVAN al hub del deporte (03/09/2026). Antes filtraban en
            el sitio y los hubs —con su ranking, sus próximos partidos y su
            feed— solo se alcanzaban desde el pie de página, así que casi nadie
            llegaba. El filtrado en sitio sigue vivo para los enlaces `?sport=`
            que ya circulan (ver el efecto de deep-link). */}
        <CategoriesFilter
          active={activeSport}
          onSelect={handleSportChange}
          hrefFor={(cat) => hubHrefForCategory(cat, '/')}
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
              <HeroBlock articles={heroArticles} stripPool={heroStripPool} />
            </div>
          </div>
        )}

        {/* Sin resultados para este filtro */}
        {heroArticles.length === 0 && activeSport !== 'Todo' && (
          <div className="mt-12 py-16 flex flex-col items-center gap-4 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', color: '#A78BFA' }}
            >
              <SearchIcon size={26} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Todavía no hay nada de <span style={{ color: '#C4B5FD' }}>{activeSport}</span> por aquí.
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

        {/* ── 1.5 REPORTAJES ─────────────────────────────────────── */}
        {/* Justo bajo la portada: es el segundo bloque de la home a propósito.
            Se autooculta si no hay ninguno publicado. No se filtra por el chip
            de deporte activo — un reportaje no es actualidad de un deporte. */}
        <ReportajesBlock reportajes={reportajes} />

        {/* ── 1.6 TU DÍA ─────────────────────────────────────────── */}
        {/* DEBAJO de la portada, no encima: la home sigue abriendo con la
            actualidad y lo personal viene justo después (decisión de José Tomás
            al aprobar la maqueta, 03/09/2026). Se autooculta para quien todavía
            no ha elegido ni deportes ni equipos. */}
        <div className="mt-8">
          <TuDia events={eventosDeHoy} />
        </div>

        {/* ── 2. CALENDARIO ──────────────────────────────────────── */}
        <div className="mt-6">
          <LiveEventsSection preview={true} events={topEvents} />
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
              href={hubHrefForCategory(activeSport, '/noticias')}
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
              Ver todas las noticias
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6h7M6 2.5L9.5 6 6 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {masLeidas ? <div className="mt-10">{masLeidas}</div> : null}

        </div>

        {/* Sidebar — solo desktop */}
        <aside className="w-72 xl:w-80 flex-shrink-0 hidden lg:block sticky top-20 self-start pt-6">
          <Sidebar topPlayers={topPlayers} events={topEvents} />
        </aside>

      </div>
      </div>{/* end fade wrapper */}

    </main>
  )
}
