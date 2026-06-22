// Onces guardados por el usuario. Cliente puro (localStorage). Cada entrada
// es un snapshot de la formación + slotId→playerId, sin atadura al reto
// semanal. Sirven para coleccionar y compartir tus mejores XI.

'use client'

import type { FormationId } from './mionce-challenges'
import { createClient } from '@/lib/supabase'

const STORAGE_KEY = 'ts_mionce_saved'
const SCHEMA_VERSION = 1
const CHANGED_EVENT = 'ts:mionce-saved-changed'
const MAX_ENTRIES = 12
// De quién es la cache local: id de usuario | 'guest' (mismo patrón que album).
const OWNER_KEY = 'ts_mionce_owner'

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
  pushSaveToServer(entry)
  return entry
}

export function deleteLineup(id: string): void {
  const next = loadSavedLineups().filter(e => e.id !== id)
  persist(next)
  pushDeleteToServer(id)
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

// ── Sincronización con el servidor (sincroniza web↔app) ──────────────────────
// Igual que el álbum: la UI lee la cache local; con sesión, guardar/borrar
// suben en 2º plano (con el MISMO id, que es de cliente) y el login fusiona el
// local + baja el servidor a la cache.

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

function lineupBody(l: SavedLineup) {
  return {
    id: l.id,
    name: l.name,
    formation: l.formation,
    slots: l.slots,
    createdAt: l.createdAt,
    challengeId: l.challengeId,
    challengeTitle: l.challengeTitle,
  }
}

/** Guarda un once en el servidor si hay sesión (fire-and-forget). */
function pushSaveToServer(entry: SavedLineup): void {
  if (typeof window === 'undefined') return
  void (async () => {
    if (!(await isAuthed())) return
    try {
      await fetch('/api/mionce/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lineupBody(entry)),
      })
    } catch { /* la cache local ya lo tiene */ }
  })()
}

/** Borra un once del servidor si hay sesión (fire-and-forget). */
function pushDeleteToServer(id: string): void {
  if (typeof window === 'undefined') return
  void (async () => {
    if (!(await isAuthed())) return
    try {
      await fetch(`/api/mionce/saved?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    } catch { /* reintentará al re-sincronizar */ }
  })()
}

/**
 * Al iniciar sesión: si la cache era de invitado, sube los onces locales al
 * servidor (mismo id ⇒ idempotente); después baja el servidor a la cache.
 */
export async function syncSavedOnAuth(userId: string): Promise<void> {
  if (typeof window === 'undefined') return
  const owner = getOwner()
  if (owner == null || owner === 'guest') {
    const local = loadSavedLineups()
    for (const l of local) {
      try {
        await fetch('/api/mionce/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lineupBody(l)),
        })
      } catch { /* reintentará en la próxima sesión */ }
    }
  }
  try {
    const res = await fetch('/api/mionce/saved', { headers: { Accept: 'application/json' } })
    if (!res.ok) return
    const json = (await res.json()) as { lineups?: SavedLineup[] }
    persist((json.lineups ?? []).slice(0, MAX_ENTRIES))
    setOwner(userId)
  } catch { /* mantenemos la cache local */ }
}

/** Al cerrar sesión: vacía la cache local y marca dueño = invitado. */
export function clearSavedOnLogout(): void {
  if (typeof window === 'undefined') return
  persist([])
  setOwner('guest')
}
