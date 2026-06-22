// Álbum de cromos: persiste qué jugadores ha colocado correctamente el
// usuario en TakaGrid o Mi Once. Cliente puro (localStorage); no se sincroniza
// a backend por ahora. Si en el futuro tenemos cuenta de usuario, basta con
// añadir un loader/saver server-side detrás de esta misma API.

'use client'

import type { GameId } from './games-store'
import { createClient } from '@/lib/supabase'

const STORAGE_KEY = 'ts_album'
const SCHEMA_VERSION = 1
const CHANGED_EVENT = 'ts:album-changed'
// De quién es la cache local: id de usuario | 'guest'. Evita mezclar el álbum
// de un usuario con el de otro y permite fusionar el de invitado solo una vez.
const OWNER_KEY = 'ts_album_owner'

export interface AlbumEntry {
  playerId: string
  firstSeen: string   // YYYY-MM-DD
  count: number
  sources: GameId[]
}

interface AlbumState {
  version: number
  entries: Record<string, AlbumEntry>
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function emptyState(): AlbumState {
  return { version: SCHEMA_VERSION, entries: {} }
}

export function loadAlbum(): AlbumState {
  if (typeof window === 'undefined') return emptyState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as AlbumState
    if (!parsed || parsed.version !== SCHEMA_VERSION) return emptyState()
    return { version: parsed.version, entries: parsed.entries ?? {} }
  } catch {
    return emptyState()
  }
}

export function saveAlbum(s: AlbumState): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

/** Suma una aparición al álbum. Idempotente respecto a (playerId, día). */
export function collectPlayer(playerId: string, source: GameId): AlbumEntry {
  const cur = loadAlbum()
  const today = todayKey()
  const existing = cur.entries[playerId]
  let next: AlbumEntry
  if (existing) {
    const sources = existing.sources.includes(source)
      ? existing.sources
      : [...existing.sources, source]
    next = {
      ...existing,
      count: existing.count + 1,
      sources,
    }
  } else {
    next = { playerId, firstSeen: today, count: 1, sources: [source] }
  }
  cur.entries[playerId] = next
  saveAlbum(cur)
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT)) } catch { /* ignore */ }
  }
  // Local primero (ya hecho); si hay sesión, sube al servidor en 2º plano.
  pushCollectToServer(playerId, source)
  return next
}

export function getAlbumEntries(): AlbumEntry[] {
  const s = loadAlbum()
  return Object.values(s.entries)
}

export function onAlbumChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CHANGED_EVENT, handler)
  return () => window.removeEventListener(CHANGED_EVENT, handler)
}

// ── Sincronización con el servidor (sincroniza web↔app) ──────────────────────
// Modelo "local primero": la UI siempre lee la cache local (síncrona, sin
// romper a nadie). Con sesión, las escrituras suben en 2º plano y el login
// fusiona el local + baja el servidor a la cache. El dueño de la cache evita
// mezclar álbumes de usuarios distintos.

function getOwner(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(OWNER_KEY) } catch { return null }
}
function setOwner(o: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(OWNER_KEY, o) } catch { /* ignore */ }
}

async function isAuthed(): Promise<boolean> {
  const sb = createClient()
  if (!sb) return false
  try {
    const { data } = await sb.auth.getSession()
    return !!data.session
  } catch { return false }
}

/** Sube una aparición al servidor si hay sesión (fire-and-forget). */
function pushCollectToServer(playerId: string, source: GameId): void {
  if (typeof window === 'undefined') return
  void (async () => {
    if (!(await isAuthed())) return
    try {
      await fetch('/api/album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, source }),
      })
    } catch { /* la cache local ya lo tiene */ }
  })()
}

/**
 * Al iniciar sesión: si la cache era de invitado, fusiona el local en el
 * servidor (una vez); después baja el servidor a la cache local. Idempotente.
 */
export async function syncAlbumOnAuth(userId: string): Promise<void> {
  if (typeof window === 'undefined') return
  const owner = getOwner()
  if (owner == null || owner === 'guest') {
    const local = getAlbumEntries()
    if (local.length > 0) {
      try {
        await fetch('/api/album/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: local }),
        })
      } catch { /* reintentará en la próxima sesión */ }
    }
  }
  try {
    const res = await fetch('/api/album', { headers: { Accept: 'application/json' } })
    if (!res.ok) return
    const json = (await res.json()) as { entries?: AlbumEntry[] }
    const entries: Record<string, AlbumEntry> = {}
    for (const e of json.entries ?? []) entries[e.playerId] = e
    saveAlbum({ version: SCHEMA_VERSION, entries })
    setOwner(userId)
    try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT)) } catch { /* ignore */ }
  } catch { /* mantenemos la cache local */ }
}

/** Al cerrar sesión: vacía la cache local y marca dueño = invitado. */
export function clearAlbumOnLogout(): void {
  if (typeof window === 'undefined') return
  saveAlbum(emptyState())
  setOwner('guest')
  try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT)) } catch { /* ignore */ }
}
