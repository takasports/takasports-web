// Misiones diarias y semanales — segunda capa de la "Liga Taka". Cada misión
// es una instancia de una plantilla del pool, seleccionada deterministamente
// por seed día/semana. Los juegos llaman a reportPlay() al terminar y, si la
// misión se completa, se entrega su recompensa de XP vía addXp().

'use client'

import type { GameId } from './games-store'
import { addXp } from './meta-progression'

const STORAGE_KEY = 'ts_missions'
// v3 (Fase 3·parte 2): d-hawkeye vuelve al pool con meta `solved-exact`
// (payload.solved===9), ahora que los 50 grids de TakaGrid son resolubles.
// v2 (Fase 2): d-hawkeye fuera + w-once "completar" en vez de "11/11 perfecto".
// El bump fuerza a todos los clientes a regenerar misiones corregidas.
const SCHEMA_VERSION = 3
const CHANGED_EVENT = 'ts:missions-changed'

export type MissionPeriod = 'daily' | 'weekly'

export type MissionGoal =
  | { kind: 'play-any'; target: number }
  | { kind: 'play-game'; gameId: GameId; target: number }
  | { kind: 'play-all-four' }
  | { kind: 'score-at-least'; gameId: GameId; min: number }
  | { kind: 'solved-exact'; gameId: GameId; solved: number }

export interface MissionTemplate {
  id: string
  title: string
  description: string
  emoji: string
  goal: MissionGoal
  rewardXp: number
  period: MissionPeriod
}

export interface MissionInstance {
  templateId: string
  period: MissionPeriod
  key: string         // dailyKey (YYYY-MM-DD) o weeklyKey (YYYY-Www)
  progress: number    // 0..target
  target: number
  done: boolean
  claimedAt?: string  // ISO
  visited?: GameId[]  // sólo para play-all-four
}

interface MissionsState {
  version: number
  dailyKey: string
  weeklyKey: string
  instances: MissionInstance[]
}

// ── Plantillas ───────────────────────────────────────────────────

export const TEMPLATES: Record<string, MissionTemplate> = {
  'd-quad': {
    id: 'd-quad', title: 'Cuatro en raya', description: 'Termina una partida de los 4 juegos hoy',
    emoji: '🎯', goal: { kind: 'play-all-four' }, rewardXp: 100, period: 'daily',
  },
  'd-trivia7': {
    id: 'd-trivia7', title: 'Trivia rápida', description: 'Saca ≥70 pts en CrackQuiz',
    emoji: '⚡', goal: { kind: 'score-at-least', gameId: 'crackquiz', min: 70 }, rewardXp: 50, period: 'daily',
  },
  'd-warmup': {
    id: 'd-warmup', title: 'Calienta motores', description: 'Termina 2 partidas hoy (cualquier juego)',
    emoji: '🔥', goal: { kind: 'play-any', target: 2 }, rewardXp: 30, period: 'daily',
  },
  // Reactivada en Fase 3·parte 2: los 50 grids son resolubles (test de solvencia)
  // y la meta es `solved-exact` (payload.solved===9), independiente del modo hard
  // (antes min:90 se cumplía con 5/9 en hard porque score = solved×20).
  'd-hawkeye': {
    id: 'd-hawkeye', title: 'Ojo de halcón', description: 'Resuelve TakaGrid 9/9',
    emoji: '🦅', goal: { kind: 'solved-exact', gameId: 'takagrid', solved: 9 }, rewardXp: 60, period: 'daily',
  },
  'd-combo': {
    id: 'd-combo', title: 'Combo de fuego', description: 'Saca ≥100 pts en CrackQuiz',
    emoji: '💥', goal: { kind: 'score-at-least', gameId: 'crackquiz', min: 100 }, rewardXp: 80, period: 'daily',
  },
  'd-double-quiz': {
    id: 'd-double-quiz', title: 'Doble jugada', description: 'Termina 2 partidas de CrackQuiz (la práctica cuenta)',
    emoji: '🎲', goal: { kind: 'play-game', gameId: 'crackquiz', target: 2 }, rewardXp: 40, period: 'daily',
  },
  'w-once': {
    id: 'w-once', title: 'Once de la semana', description: 'Completa tu Once de la semana (los 11 jugadores)',
    emoji: '🏆', goal: { kind: 'play-game', gameId: 'mionce', target: 1 }, rewardXp: 120, period: 'weekly',
  },
  'w-sopa': {
    id: 'w-sopa', title: 'Sopa limpia', description: 'Resuelve la Sopa semanal completa',
    emoji: '🥣', goal: { kind: 'score-at-least', gameId: 'sopacracks', min: 80 }, rewardXp: 100, period: 'weekly',
  },
}

const DAILY_POOL: string[]  = ['d-quad', 'd-trivia7', 'd-warmup', 'd-combo', 'd-double-quiz', 'd-hawkeye']
const WEEKLY_POOL: string[] = ['w-once', 'w-sopa']
const DAILY_COUNT = 2
const WEEKLY_COUNT = 1

// ── Helpers internos ─────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

// ISO week key (YYYY-Www) — implementación local para evitar import circular
function weekKey(): string {
  const d = new Date()
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNr = (tmp.getUTCDay() + 6) % 7
  tmp.setUTCDate(tmp.getUTCDate() - dayNr + 3)
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4))
  const diff = (tmp.getTime() - firstThursday.getTime()) / 86400000
  const week = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function seedFromKey(k: string): number {
  let h = 2166136261
  for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function targetOf(g: MissionGoal): number {
  switch (g.kind) {
    case 'play-any':       return g.target
    case 'play-game':      return g.target
    case 'play-all-four':  return 4
    case 'score-at-least': return 1
    case 'solved-exact':   return 1
  }
}

function pickIds(seed: number, pool: string[], n: number): string[] {
  const rand = mulberry32(seed)
  const arr = pool.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, n)
}

function genInstances(dailyK: string, weeklyK: string): MissionInstance[] {
  const daily  = pickIds(seedFromKey('d-' + dailyK),  DAILY_POOL,  DAILY_COUNT)
  const weekly = pickIds(seedFromKey('w-' + weeklyK), WEEKLY_POOL, WEEKLY_COUNT)
  const make = (tid: string, k: string): MissionInstance => ({
    templateId: tid,
    period: TEMPLATES[tid].period,
    key: k,
    progress: 0,
    target: targetOf(TEMPLATES[tid].goal),
    done: false,
  })
  return [...daily.map(t => make(t, dailyK)), ...weekly.map(t => make(t, weeklyK))]
}

function emptyState(): MissionsState {
  const dK = todayKey()
  const wK = weekKey()
  return { version: SCHEMA_VERSION, dailyKey: dK, weeklyKey: wK, instances: genInstances(dK, wK) }
}

function rotate(prev: MissionsState, newDaily: string, newWeekly: string): MissionsState {
  const keepWeekly = prev.weeklyKey === newWeekly
  const oldWeekly  = keepWeekly ? prev.instances.filter(i => i.period === 'weekly') : []
  const fresh      = genInstances(newDaily, newWeekly)
  if (keepWeekly) {
    const freshDaily = fresh.filter(i => i.period === 'daily')
    return { version: SCHEMA_VERSION, dailyKey: newDaily, weeklyKey: newWeekly, instances: [...freshDaily, ...oldWeekly] }
  }
  return { version: SCHEMA_VERSION, dailyKey: newDaily, weeklyKey: newWeekly, instances: fresh }
}

// ── API pública ──────────────────────────────────────────────────

export function loadMissions(): MissionsState {
  if (typeof window === 'undefined') return emptyState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const s = emptyState()
      saveMissions(s)
      return s
    }
    const parsed = JSON.parse(raw) as MissionsState
    if (!parsed || parsed.version !== SCHEMA_VERSION) {
      const s = emptyState()
      saveMissions(s)
      return s
    }
    const d = todayKey(), w = weekKey()
    if (parsed.dailyKey !== d || parsed.weeklyKey !== w) {
      const rotated = rotate(parsed, d, w)
      saveMissions(rotated)
      return rotated
    }
    return parsed
  } catch {
    return emptyState()
  }
}

export function saveMissions(s: MissionsState): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

export function getActiveMissions(): Array<{ mission: MissionInstance; template: MissionTemplate }> {
  const s = loadMissions()
  return s.instances
    .map(i => ({ mission: i, template: TEMPLATES[i.templateId] }))
    .filter(x => !!x.template)
}

export interface PlayReport {
  /** Score normalizado de la partida (ej. CrackQuiz 0–~200, TakaGrid solved*10). */
  score: number
  /** Celdas resueltas (TakaGrid): nº de aciertos 0..9, para metas exactas. */
  solved?: number
}

/**
 * Cada juego llama a esto después de terminar una partida puntuable
 * (justo después de su addXp). Actualiza progreso de las misiones activas y
 * entrega la recompensa via addXp(gameId, rewardXp) al completarse.
 */
export function reportPlay(gameId: GameId, p: PlayReport): void {
  if (typeof window === 'undefined') return
  const s = loadMissions()
  let changed = false
  const completedRewards: Array<{ gameId: GameId; reward: number }> = []

  for (const inst of s.instances) {
    if (inst.done) continue
    const t = TEMPLATES[inst.templateId]
    if (!t) continue
    const g = t.goal
    let advanced = false
    switch (g.kind) {
      case 'play-any':
        inst.progress = Math.min(inst.target, inst.progress + 1)
        advanced = true
        break
      case 'play-game':
        if (g.gameId === gameId) {
          inst.progress = Math.min(inst.target, inst.progress + 1)
          advanced = true
        }
        break
      case 'play-all-four': {
        const visited = new Set(inst.visited ?? [])
        if (!visited.has(gameId)) {
          visited.add(gameId)
          inst.visited = Array.from(visited)
          inst.progress = visited.size
          advanced = true
        }
        break
      }
      case 'score-at-least':
        if (g.gameId === gameId && p.score >= g.min) {
          inst.progress = 1
          advanced = true
        }
        break
      case 'solved-exact':
        if (g.gameId === gameId && p.solved === g.solved) {
          inst.progress = 1
          advanced = true
        }
        break
    }
    if (advanced) {
      changed = true
      if (!inst.done && inst.progress >= inst.target) {
        inst.done = true
        inst.claimedAt = new Date().toISOString()
        completedRewards.push({ gameId, reward: t.rewardXp })
      }
    }
  }

  if (changed) {
    saveMissions(s)
    try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT)) } catch { /* ignore */ }
    // Entregamos el XP tras persistir, para que un eventual handler que lea
    // misiones desde el event ts:meta-changed las vea ya marcadas como done.
    for (const r of completedRewards) addXp(r.gameId, r.reward)
  }
}

export function onMissionsChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CHANGED_EVENT, handler)
  return () => window.removeEventListener(CHANGED_EVENT, handler)
}
