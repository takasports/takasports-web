import type { Pick } from '@/components/QuinielaModule'

// ─────────────────────────────────────────────────────────────────
// Tipos locales del módulo Quiniela
// ─────────────────────────────────────────────────────────────────
export const BADGE_DEFS = [
  { id: 'pleno',         emoji: '🎯', name: 'Pleno',          desc: 'Acertaste todos los picks de una jornada' },
  { id: 'contra_ia',    emoji: '🤖', name: 'Contra la IA',   desc: 'Acertaste yendo contra la sugerencia de IA' },
  { id: 'empate_guru',  emoji: '🤝', name: 'Gurú del empate', desc: 'Acertaste 2 empates en la misma jornada' },
  { id: 'racha5',       emoji: '🔥', name: 'En racha x5',    desc: '5 semanas consecutivas participando' },
  { id: 'veterano',     emoji: '⭐', name: 'Veterano',        desc: '10 jornadas completadas' },
  { id: 'pick_dificil', emoji: '💎', name: 'Pick difícil',   desc: 'Acertaste un resultado con cuota > 3.0' },
] as const

export type BadgeId = typeof BADGE_DEFS[number]['id']

export interface CoinTxn { amount: number; reason: string; ts: number }

export interface League {
  id: string
  name: string
  competitionId: string
  matchIds: number[]
  picks: Record<number, Pick>
  submitted: boolean
  createdAt: string
}

export interface MatchResult { home: string; away: string; outcome: '1' | 'X' | '2'; homeGoals: number; awayGoals: number; espnId?: string }
