// Helpers UI compartidos por la sección /rankings.
// Vivían inline en RankingsClient.tsx; extraídos para reutilizar en
// componentes desacoplados (RankRow, TopOneRow, MovimientoSemana, etc.).

import { calcScore, calcTrend, type RankingEntry, type Trend } from './rankings'

export function getDisplayScore(entry: RankingEntry): number {
  return entry.factors ? calcScore(entry.factors, entry.editorialBoost) : entry.score
}

// Score específico del deporte: rendimiento-heavy (r×0.50 + c×0.30 + m×0.15 + n×0.05)
// Se usa cuando hay un filtro de deporte activo en el ranking.
export function getSportScore(entry: RankingEntry): number {
  if (entry.scoreSport !== undefined) return entry.scoreSport
  if (!entry.factors) return entry.score
  const { rendimiento, contexto, mediatico, narrativa } = entry.factors
  return Math.round((rendimiento * 0.50 + contexto * 0.30 + mediatico * 0.15 + narrativa * 0.05) * 10) / 10
}

export function getEffectiveTrend(entry: RankingEntry): Trend {
  const s = getDisplayScore(entry)
  return entry.scorePrev !== undefined ? calcTrend(s, entry.scorePrev) : entry.trend
}

export function trendIcon(trend: Trend) {
  const map: Record<Trend, { icon: string; color: string; label: string }> = {
    up2:   { icon: '↑↑', color: '#22c55e', label: 'Subiendo fuerte' },
    up:    { icon: '↑',  color: '#86efac', label: 'Subiendo' },
    flat:  { icon: '→',  color: '#6B6B7B', label: 'Estable' },
    down:  { icon: '↓',  color: '#f87171', label: 'Bajando' },
    down2: { icon: '↓↓', color: '#ef4444', label: 'Bajando fuerte' },
  }
  return map[trend]
}

export function scoreColor(score: number): string {
  if (score >= 95) return '#22c55e'
  if (score >= 90) return '#86efac'
  if (score >= 85) return '#f59e0b'
  if (score >= 80) return '#f97316'
  if (score >= 75) return '#fb923c'
  return '#f87171'
}

export const SPORT_EMOJI: Record<string, string> = {
  futbol: '⚽', baloncesto: '🏀', formula1: '🏎️', tenis: '🎾',
  ufc: '🥊', wwe: '🤼', contenido: '✍️',
}
