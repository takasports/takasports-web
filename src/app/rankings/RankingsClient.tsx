'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import NewsletterSection from '@/components/NewsletterSection'
import {
  RANKINGS_BY_TAB, RANKING_JUGADORES, RANKING_JUGADORES_SUB21,
  RANKING_JUGADORES_LATAM, RANKING_JUGADORES_CONCACAF, RANKING_CLUBES,
  RANKING_JUGADORAS, RANKING_CLUBES_FEMENINO, RANKING_LUCHADORAS_UFC,
  RANKING_CREADORES, RANKING_PERIODISTAS, RANKING_CREADORES_WWE,
  JUGADORES_SCOPE_TABS, CLUBES_SCOPE_TABS,
  CLUBES_LIGA_FILTERS, CLUBES_PAIS_FILTERS, CLUBES_FEMENINO_LIGA_FILTERS,
  JUGADORAS_LIGA_FILTERS, JUGADORES_PAIS_REGIONS, JUGADORES_POSITION_FILTERS,
  type RankingEntry, type RankingTab,
  type JugadoresScope, type ClubesScope,
} from '@/lib/rankings'
import { getDisplayScore } from '@/lib/rankings-ui'
import { getSportStyle } from '@/lib/sports'
import { SearchIcon, CrownIcon, FireIcon, TennisIcon, StarIcon } from '@/components/icons/GameIcons'
import RankRow from '@/components/rankings/RankRow'
import TopOneRow from '@/components/rankings/TopOneRow'
import RankBlock from '@/components/rankings/RankBlock'
import FeaturedCard from '@/components/rankings/FeaturedCard'
import FilterPillBar from '@/components/rankings/FilterPillBar'
import ScopeTabBar from '@/components/rankings/ScopeTabBar'
import SubEntityTabBar from '@/components/rankings/SubEntityTabBar'
import MovimientoSemana from '@/components/rankings/MovimientoSemana'
import type { MoverEntry } from '@/lib/rankings-data'
import SportSelector from '@/components/rankings/SportSelector'
import EntityTabBar from '@/components/rankings/EntityTabBar'
import GlobalSearchResults from '@/components/rankings/GlobalSearchResults'
import AppliedFiltersBar, { type AppliedFilter } from '@/components/rankings/AppliedFiltersBar'
import PredictWidget from '@/components/rankings/PredictWidget'

// ── Config por deporte ────────────────────────────────────────────────
const ENTITY_CONFIG: Record<string, { id: RankingTab; label: string }[]> = {
  '': [
    { id: 'jugadores',    label: 'Jugadores'    },
    { id: 'clubes',       label: 'Clubes'       },  ],
  futbol: [
    { id: 'jugadores',    label: 'Jugadores'    },
    { id: 'clubes',       label: 'Clubes'       },  ],
  baloncesto: [
    { id: 'jugadores',    label: 'Jugadores'    },
    { id: 'clubes',       label: 'Equipos'      },  ],
  formula1: [
    { id: 'jugadores',    label: 'Pilotos'       },
    { id: 'clubes',       label: 'Constructores' },
  ],
  tenis: [
    { id: 'jugadores',    label: 'Jugadores' },
  ],
  ufc: [
    { id: 'jugadores',    label: 'Luchadores' },
  ],
}

const SPECIAL_SPORTS = ['wwe', 'contenido']

const SUB_ENTITY_TABS: Record<string, { id: string; label: string }[]> = {
  wwe: [
    { id: 'total',     label: 'Total'     },
    { id: 'masculino', label: 'Masculino' },
    { id: 'femenino',  label: 'Femenino'  },
    { id: 'creadores', label: 'Creadores' },
  ],
  // contenido: sin sub-tabs — lista unificada creadores+periodistas
}

// Contenidos: sólo los 3 deportes con sección propia
// Deportes con sección de Contenido. Otros deportes (baloncesto, F1, tenis, padel, golf)
// se reactivarán cuando tengamos creadores curados — junio 2026.
const CONTENIDO_SPORTS = ['futbol', 'mundial', 'ufc', 'wwe']

const SPORT_FILTERS_CONTENIDO = [
  { label: 'Todos',    slug: '' },
  { label: 'Fútbol',  slug: 'futbol' },
  { label: 'Mundial', slug: 'mundial' },
  { label: 'UFC',     slug: 'ufc' },
  { label: 'WWE',     slug: 'wwe' },
  { label: 'NBA',     slug: 'baloncesto' },
  { label: 'F1',      slug: 'formula1' },
  { label: 'Tenis',   slug: 'tenis' },
  { label: 'Pádel',   slug: 'padel' },
  { label: 'Golf',    slug: 'golf' },
]

// Tarjetas explicativas del Índice por track (deportistas vs contenido)
const FACTOR_CARDS_ATLETA = [
  { label: 'Rendimiento', pct: '40%', color: '#22c55e',
    desc: 'Stats reales del deporte: goles, asistencias, PPG, victorias, podios. Es el peso principal.' },
  { label: 'Contexto', pct: '20%', color: '#60a5fa',
    desc: 'Nivel de la competición y posición de su equipo en la tabla. Jugar en Top-4 pesa más.' },
  { label: 'Mediático', pct: '25%', color: '#f59e0b',
    desc: 'Alcance en redes sociales, búsquedas en Google y menciones en prensa especializada.' },
  { label: 'Narrativa', pct: '15%', color: '#c084fc',
    desc: 'Momento de carrera, hitos históricos y peso simbólico. Lectura editorial transparente.' },
]
const FACTOR_CARDS_CONTENIDO = [
  { label: 'Audiencia', pct: '50%', color: '#f59e0b',
    desc: 'Seguidores y suscriptores ponderados por plataforma (YouTube, Instagram, TikTok, Twitch, X). Es el peso principal.' },
  { label: 'Contenido', pct: '30%', color: '#22c55e',
    desc: 'Calidad, frecuencia y engagement de lo que publica.' },
  { label: 'Momento', pct: '15%', color: '#c084fc',
    desc: 'Crecimiento, viralidad reciente y relevancia en el debate actual.' },
  { label: 'Profundidad', pct: '5%', color: '#60a5fa',
    desc: 'Nivel de análisis y conocimiento del deporte que cubre.' },
]

const JUGADORES_SCOPES_FOR_SPORT: Record<string, JugadoresScope[]> = {
  '':          ['global', 'liga', 'posicion', 'sub21', 'pais'],
  futbol:      ['global', 'liga', 'posicion', 'sub21', 'pais'],
  baloncesto:  ['global', 'posicion'],
  formula1:    ['global'],
  tenis:       ['global'],
  ufc:         ['global'],
}

const CLUBES_SCOPES_FOR_SPORT: Record<string, ClubesScope[]> = {
  '':          ['global', 'liga', 'pais'],
  futbol:      ['global', 'liga', 'pais'],
  baloncesto:  ['global', 'pais'],
  formula1:    ['global'],
}

const LIGA_FILTERS_BY_SPORT: Record<string, { label: string; slug: string }[]> = {
  '': [
    { label: 'Todas',      slug: '' },
    { label: 'LaLiga',     slug: 'laliga' },
    { label: 'Premier',    slug: 'premier' },
    { label: 'Bundesliga', slug: 'bundesliga' },
    { label: 'Serie A',    slug: 'seriea' },
    { label: 'Ligue 1',    slug: 'ligue1' },
    { label: 'NBA',        slug: 'nba' },
    { label: 'ATP/WTA',    slug: 'atp' },
    { label: 'MLS',        slug: 'mls' },
  ],
  futbol: [
    { label: 'Todas',      slug: '' },
    { label: 'LaLiga',     slug: 'laliga' },
    { label: 'Premier',    slug: 'premier' },
    { label: 'Bundesliga', slug: 'bundesliga' },
    { label: 'Serie A',    slug: 'seriea' },
    { label: 'Ligue 1',    slug: 'ligue1' },
    { label: 'MLS',        slug: 'mls' },
  ],
}

// ── Página principal ──────────────────────────────────────────────────
// (Componentes base extraídos a src/components/rankings/)
type DbData = Partial<Record<string, RankingEntry[]>>

export default function RankingsClient({
  initialMovers  = [],
  initialFallers = [],
  dbData         = {},
  lastUpdated,
}: {
  initialMovers?:  MoverEntry[]
  initialFallers?: MoverEntry[]
  dbData?:         DbData
  lastUpdated?:    string
}) {
  // Helper: DB data si tiene entries, si no el estático
  const db = (cat: string, fallback: RankingEntry[]): RankingEntry[] =>
    (dbData[cat] && dbData[cat]!.length > 0) ? dbData[cat]! : fallback
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialSport     = searchParams.get('deporte') ?? ''
  const initialTabParam  = searchParams.get('tab') as RankingTab | null
  const initialScopeParam = searchParams.get('scope') ?? 'global'
  const initialLiga      = searchParams.get('liga') ?? ''
  const initialGender    = searchParams.get('gender') === 'f' ? 'f' : 'm'
  const initialPosition  = searchParams.get('posicion') ?? ''
  const initialBadgeRaw  = searchParams.get('badge') ?? ''
  const initialBadge: '' | 'Histórico' | 'Revelación' | 'Nuevo' =
    initialBadgeRaw === 'Histórico' || initialBadgeRaw === 'Revelación' || initialBadgeRaw === 'Nuevo'
      ? initialBadgeRaw : ''
  const initialQuery     = searchParams.get('q') ?? ''
  const isSpecialInitial = SPECIAL_SPORTS.includes(initialSport)
  const initialEntities  = isSpecialInitial
    ? [{ id: 'jugadores' as RankingTab, label: '' }]
    : (ENTITY_CONFIG[initialSport] ?? ENTITY_CONFIG[''])
  const initialTab: RankingTab = initialEntities.find(e => e.id === initialTabParam)
    ? (initialTabParam as RankingTab)
    : initialEntities[0].id

  const [activeSport, setActiveSport]         = useState(initialSport)
  const [activeTab, setActiveTab]             = useState<RankingTab>(initialTab)
  const [subEntity, setSubEntity]             = useState('total')
  const [contenidoSport, setContenidoSport]   = useState('')
  const [jugadoresScope, setJugadoresScope]   = useState<JugadoresScope>((initialScopeParam as JugadoresScope) || 'global')
  const [clubesScope, setClubesScope]         = useState<ClubesScope>((initialScopeParam as ClubesScope) || 'global')
  const [ligaFilter, setLigaFilter]           = useState(initialLiga)
  const [positionFilter, setPositionFilter]   = useState(initialPosition)
  const [paisJugadores, setPaisJugadores]     = useState('europa')
  const [paisClubes, setPaisClubes]           = useState('')
  const [gender, setGender]                   = useState<'m' | 'f'>(initialGender)
  const [sortMode, setSortMode]               = useState<'score' | 'hot'>('score')
  const [searchQuery, setSearchQuery]         = useState(initialQuery)
  const [badgeFilter, setBadgeFilter]         = useState<'' | 'Histórico' | 'Revelación' | 'Nuevo'>(initialBadge)

  const isSpecialSport = SPECIAL_SPORTS.includes(activeSport)
  const isContenido    = activeSport === 'contenido'

  const availableEntities         = ENTITY_CONFIG[activeSport] ?? ENTITY_CONFIG['']
  const availableJugadoresScopes  = JUGADORES_SCOPES_FOR_SPORT[activeSport] ?? JUGADORES_SCOPES_FOR_SPORT['']
  const availableClubesScopes     = CLUBES_SCOPES_FOR_SPORT[activeSport] ?? CLUBES_SCOPES_FOR_SPORT['']

  const jugadoresScopeTabs = JUGADORES_SCOPE_TABS.filter(t => availableJugadoresScopes.includes(t.id))
  const clubesScopeTabs    = CLUBES_SCOPE_TABS.filter(t => availableClubesScopes.includes(t.id))

  const sportAccent = activeSport ? getSportStyle(activeSport).accent : '#7C3AED'
  // Fondo atmosférico por deporte para el hero (reusa los WebP de /calendario).
  // Solo cuando hay un deporte con asset; en "global" se mantiene el look morado.
  const sportBackdrop = ({ futbol: 'futbol', baloncesto: 'nba', formula1: 'f1', tenis: 'tenis', ufc: 'ufc', padel: 'padel' } as Record<string, string>)[activeSport] ?? null

  // Build type map for contenido total view (estable entre renders)
  const contenidoTypeMap = useMemo(() => {
    const m = new Map<string, 'Creador' | 'Periodista'>()
    db('creadores', RANKING_CREADORES).forEach(e => m.set(e.id, 'Creador'))
    db('periodistas', RANKING_PERIODISTAS).forEach(e => m.set(e.id, 'Periodista'))
    db('creadores_wwe', RANKING_CREADORES_WWE).forEach(e => m.set(e.id, 'Creador'))
    return m
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbData])

  const isFemenino = gender === 'f' && (activeSport === 'futbol' || activeSport === 'ufc' || activeSport === 'tenis')

  // ── Bases filtradas por deporte ───────────────────────────────────
  // Helper: filtra por deporte, cae a estático si la DB no tiene entradas para ese deporte
  const dbSportFilter = (cat: string, fallback: RankingEntry[], sport: string): RankingEntry[] => {
    const fromDb = db(cat, fallback).filter(e => e.sport === sport)
    if (fromDb.length > 0) return fromDb
    return fallback.filter(e => e.sport === sport)
  }

  const jugadoresBase = isFemenino
    ? activeSport === 'ufc'
      ? db('luchadoras_ufc', RANKING_LUCHADORAS_UFC)
      : activeSport === 'tenis'
        ? db('jugadoras', RANKING_JUGADORAS).filter(e => e.sport === 'tenis')
        : db('jugadoras', RANKING_JUGADORAS)
    : activeSport
      ? dbSportFilter('jugadores', RANKING_JUGADORES, activeSport)
      : db('jugadores', RANKING_JUGADORES)
  const clubesBase = isFemenino
    ? db('clubes_femenino', RANKING_CLUBES_FEMENINO)
    : activeSport
      ? dbSportFilter('clubes', RANKING_CLUBES, activeSport)
      : db('clubes', RANKING_CLUBES)

  // ── Resolver entries ──────────────────────────────────────────────
  let entries: RankingEntry[] = []
  let featuredEntries: RankingEntry[] = []

  if (activeSport === 'wwe') {
    if (subEntity === 'creadores') {
      entries = db('creadores_wwe', RANKING_CREADORES_WWE).filter(e => !e.featured)
        .sort((a, b) => getDisplayScore(b) - getDisplayScore(a))
      featuredEntries = db('creadores_wwe', RANKING_CREADORES_WWE).filter(e => e.featured)
    } else {
      const wweBase = dbSportFilter('jugadores', RANKING_JUGADORES, 'wwe')
        .sort((a, b) => getDisplayScore(b) - getDisplayScore(a))
      if (subEntity === 'total') entries = wweBase
      else if (subEntity === 'masculino') entries = wweBase.filter(e => e.position === 'masculino')
      else if (subEntity === 'femenino')  entries = wweBase.filter(e => e.position === 'femenino')
      else entries = wweBase
    }
  } else if (isContenido) {
    // Lista unificada: creadores + periodistas + creadores_wwe
    // Restringida a fútbol, UFC y WWE (los deportes con sección propia)
    const contenidoBase = (e: RankingEntry) =>
      CONTENIDO_SPORTS.includes(e.sport ?? '') &&
      (!contenidoSport || e.sport === contenidoSport)
    // Dedupe por id (algunos ids viven en dos arrays a la vez): último gana,
    // coherente con contenidoTypeMap — evita pintar a la misma persona 2 veces.
    const contenidoById = new Map<string, RankingEntry>()
    for (const e of [
      ...db('creadores',     RANKING_CREADORES).filter(e => !e.featured),
      ...db('periodistas',   RANKING_PERIODISTAS).filter(e => !e.featured),
      ...db('creadores_wwe', RANKING_CREADORES_WWE).filter(e => !e.featured),
    ]) contenidoById.set(e.id, e)
    entries = [...contenidoById.values()]
      .filter(contenidoBase)
      .sort((a, b) => getDisplayScore(b) - getDisplayScore(a))
  } else if (activeTab === 'jugadores') {
    if (jugadoresScope === 'global') {
      entries = jugadoresBase
    } else if (jugadoresScope === 'liga') {
      entries = ligaFilter ? jugadoresBase.filter(e => e.league === ligaFilter) : jugadoresBase
    } else if (jugadoresScope === 'posicion') {
      entries = positionFilter ? jugadoresBase.filter(e => e.position === positionFilter) : jugadoresBase
    } else if (jugadoresScope === 'sub21') {
      const base = db('sub21', RANKING_JUGADORES_SUB21)
      entries = activeSport ? base.filter(e => e.sport === activeSport) : base
    } else if (jugadoresScope === 'pais') {
      if (paisJugadores === 'latam') {
        const base = db('latam', RANKING_JUGADORES_LATAM)
        entries = activeSport ? base.filter(e => e.sport === activeSport) : base
      } else if (paisJugadores === 'concacaf') {
        const base = db('concacaf', RANKING_JUGADORES_CONCACAF)
        entries = activeSport ? base.filter(e => e.sport === activeSport) : base
      } else {
        entries = jugadoresBase.filter(e => e.region === 'europa')
      }
    }
  } else if (activeTab === 'clubes') {
    if (clubesScope === 'global') {
      entries = clubesBase
    } else if (clubesScope === 'liga') {
      entries = ligaFilter ? clubesBase.filter(e => e.league === ligaFilter) : clubesBase
    } else if (clubesScope === 'pais') {
      if (!paisClubes) {
        entries = clubesBase
      } else if (paisClubes === 'other') {
        const mainSlugs  = ['spain', 'england', 'italy', 'germany', 'france', 'usa']
        const mainEmojis = ['🇪🇸', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇮🇹', '🇩🇪', '🇫🇷', '🇺🇸']
        entries = clubesBase.filter(e => !e.country || (!mainSlugs.includes(e.country) && !mainEmojis.includes(e.country)))
      } else {
        const SLUG_TO_FLAG: Record<string, string> = {
          spain: '🇪🇸', england: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', italy: '🇮🇹', germany: '🇩🇪', france: '🇫🇷', usa: '🇺🇸',
        }
        const flagEquiv = SLUG_TO_FLAG[paisClubes] ?? paisClubes
        entries = clubesBase.filter(e => e.country === paisClubes || e.country === flagEquiv)
      }
    }
  }

  // Cuando hay filtro de deporte activo en jugadores: reordenar por score
  // específico del deporte (rendimiento-heavy) y reasignar ranks 1, 2, 3…
  const sportFilterActive = !!activeSport && !isSpecialSport && !isContenido
  if (sportFilterActive && activeTab === 'jugadores' && jugadoresScope === 'global') {
    entries = [...entries]
      .sort((a, b) => getDisplayScore(b) - getDisplayScore(a))
      .map((e, i) => ({ ...e, rank: i + 1, _globalRank: e.rank }))
  }

  // Re-rank sequentially when entries aren't in canonical global order
  const isFiltered = (
    (activeTab === 'jugadores' && jugadoresScope !== 'global' && !isSpecialSport) ||
    (activeTab === 'clubes' && (clubesScope !== 'global' || !!paisClubes) && !isSpecialSport) ||
    activeSport === 'wwe' ||   // always: WWE entries have global ranks (10, 51…), not sport-local
    isContenido                // always: two datasets each start at rank 1
  )
  if (isFiltered) {
    entries = entries.map((e, i) => ({ ...e, rank: i + 1, _globalRank: e.rank }))
  }

  // ── URL sync — centralizado en useEffect ─────────────────────────
  useEffect(() => {
    const params = new URLSearchParams()
    if (activeSport) params.set('deporte', activeSport)
    if (activeTab !== 'jugadores') params.set('tab', activeTab)
    if (!isSpecialSport && activeTab === 'jugadores' && jugadoresScope !== 'global')
      params.set('scope', jugadoresScope)
    if (!isSpecialSport && activeTab === 'clubes' && clubesScope !== 'global')
      params.set('scope', clubesScope)
    if (ligaFilter) params.set('liga', ligaFilter)
    if (gender === 'f') params.set('gender', 'f')
    if (positionFilter) params.set('posicion', positionFilter)
    if (badgeFilter) params.set('badge', badgeFilter)
    if (searchQuery.trim()) params.set('q', searchQuery.trim())
    const query = params.toString()
    router.replace(query ? `?${query}` : '?', { scroll: false })
  }, [
    activeSport, activeTab, jugadoresScope, clubesScope, ligaFilter,
    gender, positionFilter, badgeFilter, searchQuery,
    isSpecialSport, router,
  ])

  // ── Handlers ─────────────────────────────────────────────────────
  const resetFilters = () => {
    setJugadoresScope('global')
    setClubesScope('global')
    setLigaFilter('')
    setPositionFilter('')
    setPaisJugadores('europa')
    setPaisClubes('')
  }

  const handleSportChange = (sport: string) => {
    setActiveSport(sport)
    setSubEntity('total')
    setContenidoSport('')
    setGender('m')
    if (!SPECIAL_SPORTS.includes(sport)) {
      const entities = ENTITY_CONFIG[sport] ?? ENTITY_CONFIG['']
      setActiveTab(entities[0].id)
    }
    resetFilters()
  }

  const handleEntityChange = (tab: RankingTab) => {
    setActiveTab(tab)
    resetFilters()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleJugadoresScopeChange = (scope: JugadoresScope) => {
    setJugadoresScope(scope)
    setLigaFilter('')
    setPositionFilter('')
    setPaisJugadores('europa')
  }

  const handleClubesScopeChange = (scope: ClubesScope) => {
    setClubesScope(scope)
    setLigaFilter('')
    setPaisClubes('')
  }

  // Sort opcional por tendencia ("Hot now")
  const hasHotData = entries.some(e => e.scorePrev !== undefined)
  const sortedEntries = (sortMode === 'hot' && hasHotData)
    ? [...entries].sort((a, b) => {
        const da = a.scorePrev !== undefined ? getDisplayScore(a) - a.scorePrev : -99
        const db = b.scorePrev !== undefined ? getDisplayScore(b) - b.scorePrev : -99
        return db - da
      }).map((e, i) => ({ ...e, rank: i + 1 }))
    : entries

  // Filtros UI: badge + búsqueda por nombre (sin acentos)
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = norm(searchQuery.trim())
  const finalEntries = sortedEntries
    .filter(e => !badgeFilter || e.badge === badgeFilter)
    .filter(e => !q || norm(e.name).includes(q) || norm(e.subtitle).includes(q))

  // Slices del listado
  const top1       = finalEntries[0]
  const rank2to10  = finalEntries.slice(1, 10)
  const rank11to25 = finalEntries.slice(10, 25)
  const rank26to50 = finalEntries.slice(25, 50)
  const rank51on   = finalEntries.slice(50)

  // Liga filters según deporte y género
  const jugadoresLigaFilters = isFemenino ? JUGADORAS_LIGA_FILTERS : (LIGA_FILTERS_BY_SPORT[activeSport] ?? LIGA_FILTERS_BY_SPORT[''])
  const clubesLigaFilters    = isFemenino ? CLUBES_FEMENINO_LIGA_FILTERS : CLUBES_LIGA_FILTERS

  // typeTagFn para contenido: muestra el tipo (Creador/Periodista) en cada fila
  const typeTagFn = isContenido
    ? (e: RankingEntry) => contenidoTypeMap.get(e.id)
    : undefined

  const showFeatured = (
    activeSport === 'wwe' && subEntity === 'creadores'
  ) && featuredEntries.length > 0

  return (
    <div data-sport={activeSport || undefined} style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24">

        {/* ── HERO ─────────────────────────────────────────────── */}
        <div className="relative pt-6 pb-4 overflow-hidden">
          {/* Fondo atmosférico del deporte (broadcast) — solo con filtro de
              deporte activo; en "global" queda el look morado de marca. */}
          {sportBackdrop && (
            <>
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: `url(/banners/backdrop-${sportBackdrop}.webp)`, backgroundSize: 'cover', backgroundPosition: 'center 30%', opacity: 0.22 }}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(180deg, rgba(9,9,15,0.45) 0%, rgba(9,9,15,0.72) 60%, var(--bg-base) 100%)' }}
              />
            </>
          )}
          <div
            className="absolute -top-12 left-1/2 -translate-x-1/2 w-[600px] h-[280px] pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 50% 30%, ${sportAccent}18 0%, transparent 65%)`, filter: 'blur(20px)', transition: 'all 0.4s ease' }}
          />
          <div className="relative text-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(124,58,237,0.12)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.28)', fontFamily: 'var(--font-sport)' }}>
                {(() => {
                  if (lastUpdated) {
                    const d = new Date(lastUpdated)
                    const now = new Date()
                    const diffMs = now.getTime() - d.getTime()
                    const diffDays = Math.floor(diffMs / 86400000)
                    const label = diffDays === 0 ? 'hoy' : diffDays === 1 ? 'hace 1 día' : `hace ${diffDays} días`
                    return `Actualizado ${label} · ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  }
                  const now = new Date()
                  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                  const fmt = (d: Date) => d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                  return `Edición ${fmt(now)} · vs ${fmt(prev)}`
                })()}
              </span>
            </div>
            <h1 className="font-black mb-3"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', color: '#F8F8FF', letterSpacing: '-0.03em', lineHeight: 1 }}>
              Índice <span style={{ color: '#9B7CF6' }}>Taka</span>
            </h1>
            <p className="text-sm max-w-xl mx-auto leading-relaxed"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
              Rankings propios de Taka: rendimiento, estadística, influencia mediática y percepción pública.
            </p>
            <div className="mt-4 flex justify-center gap-2 flex-wrap">
              <Link
                href="/rankings/todos"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.16em] transition-all hover:brightness-125"
                style={{
                  background: 'rgba(196,181,253,0.12)',
                  color: '#C4B5FD',
                  border: '1px solid rgba(196,181,253,0.3)',
                  fontFamily: 'var(--font-sport)',
                }}
              >
                👑 Reyes del deporte <span style={{ color: '#7C3AED' }}>→</span>
              </Link>
              <Link
                href="/rankings/comparar"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.16em] transition-all hover:brightness-125"
                style={{
                  background: 'rgba(124,58,237,0.12)',
                  color: '#C4B5FD',
                  border: '1px solid rgba(124,58,237,0.3)',
                  fontFamily: 'var(--font-sport)',
                }}
              >
                ⚖️ Comparador <span style={{ color: '#7C3AED' }}>→</span>
              </Link>
              <Link
                href="/rankings/mi-top"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.16em] transition-all hover:brightness-125"
                style={{
                  background: 'rgba(248,113,113,0.10)',
                  color: '#fca5a5',
                  border: '1px solid rgba(248,113,113,0.25)',
                  fontFamily: 'var(--font-sport)',
                }}
              >
                ❤ Mi Top
              </Link>
            </div>
          </div>
        </div>

        {/* ── MOVIMIENTO DE LA SEMANA ───────────────────────────── */}
        <MovimientoSemana movers={initialMovers} fallers={initialFallers} />

        {/* ── 1. SELECTOR DE DEPORTE ────────────────────────────── */}
        <div className="mb-6">
          <SportSelector active={activeSport} onChange={handleSportChange} />
        </div>

        {/* ── 2a. ENTITY TABS (deportes normales) ─────────────── */}
        {!isSpecialSport && (
          <EntityTabBar
            entities={availableEntities}
            active={activeTab}
            onChange={handleEntityChange}
            activeAccent={sportAccent}
          />
        )}

        {/* ── 2b. SUB-ENTITY TABS (WWE / Contenido) ───────────── */}
        {isSpecialSport && SUB_ENTITY_TABS[activeSport] && (
          <SubEntityTabBar
            tabs={SUB_ENTITY_TABS[activeSport]}
            active={subEntity}
            onChange={(id) => { setSubEntity(id); setContenidoSport('') }}
            accent={isContenido ? '#f59e0b' : sportAccent}
          />
        )}

        {/* ── Toggle Femenino — Fútbol, UFC y Tenis ───────────── */}
        {(activeSport === 'futbol' || activeSport === 'ufc' || activeSport === 'tenis') && !isSpecialSport && (
          <div className="flex items-center gap-1.5 mt-3 mb-1">
            {(['m', 'f'] as const).map(g => {
              const isActive = gender === g
              return (
                <button key={g} onClick={() => { setGender(g); resetFilters() }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                  style={{
                    background: isActive ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#22c55e' : '#5A5A6A',
                    border: isActive ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.07)',
                    cursor: 'pointer', fontFamily: 'var(--font-sport)',
                  }}>
                  {activeSport === 'tenis'
                    ? (<><TennisIcon size={11} /> {g === 'm' ? 'ATP' : 'WTA'}</>)
                    : (g === 'm' ? '♂ Masculino' : '♀ Femenino')}
                </button>
              )
            })}
          </div>
        )}

        {/* ── BÚSQUEDA + FILTRO BADGE ──────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex items-center"
              style={{ color: '#5A5A72' }}><SearchIcon size={13} /></span>
            <input
              type="text"
              placeholder="Buscar en TODOS los rankings (ej: Messi, Ferrari, Pedrerol)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 rounded-full text-xs font-semibold transition-all focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: searchQuery ? `1px solid ${sportAccent}40` : '1px solid rgba(255,255,255,0.07)',
                color: '#D0D0E0',
                fontFamily: 'var(--font-sport)',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: '#8E8E9E', cursor: 'pointer', background: 'none', border: 'none' }}
                aria-label="Limpiar búsqueda">
                ✕
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {([
              { id: '',           label: 'Todos',      color: '#8E8E9E', Icon: null },
              { id: 'Histórico',  label: 'Histórico',  color: '#facc15', Icon: CrownIcon },
              { id: 'Revelación', label: 'Revelación', color: '#22c55e', Icon: StarIcon },
              { id: 'Nuevo',      label: 'Nuevo',      color: '#60a5fa', Icon: null },
            ] as const).map(b => {
              const isActive = badgeFilter === b.id
              return (
                <button key={b.id} onClick={() => setBadgeFilter(b.id)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all inline-flex items-center gap-1.5"
                  style={{
                    background: isActive ? `${b.color}18` : 'rgba(255,255,255,0.04)',
                    color: isActive ? b.color : '#5A5A72',
                    border: isActive ? `1px solid ${b.color}40` : '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer', fontFamily: 'var(--font-sport)',
                  }}>
                  {b.Icon && <b.Icon size={11} />}{b.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mb-6 mt-2">
          <span className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: isContenido ? '#f59e0b50' : `${sportAccent}50`, fontFamily: 'var(--font-sport)' }}>
            {isContenido ? '✦ Ranking editorial · Top curado por disciplina' : '✦ Ranking deportivo · Top 100 ampliable'}
          </span>
          {(!isContenido && hasHotData && !(activeSport === 'wwe' && subEntity === 'creadores')) && (
            <button
              onClick={() => setSortMode(s => s === 'score' ? 'hot' : 'score')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0"
              style={{
                background: sortMode === 'hot' ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)',
                color: sortMode === 'hot' ? '#f59e0b' : '#4A4A62',
                border: sortMode === 'hot' ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer', fontFamily: 'var(--font-sport)',
              }}>
              <FireIcon size={11} /> Hot now
            </button>
          )}
        </div>

        {/* ── 3. SCOPE TABS ────────────────────────────────────── */}
        {!isSpecialSport && activeTab === 'jugadores' && (
          <ScopeTabBar tabs={jugadoresScopeTabs} active={jugadoresScope} onChange={handleJugadoresScopeChange} />
        )}
        {!isSpecialSport && activeTab === 'clubes' && (
          <ScopeTabBar tabs={clubesScopeTabs} active={clubesScope} onChange={handleClubesScopeChange} />
        )}

        {(!isSpecialSport && (activeTab === 'jugadores' || activeTab === 'clubes')) && <div className="mb-4" />}

        {/* Contenido sport filter */}
        {isContenido && (
          <FilterPillBar
            filters={SPORT_FILTERS_CONTENIDO}
            active={contenidoSport}
            onChange={setContenidoSport}
            accentColor="#f59e0b"
          />
        )}

        {/* ── 4. FILTROS SECUNDARIOS ────────────────────────────── */}

        {/* Jugadores: Liga */}
        {!isSpecialSport && activeTab === 'jugadores' && jugadoresScope === 'liga' && (
          <FilterPillBar
            filters={jugadoresLigaFilters}
            active={ligaFilter}
            onChange={setLigaFilter}
            accentColor="#C4B5FD"
          />
        )}

        {/* Jugadores: Posición */}
        {!isSpecialSport && activeTab === 'jugadores' && jugadoresScope === 'posicion' && (
          <FilterPillBar
            filters={JUGADORES_POSITION_FILTERS}
            active={positionFilter}
            onChange={setPositionFilter}
            accentColor="#86efac"
          />
        )}

        {/* Jugadores: País */}
        {!isSpecialSport && activeTab === 'jugadores' && jugadoresScope === 'pais' && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-5 pb-0.5">
            {JUGADORES_PAIS_REGIONS.map((r) => {
              const isActive = paisJugadores === r.id
              return (
                <button key={r.id} onClick={() => setPaisJugadores(r.id)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: isActive ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#C4B5FD' : '#5A5A72',
                    border: isActive ? '1px solid rgba(124,58,237,0.35)' : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: isActive ? '0 2px 12px rgba(124,58,237,0.2)' : 'none',
                    cursor: 'pointer', fontFamily: 'var(--font-sport)',
                  }}>
                  <span>{r.emoji}</span><span>{r.label}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Clubes: Liga */}
        {!isSpecialSport && activeTab === 'clubes' && clubesScope === 'liga' && (
          <FilterPillBar
            filters={clubesLigaFilters}
            active={ligaFilter}
            onChange={setLigaFilter}
            accentColor="#C4B5FD"
          />
        )}

        {/* Clubes: País */}
        {!isSpecialSport && activeTab === 'clubes' && clubesScope === 'pais' && (
          <FilterPillBar
            filters={CLUBES_PAIS_FILTERS}
            active={paisClubes}
            onChange={setPaisClubes}
            accentColor="#fbbf24"
          />
        )}

        {/* ── BARRA DE FILTROS APLICADOS ──────────────────────── */}
        {(() => {
          const applied: AppliedFilter[] = []
          const sportLabel: Record<string, string> = {
            futbol: '⚽ Fútbol', baloncesto: '🏀 Baloncesto', formula1: '🏎️ F1',
            tenis: '🎾 Tenis', ufc: '🥊 UFC', wwe: '🤼 WWE', contenido: '✍️ Contenido',
          }
          if (activeSport) applied.push({
            key: 'sport',
            label: sportLabel[activeSport] ?? activeSport,
            color: sportAccent,
            onClear: () => handleSportChange(''),
          })
          if (!isSpecialSport && activeTab !== 'jugadores') {
            const ent = availableEntities.find(e => e.id === activeTab)
            if (ent) applied.push({
              key: 'entity', label: ent.label, color: sportAccent,
              onClear: () => handleEntityChange('jugadores'),
            })
          }
          if (gender === 'f' && (activeSport === 'futbol' || activeSport === 'ufc' || activeSport === 'tenis')) {
            applied.push({
              key: 'gender',
              label: activeSport === 'tenis' ? 'WTA' : '♀ Femenino',
              color: '#22c55e',
              onClear: () => { setGender('m'); resetFilters() },
            })
          }
          if (!isSpecialSport && activeTab === 'jugadores' && jugadoresScope !== 'global') {
            const scopeLabel: Record<string, string> = {
              liga: 'Por liga', posicion: 'Por posición', sub21: '⭐ Sub-21', pais: 'Por país',
            }
            applied.push({
              key: 'jscope',
              label: scopeLabel[jugadoresScope] ?? jugadoresScope,
              onClear: () => handleJugadoresScopeChange('global'),
            })
          }
          if (!isSpecialSport && activeTab === 'clubes' && clubesScope !== 'global') {
            const scopeLabel: Record<string, string> = { liga: 'Por liga', pais: 'Por país' }
            applied.push({
              key: 'cscope',
              label: scopeLabel[clubesScope] ?? clubesScope,
              onClear: () => handleClubesScopeChange('global'),
            })
          }
          if (ligaFilter) {
            const ligaList = activeTab === 'clubes' ? clubesLigaFilters : jugadoresLigaFilters
            const ligaLabel = ligaList.find(f => f.slug === ligaFilter)?.label ?? ligaFilter
            applied.push({
              key: 'liga', label: `Liga: ${ligaLabel}`, color: '#C4B5FD',
              onClear: () => setLigaFilter(''),
            })
          }
          if (positionFilter) {
            const posLabel = JUGADORES_POSITION_FILTERS.find(f => f.slug === positionFilter)?.label ?? positionFilter
            applied.push({
              key: 'pos', label: `Posición: ${posLabel}`, color: '#86efac',
              onClear: () => setPositionFilter(''),
            })
          }
          if (!isSpecialSport && activeTab === 'jugadores' && jugadoresScope === 'pais' && paisJugadores !== 'europa') {
            const r = JUGADORES_PAIS_REGIONS.find(x => x.id === paisJugadores)
            if (r) applied.push({
              key: 'region', label: `${r.emoji} ${r.label}`, color: '#A78BFA',
              onClear: () => setPaisJugadores('europa'),
            })
          }
          if (!isSpecialSport && activeTab === 'clubes' && clubesScope === 'pais' && paisClubes) {
            const c = CLUBES_PAIS_FILTERS.find(x => x.slug === paisClubes)
            if (c) applied.push({
              key: 'pais', label: c.label, color: '#fbbf24',
              onClear: () => setPaisClubes(''),
            })
          }
          if (activeSport === 'wwe' && subEntity !== 'total') {
            const sLabel: Record<string, string> = {
              masculino: '♂ Masculino', femenino: '♀ Femenino', creadores: 'Creadores',
            }
            applied.push({
              key: 'wwe-sub', label: sLabel[subEntity] ?? subEntity, color: sportAccent,
              onClear: () => setSubEntity('total'),
            })
          }
          // contenido ya no tiene sub-tabs Creadores/Periodistas — sólo filtro de deporte
          if (isContenido && contenidoSport) {
            applied.push({
              key: 'cont-sport',
              label: sportLabel[contenidoSport] ?? contenidoSport,
              color: '#f59e0b',
              onClear: () => setContenidoSport(''),
            })
          }
          if (badgeFilter) {
            const badgeColor: Record<string, string> = {
              'Histórico': '#facc15', 'Revelación': '#22c55e', 'Nuevo': '#60a5fa',
            }
            applied.push({
              key: 'badge', label: badgeFilter, color: badgeColor[badgeFilter],
              onClear: () => setBadgeFilter(''),
            })
          }
          return (
            <AppliedFiltersBar
              filters={applied}
              accent={sportAccent}
              onClearAll={() => {
                setBadgeFilter('')
                setGender('m')
                resetFilters()
                setSubEntity('total')
                setContenidoSport('')
              }}
            />
          )
        })()}

        {/* ── BÚSQUEDA GLOBAL (cross-categoría) ────────────────── */}
        {searchQuery.trim().length >= 2 && (
          <GlobalSearchResults query={searchQuery} />
        )}

        {/* ── SIN RESULTADOS ───────────────────────────────────── */}
        {searchQuery.trim().length < 2 && finalEntries.length === 0 && (
          <div className="py-16 text-center flex flex-col items-center gap-2">
            <span style={{ color: '#5A5A72' }}><SearchIcon size={28} /></span>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
              {q || badgeFilter ? 'Sin coincidencias' : 'Sin datos para esta combinación'}
            </p>
            <p className="text-xs" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
              {q ? `No encontramos a "${searchQuery}" en este ranking.` :
               badgeFilter ? `Ninguna entrada con badge ${badgeFilter} aquí.` :
               'Prueba a cambiar el filtro o seleccionar otro deporte — ampliamos el índice cada semana.'}
            </p>
          </div>
        )}

        {/* ── LISTADO PRINCIPAL ─────────────────────────────────── */}
        {searchQuery.trim().length < 2 && finalEntries.length > 0 && (
          <>
            <div className="flex items-center gap-3 px-4 pb-2 mb-1">
              <span className="w-7 flex-shrink-0" /><span className="w-9 flex-shrink-0" />
              <span className="flex-1 text-[9px] font-black uppercase tracking-widest"
                style={{ color: '#2A2A3A', fontFamily: 'var(--font-sport)' }}>
                Nombre
              </span>
              <span className="hidden xl:block max-w-[260px] flex-shrink-0" />
              <span className="text-[9px] font-black uppercase tracking-widest ml-auto"
                style={{ color: '#2A2A3A', fontFamily: 'var(--font-sport)' }}>
                Puntos
              </span>
              <span className="w-5 flex-shrink-0" />
            </div>

            {/* Con búsqueda activa: lista plana con ranks reales, sin rearrancar en hero */}
            {q ? (
              <div className="flex flex-col gap-2 mb-8">
                {finalEntries.map((entry) => (
                  <RankRow
                    key={entry.id} entry={entry}
                    showSportEmoji={!activeSport && !isContenido}
                    typeTag={typeTagFn?.(entry)}
                  />
                ))}
              </div>
            ) : (
              <>
                {top1 && <div className="mb-2"><TopOneRow entry={top1} showSportEmoji={!activeSport && !isContenido} /></div>}

                {rank2to10.length > 0 && (
                  <div className="flex flex-col gap-2 mb-4">
                    {rank2to10.map((entry) => (
                      <RankRow
                        key={entry.id} entry={entry}
                        showSportEmoji={!activeSport && !isContenido}
                        typeTag={typeTagFn?.(entry)}
                      />
                    ))}
                  </div>
                )}

                <div className="mb-8">
                  <RankBlock label="Posiciones 11 – 25" entries={rank11to25} showSportEmoji={!activeSport && !isContenido} typeTagFn={typeTagFn} defaultOpen />
                  <RankBlock label="Posiciones 26 – 50" entries={rank26to50} showSportEmoji={!activeSport && !isContenido} typeTagFn={typeTagFn} />
                  {rank51on.length > 0 && (
                    <RankBlock label="Posiciones 51+" entries={rank51on} showSportEmoji={!activeSport && !isContenido} typeTagFn={typeTagFn} />
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ── PREDICCIÓN (¿quién será #1 el próximo lunes?) ──────── */}
        {!searchQuery.trim() && (
          <PredictWidget category={
            isContenido ? 'creadores'
              : activeSport === 'wwe' ? (subEntity === 'creadores' ? 'creadores_wwe' : 'jugadores')
              : activeTab === 'clubes' ? (isFemenino ? 'clubes_femenino' : 'clubes')
              : isFemenino ? (activeSport === 'ufc' ? 'luchadoras_ufc' : 'jugadoras')
              : jugadoresScope === 'sub21' ? 'sub21'
              : jugadoresScope === 'pais' ? (paisJugadores === 'latam' ? 'latam' : paisJugadores === 'concacaf' ? 'concacaf' : 'jugadores')
              : 'jugadores'
          } />
        )}

        {/* ── DESTACADOS (solo contenido creadores/periodistas) ─── */}
        {showFeatured && (
          <div className="mt-6 mb-10">
            <div className="flex items-center gap-4 mb-4">
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span className="text-[9px] font-black uppercase tracking-[0.18em] px-3 py-1 rounded-full flex-shrink-0"
                style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)', fontFamily: 'var(--font-sport)' }}>
                ⭐ Destacados
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div className="flex flex-col gap-2">
              {featuredEntries.map((entry) => (
                <FeaturedCard key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        )}

        {/* ── NOTA METODOLÓGICA ────────────────────────────────── */}
        <div className="mt-10 rounded-2xl p-5"
          style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)' }}>
          <div className="flex gap-4 mb-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm mt-0.5"
              style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
              ℹ️
            </div>
            <div>
              <p className="text-xs font-bold mb-1" style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)' }}>
                Cómo funciona el Índice Taka
              </p>
              <p className="text-xs leading-relaxed" style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
                {isContenido ? 'Cada creador o periodista' : 'Cada deportista'} recibe una puntuación de 0 a 100 ponderada en cuatro dimensiones. Toca el
                botón <span className="font-bold" style={{ color: '#C4B5FD' }}>▾ Desglose</span> de cualquier
                fila para ver los valores reales y el ajuste editorial (si lo hay).
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(isContenido ? FACTOR_CARDS_CONTENIDO : FACTOR_CARDS_ATLETA).map(f => (
              <div key={f.label} className="rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${f.color}1F` }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider"
                    style={{ color: f.color, fontFamily: 'var(--font-sport)' }}>
                    {f.label}
                  </span>
                  <span className="text-[10px] font-black tabular-nums"
                    style={{ color: f.color, fontFamily: 'var(--font-display)' }}>
                    {f.pct}
                  </span>
                </div>
                <p className="text-[10px] leading-relaxed"
                  style={{ color: '#6A6A82', fontFamily: 'var(--font-sport)' }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed mt-3"
            style={{ color: '#4A4A62', fontFamily: 'var(--font-sport)' }}>
            El índice se recalcula cada domingo con datos oficiales de ESPN, ATP/WTA, Jolpica F1 y otras fuentes
            públicas. Las tendencias <span style={{ color: '#22c55e' }}>↑</span> /{' '}
            <span style={{ color: '#f87171' }}>↓</span> comparan con la edición anterior. El ajuste editorial
            (máx ±15) es siempre visible y justificado en el desglose.
          </p>
        </div>

      </main>

      <NewsletterSection source="rankings" />
      <Footer />
      <ScrollToTop />
    </div>
  )
}
