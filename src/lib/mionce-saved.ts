// Onces guardados por el usuario. Cliente puro (localStorage). Cada entrada
// es un snapshot de la formación + slotId→playerId, sin atadura al reto
// semanal. Sirven para coleccionar y compartir tus mejores XI.

'use client'

import type { FormationId } from './mionce-challenges'

const STORAGE_KEY = 'ts_mionce_saved'
const SCHEMA_VERSION = 1
const CHANGED_EVENT = 'ts:mionce-saved-changed'
const MAX_ENTRIES = 12

export interface SavedLineup {
  id: string
  name: string
  formation: FormationId
  slots: Record<string, string>     // slotId → playerId
  createdAt: string                 // ISO datetime
  challengeId?: string              // id del reto cuando se guardó (informativo)
  challengeTitle?: string
}

interface SavedState {
  version: number
  entries: SavedLineup[]
}

function emptyState(): SavedState {
  return { version: SCHEMA_VERSION, entries: [] }
}

function safeId(): string {
  // No necesitamos UUID — basta con ts + random corto
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function loadSavedLineups(): SavedLineup[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedState
    if (!parsed || parsed.version !== SCHEMA_VERSION) return []
    return Array.isArray(parsed.entries) ? parsed.entries : []
  } catch {
    return []
  }
}

function persist(entries: SavedLineup[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, entries }))
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT))
  } catch { /* ignore */ }
}

/** Añade una entrada nueva al final, recortando si pasamos del tope. */
export function saveLineup(input: Omit<SavedLineup, 'id' | 'createdAt'>): SavedLineup {
  const cur = loadSavedLineups()
  const entry: SavedLineup = {
    id: safeId(),
    createdAt: new Date().toISOString(),
    ...input,
    name: input.name.trim().slice(0, 40) || 'Mi once',
  }
  const next = [entry, ...cur].slice(0, MAX_ENTRIES)
  persist(next)
  return entry
}

export function deleteLineup(id: string): void {
  const next = loadSavedLineups().filter(e => e.id !== id)
  persist(next)
}

export function renameLineup(id: string, name: string): void {
  const next = loadSavedLineups().map(e =>
    e.id === id ? { ...e, name: name.trim().slice(0, 40) || e.name } : e
  )
  persist(next)
}

export function onSavedLineupsChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CHANGED_EVENT, handler)
  return () => window.removeEventListener(CHANGED_EVENT, handler)
}

export const SAVED_LINEUP_LIMIT = MAX_ENTRIES
