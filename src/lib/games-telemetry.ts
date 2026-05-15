// Cliente ligero de telemetría: encola eventos y los manda en batch
// cada 10s o en beforeunload. No bloquea nada — los eventos son
// best-effort.
//
// Uso:
//   trackGameEvent({ gameId: 'crackquiz', event: 'started', period })
//   trackGameEvent({ gameId: 'crackquiz', event: 'completed', period, meta: { score: 90 } })
//
// El anon_id se mantiene en localStorage para distinguir usuarios sin
// sesión (no PII, solo un uuid).

import type { GameId } from './games-store'

type EventType = 'started' | 'completed' | 'abandoned' | 'shared' | 'leaderboard_view'

interface TrackInput {
  gameId: GameId
  event:  EventType
  period?: string
  meta?:   Record<string, unknown>
}

interface QueuedEvent {
  game_id:    GameId
  event_type: EventType
  period?:    string
  meta?:      Record<string, unknown>
  anon_id?:   string
}

const ANON_KEY  = 'ts_games:anon_id'
const QUEUE_KEY = 'ts_games:events_queue'
const FLUSH_MS  = 10_000
const MAX_BATCH = 50

let queue:    QueuedEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let initialized = false

function getAnonId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    let id = localStorage.getItem(ANON_KEY)
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
      localStorage.setItem(ANON_KEY, id)
    }
    return id
  } catch { return undefined }
}

function loadPersistedQueue(): QueuedEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as QueuedEvent[]) : []
  } catch { return [] }
}

function persistQueue(): void {
  if (typeof window === 'undefined') return
  try {
    if (queue.length === 0) localStorage.removeItem(QUEUE_KEY)
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch { /* ignore */ }
}

async function flush(): Promise<void> {
  if (queue.length === 0) return
  const batch = queue.splice(0, MAX_BATCH)
  persistQueue()
  try {
    const res = await fetch('/api/games/events', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({ events: batch }),
      // No bloquear unload pages:
      keepalive: true,
    } as RequestInit)
    if (!res.ok) {
      // Re-encolar al frente para reintentar; mejor perder algo que
      // duplicar masivamente.
      queue.unshift(...batch.slice(0, MAX_BATCH))
      persistQueue()
    }
  } catch {
    queue.unshift(...batch.slice(0, MAX_BATCH))
    persistQueue()
  }
}

function scheduleFlush(): void {
  if (flushTimer || typeof window === 'undefined') return
  flushTimer = setTimeout(async () => {
    flushTimer = null
    await flush()
    if (queue.length > 0) scheduleFlush()
  }, FLUSH_MS)
}

function initOnce(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  // Recuperar cola persistida (eventos de sesiones previas).
  const persisted = loadPersistedQueue()
  if (persisted.length > 0) queue = persisted.concat(queue)
  // Flush al cerrar pestaña.
  window.addEventListener('beforeunload', () => { void flush() })
  // Flush al recuperar visibilidad (best-effort, no bloquea).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && queue.length > 0) void flush()
  })
}

/**
 * Registra un evento de telemetría. No bloquea, no falla. En SSR es
 * no-op silencioso.
 */
export function trackGameEvent({ gameId, event, period, meta }: TrackInput): void {
  if (typeof window === 'undefined') return
  initOnce()
  queue.push({
    game_id:    gameId,
    event_type: event,
    period,
    meta,
    anon_id:    getAnonId(),
  })
  persistQueue()
  scheduleFlush()
}

/** Fuerza el flush ya (útil para tests o cierres manuales). */
export async function flushTelemetry(): Promise<void> {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
  await flush()
}
