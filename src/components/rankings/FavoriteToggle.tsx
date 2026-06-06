'use client'

import { useEffect, useState } from 'react'

// Botón de corazón para añadir/quitar de favoritos.
// Optimistic update: el click se ve inmediato; si la API falla, revierte.
// Si el usuario no está logueado, redirige a /login con returnTo.

interface Props {
  entryId: string
  size?: number
}

// Cache compartida a nivel de módulo: TODAS las filas comparten UNA sola
// petición a /api/rankings/favorites (antes cada fila hacía la suya → N+1:
// una vista de 50 filas disparaba 50 fetches idénticos).
let favoritesCache: Promise<Set<string>> | null = null
function loadFavorites(): Promise<Set<string>> {
  if (!favoritesCache) {
    favoritesCache = fetch('/api/rankings/favorites', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : { favorites: [] }))
      .then((j: { favorites?: { entry_id: string }[] }) =>
        new Set((j.favorites ?? []).map(f => f.entry_id)))
      .catch(() => new Set<string>())
  }
  return favoritesCache
}
function updateFavoritesCache(id: string, add: boolean) {
  favoritesCache?.then(set => { if (add) set.add(id); else set.delete(id) })
}

export default function FavoriteToggle({ entryId, size = 18 }: Props) {
  const [active, setActive] = useState<boolean | null>(null)  // null = aún cargando

  useEffect(() => {
    let alive = true
    loadFavorites().then(set => { if (alive) setActive(set.has(entryId)) })
    return () => { alive = false }
  }, [entryId])

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const wasActive = active
    setActive(!wasActive)
    try {
      const res = wasActive
        ? await fetch(`/api/rankings/favorites?entry_id=${encodeURIComponent(entryId)}`, {
            method: 'DELETE', credentials: 'same-origin',
          })
        : await fetch('/api/rankings/favorites', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry_id: entryId }),
          })
      if (res.status === 401) {
        window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname)}`
        return
      }
      if (!res.ok) setActive(wasActive)
      else updateFavoritesCache(entryId, !wasActive)
    } catch {
      setActive(wasActive)
    }
  }

  if (active === null) return <span style={{ display: 'inline-block', width: size, height: size }} />

  return (
    <button
      onClick={toggle}
      title={active ? 'Quitar de favoritos' : 'Añadir a favoritos'}
      aria-label={active ? 'Quitar de favoritos' : 'Añadir a favoritos'}
      style={{
        background: 'transparent', border: 0, padding: 4, cursor: 'pointer',
        lineHeight: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24"
        fill={active ? '#f87171' : 'none'}
        stroke={active ? '#f87171' : '#5A5A72'}
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'all 0.18s' }}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
  )
}
