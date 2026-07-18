'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { PodiumMedal } from '@/components/icons/GameIcons'
import NewsletterSection from '@/components/NewsletterSection'
import ScrollToTop from '@/components/ScrollToTop'
import { StatBlockBoundary } from '@/components/StatBlockBoundary'
import { trackStatsBlockOpen, trackStatsGroupOpen, trackSearch } from '@/lib/analytics'
import { StatsSearchModal, type SearchableRow } from '@/components/StatsSearchModal'
import MundialBracket from '@/components/mundial/MundialBracket'
import type { StatBlock } from './stats-types'
import { FUTBOL_FEMENINO_BLOCKS, LEAGUE_FILTERS, SECTION_BLOCK_COUNT, SPORTS, TeamLeagueContext, buildTeamLeague } from './sports-config'
import { BLOCK_TO_META_KEY, LIVE_BLOCK_IDS, LIVE_PLAYER_BLOCK_IDS, applyLivePlayerToBlock, getBlockMeta, toStatRows, type LivePlayerData, type LiveStandingsData } from './live-data'
import { MetricGroupAccordion, PlayoffSeriesCard, StatBlockCard } from './StatCards'
import { WC_START, WorldCupCountdown, WorldCupGroupCard } from './MundialCards'
import { ResumenView } from './ResumenView'
import { buildStatsUrl, parseStatsLocation } from './stats-url'
export default function EstadisticasClient({ initialData, initialSport }: { initialData?: LiveStandingsData | null; initialSport?: string }) {
  const searchParams = useSearchParams()

  // El deporte inicial viene del prop (ruta /estadisticas/[sport]); si no, se lee
  // de ?sport= (compatibilidad con enlaces antiguos) y por defecto 'Destacados'.
  const initialSportId = (() => {
    if (initialSport && SPORTS.find(s => s.id === initialSport)) return initialSport
    const sp = searchParams.get('sport') ?? ''
    return SPORTS.find(s => s.id === sp) ? sp : 'resumen'
  })()

  const [sportId, setSportId] = useState<string>(initialSportId)
  const [sectionId, setSectionId] = useState<string>(() => {
    const sec = searchParams.get('section') ?? ''
    const sport = SPORTS.find(s => s.id === initialSportId) ?? SPORTS[0]
    return sport.sections.find(s => s.id === sec) ? sec : sport.sections[0].id
  })
  const [expandedBlocks, setExpandedBlocks]   = useState<Record<string, boolean>>({})
  const [expandedGroups, setExpandedGroups]   = useState<Record<string, boolean>>(() => {
    const firstGroupId = SPORTS[0].sections[0].groups?.[0]?.id
    return firstGroupId ? { [firstGroupId]: true } : {}
  })
  const [leagueFilter, setLeagueFilter]       = useState('General')
  const [gender, setGender]                   = useState<'m' | 'f'>(() =>
    initialSportId === 'futbol' && searchParams.get('gender') === 'f' ? 'f' : 'm'
  )
  const [liveData, setLiveData]               = useState<LiveStandingsData | null>(initialData ?? null)
  const [livePlayerData, setLivePlayerData]   = useState<LivePlayerData | null>(null)
  const [lastUpdated, setLastUpdated]         = useState<Date | null>(null)
  const [fetchError, setFetchError]           = useState<string | null>(null)
  const [refreshing, setRefreshing]           = useState(false)
  const [updatedFlash, setUpdatedFlash]       = useState(false)
  const [searchOpen, setSearchOpen]           = useState(false)
  const [favorites, setFavorites]             = useState<Set<string>>(() => new Set())
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [hideUnavailable, setHideUnavailable] = useState(true)

  // Load favorites + ocultar-vacíos preference from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ts_stats_favorites')
      if (raw) setFavorites(new Set(JSON.parse(raw)))
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem('ts_stats_hide_unavailable')
      if (raw === '0') setHideUnavailable(false)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try { localStorage.setItem('ts_stats_hide_unavailable', hideUnavailable ? '1' : '0') } catch { /* ignore */ }
  }, [hideUnavailable])

  // Sello "última actualización" solo en cliente: el valor inicial se calcula
  // tras montar para evitar un mismatch de hidratación (hora UTC del servidor en
  // SSR ≠ hora local del cliente, que se renderiza con toLocaleTimeString).
  useEffect(() => {
    if (initialData) setLastUpdated(new Date())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Botón "atrás" del navegador navega por las subsecciones ──────────
  // Antes cada cambio de deporte/sección usaba replaceState, así que el
  // historial no recordaba la ruta interna y "atrás" echaba de Estadísticas
  // de un tirón. Ahora: al montar sellamos la entrada actual con el estado de
  // navegación (preservando los marcadores internos de Next para no forzar
  // recargas en popstate), los cambios hacen pushState, y este listener
  // restaura deporte/sección/género al retroceder. Solo el último "atrás" sale.
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.history.replaceState(
      { ...window.history.state, tsNav: { sportId, sectionId, gender } },
      ''
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPop = (e: PopStateEvent) => {
      if (!window.location.pathname.startsWith('/estadisticas')) return
      const nav = (e.state as { tsNav?: { sportId?: string; sectionId?: string; gender?: 'm' | 'f' } } | null)?.tsNav
      const loc = nav ?? parseStatsLocation()
      const nextSport = SPORTS.find(s => s.id === loc.sportId) ?? SPORTS[0]
      const nextSec = nextSport.sections.find(s => s.id === loc.sectionId) ?? nextSport.sections[0]
      const g: 'm' | 'f' = nextSport.id === 'futbol' && loc.gender === 'f' ? 'f' : 'm'
      setSportId(nextSport.id)
      setGender(g)
      setSectionId(nextSec.id)
      setExpandedBlocks({})
      setExpandedGroups(nextSec.groups ? { [nextSec.groups[0]?.id ?? '']: true } : {})
      setLeagueFilter('General')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleFav = React.useCallback((blockId: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      try { localStorage.setItem('ts_stats_favorites', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }, [])

  const POLL_MS = 5 * 60_000

  const refreshOnceRef    = useRef<() => void>(() => {})
  const fetchPlayersRef   = useRef<() => void>(() => {})
  const hasLoadedPlayersRef = useRef(false)

  // Main polling — standings only (always active)
  useEffect(() => {
    let cancelled = false
    const fetchStandings = async () => {
      setRefreshing(true)
      try {
        const standings = await fetch('/api/stats/standings').then(r => r.ok ? r.json() : Promise.reject(new Error(`standings ${r.status}`)))
        if (cancelled) return
        if (standings) {
          // Show flash only if this isn't the very first hydration
          const isUpdate = !!liveData && standings.updatedAt !== liveData.updatedAt
          setLiveData(standings)
          if (isUpdate) {
            setUpdatedFlash(true)
            setTimeout(() => setUpdatedFlash(false), 2200)
          }
        }
        setLastUpdated(new Date())
        setFetchError(null)
      } catch (err) {
        if (cancelled) return
        setFetchError(err instanceof Error ? err.message : 'Error de red')
      } finally {
        if (!cancelled) setRefreshing(false)
      }
    }
    refreshOnceRef.current = fetchStandings
    // initialData puede venir "shardeado" a un solo deporte (SSR de ?sport=X):
    // faltan las keys del resto de deportes. Sin un fetch full tras hidratar,
    // cambiar de pestaña renderiza un deporte sin datos. Traemos el payload
    // completo en background si detectamos un shard parcial.
    const partial = initialData as Partial<LiveStandingsData> | null | undefined
    const isPartialShard = !!partial && (
      partial.football === undefined ||
      partial.nbaEast === undefined ||
      partial.f1Drivers === undefined
    )
    if (!initialData || isPartialShard) fetchStandings()
    const interval = setInterval(fetchStandings, POLL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lazy players — only fetched when viewing fútbol masculino
  useEffect(() => {
    if (sportId !== 'futbol' || gender !== 'm') return
    let cancelled = false
    const fetchPlayers = async () => {
      try {
        const players = await fetch('/api/stats/players').then(r => r.ok ? r.json() : Promise.reject(new Error(`players ${r.status}`)))
        if (cancelled) return
        if (players) { setLivePlayerData(players); hasLoadedPlayersRef.current = true }
      } catch { /* non-critical, silent */ }
    }
    fetchPlayersRef.current = fetchPlayers
    if (!hasLoadedPlayersRef.current) fetchPlayers()
    const interval = setInterval(fetchPlayers, POLL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sportId, gender])

  function applyLive(blocks: StatBlock[]): StatBlock[] {
    return blocks.map(block => {
      // Standings data
      if (liveData) {
        const league = liveData.football?.find(l => l.id === block.id)
        if (league?.rows.length) return { ...block, rows: toStatRows(league.rows, undefined, league.leagueSlug), placeholder: false }
        // Knockout phase: standings empty → fallback to live fixtures
        if (block.id === 'tabla-ucl' && liveData.uclFixtures?.length)
          return { ...block, title: 'Champions League · Fase KO', rows: toStatRows(liveData.uclFixtures), placeholder: false, cardType: 'fixtures' }
        if (block.id === 'tabla-uel' && liveData.uelFixtures?.length)
          return { ...block, title: 'Europa League · Fase KO', rows: toStatRows(liveData.uelFixtures), placeholder: false, cardType: 'fixtures' }
        if (block.id === 'nba-este'        && liveData.nbaEast?.length)         return { ...block, rows: toStatRows(liveData.nbaEast, undefined, 'basketball/nba') }
        if (block.id === 'nba-oeste'       && liveData.nbaWest?.length)         return { ...block, rows: toStatRows(liveData.nbaWest, undefined, 'basketball/nba') }
        if (block.id === 'f1-campeonato'   && liveData.f1Drivers?.length)       return { ...block, rows: toStatRows(liveData.f1Drivers, 'Escudería') }
        if (block.id === 'f1-constructores'&& liveData.f1Constructors?.length)  return { ...block, rows: toStatRows(liveData.f1Constructors) }
        if (block.id === 'atp-ranking'       && liveData.atpRanking?.length)     return { ...block, rows: toStatRows(liveData.atpRanking) }
        if (block.id === 'wta-ranking'       && liveData.wtaRanking?.length)     return { ...block, rows: toStatRows(liveData.wtaRanking) }
        if (block.id === 'f1-poles'          && liveData.f1Poles?.length)        return { ...block, rows: toStatRows(liveData.f1Poles, 'Escudería') }
        if (block.id === 'ranking-fifa'      && liveData.fifaRanking?.length)    return { ...block, rows: toStatRows(liveData.fifaRanking) }
        if (block.id === 'nba-scoring'       && liveData.nbaScoring?.length)     return { ...block, rows: toStatRows(liveData.nbaScoring) }
        if (block.id === 'nba-rebounds'      && liveData.nbaRebounds?.length)    return { ...block, rows: toStatRows(liveData.nbaRebounds) }
        if (block.id === 'nba-assists'       && liveData.nbaAssists?.length)     return { ...block, rows: toStatRows(liveData.nbaAssists) }
        if (block.id === 'nba-blocks'        && liveData.nbaBlocks?.length)      return { ...block, rows: toStatRows(liveData.nbaBlocks) }
        if (block.id === 'nba-steals'        && liveData.nbaSteals?.length)      return { ...block, rows: toStatRows(liveData.nbaSteals) }
        if (block.id === 'nba-efficiency'    && liveData.nbaEfficiency?.length)  return { ...block, rows: toStatRows(liveData.nbaEfficiency) }
        if (block.id === 'nba-3pt'           && liveData.nba3ptMade?.length)     return { ...block, rows: toStatRows(liveData.nba3ptMade) }
        if (block.id === 'f-ligaf-tabla'     && liveData.womenLigaF?.length)          return { ...block, rows: toStatRows(liveData.womenLigaF),          placeholder: false }
        if (block.id === 'f-goleadoras'      && liveData.womenGoals?.length)          return { ...block, rows: toStatRows(liveData.womenGoals),           placeholder: false }
        if (block.id === 'f-asistencias'     && liveData.womenAssists?.length)        return { ...block, rows: toStatRows(liveData.womenAssists),         placeholder: false }
        if (block.id === 'stats-dt'          && liveData.coachesWinRate?.length)      return { ...block, rows: toStatRows(liveData.coachesWinRate!, 'Club') }

        if (block.id === 'goles-equipo') {
          const allTeams = (liveData.football ?? []).flatMap(league =>
            league.rows.map(row => {
              const gf = parseInt(row.extra?.GF ?? '0') || 0
              const gp = (parseInt(row.extra?.V ?? '0') || 0) + (parseInt(row.extra?.E ?? '0') || 0) + (parseInt(row.extra?.D ?? '0') || 0)
              return { name: row.name, league: league.label, gf, gp }
            })
          ).filter(t => t.gf > 0).sort((a, b) => b.gf - a.gf).slice(0, 7)
          if (allTeams.length) return { ...block, rows: allTeams.map((t, i) => ({
            rank: i + 1, name: t.name, team: t.league,
            value: String(t.gf),
            sub: `${t.gp} PJ · ${t.gp > 0 ? (t.gf / t.gp).toFixed(2) : '0'}/PJ`,
            trend: 'flat' as const,
          }))}
        }

        if (block.id === 'menos-goles') {
          const allTeams = (liveData.football ?? []).flatMap(league =>
            league.rows.map(row => {
              const gc = parseInt(row.extra?.GC ?? '0') || 0
              const gp = (parseInt(row.extra?.V ?? '0') || 0) + (parseInt(row.extra?.E ?? '0') || 0) + (parseInt(row.extra?.D ?? '0') || 0)
              return { name: row.name, league: league.label, gc, gp }
            })
          ).filter(t => t.gp > 0).sort((a, b) => a.gc - b.gc).slice(0, 7)
          if (allTeams.length) return { ...block, rows: allTeams.map((t, i) => ({
            rank: i + 1, name: t.name, team: t.league,
            value: String(t.gc),
            sub: `${t.gp} PJ · ${t.gp > 0 ? (t.gc / t.gp).toFixed(2) : '0'}/PJ`,
            trend: 'flat' as const,
          }))}
        }

        if (block.id === 'ufc-p4p' && liveData.ufcP4P?.length)
          return { ...block, rows: toStatRows(liveData.ufcP4P) }

        if (block.id === 'ufc-campeones' && liveData.ufcChampions?.length)
          return { ...block, rows: toStatRows(liveData.ufcChampions, 'División') }

        // Cualquier división UFC (ufc-hw, ufc-lhw, ..., ufc-w-stw) viene en
        // el agregator liveData.ufcDivisions keyed por blockId.
        if (block.id.startsWith('ufc-') && block.id !== 'ufc-p4p' && block.id !== 'ufc-campeones') {
          const rows = liveData.ufcDivisions?.[block.id]
          if (rows?.length) return { ...block, rows: toStatRows(rows) }
        }

        if (block.id.startsWith('wc-group-') && liveData.worldCup?.length) {
          const group = liveData.worldCup.find(g => g.id === block.id)
          if (group?.rows.length) return { ...block, rows: toStatRows(group.rows) }
        }

        // ── Nuevos automatizados ────────────────────────────────────────
        if (block.id === 'f1-calendario'    && liveData.f1Calendar?.length)        return { ...block, rows: toStatRows(liveData.f1Calendar) }
        if (block.id === 'f1-sprints'       && liveData.f1Sprints?.length)         return { ...block, rows: toStatRows(liveData.f1Sprints, 'Escudería') }
        if (block.id === 'nba-mvp-race'     && liveData.nbaMvpRace?.length)        return { ...block, rows: toStatRows(liveData.nbaMvpRace) }
        if (block.id === 'nba-dpoy-race'    && liveData.nbaDpoyRace?.length)       return { ...block, rows: toStatRows(liveData.nbaDpoyRace) }
        if (block.id === 'nba-rookie-race'  && liveData.nbaRookieRace?.length)     return { ...block, rows: toStatRows(liveData.nbaRookieRace) }
        if (block.id === 'ucl-scorers'      && liveData.uclScorers?.length)        return { ...block, rows: toStatRows(liveData.uclScorers) }
        if (block.id === 'uel-scorers'      && liveData.uelScorers?.length)        return { ...block, rows: toStatRows(liveData.uelScorers) }
        if (block.id === 'ucl-assists'      && liveData.uclAssists?.length)        return { ...block, rows: toStatRows(liveData.uclAssists) }
        if (block.id === 'uel-assists'      && liveData.uelAssists?.length)        return { ...block, rows: toStatRows(liveData.uelAssists) }
        if (block.id === 'wc-scorers'       && liveData.mundialScorers?.length)     return { ...block, rows: toStatRows(liveData.mundialScorers) }
        if (block.id === 'wc-assists'       && liveData.mundialAssists?.length)     return { ...block, rows: toStatRows(liveData.mundialAssists) }
        if (block.id === 'wc-qualified'     && liveData.worldCupQualified?.length) return { ...block, rows: toStatRows(liveData.worldCupQualified) }
        if (block.id === 'wc-schedule'      && liveData.worldCupSchedule?.length)  return { ...block, rows: toStatRows(liveData.worldCupSchedule) }
        if (block.id === 'motogp-pilotos'        && liveData.motogpRiders?.length)        return { ...block, rows: toStatRows(liveData.motogpRiders, 'Escudería') }
        if (block.id === 'motogp-constructores'  && liveData.motogpConstructors?.length)  return { ...block, rows: toStatRows(liveData.motogpConstructors) }
        if (block.id === 'tenis-slams'           && liveData.tennisSlams?.length)         return { ...block, rows: toStatRows(liveData.tennisSlams) }
      }
      // Player stats data
      if (livePlayerData && LIVE_PLAYER_BLOCK_IDS.has(block.id)) {
        const { block: updated, isLive } = applyLivePlayerToBlock(block, livePlayerData, leagueFilter)
        if (isLive) return updated
      }
      // No mentir: si el servidor marca el bloque 'unavailable' (su fuente devolvió
      // vacío), NO mostramos las filas hardcodeadas del config como si fueran
      // actuales. Las vaciamos → el bloque pinta "Datos no disponibles" y el toggle
      // de vacíos lo oculta, en vez de datos viejos (NBA 24/25, femenino Sam Kerr…).
      if (liveData && !block.placeholder && block.rows.length > 0) {
        const m = getBlockMeta(block.id, liveData.meta, block.cardType)
        if (m?.status === 'unavailable') return { ...block, rows: [] }
      }
      return block
    })
  }

  function isBlockLive(block: StatBlock): boolean {
    const metaKey = block.cardType === 'fixtures'
      ? ({ 'tabla-ucl': 'uclFixtures', 'tabla-uel': 'uelFixtures' } as Record<string, string>)[block.id] ?? BLOCK_TO_META_KEY[block.id]
      : BLOCK_TO_META_KEY[block.id]
    const meta = liveData?.meta?.[metaKey]
    if (meta?.status === 'unavailable' || meta?.status === 'stale' || meta?.status === 'historical') return false
    if (liveData && LIVE_BLOCK_IDS.has(block.id) && block.rows.length > 0) return true
    if (livePlayerData && LIVE_PLAYER_BLOCK_IDS.has(block.id) && block.rows.length > 0) return true
    return false
  }

  const sport = SPORTS.find(s => s.id === sportId) ?? SPORTS[0]
  // Fondo atmosférico por deporte para el hero (reusa los WebP de /calendario).
  const statsBackdrop = ({ futbol: 'futbol', baloncesto: 'nba', formula1: 'f1', tenis: 'tenis', ufc: 'ufc' } as Record<string, string>)[sportId] ?? null
  const isFemenino = gender === 'f' && sportId === 'futbol'

  const handleSportChange = (id: string, targetSection?: string, targetGender?: 'm' | 'f') => {
    const nextSport = SPORTS.find(s => s.id === id)
    const sec = (targetSection && nextSport?.sections.find(s => s.id === targetSection))
      ? nextSport.sections.find(s => s.id === targetSection)!
      : nextSport?.sections[0]
    // El femenino solo existe en fútbol; en cualquier otro deporte volvemos a 'm'.
    const g: 'm' | 'f' = (id === 'futbol' && targetGender === 'f') ? 'f' : 'm'
    setSportId(id)
    setGender(g)
    setSectionId(sec?.id ?? 'jugadores')
    setExpandedBlocks({})
    setExpandedGroups(sec?.groups ? { [sec.groups[0]?.id ?? '']: true } : {})
    setLeagueFilter('General')
    // URL de path limpia (/estadisticas/<slug>) sin recargar: las pestañas siguen
    // siendo instantáneas (no remonta la página). La sección se omite aquí para
    // que la dirección del deporte coincida con su canonical. pushState (no
    // replaceState) para que "atrás" del navegador retroceda al deporte anterior;
    // preservamos window.history.state (marcadores de Next) para no forzar recarga.
    if (typeof window !== 'undefined') {
      window.history.pushState(
        { ...window.history.state, tsNav: { sportId: id, sectionId: sec?.id, gender: g } },
        '', buildStatsUrl(id, undefined, g === 'f')
      )
    }
  }

  const handleSectionChange = (id: string) => {
    if (id === sectionId) return  // misma sección → no duplicar entrada de historial
    const sec = sport.sections.find(s => s.id === id)
    setSectionId(id)
    setExpandedBlocks({})
    setExpandedGroups(sec?.groups ? { [sec.groups[0]?.id ?? '']: true } : {})
    setLeagueFilter('General')
    if (typeof window !== 'undefined') {
      window.history.pushState(
        { ...window.history.state, tsNav: { sportId, sectionId: id, gender } },
        '', buildStatsUrl(sportId, id, gender === 'f')
      )
    }
  }

  const section = sport.sections.find(s => s.id === sectionId) ?? sport.sections[0]
  const isFutbol = sportId === 'futbol'
  const isFutbolJugadores = isFutbol && sectionId === 'jugadores'
  const hasGroups = !!(section?.groups && section.groups.length > 0)

  // Cuenta de bloques con datos verificables por deporte (meta != 'unavailable').
  // Permite mostrar un badge en cada pestaña de deporte y dimear los vacíos.
  const liveMeta = liveData?.meta
  const sportAvailableCounts = React.useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    for (const sp of SPORTS) {
      let n = 0
      for (const sec of sp.sections) {
        const blocks: StatBlock[] = sec.groups
          ? sec.groups.flatMap(g => g.blocks)
          : (sec.blocks ?? [])
        for (const b of blocks) {
          if (b.placeholder && b.rows.length === 0) continue
          const m = getBlockMeta(b.id, liveMeta, b.cardType)
          if (m?.status === 'unavailable') continue
          n++
        }
      }
      out[sp.id] = n
    }
    return out
  }, [liveMeta])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const flatBlocks = React.useMemo(() => applyLive(section?.blocks ?? []), [section, liveData, livePlayerData, leagueFilter])
  const leagueFilteredBlocks = (sectionId === 'competiciones' && leagueFilter !== 'General')
    ? flatBlocks.filter(b => !b.league || b.league === leagueFilter)
    : flatBlocks
  const favoriteFilteredBlocks = showFavoritesOnly
    ? leagueFilteredBlocks.filter(b => favorites.has(b.id))
    : leagueFilteredBlocks
  // Auto-ocultar bloques marcados como "unavailable" cuando el toggle está activo.
  // Conserva los favoritos aunque estén unavailable: si el usuario lo guardó, lo verá.
  const filteredFlatBlocks = hideUnavailable
    ? favoriteFilteredBlocks.filter(b => {
        if (favorites.has(b.id)) return true
        const m = getBlockMeta(b.id, liveData?.meta, b.cardType)
        return m?.status !== 'unavailable'
      })
    : favoriteFilteredBlocks
  const hiddenFlatCount = favoriteFilteredBlocks.length - filteredFlatBlocks.length

  const toggleBlock = (id: string) => {
    setExpandedBlocks(prev => {
      const next = !prev[id]
      if (next) trackStatsBlockOpen({ block_id: id, sport: sportId, section: sectionId })
      return { ...prev, [id]: next }
    })
  }
  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = !prev[id]
      if (next) trackStatsGroupOpen({ group_id: id, sport: sportId })
      return { ...prev, [id]: next }
    })
  }

  const teamLeague = React.useMemo(
    () => buildTeamLeague(liveData?.football ?? []),
    [liveData?.football],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const searchableRows = React.useMemo<SearchableRow[]>(() => {
    const out: SearchableRow[] = []
    const collect = (blocks: StatBlock[]) => {
      for (const b of applyLive(blocks)) {
        if (b.placeholder || !b.rows.length) continue
        for (const r of b.rows) {
          out.push({ blockId: b.id, blockTitle: b.title, rowName: r.name, rowTeam: r.team, rowValue: r.value, metric: b.metric })
        }
      }
    }
    for (const sec of sport.sections) {
      if (sec.blocks) collect(sec.blocks)
      if (sec.groups) for (const g of sec.groups) collect(g.blocks)
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, liveData, livePlayerData, leagueFilter])

  const handleSearchPick = (blockId: string) => {
    trackSearch(`stats:${blockId}`)
    setExpandedBlocks(prev => ({ ...prev, [blockId]: true }))
    for (const sec of sport.sections) {
      const group = sec.groups?.find(g => g.blocks.some(b => b.id === blockId))
      if (group) {
        setExpandedGroups(prev => ({ ...prev, [group.id]: true }))
        break
      }
    }
    requestAnimationFrame(() => {
      const el = document.getElementById(blockId)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      else window.location.hash = `#${blockId}`
    })
  }

  return (
    <TeamLeagueContext.Provider value={teamLeague}>
    <StatsSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} rows={searchableRows} onPick={handleSearchPick} />
    <div data-sport={sportId || undefined} style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24">

        {/* ── HERO ──────────────────────────────────────── */}
        <div className="relative pt-8 pb-5 overflow-hidden">
          {/* Fondo atmosférico del deporte (broadcast) — solo en deportes con
              asset; en Destacados/Mundial/MotoGP queda el look base. */}
          {statsBackdrop && (
            <>
              <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: `url(/banners/signal/${statsBackdrop}.webp)`, backgroundSize: 'cover', backgroundPosition: 'center 32%', opacity: 0.4 }} />
              <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(180deg, rgba(9,9,15,0.40) 0%, rgba(9,9,15,0.72) 62%, var(--bg-base) 100%)' }} />
            </>
          )}
          {/* Accent glow */}
          <div className="absolute -top-8 left-0 w-[500px] h-64 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 15% 50%, ${sport.accent}12 0%, transparent 65%)`, filter: 'blur(24px)', transition: 'background 0.5s ease' }} />
          <div className="relative">
            {/* Title row */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-3">
              <div>
                <h1 className="font-black leading-none"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,5vw,3.2rem)', letterSpacing: '-0.03em' }}>
                  <span style={{ color: '#F8F8FF' }}>Estad</span><span style={{ color: sport.accent }}>ísticas</span>
                </h1>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                  ESPN · NBA.com · Jolpica · F1 oficial · Actualizado automáticamente
                </p>
              </div>
              {/* Freshness chip */}
              {lastUpdated && (
                <span className="text-[10px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full sm:mb-0.5"
                  style={{ background: fetchError ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)', color: fetchError ? '#f87171' : '#4ade80', border: `1px solid ${fetchError ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`, fontFamily: 'var(--font-sport)' }}>
                  <span className={refreshing ? 'animate-spin' : ''} style={{ display: 'inline-block' }}>⟳</span>
                  {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {updatedFlash && (
                <span aria-live="polite" className="text-[10px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(74,222,128,0.14)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.32)', fontFamily: 'var(--font-sport)', animation: 'fadeOut 2.2s forwards' }}>
                  ● Actualizado
                </span>
              )}
            </div>
            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => { refreshOnceRef.current(); fetchPlayersRef.current() }} disabled={refreshing}
                className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-opacity hover:opacity-80 disabled:opacity-40 inline-flex items-center gap-1"
                style={{ background: 'rgba(34,197,94,0.08)', color: '#86efac', border: '1px solid rgba(34,197,94,0.2)', fontFamily: 'var(--font-sport)', cursor: refreshing ? 'wait' : 'pointer' }}>
                {refreshing ? '⟳ Refrescando…' : '⟳ Refrescar'}
              </button>
              <button onClick={() => setSearchOpen(true)}
                className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-opacity hover:opacity-80 inline-flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#9090B0', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
                aria-label="Buscar (⌘K)">
                🔍 Buscar
                <kbd className="hidden sm:inline text-[9px] font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: '#5A5A72' }}>⌘K</kbd>
              </button>
              {favorites.size > 0 && (
                <button onClick={() => setShowFavoritesOnly(v => !v)}
                  className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-opacity hover:opacity-80 inline-flex items-center gap-1.5"
                  style={{
                    background: showFavoritesOnly ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.04)',
                    color: showFavoritesOnly ? '#fbbf24' : '#9090B0',
                    border: showFavoritesOnly ? '1px solid rgba(251,191,36,0.32)' : '1px solid rgba(255,255,255,0.08)',
                    fontFamily: 'var(--font-sport)', cursor: 'pointer',
                  }}>
                  {showFavoritesOnly ? '★' : '☆'} Favoritos
                  {favorites.size > 0 && <span className="text-[9px] font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)' }}>{favorites.size}</span>}
                </button>
              )}
              <button onClick={() => setHideUnavailable(v => !v)}
                className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-opacity hover:opacity-80 inline-flex items-center gap-1.5"
                style={{
                  background: hideUnavailable ? 'rgba(255,255,255,0.04)' : 'rgba(248,113,113,0.10)',
                  color: hideUnavailable ? '#9090B0' : '#f87171',
                  border: hideUnavailable ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(248,113,113,0.28)',
                  fontFamily: 'var(--font-sport)', cursor: 'pointer',
                }}
                title={hideUnavailable ? 'Mostrar también bloques sin datos' : 'Ocultar bloques sin datos'}
                aria-pressed={!hideUnavailable}>
                {hideUnavailable ? '⊘ Vacíos' : '⊕ Ver todos'}
              </button>
              {fetchError && (
                <span className="text-[11px]" style={{ color: '#f87171', fontFamily: 'var(--font-sport)' }}>
                  ⚠ {fetchError}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── NAVEGACIÓN STICKY (deporte + sección) ─── */}
        <div className="sticky z-30 -mx-4 sm:-mx-6 xl:-mx-10 px-4 sm:px-6 xl:px-10"
          style={{ top: 56, background: 'var(--bg-base)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>

          {/* TAB 1: DEPORTE — wrap a 2 filas en móvil, scroll horizontal en desktop */}
          <div className="flex flex-wrap sm:flex-nowrap gap-1 sm:overflow-x-auto scrollbar-hide pb-0"
            style={{ borderBottom: '1px solid var(--border)' }}>
            {SPORTS.map(s => {
              const count = sportAvailableCounts[s.id] ?? 0
              const isEmpty = count === 0 && s.id !== 'mundial'
              const isActive = sportId === s.id
              return (
                <button key={s.id} onClick={() => handleSportChange(s.id)}
                  aria-label={isEmpty ? `${s.label}, sin datos verificables hoy` : `${s.label}, ${count} ${count === 1 ? 'bloque' : 'bloques'} con datos`}
                  aria-current={isActive ? 'true' : undefined}
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap"
                  style={{
                    fontFamily: 'var(--font-sport)',
                    color: isActive ? s.accent : s.id === 'mundial' ? '#f59e0b' : 'var(--text-muted)',
                    background: s.id === 'mundial' && !isActive ? 'rgba(245,158,11,0.08)' : 'none',
                    border: 'none',
                    borderBottom: isActive ? `2px solid ${s.accent}` : s.id === 'mundial' ? '2px solid rgba(245,158,11,0.35)' : '2px solid transparent',
                    borderRadius: s.id === 'mundial' && !isActive ? '6px 6px 0 0' : undefined,
                    marginBottom: -1, cursor: 'pointer',
                    opacity: isEmpty && !isActive ? 0.45 : 1,
                  }}
                  title={isEmpty ? `${s.label}: sin datos verificables hoy` : `${s.label}: ${count} bloques con datos`}>
                  <span className="text-sm leading-none">{s.emoji}</span>
                  {s.label}
                  {s.id === 'mundial' && <span className="text-[9px] font-black px-1 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', letterSpacing: '0.05em' }}>🔜</span>}
                  {s.id !== 'mundial' && count > 0 && (
                    <span className="text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded-full"
                      style={{
                        background: isActive ? `${s.accent}1f` : 'rgba(74,222,128,0.10)',
                        color: isActive ? s.accent : '#4ade80',
                        border: `1px solid ${isActive ? s.accent + '40' : 'rgba(74,222,128,0.25)'}`,
                      }}>
                      {count}
                    </span>
                  )}
                  {s.id !== 'mundial' && isEmpty && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                      —
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* TAB 2: SECCIÓN */}
          {!isFemenino && sport.sections.length > 1 && (
            <div className="py-2.5 flex items-center gap-1 overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-1 p-1 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {sport.sections.map(sec => (
                  <button key={sec.id}
                    onClick={() => handleSectionChange(sec.id)}
                    aria-label={(SECTION_BLOCK_COUNT.get(`${sport.id}:${sec.id}`) ?? 0) > 0
                      ? `${sec.label}, ${SECTION_BLOCK_COUNT.get(`${sport.id}:${sec.id}`)} tablas`
                      : sec.label}
                    aria-current={sectionId === sec.id ? 'true' : undefined}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                    style={{
                      background: sectionId === sec.id ? `${sport.accent}18` : 'transparent',
                      color: sectionId === sec.id ? sport.accent : '#4A4A6A',
                      border: sectionId === sec.id ? `1px solid ${sport.accent}35` : '1px solid transparent',
                      fontFamily: 'var(--font-sport)', cursor: 'pointer',
                    }}>
                    <span className="text-xs">{sec.icon}</span>
                    {sec.label}
                    {(SECTION_BLOCK_COUNT.get(`${sport.id}:${sec.id}`) ?? 0) > 0 && (
                      <span className="text-[8px] px-1 py-0.5 rounded font-black ml-0.5"
                        style={{ background: sectionId === sec.id ? `${sport.accent}20` : 'rgba(255,255,255,0.05)', color: sectionId === sec.id ? sport.accent : '#3A3A52' }}>
                        {SECTION_BLOCK_COUNT.get(`${sport.id}:${sec.id}`) ?? 0}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RESUMEN — landing cross-sport ───────────── */}
        {sportId === 'resumen' ? (
          <div className="mt-5">
            <ResumenView
              liveData={liveData}
              livePlayerData={livePlayerData}
              lastUpdated={lastUpdated}
              onPickSport={handleSportChange}
            />
          </div>
        ) : null}

        {/* ── Banner Mundial 2026 ─────────────────────── */}
        {sportId === 'mundial' && (
          <div className="mt-5 mb-6 rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(239,68,68,0.08) 100%)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontSize: 22 }}>🏆</span>
                  <span className="font-black text-sm uppercase tracking-widest" style={{ fontFamily: 'var(--font-sport)', color: '#f59e0b' }}>
                    FIFA World Cup 2026
                  </span>
                  {WC_START.getTime() - Date.now() <= 0
                    ? null
                    : <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>PRÓXIMO</span>
                  }
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {WC_START.getTime() - Date.now() <= 0
                    ? 'Grupos en juego · Datos en vivo desde ESPN'
                    : '11 jun – 19 jul 2026 · USA, Canadá, México · 48 selecciones · 12 grupos'
                  }
                </p>
              </div>
              <WorldCupCountdown />
            </div>
          </div>
        )}

        {/* ── Toggle Femenino — solo Fútbol ────────────── */}
        {sportId === 'futbol' && (
          <div className="flex items-center gap-1.5 mt-5 mb-5">
            {(['m', 'f'] as const).map(g => {
              const isActive = gender === g
              return (
                <button key={g} onClick={() => {
                  setGender(g); setExpandedBlocks({})
                  if (typeof window !== 'undefined') {
                    window.history.replaceState(
                      { ...window.history.state, tsNav: { sportId, sectionId, gender: g } },
                      '', buildStatsUrl(sportId, sectionId, g === 'f')
                    )
                  }
                }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                  style={{
                    background: isActive ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#22c55e' : 'var(--text-muted)',
                    border: isActive ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.07)',
                    cursor: 'pointer', fontFamily: 'var(--font-sport)',
                  }}>
                  {g === 'm' ? '♂ Masculino' : '♀ Femenino'}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Fútbol Femenino — grid directo ──────────── */}
        {isFemenino && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-2">
            {applyLive(FUTBOL_FEMENINO_BLOCKS).map(block => (
              <StatBlockBoundary key={block.id} blockId={block.id}>
                <StatBlockCard block={block} accent="#22c55e" expanded={!!expandedBlocks[block.id]} onToggle={() => toggleBlock(block.id)} isLive={isBlockLive(block)} meta={getBlockMeta(block.id, liveData?.meta)} isFav={favorites.has(block.id)} onToggleFav={() => toggleFav(block.id)} />
              </StatBlockBoundary>
            ))}
          </div>
        )}

        {sportId !== 'resumen' && !isFemenino && (isFutbolJugadores || (isFutbol && sectionId === 'competiciones')) && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5 mb-5">
            {LEAGUE_FILTERS.map(liga => (
              <button key={liga} onClick={() => setLeagueFilter(liga)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all"
                style={{
                  background: leagueFilter === liga ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                  color: leagueFilter === liga ? '#86efac' : '#3A3A52',
                  border: leagueFilter === liga ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer', fontFamily: 'var(--font-sport)',
                }}>
                {liga}
              </button>
            ))}
          </div>
        )}

        {sportId === 'mundial' && sectionId === 'cuadro' ? (
          <MundialBracket />
        ) : sportId !== 'resumen' && !isFemenino && hasGroups && section.groups ? (
          <div className="flex flex-col gap-1">
            {section.groups.map(group => (
              <MetricGroupAccordion
                key={group.id}
                group={group}
                accent={sport.accent}
                expanded={!!expandedGroups[group.id]}
                onToggle={() => toggleGroup(group.id)}
                expandedBlocks={expandedBlocks}
                onToggleBlock={toggleBlock}
                leagueFilter={leagueFilter}
                livePlayerData={livePlayerData}
                liveMeta={liveData?.meta}
                favorites={favorites}
                onToggleFav={toggleFav}
                hideUnavailable={hideUnavailable}
              />
            ))}
          </div>
        ) : sportId === 'resumen' ? null : (
          <>
            <div className={`grid gap-5 ${
              sportId === 'mundial' && sectionId === 'grupos'
                ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
            }`}>
              {filteredFlatBlocks.map(block => {
                const blockMeta = getBlockMeta(block.id, liveData?.meta, block.cardType)
                const live = isBlockLive(block)
                let inner: React.ReactNode
                if (block.id.startsWith('wc-group-'))
                  inner = <WorldCupGroupCard block={block} accent={sport.accent} isLive={live} meta={blockMeta} />
                else if (block.cardType === 'fixtures')
                  inner = <PlayoffSeriesCard block={block} accent={sport.accent} isLive={live} meta={blockMeta} />
                else
                  inner = (
                    <StatBlockCard
                      block={block}
                      accent={sport.accent}
                      expanded={!!expandedBlocks[block.id]}
                      onToggle={() => toggleBlock(block.id)}
                      leagueFilter={leagueFilter}
                      isLive={live}
                      meta={blockMeta}
                      isFav={favorites.has(block.id)}
                      onToggleFav={() => toggleFav(block.id)}
                    />
                  )
                return <StatBlockBoundary key={block.id} blockId={block.id}>{inner}</StatBlockBoundary>
              })}
            </div>
            {filteredFlatBlocks.length === 0 && (
              <div className="py-16 text-center max-w-md mx-auto">
                {hideUnavailable && hiddenFlatCount > 0 ? (
                  <>
                    <p className="text-sm mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                      Esta sección no tiene datos verificables en vivo todavía.
                    </p>
                    <p className="text-[11px] mb-4" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                      Hay {hiddenFlatCount} bloque{hiddenFlatCount !== 1 ? 's' : ''} ocult{hiddenFlatCount !== 1 ? 'os' : 'o'} por falta de fuente gratuita confiable.
                    </p>
                    <button onClick={() => setHideUnavailable(false)}
                      className="text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full transition-opacity hover:opacity-80"
                      style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.28)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}>
                      ⊕ Ver bloques ocultos
                    </button>
                  </>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                    No hay datos disponibles para esta combinación.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* ── ROADMAP ───────────────────────────────── */}
        <div className="mt-14 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-5">
            <span className="section-accent" />
            <h2 className="section-label">Próximas integraciones</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { icon: '📊', label: 'Gráficos de evolución', sub: 'Por temporada' },
              { icon: '⚔️', label: 'Comparativas H2H', sub: 'Jugador vs jugador' },
              { icon: '🗂️', label: 'Fichas individuales', sub: 'Historial completo' },
              { icon: '🌐', label: 'Datos avanzados', sub: 'Opta · StatsBomb · WhoScored' },
              { icon: '📈', label: 'Rendimiento reciente', sub: 'Últimos 5 partidos' },
              { icon: '🏅', label: 'Palmarés histórico', sub: 'Títulos y logros' },
              { icon: '📐', label: 'Mapas de calor', sub: 'Posicionamiento' },
              { icon: '🔔', label: 'Alertas personalizadas', sub: 'Sigue jugadores clave' },
            ].map(({ icon, label, sub }) => (
              <div key={label} className="flex items-start gap-3 px-3.5 py-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-xl flex-shrink-0">{icon}</span>
                <div>
                  <p className="text-xs font-semibold leading-tight" style={{ color: '#A0A0C0', fontFamily: 'var(--font-sport)' }}>{label}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <NewsletterSection source="estadisticas" />
      <ScrollToTop />
    </div>
    </TeamLeagueContext.Provider>
  )
}
