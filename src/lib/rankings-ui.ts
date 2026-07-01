// Helpers UI compartidos por la sección /rankings.
// Vivían inline en RankingsClient.tsx; extraídos para reutilizar en
// componentes desacoplados (RankRow, TopOneRow, MovimientoSemana, etc.).

import {
  calcScore, calcCreatorScore, calcTrend, type RankingEntry, type Trend,
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

// Índice mostrado: la DB/curado ya traen el valor canónico — `score_auto` se
// calcula por track en la DB (deportistas 40/20/25/15, contenido 50/30/15/5) y
// `score_manual` lo pisa. Confiamos en ese número; el recálculo por track queda
// como red de seguridad para entradas sin score persistido.
export function getDisplayScore(entry: RankingEntry): number {
  if (typeof entry.score === 'number' && entry.score > 0) return entry.score
  if (!entry.factors) return entry.score
  return isCreatorEntry(entry)
    ? calcCreatorScore(entry.factors, entry.editorialBoost)
    : calcScore(entry.factors, entry.editorialBoost)
}

// La flecha refleja el CAMBIO REAL de score (esta semana vs la anterior), como
// promete la metodología (sección 4): así la flecha, el número y el sparkline
// coinciden y no se contradicen. Umbral ±1 = movimiento; ±4 = movimiento fuerte
// (↑↑/↓↓). Si no hay score previo (entry nueva), caemos a la tendencia editorial.
export function getEffectiveTrend(entry: RankingEntry): Trend {
  if (typeof entry.scorePrev !== 'number') return entry.trend
  return calcTrend(getDisplayScore(entry), entry.scorePrev)
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
