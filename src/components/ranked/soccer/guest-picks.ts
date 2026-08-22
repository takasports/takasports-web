// ─────────────────────────────────────────────────────────────────────────────
// Pronósticos de INVITADO — jugar antes de tener cuenta.
//
// El primer toque en 1·X·2 iba al servidor, recibía un 401 y disparaba Google
// OAuth en el acto: había que crearse una cuenta ANTES de haber probado nada.
// Con toda la sección apoyada en ese primer toque, era el sitio exacto donde se
// caía el embudo. El pick se guardaba en `porra:pendingPick` para no perderlo,
// pero eso arregla el olvido, no la decisión: al usuario se le seguía pidiendo
// registrarse a cambio de nada.
//
// Ahora se pronostica en local y la cuenta se pide cuando compra algo: guardar
// la Jornada, competir en la Liga Taka, que te avisen antes del cierre. Al
// entrar, los picks de invitado se suben solos.
//
// Es deliberadamente el MISMO shape que `PredictionRow.prediction`, para que la
// UI no tenga que saber de dónde viene un pick: las tarjetas, el contador de la
// Jornada y el bloque de marcador exacto funcionan igual con sesión y sin ella.
// ─────────────────────────────────────────────────────────────────────────────

import type { PredMap, SoccerPick } from './types'

const KEY = 'taka:guestPicks:v1'

export interface GuestPick {
  pick: SoccerPick
  exactScore?: { home: number; away: number }
}

type GuestStore = Record<string, GuestPick>

function read(): GuestStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as GuestStore
  } catch {
    // JSON corrupto o storage bloqueado (Safari privado): se juega sin memoria
    // en vez de romper la pantalla.
    return {}
  }
}

function write(store: GuestStore): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(store)) } catch { /* sin espacio */ }
}

/** Todos los picks de invitado guardados. */
export function readGuestPicks(): GuestStore {
  return read()
}

/** Guarda (o reemplaza) el pick de un partido. */
export function saveGuestPick(
  eventId: string,
  pick: SoccerPick,
  exactScore: { home: number; away: number } | null,
): void {
  const store = read()
  store[eventId] = exactScore ? { pick, exactScore } : { pick }
  write(store)
}

export function clearGuestPicks(): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(KEY) } catch { /* */ }
}

/**
 * Tira los picks de partidos que ya no están en la Jornada visible. Sin esto,
 * el almacén crece temporada tras temporada con partidos de hace meses y el
 * contador de "picks sin guardar" cuenta cosas que ya no existen.
 */
export function pruneGuestPicks(validEventIds: ReadonlySet<string>): GuestStore {
  const store = read()
  let changed = false
  for (const id of Object.keys(store)) {
    if (!validEventIds.has(id)) { delete store[id]; changed = true }
  }
  if (changed) write(store)
  return store
}

/**
 * Los pinta la misma UI que los del servidor, así que se les da la forma de
 * `PredMap`. `points_awarded`/`is_correct` van a null: un invitado no tiene
 * puntos — precisamente por eso le interesa entrar.
 */
export function toPredMap(store: GuestStore): PredMap {
  const out: PredMap = {}
  for (const [eventId, g] of Object.entries(store)) {
    out[eventId] = {
      event_id: eventId,
      prediction: g.exactScore ? { pick: g.pick, exactScore: g.exactScore } : { pick: g.pick },
      points_awarded: null,
      is_correct: null,
    }
  }
  return out
}
