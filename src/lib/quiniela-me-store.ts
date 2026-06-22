'use client'

// ─────────────────────────────────────────────────────────────────
// quiniela-me-store — store singleton (un solo fetch global a
// /api/quiniela/me) compartido por Header (chip de nivel + toast de
// level-up) y BadgeUnlockProvider (modal de insignias nuevas).
//
// PROBLEMA que resuelve: antes CADA uno hacía su propio fetch en cada
// carga (y el Header además en cada navegación, porque se monta por
// página, no en un layout compartido) → 2+ llamadas redundantes por
// carga. Esto las funde en UNA.
//
// POR QUÉ un store de módulo y NO un React Context: el <Header/> se
// monta en muchísimos sitios (HeaderConsole en (public)/, y directo en
// home/calendario/[sport]/…), fuera de cualquier ancestro común con el
// BadgeUnlockProvider (que vive en el layout raíz). Un Context exigiría
// envolver todas esas monturas; un store de módulo + useSyncExternalStore
// funciona estén donde estén montados los consumidores.
//
// DISEÑO (según verificación adversarial):
//   · El store SOLO entrega datos + una `version` que sube en cada
//     respuesta fresca. NO decide UI ni toca el storage de nadie.
//   · Cada consumidor mantiene su PROPIA lógica de detección con su
//     PROPIO storage (Header: sessionStorage ts_level_*; badge:
//     localStorage taka_seen_badges_v1) y corre su diff una vez por
//     `version` (= una vez por respuesta).
//   · El store cablea los 3 disparadores: (a) cambio de auth de Supabase
//     (forzado, sin throttle — el Header quiere pintar el nivel ya), (b)
//     visibilitychange→visible (throttle), (c) evento 'taka:badge-check'
//     tras settle/flush (throttle). El throttle de 8s y la desactivación
//     en 401/503 son políticas del fetch compartido (antes vivían en el
//     badge), no del Header.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useSyncExternalStore } from 'react'

export interface QuinielaMeBadge {
  id: string
  name: string
  emoji: string
  color: string
  bg: string
  rarity: string
  description: string
  unlockedAt: string | null
}

// Forma parcial: solo declaramos lo que consumen Header y el badge. El
// endpoint devuelve más campos (equipment, stats, etc.) que aquí no
// hacen falta — los lee cada página por su cuenta.
export interface QuinielaMe {
  level?: number
  levelName?: string
  levelColor?: string
  progress?: number
  xp?: number
  xpToNext?: number
  badges?: QuinielaMeBadge[]
}

export interface QuinielaMeSnapshot {
  data: QuinielaMe | null
  // Sube en CADA respuesta (incluso si el contenido es idéntico). Es la
  // señal de "llegó dato fresco" que distingue una respuesta de otra para
  // que los diffs de los consumidores corran exactamente una vez por fetch.
  version: number
}

const THROTTLE_MS = 8000

let snapshot: QuinielaMeSnapshot = { data: null, version: 0 }
let inFlight: Promise<void> | null = null
let disabled = false // 401/503 → no más auto-checks hasta un fetch forzado (login)
let lastFetch = 0
let initialized = false
const listeners = new Set<() => void>()

// Snapshot estable para SSR/hidratación (mismo contenido que el inicial
// del cliente → sin desajuste de hidratación).
const SERVER_SNAPSHOT: QuinielaMeSnapshot = { data: null, version: 0 }

function setSnapshot(data: QuinielaMe | null) {
  snapshot = { data, version: snapshot.version + 1 }
  for (const l of listeners) l()
}

// Throttle + disable + dedup-por-promesa-en-vuelo. `force` (cambio de
// auth / fetch inicial) salta throttle y re-activa tras un 401.
function doFetch(force: boolean): Promise<void> {
  if (force) {
    disabled = false
  } else if (disabled || Date.now() - lastFetch < THROTTLE_MS) {
    return Promise.resolve()
  }
  if (inFlight) return inFlight
  lastFetch = Date.now()
  const p = (async () => {
    try {
      const r = await fetch('/api/quiniela/me', { cache: 'no-store' })
      if (r.status === 401 || r.status === 503) {
        disabled = true
        setSnapshot(null)
        return
      }
      if (!r.ok) return // error transitorio: conservamos el último valor
      const json = (await r.json()) as QuinielaMe
      setSnapshot(json)
    } catch {
      /* silencioso */
    } finally {
      inFlight = null
    }
  })()
  inFlight = p
  return p
}

/** Fuerza una recarga (salta throttle y re-activa tras 401). */
export function refreshQuinielaMe(): void {
  void doFetch(true)
}

// Inicializa los disparadores una sola vez (idempotente). Lo llama el
// hook al montar el primer consumidor.
function ensureInit() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  // Fetch inicial: usa la cookie de sesión (se adjunta sola), así funciona
  // aunque el JS de Supabase aún no haya cargado. Logueado → 200; invitado
  // → 401 → disabled.
  void doFetch(true)

  const onVisible = () => {
    if (document.visibilityState === 'visible') void doFetch(false)
  }
  document.addEventListener('visibilitychange', onVisible)

  // Tras un settle/flush, QuinielaClient/MundialClient/games-store disparan
  // este evento para que aparezca la insignia recién ganada sin esperar foco.
  const onBadgeCheck = () => { void doFetch(false) }
  window.addEventListener('taka:badge-check', onBadgeCheck)

  // Cambio de sesión → recarga forzada (login pinta nivel/insignias al
  // instante; logout → 401 → datos a null). Import diferido para no inflar
  // el bundle inicial (mismo patrón que el Header).
  void import('@/lib/supabase')
    .then(({ createClient }) => {
      const sb = createClient()
      if (!sb) return
      // El primer evento (INITIAL_SESSION) ya lo cubre el doFetch inicial de
      // arriba → lo saltamos para no duplicar la llamada en la carga.
      let firstEvent = true
      sb.auth.onAuthStateChange(() => {
        if (firstEvent) {
          firstEvent = false
          return
        }
        void doFetch(true)
      })
    })
    .catch(() => {})
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): QuinielaMeSnapshot {
  return snapshot
}

function getServerSnapshot(): QuinielaMeSnapshot {
  return SERVER_SNAPSHOT
}

/**
 * Suscribe un componente al store compartido de /api/quiniela/me.
 * Devuelve { data, version }. `data` es null mientras no hay sesión o aún
 * no llegó la respuesta; `version` sube en cada respuesta fresca (úsala
 * como dependencia de efecto para correr tu diff una vez por fetch).
 */
export function useQuinielaMe(): QuinielaMeSnapshot {
  useEffect(() => {
    ensureInit()
  }, [])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
