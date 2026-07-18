'use client'

import { eventHasFavorite, formKey, isFavorite } from './calendar-favorites'
import { useLiveFixtures, useLiveScores } from './calendar-live'
import { CompGroupHeader, DaySeparator, LiveHeroCard, LiveHeroStrip, MatchRow, SearchInput, SectionHeader, compConfigForGroup } from './CalendarCards'
import { DayChips } from './CalendarDatePicker'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { SportEvent } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { SPORT_THEME, getEventHighlightScore, isCombat, isMundial, sportThemeKey } from '@/lib/competitions'
import { formatDateLabel, groupDayByCompetition, groupEventsByDate, isoToLocalDate, namesMatch, orderedDateKeys } from '@/lib/calendar'
import { nameMatch } from '@/lib/quiniela'
import { SOURCE_TZ, TZ_KEY, getStoredTZ, setStoredTZ } from '@/lib/timezone'
import TimezoneSelector from '@/components/TimezoneSelector'
import UFCCardModal from '@/components/UFCCardModal'
import FavoritesOnboarding from '@/components/FavoritesOnboarding'
import CompetitionSelector from '@/components/CompetitionSelector'
import { getCompetition, matchesCompetition } from '@/lib/calendar-competitions'
import { filterByFollowed } from '@/lib/calendar-curate'
import { FOLLOWABLE_SPORTS, useFollowedSports } from '@/lib/useFollowedSports'
import { SLUG_TO_LABEL, accentForSport } from '@/lib/sports'
import { subscribeToPush } from '@/lib/push-client'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { isLiveStatus, liveSportPassesFilter } from '@/lib/live-events'
import { BellIcon, CalendarIcon, ClipboardIcon, LiveDotIcon, SearchIcon, SportIcon } from '@/components/icons/GameIcons'

const DESTACADOS_MIN = 4
const DESTACADOS_ELITE = 12
const DESTACADOS_MAX = 8

// Timeline (vista Calendario): ventana de días PASADOS que se cargan de una vez
// al montar y se anteponen a la lista. El endpoint con live=1 cubre ~10 días;
// para histórico más antiguo está la pestaña Resultados.
const PAST_WINDOW_DAYS = 12

// ─── Main ─────────────────────────────────────────────────────────────────
type ViewType = 'todos' | 'resultados' | 'recordatorios'

type FormResult = 'W' | 'D' | 'L'

export default function CalendarioContent({ events, pastEvents = [], recentForms = {}, initialTz = SOURCE_TZ }: {
  events: SportEvent[]
  pastEvents?: SportEvent[]
  recentForms?: Record<string, FormResult[]>
  initialTz?: string
}) {
  // Default tab = Calendario (todos): entras a la lista con separadores por
  // día. Default chip = 'Destacados': filtra la lista a los top 4 por día.
  const [view, setView] = useState<ViewType>('todos')
  const [tz, setTz] = useState<string>(initialTz)
  const [searchRaw, setSearchRaw] = useState('')
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('Destacados')
  const [activeComp, setActiveComp] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)   // YYYY-MM-DD or null for all
  const [selectedUFCDate, setSelectedUFCDate] = useState<string | null>(null) // UFC modal date
  const [reminders, setReminders] = useState<Set<string>>(new Set())
  // Mini-paso de contexto antes de pedir el permiso de notificaciones del
  // navegador (ver toggleReminder). null = oculto; con datos = diálogo visible.
  const [reminderPrompt, setReminderPrompt] = useState<{ id: string; home: string; away: string | null; comp: string | null } | null>(null)
  const reminderDialogRef = useRef<HTMLDivElement>(null)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [favComps, setFavComps] = useState<Set<string>>(new Set())   // ligas fijadas (slugs)
  // Deportes seguidos (personalización de "Destacados"). Local + nube (sport:<slug>),
  // compartido con la app. Vacío → no filtra (se ve todo).
  const { sports: followedSports, toggle: toggleFollowedSport } = useFollowedSports()
  const [onlyLive, setOnlyLive] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set())
  // Histórico extendido (pestaña Resultados) — busca/pagina contra /api/events/past
  const [pastRange, setPastRange] = useState<'10d' | '30d' | '90d' | 'all'>('10d')
  const [extraPast, setExtraPast] = useState<SportEvent[]>([])
  const [pastNextCursor, setPastNextCursor] = useState<string | null>(null)
  const [pastLoading, setPastLoading] = useState(false)
  const [pastError, setPastError] = useState<string | null>(null)
  // Resultados rango "10 días": se cargan en cliente (no en SSR) para aligerar la
  // página. Vía /api/events/past?live=1 → ESPN en vivo (tenis + ganador F1/UFC).
  const [recentPast, setRecentPast] = useState<SportEvent[]>(pastEvents)
  const notifTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const prevScoresRef = useRef<Map<string, string>>(new Map())
  const flashTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  // Timeline continuo (vista Calendario): días PASADOS que se anteponen a la
  // lista al subir el scroll (arriba = pasado, HOY en medio, abajo = futuro).
  // Distintos del histórico de la pestaña Resultados (extraPast/recentPast).
  const [pastTimeline, setPastTimeline] = useState<SportEvent[]>([])
  const loadingPastRef = useRef(false)
  const prependAnchorRef = useRef<number | null>(null)  // scrollHeight antes del prepend (para anclar HOY tras cargar pasados)
  const stickyBarRef = useRef<HTMLDivElement | null>(null) // barra sticky (day chips + toolbar): su altura = offset del anclaje
  const todaySepRef = useRef<HTMLElement | null>(null) // sección de HOY (referencia; ya no se ancla al montar)

  const liveScores = useLiveScores(events)
  const liveFixtures = useLiveFixtures()

  useEffect(() => {
    // Auto-detect browser TZ on first visit (no stored preference).
    // We persist it so the next SSR render already uses the correct cookie.
    const detectedTz = getStoredTZ()
    setTz(detectedTz)
    if (!localStorage.getItem(TZ_KEY)) {
      setStoredTZ(detectedTz, 'auto')
    }
    try {
      // ── Reminders / favorites / onboarding ─────────────────────
      const stored = JSON.parse(localStorage.getItem('ts_reminders') ?? '[]')
      setReminders(new Set(stored))
      const favs = JSON.parse(localStorage.getItem('ts_favorites') ?? '[]')
      setFavorites(new Set(favs))
      const favC = JSON.parse(localStorage.getItem('ts_fav_comps') ?? '[]')
      setFavComps(new Set(favC))
      // El onboarding de favoritos ya NO se auto-abre: antes tapaba todo el
      // calendario en la 1ª visita (fricción). La invitación vive en el CTA
      // "Elegir equipos" del feed; el modal solo abre si el usuario lo pulsa.

      // ── Restore prefs: URL takes priority over localStorage ─────
      const params = new URLSearchParams(window.location.search)

      const urlView   = params.get('v')
      const urlSport  = params.get('sport')
      const urlDate   = params.get('d')

      // Migración v3: la primera vez que un usuario carga después del
      // rediseño con chip Destacados, forzamos los nuevos defaults para
      // que vea realmente la nueva entrada. Si no hacemos esto, su antiguo
      // ts_cal_view='destacados' (Inicio) o ts_cal_sport='Todo' los llevan
      // al estado viejo y nunca ven el chip nuevo.
      const v3Migrated = localStorage.getItem('ts_cal_v3_chip') === '1'
      if (!v3Migrated) {
        localStorage.removeItem('ts_cal_view')
        localStorage.removeItem('ts_cal_sport')
        localStorage.setItem('ts_cal_v3_chip', '1')
      }

      const savedView  = v3Migrated ? localStorage.getItem('ts_cal_view') : null
      const savedSport = v3Migrated ? localStorage.getItem('ts_cal_sport') : null

      // Legacy aliases: 'en-vivo' e 'destacados' (Inicio) fueron absorbidos
      // por el chip Destacados dentro del tab Calendario. Cualquier URL o
      // localStorage que apunte a esos valores cae a 'todos' (Calendario).
      // Legacy: 'en-vivo'/'destacados'/'resultados' (vistas retiradas o ya no
      // navegables desde la cabecera) caen a 'todos'.
      const VALID_VIEWS: ViewType[] = ['todos', 'recordatorios']
      const normalizedView = (urlView === 'en-vivo' || urlView === 'destacados') ? 'todos' : urlView
      if (normalizedView && VALID_VIEWS.includes(normalizedView as ViewType)) {
        setView(normalizedView as ViewType)
      } else if (savedView && VALID_VIEWS.includes(savedView as ViewType)) {
        setView(savedView as ViewType)
      }

      if (urlSport) setActiveFilter(urlSport)
      else if (savedSport) setActiveFilter(savedSport)

      if (urlDate) setSelectedDate(urlDate)
    } catch { /* ignore */ }
    const timers = notifTimers.current
    return () => timers.forEach(t => clearTimeout(t))
  }, [])

  // ── Sync view/sport/date → URL + localStorage ─────────────────────
  useEffect(() => {
    try {
      localStorage.setItem('ts_cal_view', view)
      localStorage.setItem('ts_cal_sport', activeFilter)
      const params = new URLSearchParams(window.location.search)
      if (view !== 'todos') params.set('v', view); else params.delete('v')
      if (activeFilter !== 'Todo') params.set('sport', activeFilter); else params.delete('sport')
      if (selectedDate) params.set('d', selectedDate); else params.delete('d')
      const qs = params.toString()
      const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
      window.history.replaceState(null, '', newUrl)
    } catch { /* ignore */ }
  }, [view, activeFilter, selectedDate])

  // Carga la ventana de días PASADOS del timeline (una sola vez, al montar). El
  // endpoint con live=1 cubre los ~10 días recientes: los traemos de golpe y los
  // anteponemos a la lista. Para histórico más antiguo está la pestaña Resultados.
  const loadPastWindow = useCallback(async () => {
    if (loadingPastRef.current) return
    loadingPastRef.current = true
    const from = new Date(Date.now() - PAST_WINDOW_DAYS * 86_400_000).toISOString()
    prependAnchorRef.current = document.documentElement.scrollHeight
    try {
      const res = await fetch(`/api/events/past?live=1&from=${encodeURIComponent(from)}&limit=200`)
      const data = res.ok ? await res.json() as { events?: SportEvent[] } : null
      const todayKey = isoToLocalDate(new Date().toISOString(), tz)
      // Solo días estrictamente anteriores a HOY (los de hoy ya vienen por events).
      const evs = (data?.events ?? []).filter(e => e.isoDate && isoToLocalDate(e.isoDate, tz) < todayKey)
      setPastTimeline(prev => {
        const seen = new Set(prev.map(e => e.id))
        const fresh = evs.filter(e => !seen.has(e.id))
        return fresh.length ? [...fresh, ...prev] : prev
      })
    } catch {
      prependAnchorRef.current = null
    }
    loadingPastRef.current = false
  }, [tz])

  // Al anteponer los días pasados (el usuario pulsó "Ver resultados anteriores"):
  // 1) compensamos cuánto creció la página para que HOY NO SALTE de sitio, y
  // 2) asomamos un poco hacia arriba (suave) para que se vean los primeros
  // resultados e invitar a seguir subiendo. Como NO se carga nada al montar,
  // al entrar HOY está arriba al instante y no hay "flash".
  useLayoutEffect(() => {
    if (prependAnchorRef.current == null) return
    const grew = document.documentElement.scrollHeight - prependAnchorRef.current
    prependAnchorRef.current = null
    if (grew <= 0) return
    window.scrollBy(0, grew) // mantiene la posición visual (HOY donde estaba)
    requestAnimationFrame(() => window.scrollBy({ top: -Math.min(grew, 260), behavior: 'smooth' }))
  }, [pastTimeline])

  // Debounce search input — avoid filtering on every keystroke
  useEffect(() => {
    // Búsqueda instantánea desde la 1ª letra (sin mínimo de 2), debounce corto.
    const t = setTimeout(() => setSearch(searchRaw.trim().length >= 1 ? searchRaw : ''), 140)
    return () => clearTimeout(t)
  }, [searchRaw])

  // Detect score changes → trigger flash animation
  useEffect(() => {
    const newFlashes: string[] = []
    liveScores.forEach((score, id) => {
      const sig = `${score.homeGoals}-${score.awayGoals}-${score.status}`
      const prev = prevScoresRef.current.get(id)
      if (prev && prev !== sig) {
        newFlashes.push(id)
      }
      prevScoresRef.current.set(id, sig)
    })
    if (newFlashes.length > 0) {
      setFlashIds(prev => {
        const next = new Set(prev)
        newFlashes.forEach(id => next.add(id))
        return next
      })
      const timer = setTimeout(() => {
        flashTimers.current.delete(timer)
        setFlashIds(prev => {
          const next = new Set(prev)
          newFlashes.forEach(id => next.delete(id))
          return next
        })
      }, 1500)
      flashTimers.current.add(timer)
    }
  }, [liveScores])

  // Al desmontar: cancela los timers de flash pendientes (evita el setState
  // sobre un componente ya desmontado si un marcador cambió justo antes de salir).
  useEffect(() => () => {
    flashTimers.current.forEach(clearTimeout)
    flashTimers.current.clear()
  }, [])

  // Persistencia en la nube (best-effort, solo con sesión): sube o borra un
  // favorito en la cuenta (reusa user_favorites con etiqueta team:/comp:) para
  // que equipos y ligas sigan al usuario entre dispositivos.
  const syncFavoriteToCloud = useCallback((entryId: string, active: boolean) => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return
      if (active) {
        fetch('/api/rankings/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entry_id: entryId }),
        }).catch(() => { /* best-effort */ })
      } else {
        fetch(`/api/rankings/favorites?entry_id=${encodeURIComponent(entryId)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        }).catch(() => { /* best-effort */ })
      }
    }).catch(() => { /* ignore */ })
  }, [])

  const toggleFavorite = useCallback((name: string) => {
    if (!name) return
    const willActivate = !favorites.has(name)
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      localStorage.setItem('ts_favorites', JSON.stringify([...next]))
      return next
    })
    syncFavoriteToCloud(`team:${name}`, willActivate)
  }, [favorites, syncFavoriteToCloud])

  // Fijar / dejar de fijar una competición (slug). Las fijadas suben al principio
  // de cada día en el feed. Persistido en localStorage + cuenta.
  const togglePinComp = useCallback((slug: string) => {
    if (!slug) return
    const willPin = !favComps.has(slug)
    setFavComps(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      localStorage.setItem('ts_fav_comps', JSON.stringify([...next]))
      return next
    })
    syncFavoriteToCloud(`comp:${slug}`, willPin)
  }, [favComps, syncFavoriteToCloud])

  const finishOnboarding = useCallback((selectedTeams: string[]) => {
    const next = new Set(selectedTeams)
    // Sincroniza la diferencia con la cuenta: añade los nuevos, quita los retirados.
    for (const t of next) if (!favorites.has(t)) syncFavoriteToCloud(`team:${t}`, true)
    for (const t of favorites) if (!next.has(t)) syncFavoriteToCloud(`team:${t}`, false)
    setFavorites(next)
    localStorage.setItem('ts_favorites', JSON.stringify([...next]))
    localStorage.setItem('ts_onboarded', '1')
  }, [favorites, syncFavoriteToCloud])

  const skipOnboarding = useCallback(() => {
    localStorage.setItem('ts_onboarded', '1')
    setShowOnboarding(false)
  }, [])

  // Fusión con la cuenta (best-effort, solo con sesión): al entrar logueado
  // junta los favoritos de este navegador con los de la cuenta (no se pierde
  // nada) y deja la misma lista de equipos y ligas en todos los dispositivos.
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session || cancelled) return
      fetch('/api/rankings/favorites', { credentials: 'same-origin' })
        .then(r => (r.ok ? r.json() : { favorites: [] }))
        .then((j: { favorites?: { entry_id: string }[] }) => {
          if (cancelled) return
          const ids = (j.favorites ?? []).map(f => f.entry_id)
          const cloudTeams = ids.filter(id => id.startsWith('team:')).map(id => id.slice(5))
          const cloudComps = ids.filter(id => id.startsWith('comp:')).map(id => id.slice(5))
          const readArr = (k: string): string[] => {
            try { const v = JSON.parse(localStorage.getItem(k) ?? '[]'); return Array.isArray(v) ? v : [] }
            catch { return [] }
          }
          const localTeams = readArr('ts_favorites')
          const localComps = readArr('ts_fav_comps')
          const mergedTeams = new Set<string>([...localTeams, ...cloudTeams])
          const mergedComps = new Set<string>([...localComps, ...cloudComps])
          setFavorites(mergedTeams)
          setFavComps(mergedComps)
          try {
            localStorage.setItem('ts_favorites', JSON.stringify([...mergedTeams]))
            localStorage.setItem('ts_fav_comps', JSON.stringify([...mergedComps]))
          } catch { /* ignore */ }
          // Sube a la cuenta lo que solo estaba en este navegador (invitado→cuenta).
          const post = (entryId: string) => fetch('/api/rankings/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry_id: entryId }),
          }).catch(() => { /* best-effort */ })
          const cloudTeamSet = new Set(cloudTeams)
          const cloudCompSet = new Set(cloudComps)
          for (const t of localTeams) if (!cloudTeamSet.has(t)) post(`team:${t}`)
          for (const c of localComps) if (!cloudCompSet.has(c)) post(`comp:${c}`)
        })
        .catch(() => { /* best-effort */ })
    }).catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [])

  // Request browser notification permission on first reminder
  const requestNotifPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }, [])

  // Fire browser notification when reminded match is ≤15 min away
  const scheduleNotif = useCallback((id: string) => {
    const event = events.find(e => e.id === id)
    if (!event?.isoDate) return
    const diff = new Date(event.isoDate).getTime() - Date.now()
    const notifyAt = diff - 10 * 60_000 // 10 min before
    if (notifyAt <= 0 || notifyAt > 24 * 60 * 60_000) return
    const timer = setTimeout(() => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('🔔 Partido próximo — TakaSports', {
          body: `${event.home}${event.away ? ` vs ${event.away}` : ''} empieza en ~10 min`,
          icon: '/favicon.ico',
          tag: id,
        })
      }
    }, notifyAt)
    notifTimers.current.set(id, timer)
  }, [events])

  // Recordatorio REAL vía push (server) → avisa aunque la web esté cerrada. Si
  // el usuario rechaza el permiso o el navegador no soporta push, cae al aviso
  // local (setTimeout, solo con la pestaña abierta).
  const enableReminderPush = useCallback(async (id: string) => {
    const ev = events.find(e => e.id === id)
    if (ev?.isoDate) {
      try {
        const r = await subscribeToPush(['calendario'])
        if (r.ok && r.endpoint) {
          const res = await fetch('/api/push/reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: r.endpoint, matchRef: id, kickoffIso: ev.isoDate,
              home: ev.home, away: ev.away ?? null, comp: ev.comp ?? null,
              url: ev.matchRef ? `/partido/${ev.matchRef}` : '/calendario',
            }),
          })
          if (res.ok) return  // push real OK → no programamos el local (evita doble aviso)
        }
      } catch { /* cae al fallback local */ }
    }
    await requestNotifPermission()
    scheduleNotif(id)
  }, [events, requestNotifPermission, scheduleNotif])

  // Baja del recordatorio en el servidor (la suscripción push se mantiene por si
  // hay otros recordatorios; solo se borra esta fila).
  const disableReminderPush = useCallback(async (id: string) => {
    try {
      if (!('serviceWorker' in navigator)) return
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub?.endpoint) {
        await fetch('/api/push/reminders', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint, matchRef: id }),
        }).catch(() => {})
      }
    } catch { /* ignore */ }
  }, [])

  // Persistencia en la nube (best-effort, solo con sesión): sube o borra el
  // recordatorio en la cuenta para que siga al usuario entre dispositivos.
  const syncReminderToCloud = useCallback((id: string, active: boolean, ev?: SportEvent) => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return
      if (active && ev) {
        fetch('/api/account/sync/reminders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ event_id: id, event_data: ev }] }),
        }).catch(() => { /* best-effort */ })
      } else if (!active) {
        fetch('/api/account/sync/reminders', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: id }),
        }).catch(() => { /* best-effort */ })
      }
    }).catch(() => { /* ignore */ })
  }, [])

  const toggleReminder = useCallback((id: string) => {
    const willActivate = !reminders.has(id)
    setReminders(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        const timer = notifTimers.current.get(id)
        if (timer) clearTimeout(timer)
        notifTimers.current.delete(id)
        disableReminderPush(id)
      } else {
        next.add(id)
      }
      localStorage.setItem('ts_reminders', JSON.stringify([...next]))
      // Snapshot del evento junto al id: el perfil lee 'ts_reminders_data' para
      // pintar el recordatorio (los ids reales espn-* no existen en mock data).
      try {
        const data = JSON.parse(localStorage.getItem('ts_reminders_data') ?? '{}')
        if (next.has(id)) {
          const ev = events.find(e => e.id === id)
          if (ev) data[id] = ev
        } else {
          delete data[id]
        }
        localStorage.setItem('ts_reminders_data', JSON.stringify(data))
      } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent('ts-reminders-change'))
      return next
    })
    // Al activar: si el permiso de notificaciones está SIN decidir ('default'),
    // mostramos primero un mini-paso de contexto. Pedir el permiso "a pelo" hace
    // que Chrome lo bloquee de forma permanente si el usuario lo descarta. El
    // recordatorio ya quedó guardado arriba; el permiso se pide al confirmar.
    // Si ya está concedido/denegado (o no hay API), seguimos el flujo directo.
    if (willActivate) {
      const ev = events.find(e => e.id === id)
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        setReminderPrompt({ id, home: ev?.home ?? '', away: ev?.away ?? null, comp: ev?.comp ?? null })
      } else {
        enableReminderPush(id)
      }
    }
    syncReminderToCloud(id, willActivate, events.find(e => e.id === id))
  }, [enableReminderPush, disableReminderPush, events, reminders, syncReminderToCloud])

  // Cierre del mini-paso de permiso (también lo usa el focus-trap con Escape).
  const closeReminderPrompt = useCallback(() => setReminderPrompt(null), [])
  useFocusTrap(!!reminderPrompt, reminderDialogRef, closeReminderPrompt)

  // Sync de snapshots: rellena 'ts_reminders_data' para los recordatorios
  // activos cuyo evento siga en el feed. Cubre recordatorios creados antes de
  // que existiera este store, para que el perfil pueda mostrarlos igualmente.
  useEffect(() => {
    if (reminders.size === 0) return
    try {
      const data = JSON.parse(localStorage.getItem('ts_reminders_data') ?? '{}')
      let changed = false
      for (const id of reminders) {
        const ev = events.find(e => e.id === id)
        if (ev) { data[id] = ev; changed = true }
      }
      if (changed) localStorage.setItem('ts_reminders_data', JSON.stringify(data))
    } catch { /* ignore */ }
  }, [reminders, events])

  // Destacados es un chip especial — no es un deporte sino un modo curado
  // que limita a los top 4 partidos por día por prestigio de liga + favoritos.
  // Las categorías (Destacados/Todo/deportes/competiciones) ahora viven en
  // <CompetitionSelector> (barra unificada de fichas con logo), en ambas pestañas.

  // Competición seleccionada en el selector "Por competición": filtra el feed en
  // el sitio + muestra su banner. null = sin filtro de competición.
  const activeCompCfg = useMemo(() => (activeComp ? getCompetition(activeComp) : null), [activeComp])

  // Base de la LISTA de días: en la vista Calendario (sin fecha ni "En vivo")
  // combinamos los días pasados del timeline continuo DELANTE de los futuros
  // (prop events). El resto de derivados (availableDays, favoriteEvents,
  // liveEventsInList, recordatorios…) siguen usando SOLO events.
  const baseEventsForList = useMemo(
    () => (view === 'todos' && !selectedDate && !onlyLive) ? [...pastTimeline, ...events] : events,
    [view, selectedDate, onlyLive, pastTimeline, events]
  )

  const filtered = useMemo(() => {
    const matchesSearch = (e: SportEvent) =>
      !search
        || namesMatch(e.home, search)
        || (e.away ? namesMatch(e.away, search) : false)
        || namesMatch(e.comp, search)
        || namesMatch(e.sport, search)
    const matchesSport = (e: SportEvent) =>
      activeFilter === 'Todo' || activeFilter === 'Destacados' || e.sport === activeFilter
    const matchesDate = (e: SportEvent) => {
      if (!selectedDate) return true
      if (!e.isoDate) return false
      return isoToLocalDate(e.isoDate, tz) === selectedDate
    }
    const matchesLive = (e: SportEvent) => {
      if (!onlyLive) return true
      const score = liveScores.get(e.id)
      return !!score && isLiveStatus(score.status)
    }
    const matchesComp = (e: SportEvent) => !activeCompCfg || matchesCompetition(activeCompCfg, e)
    return baseEventsForList.filter(e => matchesSport(e) && matchesComp(e) && matchesSearch(e) && matchesDate(e) && matchesLive(e))
  }, [baseEventsForList, search, activeFilter, activeCompCfg, selectedDate, onlyLive, liveScores, tz])

  // Upcoming events featuring favorite teams (across all dates)
  const favoriteEvents = useMemo(() => {
    if (favorites.size === 0) return []
    const now = Date.now()
    return events
      .filter(e => eventHasFavorite(favorites, e))
      .filter(e => !e.isoDate || new Date(e.isoDate).getTime() >= now - 3 * 60 * 60_000)
      .sort((a, b) => (a.isoDate ?? '').localeCompare(b.isoDate ?? ''))
      .slice(0, 8)
  }, [events, favorites])

  // "Destacados" y "Todo" son vistas por defecto (no son un filtro que el
  // usuario "active"), así que NO disparan el botón Limpiar. Solo lo hacen un
  // deporte concreto, una fecha, una búsqueda o el toggle En vivo.
  const hasActiveFilters = !!selectedDate || (activeFilter !== 'Todo' && activeFilter !== 'Destacados') || !!searchRaw || onlyLive || !!activeComp
  const clearFilters = useCallback(() => {
    setSelectedDate(null)
    setActiveFilter('Destacados')
    setActiveComp(null)
    setSearchRaw('')
    setSearch('')
    setOnlyLive(false)
  }, [])

  // Days available with events (for the chip strip) — sport+search aware, not date-filtered
  const availableDays = useMemo(() => {
    const matchesSearch = (e: SportEvent) =>
      !search
        || namesMatch(e.home, search)
        || (e.away ? namesMatch(e.away, search) : false)
        || namesMatch(e.comp, search)
        || namesMatch(e.sport, search)
    const matchesSport = (e: SportEvent) =>
      activeFilter === 'Todo' || activeFilter === 'Destacados' || e.sport === activeFilter
    const counts: Record<string, number> = {}
    for (const e of events) {
      if (!matchesSport(e) || (activeCompCfg && !matchesCompetition(activeCompCfg, e)) || !matchesSearch(e) || !e.isoDate) continue
      const k = isoToLocalDate(e.isoDate, tz)
      counts[k] = (counts[k] ?? 0) + 1
    }
    const today = isoToLocalDate(new Date().toISOString(), tz)
    // 42 días: cubre el Mundial completo (38 días) — antes el tope de 14 dejaba
    // fuera del selector las fechas de octavos en adelante.
    return Object.keys(counts)
      .filter(k => k >= today)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 42)
      // counts solo sirve para saber QUÉ días tienen partidos; DayChips ya no
      // pinta ni label ni count (calcula su propia etiqueta desde la key).
      .map(k => ({ key: k }))
  }, [events, search, activeFilter, activeCompCfg, tz])

  const liveEventsInList = useMemo(
    () => filtered.filter(e => liveScores.has(e.id) && isLiveStatus(liveScores.get(e.id)?.status ?? '')),
    [filtered, liveScores]
  )

  const orphanFixtures = useMemo(() => {
    return liveFixtures.filter(f => {
      // 'Todo'/'Destacados' = todos los deportes; un partido en vivo huérfano
      // (que arrancó tras el último SSR, p. ej. un Mundial en juego) es siempre
      // un destacado. Ver liveSportPassesFilter para el porqué del trato especial.
      if (!liveSportPassesFilter(activeFilter, f.sport)) return false
      const matched = liveEventsInList.find(e =>
        // Cruce por matchRef (id canónico, inmune al idioma): el feed en vivo
        // trae el nombre de selección en inglés y el calendario en español, así
        // que un namesMatch solo duplicaría esos partidos. matchRef es idéntico
        // en ambos lados (slug_id). namesMatch queda de respaldo.
        (f.matchRef != null && e.matchRef === f.matchRef) ||
        (namesMatch(e.home, f.homeTeam) && namesMatch(e.away ?? '', f.awayTeam))
      )
      return !matched
    })
  }, [liveFixtures, liveEventsInList, activeFilter])

  // Si el chip Destacados está activo, en la vista Calendario se muestran los
  // partidos más importantes de cada día. Criterio combinado:
  //   1. Favoritos del usuario primero (siempre)
  //   2. Highlight score: prestigio de liga + boost por marquee team
  //      (+2), fase final/semifinal/cuartos (+4/+3/+2), live (+1.5),
  //      prime time 18-23h Madrid (+0.5)
  //   3. Empate → hora más temprana
  // Cuántos por día: al menos DESTACADOS_MIN, pero se amplía para no cortar los
  // carteles élite (score ≥ DESTACADOS_ELITE: Mundial, Champions, fases finales).
  // En plena fase de grupos del Mundial (5-6 partidos top/día) se muestran todos.
  const filteredForGrouping = useMemo(() => {
    // Con una competición seleccionada se muestran TODOS sus partidos (no se aplica
    // la curación de Destacados, que recorta a los top del día).
    if (activeFilter !== 'Destacados' || activeComp) return filtered
    // Personalización IMPLÍCITA (solo en Destacados, sin búsqueda activa): quédate
    // con tus deportes/equipos seguidos. El Mundial, los directos y tus equipos
    // entran igual; sin nada seguido → se ve todo. La búsqueda es una elección
    // explícita, así que NO filtra por seguidos.
    const src = search
      ? filtered
      : filterByFollowed(
          filtered,
          { deportesSeguidos: [...followedSports], equiposSeguidos: [...favorites] },
          {
            isLive: (e) => {
              const ls = liveScores.get((e as SportEvent).id)
              return !!ls && isLiveStatus(ls.status)
            },
            teamMatch: (n, t) => (t ? nameMatch(n, t) : false),
          },
        )
    const byDay = new Map<string, SportEvent[]>()
    for (const ev of src) {
      const day = ev.isoDate ? isoToLocalDate(ev.isoDate, tz) : 'unknown'
      const arr = byDay.get(day) ?? []
      arr.push(ev)
      byDay.set(day, arr)
    }
    const scoreCache = new Map<string, number>()
    const scoreFor = (ev: SportEvent) => {
      const cached = scoreCache.get(ev.id)
      if (cached !== undefined) return cached
      const live = liveScores.has(ev.id) && isLiveStatus(liveScores.get(ev.id)?.status ?? '')
      const s = getEventHighlightScore({
        comp: ev.comp,
        home: ev.home,
        away: ev.away,
        stage: ev.stage,
        isoDate: ev.isoDate,
        isLive: live,
      })
      scoreCache.set(ev.id, s)
      return s
    }
    const todayKey = isoToLocalDate(new Date().toISOString(), tz)
    const out: SportEvent[] = []
    for (const [day, evs] of byDay) {
      const sorted = [...evs].sort((a, b) => {
        const aFav = eventHasFavorite(favorites, a) ? 1 : 0
        const bFav = eventHasFavorite(favorites, b) ? 1 : 0
        if (aFav !== bFav) return bFav - aFav
        const sA = scoreFor(a)
        const sB = scoreFor(b)
        if (sA !== sB) return sB - sA
        return (a.isoDate ?? '').localeCompare(b.isoDate ?? '')
      })
      // Días YA JUGADOS (timeline "Ver resultados anteriores"): se muestran
      // COMPLETOS, sin curación. Destacados solo tiene sentido como AVANCE de lo
      // que viene; en un día terminado el usuario quiere TODOS los resultados,
      // no 4 curados (que además esconderían resultados reales sin avisar).
      if (day !== 'unknown' && day < todayKey) {
        out.push(...sorted)
        continue
      }
      // Al menos MIN; se extiende mientras el siguiente siga siendo favorito o
      // élite (≥ ELITE), hasta MAX. Ordenado desc. → en cuanto uno no cualifica,
      // el resto tampoco: corte limpio.
      let keep = Math.min(DESTACADOS_MIN, sorted.length)
      while (
        keep < sorted.length &&
        keep < DESTACADOS_MAX &&
        (eventHasFavorite(favorites, sorted[keep]) || scoreFor(sorted[keep]) >= DESTACADOS_ELITE)
      ) {
        keep++
      }
      // El Mundial y los DIRECTOS entran SIEMPRE en Destacados, aunque el tope del
      // día (MAX) los dejara fuera: el Mundial garantiza cobertura del torneo y un
      // directo es por definición un destacado. Se respeta el orden ya calculado
      // (`sorted`). [23] antes faltaba `|| isLive` → los directos de liga menor se
      // caían del cap (la app y el curateDay del shared sí los mantenían).
      out.push(...sorted.filter((e, i) =>
        i < keep ||
        isMundial(e.comp) ||
        (liveScores.has(e.id) && isLiveStatus(liveScores.get(e.id)?.status ?? '')),
      ))
    }
    return out
  }, [filtered, activeFilter, activeComp, favorites, followedSports, search, liveScores, tz])

  const grouped = useMemo(() => groupEventsByDate(filteredForGrouping, tz), [filteredForGrouping, tz])
  const orderedDates = useMemo(() => orderedDateKeys(grouped), [grouped])

  // A propósito NO cargamos días pasados al montar: HOY aparece arriba al
  // instante, sin "flash" ni saltos. Los pasados se traen solo cuando el usuario
  // pulsa la casilla "Ver resultados anteriores" (en el cuerpo de la lista).

  const liveCount = liveEventsInList.length + orphanFixtures.length

  const remindedEvents = useMemo(
    () => events.filter(e => reminders.has(e.id)),
    [events, reminders]
  )

  // Histórico: 10d usa lo que entró por SSR; rangos mayores cargan desde la API.
  const useExtendedPast = pastRange !== '10d'
  const pastSource = useExtendedPast ? extraPast : recentPast

  // Fetch del histórico extendido cuando cambia rango / deporte / búsqueda.
  useEffect(() => {
    if (!useExtendedPast) {
      setExtraPast([])
      setPastNextCursor(null)
      setPastError(null)
      return
    }
    let cancelled = false
    const ctrl = new AbortController()
    const debounce = setTimeout(async () => {
      const params = new URLSearchParams()
      const days = pastRange === '30d' ? 30 : pastRange === '90d' ? 90 : 365 * 3
      const fromDate = new Date(Date.now() - days * 86_400_000)
      params.set('from', fromDate.toISOString())
      params.set('limit', '60')
      if (activeFilter && activeFilter !== 'Todo') params.set('sport', activeFilter)
      if (search.trim()) params.set('q', search.trim())
      setPastLoading(true)
      setPastError(null)
      try {
        const res = await fetch(`/api/events/past?${params.toString()}`, { signal: ctrl.signal })
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json() as { events: SportEvent[]; nextCursor: string | null }
        if (cancelled) return
        setExtraPast(data.events ?? [])
        setPastNextCursor(data.nextCursor ?? null)
      } catch (err) {
        if (cancelled || (err as Error).name === 'AbortError') return
        setPastError('No se pudo cargar el histórico')
        setExtraPast([])
        setPastNextCursor(null)
      } finally {
        if (!cancelled) setPastLoading(false)
      }
    }, 250)
    return () => { cancelled = true; ctrl.abort(); clearTimeout(debounce) }
  }, [useExtendedPast, pastRange, activeFilter, search])

  const loadMorePast = useCallback(async () => {
    if (!pastNextCursor || pastLoading) return
    const params = new URLSearchParams()
    const days = pastRange === '30d' ? 30 : pastRange === '90d' ? 90 : 365 * 3
    const fromDate = new Date(Date.now() - days * 86_400_000)
    params.set('from', fromDate.toISOString())
    params.set('cursor', pastNextCursor)
    params.set('limit', '60')
    if (activeFilter && activeFilter !== 'Todo') params.set('sport', activeFilter)
    if (search.trim()) params.set('q', search.trim())
    setPastLoading(true)
    try {
      const res = await fetch(`/api/events/past?${params.toString()}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json() as { events: SportEvent[]; nextCursor: string | null }
      setExtraPast(prev => {
        const seen = new Set(prev.map(e => e.id))
        const fresh = (data.events ?? []).filter(e => !seen.has(e.id))
        return [...prev, ...fresh]
      })
      setPastNextCursor(data.nextCursor ?? null)
    } catch {
      setPastError('No se pudo cargar más')
    } finally {
      setPastLoading(false)
    }
  }, [pastNextCursor, pastLoading, pastRange, activeFilter, search])

  // Filtered past events (sport + search aware)
  const filteredPast = useMemo(() => {
    const matchesSearch = (e: SportEvent) =>
      !search
        || namesMatch(e.home, search)
        || (e.away ? namesMatch(e.away, search) : false)
        || namesMatch(e.comp, search)
        || namesMatch(e.sport, search)
    const matchesSport = (e: SportEvent) =>
      activeFilter === 'Todo' || activeFilter === 'Destacados' || e.sport === activeFilter
    return pastSource.filter(e => matchesSport(e) && (!activeCompCfg || matchesCompetition(activeCompCfg, e)) && matchesSearch(e))
  }, [pastSource, search, activeFilter, activeCompCfg])

  // Past events grouped by date (most-recent first)
  const pastGrouped = useMemo(() => {
    const groups: Record<string, SportEvent[]> = {}
    for (const e of filteredPast) {
      const k = e.isoDate ? isoToLocalDate(e.isoDate, tz) : e.date
      if (!groups[k]) groups[k] = []
      groups[k].push(e)
    }
    return groups
  }, [filteredPast, tz])

  const pastOrderedDates = useMemo(
    () => Object.keys(pastGrouped).sort((a, b) => b.localeCompare(a)),
    [pastGrouped]
  )

  // UFC events for modal
  const ufcEventsForDate = useMemo(() => {
    if (!selectedUFCDate) return []
    return filtered.filter(e =>
      isCombat(e.sport) &&
      e.isoDate &&
      isoToLocalDate(e.isoDate, tz) === selectedUFCDate
    )
  }, [selectedUFCDate, filtered, tz])

  // Build hero cards
  const liveHeroCards = useMemo(() => {
    const cards: React.ReactNode[] = []
    for (const event of liveEventsInList) {
      const score = liveScores.get(event.id)
      cards.push(
        <LiveHeroCard
          key={event.id}
          homeTeam={event.home}
          awayTeam={event.away ?? ''}
          homeAbbr={event.homeAbbr}
          awayAbbr={event.awayAbbr}
          homeLogo={event.homeLogo}
          awayLogo={event.awayLogo}
          homePhoto={event.homePhoto}
          awayPhoto={event.awayPhoto}
          homeScore={score?.homeGoals ?? 0}
          awayScore={score?.awayGoals ?? 0}
          status={score?.status ?? 'LIVE'}
          elapsed={score?.elapsed ?? null}
          sport={event.sport}
          comp={event.comp}
          matchRef={event.matchRef}
          broadcast={event.broadcast}
          tz={tz}
          flashing={flashIds.has(event.id)}
          isReminded={reminders.has(event.id)}
          onToggleReminder={() => toggleReminder(event.id)}
        />
      )
    }
    for (const fixture of orphanFixtures) {
      cards.push(
        <LiveHeroCard
          key={fixture.id}
          homeTeam={fixture.homeTeam}
          awayTeam={fixture.awayTeam}
          homeAbbr={fixture.homeAbbr}
          awayAbbr={fixture.awayAbbr}
          homeLogo={fixture.homeLogo}
          awayLogo={fixture.awayLogo}
          homePhoto={fixture.homePhoto}
          awayPhoto={fixture.awayPhoto}
          homeScore={fixture.homeGoals}
          awayScore={fixture.awayGoals}
          status={fixture.status}
          elapsed={fixture.elapsed}
          sport={fixture.sport}
          comp={fixture.comp}
          matchRef={fixture.matchRef}
          tz={tz}
          isReminded={reminders.has(fixture.id)}
          onToggleReminder={() => toggleReminder(fixture.id)}
        />
      )
    }
    return cards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEventsInList, orphanFixtures, reminders, liveScores, tz])

  // Tema por deporte: deriva del filtro activo. El cambio = solo swap de
  // variables CSS (instantáneo). La capa .cal-ambient se re-monta con key para
  // un crossfade suave de la textura característica.
  // Si hay competición seleccionada, su deporte manda (el ambiente casa con su
  // banner); si no, deriva del filtro de deporte.
  const themeKey = sportThemeKey(activeCompCfg?.sport ?? activeFilter)

  // Foto ÚNICA de la cabecera (telón): refleja lo seleccionado — la foto de la
  // competición si hay una elegida, si no la del deporte del filtro. Va de fondo,
  // con el título y los selectores encima; NO hay banner-recuadro aparte. Las
  // cabeceras de grupo de la competición activa no repiten la foto (la lleva el
  // telón); en la vista general cada liga conserva la suya (variedad).
  // En las vistas generales del calendario (Destacados/Todo/nicho → tema 'default')
  // usamos una arena nocturna PROPIA en vez del bokeh morado compartido con
  // Juegos/Rankings/Estadísticas: casa mejor con el look de foto visible y no
  // arrastra la "franja de luces" del bokeh. Las vistas de un deporte conservan su foto.
  const heroPhoto =
    activeCompCfg?.banner ??
    (themeKey === 'default' ? '/banners/signal/destacados.webp' : SPORT_THEME[themeKey].backdrop) ??
    null

  // Día de HOY (local): separa los días pasados (tono rojo suave) de los
  // futuros en las cabeceras del timeline continuo.
  const todayKey = isoToLocalDate(new Date().toISOString(), tz)

  return (
    <main
      className="cal-root relative max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-28"
      data-sport={themeKey}
      style={{ isolation: 'isolate' }}
    >
      {/* Capa ambiente del tema (foto IA + tinte + textura broadcast, detrás del
          hero). Solo el tema activo está montado → su foto carga lazy; el resto
          ni se pide. Sin foto configurada, caen solo tinte + textura. */}
      <div key={activeComp ?? themeKey} className={`cal-ambient${heroPhoto ? ' cal-ambient--photo' : ''}`} style={{ zIndex: 0 }} aria-hidden>
        {heroPhoto && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cal-backdrop" src={heroPhoto} alt="" aria-hidden="true" loading="lazy" decoding="async" />
            <div className="cal-backdrop-scrim" aria-hidden />
          </>
        )}
      </div>
      {/* Header */}
      <div className="relative pt-3 pb-2 sm:pt-6 sm:pb-4" style={{ zIndex: 1 }}>
        {/* Ambient glow */}
        <div className="absolute -top-8 left-0 w-96 h-56 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 15% 45%, rgba(124,58,237,0.09) 0%, transparent 70%)', filter: 'blur(20px)' }} />

        <div className="relative flex items-start justify-between gap-3 mb-2 sm:mb-4">
          <div className="min-w-0">
            {/* Eyebrow: identidad de la competición elegida (escudo + nombre) o
                "Agenda deportiva" cuando no hay filtro de competición. */}
            <div className={`${activeCompCfg ? 'flex' : 'hidden sm:flex'} items-center gap-2 mb-1 sm:mb-2`}>
              {activeCompCfg ? (
                <>
                  {activeCompCfg.crest && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={activeCompCfg.crest} alt="" aria-hidden="true" width={20} height={20} loading="lazy" decoding="async" style={{ objectFit: 'contain', width: 20, height: 20 }} />
                  )}
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] truncate" style={{ color: accentForSport(activeCompCfg.sport, '#A78BFA'), fontFamily: 'var(--font-sport)', maxWidth: '58vw' }}>
                    {activeCompCfg.displayName}
                  </span>
                </>
              ) : (
                <>
                  <span className="block rounded-sm" style={{ width: 3, height: 13, background: '#7C3AED', boxShadow: '0 0 8px rgba(124,58,237,0.5)' }} />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: '#5A5A74', fontFamily: 'var(--font-sport)' }}>
                    Todos los deportes
                  </span>
                </>
              )}
            </div>
            <h1 className="font-black leading-none uppercase"
              style={{ fontFamily: 'var(--font-headline)', fontSize: '1.3rem', color: '#F8F8FF', letterSpacing: '-0.01em' }}>
              Calendario
            </h1>
            {/* Acceso a la página de la competición + quitar filtro. Sustituye al
                antiguo banner-recuadro: la foto ya está de fondo, aquí va el texto. */}
            {activeCompCfg && (
              <div className="flex items-center gap-3 mt-2">
                {activeCompCfg.espnSlug && (
                  <Link href={`/calendario/${activeCompCfg.slug}`} prefetch={false}
                    className="inline-flex items-center gap-1 text-[11px] font-bold no-underline transition-opacity hover:opacity-80"
                    style={{ color: accentForSport(activeCompCfg.sport, '#A78BFA'), fontFamily: 'var(--font-sport)' }}>
                    Clasificación y goleadores
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M4.5 2 8 6l-3.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                )}
                <button onClick={() => setActiveComp(null)} aria-label="Quitar filtro de competición"
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors hover:text-white"
                  style={{ color: '#9A9AAE', fontFamily: 'var(--font-sport)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  Quitar
                </button>
              </div>
            )}
          </div>

          {/* Controles auxiliares a la derecha, en la MISMA fila que el título:
              zona horaria + favoritos + alertas. Sin pestañas ni stat chips para
              que los partidos se vean cuanto antes. */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Zona horaria — único selector (móvil + escritorio) */}
            <TimezoneSelector value={tz} onChange={(newTz) => { setTz(newTz); setStoredTZ(newTz) }} compact />
            {/* Favoritos — abre el modal de elegir equipos. Se tiñe de morado
                cuando el usuario ya tiene equipos guardados. */}
            {(() => {
              const hasFavs = favorites.size > 0
              return (
                <button
                  onClick={() => setShowOnboarding(true)}
                  aria-label="Mis equipos"
                  title="Mis equipos"
                  className="relative flex items-center justify-center rounded-full flex-shrink-0 transition-all"
                  style={{
                    width: 36, height: 36,
                    background: hasFavs ? 'rgba(124,58,237,0.16)' : 'rgba(255,255,255,0.04)',
                    border: hasFavs ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    color: hasFavs ? '#C4B5FD' : '#7A7A8E',
                    cursor: 'pointer',
                  }}>
                  <svg width={15} height={15} viewBox="0 0 16 16" fill={hasFavs ? '#C4B5FD' : 'none'} aria-hidden>
                    <path d="M8 13.5s-5-3-5-7a3 3 0 015-2 3 3 0 015 2c0 4-5 7-5 7z"
                      stroke={hasFavs ? '#C4B5FD' : '#7A7A8E'} strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                  {hasFavs && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center text-[9px] font-black tabular-nums rounded-full"
                      style={{ minWidth: 16, height: 16, padding: '0 4px', background: '#7C3AED', color: '#fff', border: '1px solid var(--bg-base)', fontFamily: 'var(--font-sport)' }}>
                      {favorites.size}
                    </span>
                  )}
                </button>
              )
            })()}
            {/* Alertas — botón icono auxiliar */}
            {(() => {
              const isActive = view === 'recordatorios'
              const remCount = remindedEvents.length
              return (
                <button
                  onClick={() => setView(isActive ? 'todos' : 'recordatorios')}
                  aria-label="Alertas"
                  title="Mis recordatorios"
                  className="relative flex items-center justify-center rounded-full flex-shrink-0 transition-all"
                  style={{
                    width: 36, height: 36,
                    background: isActive ? 'rgba(251,191,36,0.16)' : 'rgba(255,255,255,0.04)',
                    border: isActive ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    color: isActive ? '#FBBF24' : '#7A7A8E',
                    cursor: 'pointer',
                  }}>
                  <BellIcon size={14} />
                  {remCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center text-[9px] font-black tabular-nums rounded-full"
                      style={{ minWidth: 16, height: 16, padding: '0 4px', background: '#FBBF24', color: '#0a0a12', border: '1px solid var(--bg-base)', fontFamily: 'var(--font-sport)' }}>
                      {remCount}
                    </span>
                  )}
                </button>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Day chips + Toolbar (sticky on scroll) */}
      {view === 'todos' && (
        <div
          ref={stickyBarRef}
          className="mb-4 -mx-4 sm:-mx-6 xl:-mx-10 px-4 sm:px-4 sm:px-6 xl:px-10 pt-2 pb-3"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            background: 'linear-gradient(180deg, rgba(10,10,18,0.96) 0%, rgba(10,10,18,0.88) 80%, rgba(10,10,18,0) 100%)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {availableDays.length > 0 && (
            <div className="mb-2.5">
              <DayChips days={availableDays} value={selectedDate} onChange={setSelectedDate} tz={tz} />
            </div>
          )}
          {/* Toolbar — single scrollable row on mobile, two-row layout on sm+ */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
            <SearchInput value={searchRaw} onChange={setSearchRaw} />
            {/* Divider */}
            <div className="flex-shrink-0 w-px h-4" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <button
              onClick={() => setOnlyLive(v => !v)}
              aria-pressed={onlyLive}
              aria-label="Mostrar solo partidos en vivo"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0"
              style={{
                background: onlyLive ? 'rgba(255,77,46,0.18)' : 'rgba(255,255,255,0.04)',
                color: onlyLive ? '#FF4D2E' : '#7A7A8E',
                border: onlyLive ? '1px solid rgba(255,77,46,0.45)' : '1px solid rgba(255,255,255,0.06)',
                fontFamily: 'var(--font-sport)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: onlyLive ? '0 0 12px rgba(255,77,46,0.18)' : 'none',
              }}
            >
              {onlyLive && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#FF4D2E' }} />}
              En vivo
            </button>
            {hasActiveFilters && (
              <>
                <div className="flex-shrink-0 w-px h-4" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0"
                  style={{
                    background: 'rgba(244,63,94,0.10)',
                    color: '#FB7185',
                    border: '1px solid rgba(244,63,94,0.25)',
                    fontFamily: 'var(--font-sport)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ✕ Limpiar
                </button>
              </>
            )}
          </div>

          {/* Sport categories — Destacados es una pastilla resaltada,
              el resto tabs de texto plano con subrayado púrpura al activo.
              Mask en el borde derecho indica que hay scroll horizontal. */}
          {/* Barra unificada de categorías (fichas con logo, scrollable):
              Destacados → Todo → deportes (icono) → competiciones (escudo).
              Reemplaza los antiguos chips de texto. Deporte/modo ajusta el filtro;
              competición fija activeComp → su foto pasa al telón de fondo de la
              cabecera y su escudo/acceso a la página aparecen junto al título. */}
          <div className="mt-3 pb-1">
            <CompetitionSelector
              events={events}
              activeFilter={activeFilter}
              activeComp={activeComp}
              onSelectSport={(k) => { setActiveComp(null); setActiveFilter(k) }}
              onSelectComp={(slug) => { if (activeComp === slug) { setActiveComp(null) } else { setActiveFilter('Todo'); setActiveComp(slug) } }}
            />
            {/* "Mis deportes": personaliza los Destacados. Vacío → se ven todos.
                Se sincroniza con la app (usuarios con sesión). Editor completo en el
                Perfil (fase posterior); aquí una fila mínima de chips. */}
            {activeFilter === 'Destacados' && (
              <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                <span className="text-[10px] font-black uppercase tracking-widest flex-shrink-0"
                  style={{ color: '#7C7C8C', fontFamily: 'var(--font-sport)' }}>
                  Mis deportes
                </span>
                {FOLLOWABLE_SPORTS.map((slug) => {
                  const on = followedSports.has(slug)
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => toggleFollowedSport(slug)}
                      aria-pressed={on}
                      className="flex-shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-full transition-all"
                      style={{
                        background: on ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
                        color: on ? '#C4B5FD' : '#8A8AA0',
                        border: on ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        fontFamily: 'var(--font-sport)',
                      }}
                    >
                      {SLUG_TO_LABEL[slug] ?? slug}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {view === 'todos' && (
        <div className="relative z-[1] space-y-10">
          {/* Live strip at top of TODOS view */}
          {liveCount > 0 && !selectedDate && (
            <section>
              <SectionHeader icon={<LiveDotIcon size={8} />} label="En Vivo" color="#FF4D2E" count={liveCount} hint={liveCount > 3 ? '← desliza →' : undefined} />
              <LiveHeroStrip items={liveHeroCards} />
            </section>
          )}

          {/* El resumen grande de "tus equipos" se retiró de la lista: ocupaba
              demasiado. Ver y cambiar tus equipos vive ahora en el botón ♥ de la
              cabecera. Así, al entrar, se ven antes los partidos. */}

          {orderedDates.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="mb-2 flex justify-center" style={{ color: onlyLive ? '#FF4D2E' : '#7C7C8C' }}>
                {onlyLive
                  ? <LiveDotIcon size={32} />
                  : search
                    ? <SearchIcon size={32} />
                    : (activeFilter !== 'Todo' && activeFilter !== 'Destacados')
                      ? <SportIcon sport={activeFilter} size={32} />
                      : <CalendarIcon size={32} />}
              </p>
              <p style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', fontSize: 13, fontWeight: 600 }}>
                {onlyLive
                  ? 'No hay partidos en vivo ahora mismo'
                  : search
                    ? `Sin resultados para "${search}"`
                    : selectedDate
                      ? 'No hay partidos para esa fecha'
                      : activeCompCfg
                        ? `No hay partidos de ${activeCompCfg.shortName} programados ahora`
                        : (activeFilter !== 'Todo' && activeFilter !== 'Destacados')
                          ? `No hay eventos de ${activeFilter} en los próximos días`
                          : 'No se encontraron eventos'}
              </p>
              <p className="text-[10px] mt-1.5" style={{ color: '#7A7A8E' }}>
                {onlyLive
                  ? 'Cuando arranque un partido aparecerá aquí. Quita el filtro para ver todo el calendario.'
                  : search
                    ? 'Prueba con el nombre del equipo o la competición'
                    : selectedDate
                      ? 'Mostramos las próximas ~3 semanas. Para los días ya jugados, pulsa «Ver resultados anteriores».'
                      : activeCompCfg
                        ? 'Mira su clasificación y todo el calendario en el banner de arriba ↑'
                        : (activeFilter !== 'Todo' && activeFilter !== 'Destacados')
                          ? 'Prueba seleccionando otra fecha o cambia el filtro'
                          : 'Vuelve a intentarlo en unos minutos'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all hover:brightness-125"
                  style={{ background: 'rgba(124,58,237,0.16)', color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.4)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
                >
                  ✕ Quitar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Casilla "Ver resultados anteriores": al entrar HOY está arriba y
                  no se carga nada (sin flash). Al pulsarla se traen los días
                  pasados con sus marcadores y se asoman por arriba (el usuario
                  sube para verlos). Solo en la vista general (sin día ni "En vivo"). */}
              {pastTimeline.length === 0 && !selectedDate && !onlyLive ? (
                <button
                  onClick={() => loadPastWindow()}
                  className="cal-press w-full flex items-center justify-center gap-1.5 py-2.5 mb-1 rounded-xl text-[10px] font-black uppercase tracking-[0.18em] transition-all hover:brightness-125"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)', color: '#9090A8', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M2.5 7.5L6 4l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Ver resultados anteriores
                </button>
              ) : pastTimeline.length > 0 ? (
                <div className="flex items-center justify-center py-2 text-[10px] uppercase tracking-widest" style={{ color: '#7C7C8C', fontFamily: 'var(--font-sport)' }}>
                  <span>Resultados de días anteriores</span>
                </div>
              ) : null}
              {orderedDates.map(dateKey => {
              // Orden cronológico de los partidos del día. En "Destacados" se respeta
              // la curación por relevancia (top del día); en el resto (Todo / deporte /
              // competición) se ordena por isoDate (instante real → sube de menor a
              // mayor sea cual sea la zona horaria del usuario), de modo que las
              // competiciones quedan por su primer partido y, dentro de cada una, los
              // encuentros van en hora ascendente.
              const rawDay = grouped[dateKey] ?? []
              const dayEvents = activeFilter === 'Destacados'
                ? rawDay
                : [...rawDay].sort((a, b) => (a.isoDate ?? '').localeCompare(b.isoDate ?? ''))
              // Agrupar por competición (orden de primera aparición) y ordenar por
              // hora los partidos DENTRO de cada liga. En Destacados venían por
              // relevancia ("caché"), no por hora → ver groupDayByCompetition.
              const { order: compOrder, byComp } = groupDayByCompetition(dayEvents)
              // Ligas fijadas primero (orden estable; el resto, primera aparición).
              compOrder.sort((a, b) => {
                const pa = favComps.has(compConfigForGroup(a, byComp[a][0]?.sport)?.slug ?? '') ? 1 : 0
                const pb = favComps.has(compConfigForGroup(b, byComp[b][0]?.sport)?.slug ?? '') ? 1 : 0
                return pb - pa
              })
              return (
                // key incluye el filtro/fecha/onlyLive: al cambiarlos la sección
                // se re-monta y dispara la entrada en cascada (Fase B). No incluye
                // search ni liveScores → no re-anima al teclear ni en cada poll.
                <section ref={dateKey === todayKey ? todaySepRef : undefined} key={`${activeFilter}|${selectedDate ?? ''}|${onlyLive ? 'L' : ''}|${dateKey}`}>
                  <DaySeparator dateKey={dateKey} count={dayEvents.length} tone={dateKey < todayKey ? 'past' : 'upcoming'} tz={tz} />
                  {compOrder.map((comp, compIdx) => {
                    const compEvents = byComp[comp]
                    // FASE 3 (José Tomás 2026-07-09): cabecera de liga en el color
                    // POR DEPORTE (verde fútbol, ámbar básket…), igual que las tarjetas
                    // y que la app. Antes usaba el color de marca de la competición.
                    const accent = accentForSport(compEvents[0]?.sport, '#A78BFA')
                    const cfg = compConfigForGroup(comp, compEvents[0]?.sport)
                    return (
                      <div key={comp} className="mb-2 relative cal-anim-in" style={{ animationDelay: `${Math.min(compIdx * 55, 280)}ms` }}>
                        <CompGroupHeader comp={comp} accent={accent} count={compEvents.length} first={compIdx === 0} crest={cfg?.crest} slug={cfg?.slug} banner={activeComp && cfg?.slug === activeComp ? undefined : cfg?.banner} pinned={!!cfg?.slug && favComps.has(cfg.slug)} onTogglePin={cfg?.slug ? () => togglePinComp(cfg.slug!) : undefined} />
                        <div className="space-y-1.5">
                          {compEvents.map(event => (
                            <MatchRow
                              key={event.id}
                              event={event}
                              liveScore={liveScores.get(event.id)}
                              isReminded={reminders.has(event.id)}
                              onToggleReminder={() => toggleReminder(event.id)}
                              onClickUFC={setSelectedUFCDate}
                              flashing={flashIds.has(event.id)}
                              isFav={eventHasFavorite(favorites, event)}
                              homeFav={isFavorite(favorites, event.home)}
                              awayFav={isFavorite(favorites, event.away)}
                              onToggleFav={() => toggleFavorite(event.home)}
                              formHome={recentForms[formKey(event, event.home)]}
                              formAway={event.away ? recentForms[formKey(event, event.away)] : undefined}
                              showReason={activeFilter === 'Destacados'}
                              tz={tz}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </section>
              )
              })}
            </>
          )}

          {/* CTA — invitar a ver toda la agenda cuando estamos en modo Destacados */}
          {activeFilter === 'Destacados' && orderedDates.length > 0 && filtered.length > filteredForGrouping.length && (
            <div className="flex flex-col items-center gap-1.5 pt-2">
              <p className="text-[11px]" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                Mostrando lo más destacado de cada día
              </p>
              <button
                onClick={() => setActiveFilter('Todo')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.16em] transition-all"
                style={{
                  color: '#C4B5FD',
                  background: 'rgba(124,58,237,0.12)',
                  border: '1px solid rgba(124,58,237,0.32)',
                  fontFamily: 'var(--font-sport)',
                  cursor: 'pointer',
                }}
              >
                Ver todo el calendario ({filtered.length})
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {view === 'recordatorios' && (
        <div className="relative z-[1] space-y-5">
          {remindedEvents.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="mb-3 flex justify-center" style={{ color: '#FBBF24', opacity: 0.6 }}><BellIcon size={32} /></p>
              <p style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', fontSize: 13, fontWeight: 600 }}>
                No tienes recordatorios activos
              </p>
              <p className="text-[10px] mt-1.5 flex items-center justify-center gap-1" style={{ color: '#7A7A8E' }}>
                Pulsa <BellIcon size={10} /> en cualquier partido para recordarlo
              </p>
            </div>
          ) : (
            <section>
              <SectionHeader icon={<BellIcon size={12} />} label="Mis Recordatorios" color="#FBBF24" count={remindedEvents.length} />
              <div className="space-y-1.5">
                {remindedEvents.map(event => {
                  const evDate = event.isoDate ? isoToLocalDate(event.isoDate, tz) : null
                  const today = isoToLocalDate(new Date().toISOString(), tz)
                  const dateLabel = evDate && evDate !== today ? formatDateLabel(evDate, tz) : undefined
                  return (
                    <MatchRow
                      key={event.id}
                      event={event}
                      liveScore={liveScores.get(event.id)}
                      isReminded={true}
                      onToggleReminder={() => toggleReminder(event.id)}
                      dateLabel={dateLabel}
                      showComp
                      onClickUFC={setSelectedUFCDate}
                      flashing={flashIds.has(event.id)}
                      isFav={eventHasFavorite(favorites, event)}
                      homeFav={isFavorite(favorites, event.home)}
                      awayFav={isFavorite(favorites, event.away)}
                      onToggleFav={() => toggleFavorite(event.home)}
                      formHome={recentForms[formKey(event, event.home)]}
                      formAway={event.away ? recentForms[formKey(event, event.away)] : undefined}
                      tz={tz}
                    />
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* UFC Card Modal */}
      {selectedUFCDate && (
        <UFCCardModal
          date={selectedUFCDate}
          events={ufcEventsForDate}
          liveScores={liveScores}
          reminders={reminders}
          onToggleReminder={toggleReminder}
          onClose={() => setSelectedUFCDate(null)}
        />
      )}

      {/* Favorites onboarding (first visit) */}
      {showOnboarding && (
        <FavoritesOnboarding
          onClose={skipOnboarding}
          onSave={(teams) => { finishOnboarding(teams); setShowOnboarding(false) }}
        />
      )}

      {/* Mini-paso de contexto antes de pedir el permiso de notificaciones.
          Solo aparece la 1ª vez (permiso 'default'); el permiso real se solicita
          al pulsar "Permitir avisos" (dentro del gesto, con contexto). */}
      {reminderPrompt && (
        <div
          onClick={closeReminderPrompt}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            ref={reminderDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reminder-dialog-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 340, maxWidth: '90%', background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 18, padding: '24px 22px', textAlign: 'center' }}
          >
            <div style={{ width: 56, height: 56, margin: '0 auto 14px', borderRadius: '50%', background: 'rgba(255,77,46,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-action)' }}>
              <BellIcon size={26} />
            </div>
            <div style={{ fontFamily: 'var(--font-sport)', textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 11, color: 'var(--accent-action)', fontWeight: 600, marginBottom: 6 }}>
              Recordatorio
            </div>
            <h2 id="reminder-dialog-title" style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontWeight: 700, fontSize: 24, lineHeight: 1.05, color: '#F4F4F8', marginBottom: 10 }}>
              Activa los avisos
            </h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
              Te avisamos <strong style={{ color: '#C8C8D4', fontWeight: 600 }}>~10 min antes</strong> del partido, aunque tengas la web cerrada. Para eso necesitamos tu permiso de notificaciones.
            </p>
            {(reminderPrompt.home || reminderPrompt.comp) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', background: '#0E0E14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 12px', marginBottom: 18 }}>
                <span style={{ color: '#34D399', display: 'inline-flex' }}><ClipboardIcon size={15} /></span>
                <span style={{ fontSize: 12.5, color: '#C8C8D4' }}>
                  {reminderPrompt.home}{reminderPrompt.away ? ` vs ${reminderPrompt.away}` : ''}{reminderPrompt.comp ? ` · ${reminderPrompt.comp}` : ''}
                </span>
              </div>
            )}
            <button
              onClick={() => { const id = reminderPrompt.id; enableReminderPush(id); setReminderPrompt(null) }}
              style={{ width: '100%', background: 'var(--accent-action)', color: '#fff', border: 'none', borderRadius: 11, padding: 12, fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontWeight: 700, fontSize: 15, letterSpacing: '0.04em', cursor: 'pointer', marginBottom: 9 }}
            >
              Permitir avisos
            </button>
            <button
              onClick={closeReminderPrompt}
              style={{ width: '100%', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 11, padding: 11, fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
            >
              Ahora no
            </button>
            <p style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--text-muted)', margin: '13px 0 0' }}>
              El recordatorio se guarda en tu cuenta igualmente. Sin permiso no podremos enviarte el aviso.
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
