'use client'

// "Deportes seguidos" en la web (concepto que antes solo existía en la app).
// Local primero (localStorage) + sincronización por cuenta reutilizando
// user_favorites con clave `sport:<slug>` — el MISMO formato que la app, así que
// app↔web logueadas comparten la elección. Invitado = solo local.
//
// Espejo del patrón de favoritos de equipos en CalendarioContent
// (localStorage `ts_favorites` + syncFavoriteToCloud). No usamos store global:
// un CustomEvent mantiene en sync los componentes de la misma página.

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'

const LS_KEY = 'ts_followed_sports'
const SPORT_PREFIX = 'sport:'
// Slugs canónicos válidos (defensivo al leer de la nube).
export const FOLLOWABLE_SPORTS = ['futbol', 'baloncesto', 'formula1', 'tenis', 'ufc', 'wwe', 'rugby'] as const
const VALID = new Set<string>(FOLLOWABLE_SPORTS)

function readLocal(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((s: unknown): s is string => typeof s === 'string' && VALID.has(s)) : []
  } catch {
    return []
  }
}
function writeLocal(slugs: string[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(slugs))
  } catch {
    /* almacenamiento lleno / privado — se queda solo en memoria */
  }
}

function syncToCloud(slug: string, active: boolean) {
  const supabase = createClient()
  if (!supabase) return
  supabase.auth.getSession().then(({ data }) => {
    if (!data.session) return
    const entryId = SPORT_PREFIX + slug
    if (active) {
      fetch('/api/rankings/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: entryId }),
      }).catch(() => {})
    } else {
      fetch(`/api/rankings/favorites?entry_id=${encodeURIComponent(entryId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      }).catch(() => {})
    }
  })
}

export function useFollowedSports() {
  const [sports, setSportsState] = useState<Set<string>>(new Set())
  // Ref con el valor actual para que `toggle` calcule el siguiente estado y haga
  // sus efectos FUERA del updater de setState (dispatch del CustomEvent dentro del
  // updater = "setState en render" al reaccionar otros componentes).
  const sportsRef = useRef<Set<string>>(sports)
  useEffect(() => {
    sportsRef.current = sports
  }, [sports])

  useEffect(() => {
    const local = readLocal()
    sportsRef.current = new Set(local)
    setSportsState(new Set(local))
    // Fusión con la nube al cargar (si hay sesión): unión local+nube y sube lo
    // que solo estaba en local (mismo criterio que el merge de equipos favoritos).
    const supabase = createClient()
    if (!supabase) return
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session || cancelled) return
      try {
        const res = await fetch('/api/rankings/favorites', { credentials: 'same-origin' })
        if (!res.ok) return
        const j = await res.json()
        const cloud: string[] = (j.favorites ?? [])
          .map((f: { entry_id: string }) => f.entry_id)
          .filter((id: string) => id.startsWith(SPORT_PREFIX))
          .map((id: string) => id.slice(SPORT_PREFIX.length))
          .filter((s: string) => VALID.has(s))
        if (cancelled) return
        const merged = new Set<string>([...local, ...cloud])
        sportsRef.current = merged
        setSportsState(merged)
        writeLocal([...merged])
        const cloudSet = new Set(cloud)
        for (const s of local) if (!cloudSet.has(s)) syncToCloud(s, true)
      } catch {
        /* sin red — nos quedamos con lo local */
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Los chips que EDITAN los deportes viven dentro de CalendarioContent, que
  // re-renderiza su propia lista con este estado; los componentes del Inicio
  // (LiveStrip/LiveEventsSection) solo LEEN al montar. No hace falta un canal
  // cross-componente (un CustomEvent síncrono causaba "setState en render" al
  // reaccionar otro componente durante el render del que togglea).
  const toggle = useCallback((slug: string) => {
    if (!VALID.has(slug)) return
    const next = new Set(sportsRef.current)
    const active = !next.has(slug)
    if (active) next.add(slug)
    else next.delete(slug)
    sportsRef.current = next
    setSportsState(next)
    writeLocal([...next])
    syncToCloud(slug, active)
  }, [])

  return { sports, toggle }
}
