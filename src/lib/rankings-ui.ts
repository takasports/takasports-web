// Helpers UI compartidos por la sección /rankings.
// Vivían inline en RankingsClient.tsx; extraídos para reutilizar en
// componentes desacoplados (RankRow, TopOneRow, MovimientoSemana, etc.).

import {
  calcScore, calcCreatorScore, type RankingEntry, type Trend,
  RANKING_CREADORES, RANKING_PERIODISTAS, RANKING_CREADORES_WWE,
} from './rankings'

// ── Track "contenido" (creadores/periodistas) ──────────────────────
// Listado paralelo al deportivo, con criterio de score PROPIO. La DB trae
// `category`; los arrays estáticos no, así que también reconocemos por id.
const CREATOR_CATEGORIES = new Set(['creadores', 'periodistas', 'creadores_wwe'])
const CREATOR_IDS = new Set<string>(
  [...RANKING_CREADORES, ...RANKING_PERIODISTAS, ...RANKING_CREADORES_WWE].map(e => e.id),
)
export function isCreatorEntry(entry: Pick<RankingEntry, 'id' | 'category'>): boolean {
  return CREATOR_CATEGORIES.has(entry.category ?? '') || CREATOR_IDS.has(entry.id)
}

// Índice mostrado: cada track con su criterio (deportistas 40/20/25/15,
// contenido 50/30/15/5). Único punto de verdad — ScoreBreakdown usa lo mismo.
export function getDisplayScore(entry: RankingEntry): number {
  if (!entry.factors) return entry.score
  return isCreatorEntry(entry)
    ? calcCreatorScore(entry.factors, entry.editorialBoost)
    : calcScore(entry.factors, entry.editorialBoost)
}

// Score específico del deporte: rendimiento-heavy (r×0.50 + c×0.30 + m×0.15 + n×0.05)
// Se usa cuando hay un filtro de deporte activo en el ranking.
export function getSportScore(entry: RankingEntry): number {
  if (entry.scoreSport !== undefined) return entry.scoreSport
  if (!entry.factors) return entry.score
  const { rendimiento, contexto, mediatico, narrativa } = entry.factors
  return Math.round((rendimiento * 0.50 + contexto * 0.30 + mediatico * 0.15 + narrativa * 0.05) * 10) / 10
}

// La flecha refleja la tendencia editorial/DB (coherente con el insight),
// no un recálculo que podía contradecir el texto curado.
export function getEffectiveTrend(entry: RankingEntry): Trend {
  return entry.trend
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
  if (score >= 93) return '#22c55e'
  if (score >= 87) return '#86efac'
  if (score >= 82) return '#f59e0b'
  if (score >= 76) return '#f97316'
  if (score >= 70) return '#fb923c'
  return '#f87171'
}

export const SPORT_EMOJI: Record<string, string> = {
  futbol: '⚽', baloncesto: '🏀', formula1: '🏎️', tenis: '🎾',
  ufc: '🥊', wwe: '🤼', contenido: '✍️',
}
