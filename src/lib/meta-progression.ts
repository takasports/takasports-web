// Meta-progresión de la "Liga Taka": una capa única que vive por encima de
// los 4 juegos. Centraliza la racha diaria (cuenta si juegas CUALQUIERA),
// el XP global y el nivel. Cada juego llama a addXp() al completar.
//
// Storage: localStorage. Sin sincronización a backend por ahora — se puede
// añadir más adelante con una tabla user_meta sin romper la API pública.

'use client'

import type { GameId } from './games-store'
import { madridDayISO } from './taka-time'

const STORAGE_KEY = 'ts_meta_progression'
const SCHEMA_VERSION = 1
const HISTORY_LIMIT = 60
const META_CHANGED_EVENT = 'ts:meta-changed'

export interface MetaState {
  version: number
  streak: { current: number; best: number; lastPlayedDate: string }
  xp: { total: number; byGame: Partial<Record<GameId, number>> }
  history: Array<{ date: string; gameId: GameId; xpDelta: number }>
}

const EMPTY_STATE: MetaState = {
  version: SCHEMA_VERSION,
  streak: { current: 0, best: 0, lastPlayedDate: '' },
  xp: { total: 0, byGame: {} },
  history: [],
}

// ── Helpers privados ─────────────────────────────────────────────

function dayDiff(fromKey: string, toKey: string): number {
  const a = new Date(fromKey.slice(0, 10) + 'T12:00:00Z').getTime()
  const b = new Date(toKey.slice(0, 10) + 'T12:00:00Z').getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY
  return Math.round((b - a) / 86400000)
}

function todayKey(): string {
  return madridDayISO()
}

// ── API pública ──────────────────────────────────────────────────

export function loadMeta(): MetaState {
  if (typeof window === 'undefined') return cloneEmpty()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return cloneEmpty()
    const parsed = JSON.parse(raw) as MetaState
    if (!parsed || parsed.version !== SCHEMA_VERSION) return cloneEmpty()
    // Saneamiento defensivo en caso de payloads viejos
    return {
      version: parsed.version,
      streak: parsed.streak ?? cloneEmpty().streak,
      xp: parsed.xp ?? cloneEmpty().xp,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    }
  } catch {
    return cloneEmpty()
  }
}

export function saveMeta(s: MetaState): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

/**
 * Añade XP por terminar una partida de `gameId` y, de paso, registra la
 * actividad del día para la racha meta. La racha avanza si juegas hoy
 * después de jugar ayer; sobrevive 1 día perdido (grace) y se resetea
 * cuando faltan 2 días o más.
 *
 * No es idempotente respecto al XP: cada llamada suma. Cada juego controla
 * llamarlo una sola vez por partida (en su efecto de "completado").
 */
export function addXp(gameId: GameId, amount: number): MetaState {
  if (typeof window === 'undefined') return cloneEmpty()
  if (!Number.isFinite(amount) || amount <= 0) return loadMeta()

  const cur = loadMeta()
  const today = todayKey()

  let streakCurrent: number
  if (!cur.streak.lastPlayedDate) {
    streakCurrent = 1
  } else {
    const gap = dayDiff(cur.streak.lastPlayedDate, today)
    if (gap <= 0) streakCurrent = Math.max(cur.streak.current, 1)
    else if (gap === 1) streakCurrent = cur.streak.current + 1
    else if (gap === 2) streakCurrent = Math.max(cur.streak.current, 1)
    else streakCurrent = 1
  }

  const next: MetaState = {
    version: SCHEMA_VERSION,
    streak: {
      current: streakCurrent,
      best: Math.max(cur.streak.best, streakCurrent),
      lastPlayedDate: today,
    },
    xp: {
      total: cur.xp.total + amount,
      byGame: { ...cur.xp.byGame, [gameId]: (cur.xp.byGame[gameId] ?? 0) + amount },
    },
    history: [{ date: today, gameId, xpDelta: amount }, ...cur.history.slice(0, HISTORY_LIMIT - 1)],
  }
  saveMeta(next)
  try { window.dispatchEvent(new CustomEvent(META_CHANGED_EVENT)) } catch { /* ignore */ }
  return next
}

export interface LevelInfo {
  level: number
  xpTotal: number
  xpIntoLevel: number
  xpForNext: number
  progressPct: number  // 0–100
}

/**
 * Curva de nivel: subir del nivel L al L+1 cuesta L*100 XP. Total
 * acumulado para alcanzar el nivel L = 50·L·(L-1).
 *
 * Hitos: L1=0, L2=100, L3=300, L5=1.000, L10=4.500, L20=19.000.
 */
export function getLevel(xpTotal: number): LevelInfo {
  let level = 1
  let acc = 0
  while (acc + level * 100 <= xpTotal) {
    acc += level * 100
    level += 1
  }
  const xpIntoLevel = xpTotal - acc
  const xpForNext = level * 100
  return {
    level,
    xpTotal,
    xpIntoLevel,
    xpForNext,
    progressPct: xpForNext === 0 ? 0 : Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100)),
  }
}

// ── XP por juego ─────────────────────────────────────────────────
// Toda la balance vive aquí — ajustar en un solo sitio si hace falta.
// Mínimo de participación: 30 XP. Máximo por partida: ~80–85 XP.

const BASE_PER_PLAY = 30

export function xpForCrackquiz(correct: number): number {
  return BASE_PER_PLAY + Math.min(50, Math.max(0, correct) * 5)
}
export function xpForTakagrid(solved: number): number {
  return BASE_PER_PLAY + Math.min(45, Math.max(0, solved) * 5)
}
export function xpForSopacracks(found: number): number {
  return BASE_PER_PLAY + Math.min(50, Math.max(0, found) * 5)
}
export function xpForMionce(valid: number): number {
  return BASE_PER_PLAY + Math.min(55, Math.max(0, valid) * 5)
}

// ── Subscripción (para componentes UI) ───────────────────────────

export function onMetaChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(META_CHANGED_EVENT, handler)
  return () => window.removeEventListener(META_CHANGED_EVENT, handler)
}

// ── Privado ──────────────────────────────────────────────────────

function cloneEmpty(): MetaState {
  return {
    version: EMPTY_STATE.version,
    streak: { ...EMPTY_STATE.streak },
    xp: { total: 0, byGame: {} },
    history: [],
  }
}
