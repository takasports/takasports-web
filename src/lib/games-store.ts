// Cliente unificado de scoring/persistencia para los juegos de /juegos.
//
// Responsabilidades:
//   1. recordPlay()  - dual-write: localStorage primero (resistente offline),
//                      luego POST /api/games/plays. Si falla, encola para retry.
//   2. getMyPlay()   - lee local; si hay sesión, sync con server y reconcilia
//                      (gana el score mayor — mismo criterio que la RPC).
//   3. getStreak()   - lee racha global server-side (o local fallback).
//   4. Helpers de periodo: currentWeekISO(), currentDayISO().
//
// Esta lib es ADITIVA: ningún juego está obligado a usarla. Los juegos
// existentes (Quiniela, CrackQuiz, Mi Once, Sopa, TakaGrid) siguen
// funcionando con sus propias claves de localStorage. La migración a
// games-store la hace cada juego en su propio PR.
//
// Sin dependencias externas. Compatible SSR (todos los accesos a
// localStorage / window van guardados detrás de `typeof window !==
// 'undefined'`).

import { madridDayISO, madridWeekISO } from './taka-time'

export const GAME_IDS = ['quiniela', 'crackquiz', 'mionce', 'sopacracks', 'takagrid', 'strikerrush'] as const
export type GameId = typeof GAME_IDS[number]

export interface GamePlay {
  game_id:     GameId
  period:      string
  score:       number
  payload:     Record<string, unknown>
  duration_ms: number | null
  created_at?: string
  updated_at?: string
}

export interface RecordPlayInput {
  gameId:      GameId
  period:      string
  score:       number
  payload?:    Record<string, unknown>
  durationMs?: number
}

export interface RecordPlayResult {
  /** Guardado en localStorage siempre que sea posible. */
  local:     boolean
  /** Guardado en Supabase. False si no hay sesión, offline o falló. */
  persisted: boolean
  /** Si persisted=false por fallo de red, está en la cola de retry. */
  queued:    boolean
  /** El score efectivo tras reconciliar con lo previo (max). */
  score:     number
  /** Monedas acreditadas al Ranked por esta partida (0 si juego sin
   *  coins, ya acreditado para este período, o cap diario alcanzado). */
  awarded:   number
}

export interface Streak {
  current_streak:   number
  best_streak:      number
  last_played_date: string | null
  total_plays:      number
}

// ── Claves de almacenamiento ─────────────────────────────────────
const LOCAL_PLAY_PREFIX = 'ts_games:play:'     // ts_games:play:<game>:<period>
const QUEUE_KEY         = 'ts_games:queue'     // array de RecordPlayInput pendientes
const STREAK_KEY        = 'ts_games:streak'    // último Streak conocido (cache)

function playKey(gameId: GameId, period: string): string {
  return `${LOCAL_PLAY_PREFIX}${gameId}:${period}`
}

// ── Helpers de periodo ───────────────────────────────────────────

/** "2026-W20" — semana ISO en hora Taka (Europe/Madrid). */
export function currentWeekISO(d: Date = new Date()): string {
  return madridWeekISO(d)
}

/** "2026-05-15" — día en hora Taka (Europe/Madrid). */
export function currentDayISO(d: Date = new Date()): string {
  return madridDayISO(d)
}

// ── Safe storage wrappers ────────────────────────────────────────

function lsGet<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : null
  } catch { return null }
}

function lsSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota / private mode */ }
}

function lsRemove(key: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

// ── Cola de retry (offline) ──────────────────────────────────────

function queueGet(): RecordPlayInput[] {
  return lsGet<RecordPlayInput[]>(QUEUE_KEY) ?? []
}

function queuePush(item: RecordPlayInput): void {
  const q = queueGet()
  // Dedup por (gameId, period): el último gana.
  const filtered = q.filter(it => !(it.gameId === item.gameId && it.period === item.period))
  filtered.push(item)
  lsSet(QUEUE_KEY, filtered)
}

function queueDrop(gameId: GameId, period: string): void {
  const q = queueGet().filter(it => !(it.gameId === gameId && it.period === period))
  if (q.length === 0) lsRemove(QUEUE_KEY)
  else lsSet(QUEUE_KEY, q)
}

/**
 * Reintenta envío de partidas encoladas. Llamar al hidratar la app
 * (e.g. en un useEffect de _app o de Header) cuando recuperes
 * conectividad o al iniciar sesión.
 */
export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  if (typeof window === 'undefined') return { sent: 0, failed: 0 }
  const items = queueGet()
  let sent = 0, failed = 0
  for (const it of items) {
    const ok = await postPlay(it)
    if (ok) { queueDrop(it.gameId, it.period); sent++ } else { failed++ }
  }
  return { sent, failed }
}

// ── Network ──────────────────────────────────────────────────────

async function postPlay(input: RecordPlayInput): Promise<{ persisted: boolean; awarded: number }> {
  try {
    const res = await fetch('/api/games/plays', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({
        game_id:     input.gameId,
        period:      input.period,
        score:       Math.floor(input.score),
        payload:     input.payload ?? {},
        duration_ms: input.durationMs ?? undefined,
      }),
    })
    if (!res.ok) return { persisted: false, awarded: 0 }
    const data = await res.json() as { persisted?: boolean; awarded?: number }
    return { persisted: !!data.persisted, awarded: Number(data.awarded ?? 0) }
  } catch { return { persisted: false, awarded: 0 } }
}

async function pingStreak(): Promise<Streak | null> {
  try {
    const res = await fetch('/api/games/streak', { method: 'POST' })
    if (!res.ok) return null
    const data = await res.json() as { streak: Streak | null }
    if (data.streak) lsSet(STREAK_KEY, data.streak)
    // Streak puede otorgar racha_dias_3/7/30 — notifica al provider.
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('taka:badge-check'))
      }
    } catch { /* noop */ }
    return data.streak
  } catch { return null }
}

// ── API pública ──────────────────────────────────────────────────

/**
 * Registra una partida completada. Dual-write con prioridad local:
 * el localStorage se actualiza SIEMPRE (incluso sin sesión), y luego
 * se intenta sincronizar con el server.
 */
export async function recordPlay(input: RecordPlayInput): Promise<RecordPlayResult> {
  // 1) Reconciliación local: si ya había un score mayor, lo respetamos.
  const prev = lsGet<GamePlay>(playKey(input.gameId, input.period))
  const effectiveScore = prev ? Math.max(prev.score, input.score) : input.score
  const merged: GamePlay = {
    game_id:     input.gameId,
    period:      input.period,
    score:       effectiveScore,
    payload:     input.payload ?? prev?.payload ?? {},
    duration_ms: input.durationMs ?? prev?.duration_ms ?? null,
    updated_at:  new Date().toISOString(),
  }
  lsSet(playKey(input.gameId, input.period), merged)

  // 2) Envío al server. La RPC ya hace MAX(prev, new) server-side, así
  //    que enviar el score recién jugado (no el reconciliado local) es
  //    correcto y nunca regresa puntuaciones.
  const { persisted, awarded } = await postPlay(input)

  // 3) Si falló y hay window, encolar para retry.
  let queued = false
  if (!persisted && typeof window !== 'undefined') {
    queuePush(input)
    queued = true
  }

  // 4) Streak ping (fire-and-forget — no bloqueante).
  if (persisted) { void pingStreak() }

  return { local: typeof window !== 'undefined', persisted, queued, score: effectiveScore, awarded }
}

/**
 * Lee la partida del usuario para (game, period). Lee primero local;
 * si hay sesión activa, hace fetch al server y reconcilia (mayor score
 * gana). El return es siempre el reconciliado.
 */
export async function getMyPlay(gameId: GameId, period: string): Promise<GamePlay | null> {
  const local = lsGet<GamePlay>(playKey(gameId, period))
  try {
    const res = await fetch(`/api/games/plays?game=${encodeURIComponent(gameId)}&period=${encodeURIComponent(period)}`, { cache: 'no-store' })
    if (!res.ok) return local
    const data = await res.json() as { play: GamePlay | null }
    if (!data.play) return local
    if (!local || data.play.score >= local.score) {
      // Cache server-side win en local para hidratación rápida la próxima vez.
      lsSet(playKey(gameId, period), data.play)
      return data.play
    }
    // local > server (no debería pasar tras MAX, pero defensivo): re-envía.
    void postPlay({
      gameId,
      period,
      score:      local.score,
      payload:    local.payload,
      durationMs: local.duration_ms ?? undefined,
    })
    return local
  } catch { return local }
}

/** Lee la racha. Server primero; local como fallback si offline. */
export async function getStreak(): Promise<Streak | null> {
  try {
    const res = await fetch('/api/games/streak', { cache: 'no-store' })
    if (!res.ok) return lsGet<Streak>(STREAK_KEY)
    const data = await res.json() as { streak: Streak | null }
    if (data.streak) lsSet(STREAK_KEY, data.streak)
    return data.streak ?? lsGet<Streak>(STREAK_KEY)
  } catch { return lsGet<Streak>(STREAK_KEY) }
}

export interface LeaderboardBadgeMeta {
  id:     string
  name:   string
  emoji:  string
  color:  string
  bg:     string
  rarity: string
}
export interface LeaderboardEquipmentMeta {
  badge?:   { emoji: string; color: string; bg: string; name: string }
  title?:   { text: string; color: string }
  frame?:   { color: string }
  card_bg?: { gradient: string }
}

export interface LeaderboardEntry {
  /** Identificador público opaco (hash del user_id), NO el UUID de auth.
   *  Sirve como key estable en el cliente; el resaltado "tú" va por posición. */
  pid:          string
  score:        number
  duration_ms:  number | null
  display_name: string | null
  avatar_url:   string | null
  position:     number
  created_at:   string
  /** Hasta 3 badges (los más prestigiosos) — fallback si no hay equipment.badge. */
  badges?:      LeaderboardBadgeMeta[]
  /** Equipamiento activo del user (badge/title/frame/card_bg). */
  equipment?:   LeaderboardEquipmentMeta
}

export async function getLeaderboard(gameId: GameId, period: string, limit = 50): Promise<LeaderboardEntry[]> {
  try {
    const url = `/api/games/leaderboard?game=${encodeURIComponent(gameId)}&period=${encodeURIComponent(period)}&limit=${limit}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json() as { entries: LeaderboardEntry[] }
    return data.entries ?? []
  } catch { return [] }
}

export interface MyPosition {
  play:     { score: number; duration_ms: number | null; created_at: string } | null
  position: number | null
  total:    number
}

export async function getMyPosition(gameId: GameId, period: string): Promise<MyPosition> {
  try {
    const res = await fetch(`/api/games/me?game=${encodeURIComponent(gameId)}&period=${encodeURIComponent(period)}`, { cache: 'no-store' })
    if (!res.ok) return { play: null, position: null, total: 0 }
    return await res.json() as MyPosition
  } catch { return { play: null, position: null, total: 0 } }
}
