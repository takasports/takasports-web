'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import ScrollToTop from '@/components/ScrollToTop'
import NewsletterSection from '@/components/NewsletterSection'
import {
  RANKING_JUGADORES, RANKING_JUGADORES_SUB21, RANKING_CLUBES,
  RANKING_JUGADORAS, RANKING_CLUBES_FEMENINO, RANKING_LUCHADORAS_UFC,
  RANKING_CREADORES, RANKING_PERIODISTAS, RANKING_CREADORES_WWE,
  CLUBES_LIGA_FILTERS, CLUBES_FEMENINO_LIGA_FILTERS, JUGADORAS_LIGA_FILTERS,
  type RankingEntry,
} from '@/lib/rankings'
import { getDisplayScore } from '@/lib/rankings-ui'
import { getSportStyle } from '@/lib/sports'
import { SearchIcon, CrownIcon, FireIcon, TennisIcon, StarIcon } from '@/components/icons/GameIcons'
import RankRow from '@/components/rankings/RankRow'
import TopOneRow from '@/components/rankings/TopOneRow'
import Podium from '@/components/rankings/Podium'
import RankBlock from '@/components/rankings/RankBlock'
import SportPodium from '@/components/rankings/SportPodium'
import FeaturedCard from '@/components/rankings/FeaturedCard'
import FilterPillBar from '@/components/rankings/FilterPillBar'
import SportSelector from '@/components/rankings/SportSelector'
import GlobalSearchResults from '@/components/rankings/GlobalSearchResults'
import AppliedFiltersBar, { type AppliedFilter } from '@/components/rankings/AppliedFiltersBar'
import PredictWidget from '@/components/rankings/PredictWidget'
import { MAX_WEEKLY_DELTA } from '@/lib/rankings-data'
import { agruparPorDeporte } from '@/lib/rankings-por-deporte'
import { useFollowedSports } from '@/lib/useFollowedSports'

// ── Modelo: 3 tracks de alto nivel ────────────────────────────────────
type Track = 'deportista' | 'equipo' | 'creador'

const TRACK_TABS: { id: Track; label: string }[] = [
  { id: 'deportista', label: 'Deportistas' },
  { id: 'equipo',     label: 'Equipos' },
  { id: 'creador',    label: 'Contenido' },
]

// Deportes que ofrece cada track (slugs para SportSelector.only)
// La lucha libre entró aquí el 04/09/2026: sus luchadores YA aparecían en
// «Todos» (Roman Reigns es el nº 1 global), pero no había forma de filtrar por
// ella. Con un podio por deporte el atajo «Ver los N →» necesita un chip al que
// llegar.
const DEPORTISTA_SPORTS = ['', 'futbol', 'baloncesto', 'formula1', 'tenis', 'ufc', 'wwe']
const EQUIPO_SPORTS     = ['', 'futbol', 'baloncesto']
// Creadores: verticales con creadores curados
const CREADOR_SPORTS = ['futbol', 'ufc', 'wwe']
const CREADOR_VERTICALS = [
  { label: 'Todos',  slug: '' },
  { label: 'Fútbol', slug: 'futbol' },
  { label: 'UFC',    slug: 'ufc' },
  { label: 'WWE',    slug: 'wwe' },
]
// Deportes con toggle Femenino en deportistas
const GENDER_SPORTS = ['futbol', 'ufc', 'tenis']

// Ligas por deporte (jugadores masculino). Femenino y clubes usan sus propios sets.
const LIGA_FILTERS_BY_SPORT: Record<string, { label: string; slug: string }[]> = {
  futbol: [
    { label: 'Todas',      slug: '' },
    { label: 'LaLiga',     slug: 'laliga' },
    { label: 'Premier',    slug: 'premier' },
    { label: 'Bundesliga', slug: 'bundesliga' },
    { label: 'Serie A',    slug: 'seriea' },
    { label: 'Ligue 1',    slug: 'ligue1' },
    { label: 'MLS',        slug: 'mls' },
  ],
  baloncesto: [
    { label: 'Todas', slug: '' },
    { label: 'NBA',   slug: 'nba' },
  ],
}

// Tarjetas explicativas del Ranking por track (deportistas vs contenido)
const FACTOR_CARDS_ATLETA = [
  { label: 'Rendimiento', pct: '45%', color: '#22c55e',
    desc: 'Stats reales del deporte: goles y asistencias, PER, ranking mundial, puntos del campeonato. Es el peso principal.' },
  { label: 'Contexto', pct: '20%', color: '#60a5fa',
    desc: 'Nivel de la competición y posición de su equipo en la tabla. Jugar en Top-4 pesa más.' },
  { label: 'Forma', pct: '20%', color: '#c084fc',
    desc: 'Momentum reciente: cómo ha evolucionado su puntuación en las últimas semanas.' },
  { label: 'Mediático', pct: '15%', color: '#f59e0b',
    desc: 'Alcance y popularidad, medido por las visitas a su página de Wikipedia.' },
]
const FACTOR_CARDS_CONTENIDO = [
  { label: 'Audiencia', pct: '50%', color: '#f59e0b',
    desc: 'Seguidores reales ponderados por plataforma (YouTube, Twitch, TikTok, Instagram, X). Es el peso principal.' },
  { label: 'Crecimiento', pct: '25%', color: '#22c55e',
    desc: 'Ritmo de publicación y evolución reciente de su audiencia.' },
  { label: 'Relevancia', pct: '25%', color: '#c084fc',
    desc: 'Si su gente de verdad le ve: visitas de sus últimos vídeos en relación a su número de seguidores.' },
]

// Cabecera de columnas de la TABLA (no de los podios).
function ColumnHeader() {
  return (
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
  )
}

type DbData = Partial<Record<string, RankingEntry[]>>

// Cuándo vuelve a recalcularse. Espejo del launchd que dispara
// scripts/weekly-rankings.mjs (com.taka.weekly-rankings-update): domingos a las
// 23:45 y miércoles a las 22:00. Si allí cambia el horario, aquí también.
const PASADAS = [
  { dia: 0, hora: 23, min: 45 },  // domingo
  { dia: 3, hora: 22, min: 0 },   // miércoles
]
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function proximaActualizacion(ahora: Date): string {
  let proxima: Date | null = null
  for (const p of PASADAS) {
    for (let suma = 0; suma <= 7; suma++) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + suma, p.hora, p.min)
      if (d.getDay() !== p.dia || d <= ahora) continue
      if (!proxima || d < proxima) proxima = d
      break
    }
  }
  if (!proxima) return 'esta semana'
  const dias = Math.round(
    (new Date(proxima.getFullYear(), proxima.getMonth(), proxima.getDate()).getTime() -
      new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime()) / 86400000,
  )
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'
  return `el ${DIAS[proxima.getDay()]}`
}

export default function RankingsClient({
  dbData         = {},
  lastUpdated,
}: {
  dbData?:         DbData
  lastUpdated?:    string
}) {
  // Helper: DB data si tiene entries, si no el estático
  const db = (cat: string, fallback: RankingEntry[]): RankingEntry[] =>
    (dbData[cat] && dbData[cat]!.length > 0) ? dbData[cat]! : fallback
  const router = useRouter()
  const searchParams = useSearchParams()

  const trackParam = searchParams.get('track')
  const initialTrack: Track =
    trackParam === 'equipo' || trackParam === 'creador' ? trackParam : 'deportista'
  const initialSport   = searchParams.get('deporte') ?? ''
  const initialLiga    = searchParams.get('liga') ?? ''
  const initialGender  = searchParams.get('gender') === 'f' ? 'f' : 'm'
  const initialCantera = searchParams.get('cantera') === '1'
  const initialQuery = searchParams.get('q') ?? ''

  const [track, setTrack]                   = useState<Track>(initialTrack)
  const [activeSport, setActiveSport]       = useState(initialSport)
  const [gender, setGender]                 = useState<'m' | 'f'>(initialGender)
  const [ligaFilter, setLigaFilter]         = useState(initialLiga)
  const [cantera, setCantera]               = useState(initialCantera)
  const [sortMode, setSortMode]             = useState<'score' | 'hot'>('score')
  const [toolsOpen, setToolsOpen]           = useState(false)
  const [searchQuery, setSearchQuery]       = useState(initialQuery)
  // Ordena los podios de «Todos»: lo tuyo primero. Llega vacío en el primer
  // render (localStorage solo existe tras hidratar) → el HTML del servidor y el
  // del cliente coinciden, y el orden personal entra después.
  const { sports: deportesSeguidos } = useFollowedSports()

  const isCreador = track === 'creador'
  const sportAccent = activeSport && !isCreador ? getSportStyle(activeSport).accent : (isCreador ? '#f59e0b' : '#7C3AED')
  const sportBackdrop = ({ futbol: 'futbol', baloncesto: 'nba', formula1: 'f1', tenis: 'tenis', ufc: 'ufc', wwe: 'wwe' } as Record<string, string>)[activeSport] ?? null

  const isFemenino = gender === 'f' && !isCreador && (
    (track === 'deportista' && GENDER_SPORTS.includes(activeSport)) ||
    (track === 'equipo' && activeSport === 'futbol')
  )

  // Tipo (Creador/Periodista) por id para el track creadores
  const contenidoTypeMap = useMemo(() => {
    const m = new Map<string, 'Creador' | 'Periodista'>()
    db('creadores', RANKING_CREADORES).forEach(e => m.set(e.id, 'Creador'))
    db('periodistas', RANKING_PERIODISTAS).forEach(e => m.set(e.id, 'Periodista'))
    db('creadores_wwe', RANKING_CREADORES_WWE).forEach(e => m.set(e.id, 'Creador'))
    return m
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbData])

  // Filtra categoría DB por deporte; cae a estático si la DB no tiene ese deporte
  // (así los deportes de score bajo —F1, tenis— que no entran en el top-N de la DB
  // siguen mostrándose desde el dataset curado).
  const dbSportFilter = (cat: string, fallback: RankingEntry[], sport: string): RankingEntry[] => {
    const fromDb = db(cat, fallback).filter(e => e.sport === sport)
    if (fromDb.length > 0) return fromDb
    return fallback.filter(e => e.sport === sport)
  }

  // ── Resolver entries por track ────────────────────────────────────
  let entries: RankingEntry[] = []

  if (isCreador) {
    // CONTENIDO: creadores y periodistas en una sola lista. Estuvieron separados
    // mientras sus notas no eran comparables — la del creador salía de datos y la
    // del periodista estaba puesta a mano. Desde que los periodistas pasan por el
    // mismo pipeline (audiencia real de Instagram y YouTube, crecimiento,
    // engagement) miden lo mismo y separarlos ya no tenía sentido.
    const byId = new Map<string, RankingEntry>()
    for (const e of [
      ...db('creadores',     RANKING_CREADORES).filter(e => !e.featured),
      ...db('periodistas',   RANKING_PERIODISTAS).filter(e => !e.featured),
      ...db('creadores_wwe', RANKING_CREADORES_WWE).filter(e => !e.featured),
    ]) byId.set(e.id, e)
    entries = [...byId.values()]
      .filter(e => CREADOR_SPORTS.includes(e.sport ?? '') && (!activeSport || e.sport === activeSport))
      .sort((a, b) => getDisplayScore(b) - getDisplayScore(a))
  } else if (track === 'equipo') {
    const base = isFemenino
      ? db('clubes_femenino', RANKING_CLUBES_FEMENINO)
      : activeSport
        ? dbSportFilter('clubes', RANKING_CLUBES, activeSport)
        : db('clubes', RANKING_CLUBES)
    entries = ligaFilter ? base.filter(e => e.league === ligaFilter) : base
  } else {
    // deportista
    if (cantera) {
      // Cantera = flag age_group='sub21' (folded en jugadores/jugadoras) + categoría sub21
      const pool = new Map<string, RankingEntry>()
      for (const e of [...db('jugadores', RANKING_JUGADORES), ...db('jugadoras', RANKING_JUGADORAS)]) {
        if (e.ageGroup === 'sub21') pool.set(e.id, e)
      }
      for (const e of db('sub21', RANKING_JUGADORES_SUB21)) pool.set(e.id, e)
      let base = [...pool.values()]
      if (activeSport) base = base.filter(e => e.sport === activeSport)
      entries = base
    } else if (isFemenino) {
      entries = activeSport === 'ufc'
        ? db('luchadoras_ufc', RANKING_LUCHADORAS_UFC)
        : activeSport === 'tenis'
          ? db('jugadoras', RANKING_JUGADORAS).filter(e => e.sport === 'tenis')
          : db('jugadoras', RANKING_JUGADORAS)
    } else {
      entries = activeSport
        ? dbSportFilter('jugadores', RANKING_JUGADORES, activeSport)
        : db('jugadores', RANKING_JUGADORES)
    }
    if (ligaFilter) entries = entries.filter(e => e.league === ligaFilter)
  }

  // Dedup por id + orden por score + re-rank secuencial 1..N
  {
    const seen = new Set<string>()
    entries = entries.filter(e => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
  }
  entries = [...entries]
    .sort((a, b) => getDisplayScore(b) - getDisplayScore(a))
    .map((e, i) => ({ ...e, rank: i + 1, _globalRank: e.rank }))

  // ── URL sync ──────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams()
    if (track !== 'deportista') params.set('track', track)
    if (activeSport) params.set('deporte', activeSport)
    if (ligaFilter) params.set('liga', ligaFilter)
    if (gender === 'f') params.set('gender', 'f')
    if (cantera) params.set('cantera', '1')
    if (searchQuery.trim()) params.set('q', searchQuery.trim())
    const query = params.toString()
    router.replace(query ? `?${query}` : '?', { scroll: false })
  }, [track, activeSport, ligaFilter, gender, cantera, searchQuery, router])

  // ── Handlers ─────────────────────────────────────────────────────
  const handleTrackChange = (t: Track) => {
    setTrack(t)
    setActiveSport('')
    setGender('m')
    setLigaFilter('')
    setCantera(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const handleSportChange = (sport: string) => {
    setActiveSport(sport)
    setLigaFilter('')
    setGender('m')
  }

  // Sort opcional "Hot now" (delta acotado a ±MAX_WEEKLY_DELTA)
  const hasHotData = entries.some(e => e.scorePrev !== undefined)
  const clampDelta = (d: number) => Math.max(-MAX_WEEKLY_DELTA, Math.min(MAX_WEEKLY_DELTA, d))
  const sortedEntries = (sortMode === 'hot' && hasHotData)
    ? [...entries].sort((a, b) => {
        const da = a.scorePrev !== undefined ? clampDelta(getDisplayScore(a) - a.scorePrev) : -99
        const db2 = b.scorePrev !== undefined ? clampDelta(getDisplayScore(b) - b.scorePrev) : -99
        return db2 - da
      }).map((e, i) => ({ ...e, rank: i + 1 }))
    : entries

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = norm(searchQuery.trim())
  const finalEntries = sortedEntries
    .filter(e => !q || norm(e.name).includes(q) || norm(e.subtitle).includes(q))

  const listScores = finalEntries.map(getDisplayScore)
  const listMaxScore = listScores.length ? Math.max(...listScores) : undefined
  const listMinScore = listScores.length ? Math.min(...listScores) : undefined

  const top1       = finalEntries[0]
  const rank2to10  = finalEntries.slice(1, 10)
  const topThree   = finalEntries.slice(0, 3)
  const rank4to10  = finalEntries.slice(3, 10)
  const rank11to25 = finalEntries.slice(10, 25)
  const rank26to50 = finalEntries.slice(25, 50)
  const rank51on   = finalEntries.slice(50)

  // Liga filters según track / deporte / género
  const ligaFilters =
    track === 'equipo'
      ? (isFemenino ? CLUBES_FEMENINO_LIGA_FILTERS : CLUBES_LIGA_FILTERS)
      : (isFemenino ? JUGADORAS_LIGA_FILTERS : (LIGA_FILTERS_BY_SPORT[activeSport] ?? []))
  const showLiga = !isCreador && (activeSport === 'futbol' || activeSport === 'baloncesto') && ligaFilters.length > 0

  const showGenderToggle = !isCreador && (
    (track === 'deportista' && GENDER_SPORTS.includes(activeSport)) ||
    (track === 'equipo' && activeSport === 'futbol')
  )

  const typeTagFn = isCreador
    ? (e: RankingEntry) => contenidoTypeMap.get(e.id)
    : undefined

  const showSportEmoji = !activeSport && !isCreador

  // ── Podios por deporte (solo en «Todos») ───────────────────────────
  // Mezclar deportes en una sola escalera hacía que el nº 1 del deporte fuera un
  // luchador de la WWE por delante de Bellingham y de Sinner: las notas se
  // calculan con fuentes distintas por deporte y no son comparables entre sí.
  // Cada deporte tiene ahora su podio; la lista mezclada se conserva ENTERA
  // debajo (José Tomás, 04/09/2026).
  const ordenDeportes = isCreador
    ? CREADOR_SPORTS
    : track === 'equipo'
      ? EQUIPO_SPORTS.filter(Boolean)
      : DEPORTISTA_SPORTS.filter(Boolean)
  // En «Hot now» la lista va ordenada por lo que MÁS SUBE esta semana, no por
  // nota: un pedestal de oro/plata/bronce ahí diría algo que no es. Ese orden
  // conserva la lista de siempre.
  const podios = (!q && !activeSport && sortMode === 'score')
    ? agruparPorDeporte(finalEntries, ordenDeportes, deportesSeguidos, 3)
    : []
  // Con un solo deporte no hay nada que separar: se queda la vista de siempre.
  const mostrarPodios = podios.length >= 2

  const abrirDeporte = (sport: string) => {
    handleSportChange(sport)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div data-sport={activeSport || undefined} style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24">

        {/* ── HERO ─────────────────────────────────────────────── */}
        <div className="relative pt-6 pb-4 overflow-hidden">
          {sportBackdrop && (
            <>
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: `url(/banners/signal/${sportBackdrop}.webp)`, backgroundSize: 'cover', backgroundPosition: 'center 32%', opacity: 0.4 }}
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
                    // Días de CALENDARIO, no milisegundos entre medias: el
                    // pipeline corre a las 22:00 y a las 23:45, así que a la una
                    // de la madrugada del día siguiente habían pasado 3 horas
                    // —cero días redondeando hacia abajo— y el sello decía
                    // «Actualizado hoy · 5 ago 2026» un 6 de agosto,
                    // contradiciéndose a sí mismo en la misma línea.
                    const soloFecha = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
                    const diffDays = Math.round((soloFecha(now) - soloFecha(d)) / 86400000)
                    const label = diffDays <= 0 ? 'hoy' : diffDays === 1 ? 'ayer' : `hace ${diffDays} días`
                    // Decir cuándo vuelve a cambiar es lo único que le faltaba
                    // a la cabecera para tener calendario: el ranking se
                    // recalcula solo, pero no lo contaba en ninguna parte.
                    return `Actualizado ${label} · ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · próxima ${proximaActualizacion(now)}`
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
              Ranking <span style={{ color: '#9B7CF6' }}>Taka</span>
            </h1>
            <p className="text-sm max-w-xl mx-auto leading-relaxed"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
              {/* Los cuatro factores REALES (migración 110): rendimiento 45,
                  contexto 20, mediático 15, forma 20. El texto anterior
                  prometía «estadística» y «percepción pública» — esta última
                  era el factor subjetivo que se retiró justamente para que el
                  ranking no dependiera de opiniones.

                  El ritmo de actualización NO va aquí: lo dice el sello de
                  arriba («próxima el domingo»), y repetirlo costaba una línea
                  entera de las tres que ocupa este párrafo en móvil. */}
              Rankings propios de Taka: rendimiento medido, nivel de competición,
              repercusión mediática y forma reciente.
            </p>
            {/* Reyes del deporte, Comparador y Mi Top son herramientas, no la
                razón por la que alguien abre un ranking. Como tres botones
                grandes competían con las pestañas que hay justo debajo —dos
                niveles de navegación discutiendo por el mismo sitio— y metían
                casi una pantalla de cabecera antes del primer nombre en móvil.
                Ahora es un solo control que se abre si lo buscas. */}
            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                onClick={() => setToolsOpen(o => !o)}
                aria-expanded={toolsOpen}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.16em] transition-all hover:brightness-125"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#8A8AA0', border: '1px solid rgba(255,255,255,0.09)', cursor: 'pointer', fontFamily: 'var(--font-sport)' }}
              >
                Herramientas <span style={{ fontSize: 8 }}>{toolsOpen ? '▲' : '▼'}</span>
              </button>
              {toolsOpen && (
            <div className="flex justify-center gap-2 flex-wrap">
              <Link
                href="/rankings/todos"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.16em] transition-all hover:brightness-125"
                style={{ background: 'rgba(196,181,253,0.12)', color: '#C4B5FD', border: '1px solid rgba(196,181,253,0.3)', fontFamily: 'var(--font-sport)' }}
              >
                👑 Reyes del deporte <span style={{ color: '#7C3AED' }}>→</span>
              </Link>
              <Link
                href="/rankings/comparar"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.16em] transition-all hover:brightness-125"
                style={{ background: 'rgba(124,58,237,0.12)', color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.3)', fontFamily: 'var(--font-sport)' }}
              >
                ⚖️ Comparador <span style={{ color: '#7C3AED' }}>→</span>
              </Link>
              <Link
                href="/rankings/mi-top"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.16em] transition-all hover:brightness-125"
                style={{ background: 'rgba(248,113,113,0.10)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.25)', fontFamily: 'var(--font-sport)' }}
              >
                ❤ Mi Top
              </Link>
            </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 1. TRACK TABS (Deportistas / Equipos / Creadores) ── */}
        <div
          role="tablist"
          aria-label="Tipo de ranking"
          className="flex gap-1 overflow-x-auto scrollbar-hide"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {TRACK_TABS.map((t) => {
            const isActive = track === t.id
            return (
              <button key={t.id} role="tab" aria-selected={isActive}
                onClick={() => handleTrackChange(t.id)}
                className="flex-shrink-0 px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                style={{
                  fontFamily: 'var(--font-sport)',
                  color: isActive ? sportAccent : 'var(--text-muted)',
                  background: 'none', border: 'none',
                  borderBottom: isActive ? `2px solid ${sportAccent}` : '2px solid transparent',
                  marginBottom: -1, cursor: 'pointer',
                }}>
                {t.label}
              </button>
            )
          })}
        </div>

        {/* ── 2. SELECTOR DE DEPORTE / VERTICAL ─────────────────── */}
        <div className="mt-4 mb-2">
          {isCreador ? (
            <FilterPillBar filters={CREADOR_VERTICALS} active={activeSport} onChange={handleSportChange} accentColor="#f59e0b" />
          ) : (
            <SportSelector active={activeSport} onChange={handleSportChange} only={track === 'equipo' ? EQUIPO_SPORTS : DEPORTISTA_SPORTS} />
          )}
        </div>

        {/* ── Toggle Femenino ───────────────────────────────────── */}
        {showGenderToggle && (
          <div className="flex items-center gap-1.5 mt-1 mb-1">
            {(['m', 'f'] as const).map(g => {
              const isActive = gender === g
              return (
                <button key={g} onClick={() => { setGender(g); setLigaFilter('') }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                  style={{
                    background: isActive ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#22c55e' : 'var(--text-muted)',
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

        {/* ── Cantera (Sub-21) — solo deportistas ───────────────── */}
        {track === 'deportista' && (
          <div className="flex items-center gap-1.5 mt-2 mb-1">
            <button onClick={() => setCantera(c => !c)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
              style={{
                background: cantera ? 'rgba(255,203,87,0.16)' : 'rgba(255,255,255,0.04)',
                color: cantera ? '#ffcb57' : 'var(--text-muted)',
                border: cantera ? '1px solid rgba(255,203,87,0.4)' : '1px solid rgba(255,255,255,0.07)',
                cursor: 'pointer', fontFamily: 'var(--font-sport)',
              }}>
              <StarIcon size={11} /> Cantera Sub-21
            </button>
          </div>
        )}

        {/* ── BÚSQUEDA + FILTRO BADGE ──────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3 mt-3">
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
                color: '#D0D0E0', fontFamily: 'var(--font-sport)',
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
        </div>

        <div className="flex items-center justify-between gap-2 mb-6 mt-2">
          <span className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: isCreador ? '#f59e0b50' : `${sportAccent}50`, fontFamily: 'var(--font-sport)' }}>
            {isCreador ? '✦ Ranking editorial · Top curado por disciplina' : '✦ Ranking deportivo · Top 100 ampliable'}
          </span>
          {(!isCreador && hasHotData) && (
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

        {/* ── Liga ──────────────────────────────────────────────── */}
        {showLiga && (
          <FilterPillBar
            filters={ligaFilters}
            active={ligaFilter}
            onChange={setLigaFilter}
            accentColor="#C4B5FD"
          />
        )}

        {/* ── BARRA DE FILTROS APLICADOS ──────────────────────── */}
        {(() => {
          const applied: AppliedFilter[] = []
          const sportLabel: Record<string, string> = {
            futbol: '⚽ Fútbol', baloncesto: '🏀 Baloncesto', formula1: '🏎️ F1',
            tenis: '🎾 Tenis', ufc: '🥊 UFC', wwe: '🤼 WWE',
          }
          if (activeSport) applied.push({
            key: 'sport',
            label: sportLabel[activeSport] ?? activeSport,
            color: sportAccent,
            onClear: () => handleSportChange(''),
          })
          if (isFemenino) applied.push({
            key: 'gender',
            label: activeSport === 'tenis' ? 'WTA' : '♀ Femenino',
            color: '#22c55e',
            onClear: () => { setGender('m'); setLigaFilter('') },
          })
          if (cantera) applied.push({
            key: 'cantera', label: '⭐ Cantera Sub-21', color: '#ffcb57',
            onClear: () => setCantera(false),
          })
          if (ligaFilter) {
            const ligaLabel = ligaFilters.find(f => f.slug === ligaFilter)?.label ?? ligaFilter
            applied.push({
              key: 'liga', label: `Liga: ${ligaLabel}`, color: '#C4B5FD',
              onClear: () => setLigaFilter(''),
            })
          }
          return (
            <AppliedFiltersBar
              filters={applied}
              accent={sportAccent}
              onClearAll={() => {
                setGender('m')
                setActiveSport('')
                setLigaFilter('')
                setCantera(false)
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
              {q ? 'Sin coincidencias' : 'Sin datos para esta combinación'}
            </p>
            <p className="text-xs" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
              {q ? `No encontramos a "${searchQuery}" en este ranking.` :
               'Prueba a cambiar el filtro o seleccionar otro deporte — ampliamos el índice cada semana.'}
            </p>
          </div>
        )}

        {/* ── LISTADO PRINCIPAL ─────────────────────────────────── */}
        {searchQuery.trim().length < 2 && finalEntries.length > 0 && (
          <>
            {!mostrarPodios && <ColumnHeader />}

            {!q && mostrarPodios ? (
              <>
                {podios.some(g => g.seguido) && (
                  <p className="flex items-center gap-2.5 px-1 pb-2 text-[9.5px] font-black uppercase tracking-[0.18em]"
                    style={{ color: '#4A4A62', fontFamily: 'var(--font-sport)' }}>
                    Tus deportes
                    <span aria-hidden="true" className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                  </p>
                )}
                {podios.map((g, i) => (
                  <div key={g.sport}>
                    {/* Separador entre lo tuyo y el resto: solo donde cambia. */}
                    {g.seguido === false && podios[i - 1]?.seguido === true && (
                      <p className="flex items-center gap-2.5 px-1 pt-3 pb-2 text-[9.5px] font-black uppercase tracking-[0.18em]"
                        style={{ color: '#4A4A62', fontFamily: 'var(--font-sport)' }}>
                        El resto
                        <span aria-hidden="true" className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                      </p>
                    )}
                    <SportPodium
                      sport={g.sport} entries={g.entries} total={g.total} seguido={g.seguido}
                      onOpen={abrirDeporte} maxScore={listMaxScore} minScore={listMinScore}
                    />
                  </div>
                ))}

                <div className="mt-6 pt-5 mb-8" style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}>
                  <h2 className="font-black" style={{ fontFamily: 'var(--font-display)', fontSize: 21, color: '#F8F8FF', letterSpacing: '-0.01em' }}>
                    Todos los deportes
                  </h2>
                  <p className="text-[11.5px] mt-1 mb-3" style={{ color: '#6A6A82', fontFamily: 'var(--font-sport)' }}>
                    La lista completa, mezclando deportes. {finalEntries.length} {finalEntries.length === 1 ? 'nombre' : 'nombres'}.
                  </p>
                  <ColumnHeader />
                  <RankBlock label="Posiciones 1 – 25" entries={finalEntries.slice(0, 25)} showSportEmoji={showSportEmoji} typeTagFn={typeTagFn} maxScore={listMaxScore} minScore={listMinScore} defaultOpen />
                  <RankBlock label="Posiciones 26 – 50" entries={rank26to50} showSportEmoji={showSportEmoji} typeTagFn={typeTagFn} maxScore={listMaxScore} minScore={listMinScore} />
                  {rank51on.length > 0 && (
                    <RankBlock label="Posiciones 51+" entries={rank51on} showSportEmoji={showSportEmoji} typeTagFn={typeTagFn} maxScore={listMaxScore} minScore={listMinScore} />
                  )}
                </div>
              </>
            ) : q ? (
              <div className="flex flex-col gap-2 mb-8">
                {finalEntries.map((entry) => (
                  <RankRow
                    key={entry.id} entry={entry}
                    showSportEmoji={showSportEmoji}
                    typeTag={typeTagFn?.(entry)}
                    maxScore={listMaxScore} minScore={listMinScore}
                  />
                ))}
              </div>
            ) : (
              <>
                {topThree.length === 3 ? (
                  <>
                    <Podium entries={topThree} accent={sportAccent} showSportEmoji={showSportEmoji} />
                    {rank4to10.length > 0 && (
                      <div className="flex flex-col gap-2 mb-4">
                        {rank4to10.map((entry) => (
                          <RankRow
                            key={entry.id} entry={entry}
                            showSportEmoji={showSportEmoji}
                            typeTag={typeTagFn?.(entry)}
                            maxScore={listMaxScore} minScore={listMinScore}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {top1 && <div className="mb-2"><TopOneRow entry={top1} showSportEmoji={showSportEmoji} /></div>}
                    {rank2to10.length > 0 && (
                      <div className="flex flex-col gap-2 mb-4">
                        {rank2to10.map((entry) => (
                          <RankRow
                            key={entry.id} entry={entry}
                            showSportEmoji={showSportEmoji}
                            typeTag={typeTagFn?.(entry)}
                            maxScore={listMaxScore} minScore={listMinScore}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div className="mb-8">
                  <RankBlock label="Posiciones 11 – 25" entries={rank11to25} showSportEmoji={showSportEmoji} typeTagFn={typeTagFn} maxScore={listMaxScore} minScore={listMinScore} defaultOpen />
                  <RankBlock label="Posiciones 26 – 50" entries={rank26to50} showSportEmoji={showSportEmoji} typeTagFn={typeTagFn} maxScore={listMaxScore} minScore={listMinScore} />
                  {rank51on.length > 0 && (
                    <RankBlock label="Posiciones 51+" entries={rank51on} showSportEmoji={showSportEmoji} typeTagFn={typeTagFn} maxScore={listMaxScore} minScore={listMinScore} />
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ── PREDICCIÓN (¿quién será #1 el próximo lunes?) ──────── */}
        {!searchQuery.trim() && (
          <PredictWidget category={
            isCreador ? 'creadores'
              : track === 'equipo' ? (isFemenino ? 'clubes_femenino' : 'clubes')
              : cantera ? 'sub21'
              : isFemenino ? (activeSport === 'ufc' ? 'luchadoras_ufc' : 'jugadoras')
              : 'jugadores'
          } />
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
                Cómo funciona el Ranking Taka
              </p>
              <p className="text-xs leading-relaxed" style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
                {isCreador ? 'Cada creador o periodista' : 'Cada deportista'} recibe una puntuación de 0 a 100 ponderada en cuatro dimensiones. Toca el
                botón <span className="font-bold" style={{ color: '#C4B5FD' }}>▾ Desglose</span> de cualquier
                fila para ver los valores reales y el ajuste editorial (si lo hay).
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {(isCreador ? FACTOR_CARDS_CONTENIDO : FACTOR_CARDS_ATLETA).map(f => (
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

      </div>

      <NewsletterSection source="rankings" />
      <ScrollToTop />
    </div>
  )
}
