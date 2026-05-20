// Álbum de cromos: persiste qué jugadores ha colocado correctamente el
// usuario en TakaGrid o Mi Once. Cliente puro (localStorage); no se sincroniza
// a backend por ahora. Si en el futuro tenemos cuenta de usuario, basta con
// añadir un loader/saver server-side detrás de esta misma API.

'use client'

import type { GameId } from './games-store'

const STORAGE_KEY = 'ts_album'
const SCHEMA_VERSION = 1
const CHANGED_EVENT = 'ts:album-changed'

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
