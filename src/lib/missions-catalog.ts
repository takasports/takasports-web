// Catálogo de misiones — definición PURA compartida entre el cliente
// (missions.ts, localStorage) y el servidor (/api/games/missions/claim).
// Sin 'use client' ni APIs de navegador: importable desde ambos lados.
//
// F4·T5: las recompensas están en PUNTOS reales (un juego da 1–12, así que
// una misión diaria vale ~5–15 y una semanal ~25). Tope: 40 pts/día de misión.
// El monto lo fija SIEMPRE el servidor desde este catálogo — el cliente solo
// dice QUÉ misión, nunca CUÁNTOS puntos.

import type { GameId } from './games-store'

export type MissionPeriod = 'daily' | 'weekly'

export type MissionGoal =
  | { kind: 'play-any'; target: number }
  | { kind: 'play-game'; gameId: GameId; target: number }
  | { kind: 'play-all-four' }
  | { kind: 'score-at-least'; gameId: GameId; min: number }
  | { kind: 'solved-exact'; gameId: GameId; solved: number }

// Cómo el SERVIDOR verifica el completado contra game_plays (partidas reales,
// acotadas por el techo antifraude de record_game_play):
//   · 'exists' / 'score' / 'takagrid-solved' / 'all-four' → verificables.
//   · 'client' → misiones de conteo (jugar N veces) que game_plays no puede
//     verificar (deduplica por periodo); se confía en el cliente y el tope
//     diario de 40 acota el abuso.
export type MissionVerify =
  | { via: 'client' }
  | { via: 'all-four' }
  | { via: 'exists'; gameId: GameId; periodType: MissionPeriod }
  | { via: 'score'; gameId: GameId; periodType: MissionPeriod; min: number }
  | { via: 'takagrid-solved'; solved: number }

export interface MissionTemplate {
  id: string
  title: string
  description: string
  emoji: string
  goal: MissionGoal
  reward: number          // PUNTOS reales
  period: MissionPeriod
  verify: MissionVerify
}

export const MISSION_DAILY_CAP = 40

export const TEMPLATES: Record<string, MissionTemplate> = {
  'd-quad': {
    id: 'd-quad', title: 'Cuatro en raya', description: 'Termina una partida de los 4 juegos hoy',
    emoji: '🎯', goal: { kind: 'play-all-four' }, reward: 15, period: 'daily',
    verify: { via: 'all-four' },
  },
  'd-trivia7': {
    id: 'd-trivia7', title: 'Trivia rápida', description: 'Saca ≥70 pts en CrackQuiz',
    emoji: '⚡', goal: { kind: 'score-at-least', gameId: 'crackquiz', min: 70 }, reward: 8, period: 'daily',
    verify: { via: 'score', gameId: 'crackquiz', periodType: 'daily', min: 70 },
  },
  'd-warmup': {
    id: 'd-warmup', title: 'Calienta motores', description: 'Termina 2 partidas hoy (cualquier juego)',
    emoji: '🔥', goal: { kind: 'play-any', target: 2 }, reward: 5, period: 'daily',
    verify: { via: 'client' },
  },
  'd-hawkeye': {
    id: 'd-hawkeye', title: 'Ojo de halcón', description: 'Resuelve TakaGrid 9/9',
    emoji: '🦅', goal: { kind: 'solved-exact', gameId: 'takagrid', solved: 9 }, reward: 12, period: 'daily',
    verify: { via: 'takagrid-solved', solved: 9 },
  },
  'd-combo': {
    id: 'd-combo', title: 'Combo de fuego', description: 'Saca ≥100 pts en CrackQuiz',
    emoji: '💥', goal: { kind: 'score-at-least', gameId: 'crackquiz', min: 100 }, reward: 12, period: 'daily',
    verify: { via: 'score', gameId: 'crackquiz', periodType: 'daily', min: 100 },
  },
  'd-double-quiz': {
    id: 'd-double-quiz', title: 'Doble jugada', description: 'Termina 2 partidas de CrackQuiz (sin contar la práctica)',
    emoji: '🎲', goal: { kind: 'play-game', gameId: 'crackquiz', target: 2 }, reward: 6, period: 'daily',
    verify: { via: 'client' },
  },
  'w-once': {
    id: 'w-once', title: 'Once de la semana', description: 'Completa tu Once de la semana (los 11 jugadores)',
    emoji: '🏆', goal: { kind: 'play-game', gameId: 'mionce', target: 1 }, reward: 25, period: 'weekly',
    verify: { via: 'exists', gameId: 'mionce', periodType: 'weekly' },
  },
  'w-sopa': {
    id: 'w-sopa', title: 'Sopa limpia', description: 'Resuelve la Sopa semanal completa',
    emoji: '🥣', goal: { kind: 'score-at-least', gameId: 'sopacracks', min: 80 }, reward: 25, period: 'weekly',
    verify: { via: 'score', gameId: 'sopacracks', periodType: 'weekly', min: 80 },
  },
}

export const DAILY_POOL: string[]  = ['d-quad', 'd-trivia7', 'd-warmup', 'd-combo', 'd-double-quiz', 'd-hawkeye']
export const WEEKLY_POOL: string[] = ['w-once', 'w-sopa']
export const DAILY_COUNT = 2
export const WEEKLY_COUNT = 1

export function targetOf(g: MissionGoal): number {
  switch (g.kind) {
    case 'play-any':       return g.target
    case 'play-game':      return g.target
    case 'play-all-four':  return 4
    case 'score-at-least': return 1
    case 'solved-exact':   return 1
  }
}

// ── Selección determinista (misma seed en cliente y servidor) ─────────────
// El servidor la usa para rechazar reclamos de misiones que no están activas hoy.

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

function pickIds(seed: number, pool: string[], n: number): string[] {
  const rand = mulberry32(seed)
  const arr = pool.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, n)
}

export function activeDailyIds(dayKey: string): string[] {
  return pickIds(seedFromKey('d-' + dayKey), DAILY_POOL, DAILY_COUNT)
}

export function activeWeeklyIds(weekKey: string): string[] {
  return pickIds(seedFromKey('w-' + weekKey), WEEKLY_POOL, WEEKLY_COUNT)
}
