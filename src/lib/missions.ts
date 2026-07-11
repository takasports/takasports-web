// Misiones diarias y semanales — segunda capa de la "Liga Taka". Cada misión
// es una instancia de una plantilla del catálogo (missions-catalog), seleccionada
// deterministamente por seed día/semana.
//
// F4·T5: el progreso/estado vive en localStorage (UX instantánea), pero los
// PUNTOS los concede el SERVIDOR. Al terminar una partida el juego llama a
// reportPlay(); si una misión se completa, reportPlay la DEVUELVE y el juego
// llama a claimMissions() —tras persistir la partida— para acreditar los puntos
// reales vía /api/games/missions/claim (que reverifica contra game_plays).

'use client'

import type { GameId } from './games-store'
import { madridDayISO, madridWeekISO } from './taka-time'
import {
  TEMPLATES,
  activeDailyIds,
  activeWeeklyIds,
  targetOf,
  type MissionPeriod,
  type MissionTemplate,
} from './missions-catalog'

export type { MissionTemplate }

const STORAGE_KEY = 'ts_missions'
// v4 (F4·T5): recompensas en PUNTOS reales + acreditación en el servidor (claim).
// El bump regenera misiones limpias en todos los clientes.
const SCHEMA_VERSION = 4
const CHANGED_EVENT = 'ts:missions-changed'

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

// ── Helpers internos ─────────────────────────────────────────────

function todayKey(): string { return madridDayISO() }
function weekKey(): string { return madridWeekISO() }

function genInstances(dailyK: string, weeklyK: string): MissionInstance[] {
  const daily  = activeDailyIds(dailyK)
  const weekly = activeWeeklyIds(weeklyK)
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

export interface CompletedMission {
  missionId: string
  period: string
}

/**
 * Cada juego llama a esto al terminar una partida puntuable. Actualiza el
 * progreso local (UX instantánea) y DEVUELVE las misiones recién completadas
 * para que el juego las reclame con claimMissions() tras persistir la partida.
 */
export function reportPlay(gameId: GameId, p: PlayReport): CompletedMission[] {
  if (typeof window === 'undefined') return []
  const s = loadMissions()
  let changed = false
  const completed: CompletedMission[] = []

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
        completed.push({ missionId: inst.templateId, period: inst.key })
      }
    }
  }

  if (changed) {
    saveMissions(s)
    try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT)) } catch { /* ignore */ }
  }
  return completed
}

/**
 * Reclama al servidor los PUNTOS reales de las misiones completadas. Best-effort
 * (nunca rompe el flujo del juego). Se llama DESPUÉS de que recordPlay haya
 * persistido la partida, para que el servidor reverifique contra game_plays.
 * La idempotencia y el tope diario los aplica la RPC award_mission_points.
 */
export async function claimMissions(completed: CompletedMission[]): Promise<void> {
  if (typeof window === 'undefined' || completed.length === 0) return
  await Promise.allSettled(
    completed.map(c =>
      fetch('/api/games/missions/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission_id: c.missionId, period: c.period }),
        credentials: 'include',
      }),
    ),
  )
}

export function onMissionsChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CHANGED_EVENT, handler)
  return () => window.removeEventListener(CHANGED_EVENT, handler)
}
