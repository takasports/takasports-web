import type { Pick } from '@/components/QuinielaModule'
import type { QuinielaMatch } from '@/components/QuinielaModule'
import type { BadgeId, MatchResult } from './types'

// ─────────────────────────────────────────────────────────────────
// Racha por jornada — cuenta jornadas distintas jugadas.
// Antes era por semana ISO (no encajaba con un torneo diario como
// el Mundial). Cada jornada jugada suma; durante un torneo activo
// current = best = nº de jornadas distintas en las que participaste.
// ─────────────────────────────────────────────────────────────────
export function computeStreak(submitted: Set<string>): { current: number; best: number } {
  const n = submitted.size
  return { current: n, best: n }
}

export function isCorrect(pick: Pick, outcome: '1' | 'X' | '2'): boolean {
  if (pick === outcome) return true
  if (pick === '1X') return outcome === '1' || outcome === 'X'
  if (pick === 'X2') return outcome === 'X' || outcome === '2'
  return false
}

// ─────────────────────────────────────────────────────────────────
// Forma reciente del equipo — últimos 5 partidos (determinista)
// ─────────────────────────────────────────────────────────────────
export function teamForm(name: string): ('W' | 'D' | 'L')[] {
  const seed = name.split('').reduce((s, c, i) => s + c.charCodeAt(0) * (i + 3), 0)
  return Array.from({ length: 5 }, (_, i) => {
    const v = (seed * (i + 7) * 31 + i * 13) % 10
    return v < 4 ? 'W' : v < 7 ? 'D' : 'L'
  })
}

// ─────────────────────────────────────────────────────────────────
// Tendencia de picks — cambia cada 3 min, combinada con match seed
// ─────────────────────────────────────────────────────────────────
export function communityTrend(match: QuinielaMatch, tick: number): { d1: number; dX: number; d2: number } {
  const s = (match.home.charCodeAt(0) * 11 + match.away.charCodeAt(0) * 7 + tick * 3) % 30 - 15
  return { d1: Math.round(s * 0.4), dX: Math.round(-s * 0.2), d2: Math.round(-s * 0.3) }
}

// ─────────────────────────────────────────────────────────────────
// Sistema de monedas internas — ahora vive en `useCoins` (./hooks).
// Estas funciones legacy se eliminaron; usar el hook en componentes.
// ─────────────────────────────────────────────────────────────────

export function computeCoinRewards(
  picks: Array<{ pick: string; exactHome?: number; exactAway?: number }>,
  results: MatchResult[],
  captainIdx: number | undefined,
): { perPick: number[]; exact: number[]; captainBonus: number; plenoBonus: number; total: number } {
  const perPick: number[] = []
  const exact: number[] = []
  let plenoCount = 0

  picks.forEach((p, i) => {
    const r = results[i]
    if (!r) { perPick.push(0); exact.push(0); return }
    const hit = isCorrect(p.pick as Pick, r.outcome)
    const base = hit ? (captainIdx === i ? 20 : 10) : 0
    perPick.push(base)
    const exactHit =
      hit &&
      p.exactHome != null && p.exactAway != null &&
      p.exactHome === r.homeGoals && p.exactAway === r.awayGoals
    exact.push(exactHit ? 50 : 0)
    if (hit) plenoCount++
  })

  const captainBonus = 0
  const plenoBonus = plenoCount === picks.length && picks.length > 0 ? 100 : 0
  const total = perPick.reduce((a, b) => a + b, 0) + exact.reduce((a, b) => a + b, 0) + plenoBonus
  return { perPick, exact, captainBonus, plenoBonus, total }
}

export function computeNewBadges(
  picks: Array<{ home: string; away: string; pick: string; result?: { outcome: '1'|'X'|'2'; homeGoals: number; awayGoals: number }; odds?: { home: number; draw: number; away: number } }>,
  scored: number,
  total: number,
  streak: number,
  totalJornadas: number,
  existing: BadgeId[]
): BadgeId[] {
  const earned: BadgeId[] = []
  const add = (id: BadgeId) => { if (!existing.includes(id) && !earned.includes(id)) earned.push(id) }

  if (scored === total && total > 0) add('pleno')
  if (streak >= 5) add('racha5')
  if (totalJornadas >= 10) add('veterano')

  const empatesCorrect = picks.filter(p => {
    const o = p.result?.outcome
    return o === 'X' && isCorrect(p.pick as Pick, 'X')
  }).length
  if (empatesCorrect >= 2) add('empate_guru')

  const hasContraIA = picks.some(p => {
    if (!p.odds || !p.result) return false
    const ai = aiSuggest(p.odds).pick
    const correct = isCorrect(p.pick as Pick, p.result.outcome)
    const disagreed = p.pick !== ai && !(ai === '1X' && (p.pick === '1' || p.pick === 'X')) && !(ai === 'X2' && (p.pick === 'X' || p.pick === '2'))
    return correct && disagreed
  })
  if (hasContraIA) add('contra_ia')

  const hasDificil = picks.some(p => {
    if (!p.odds || !p.result) return false
    const o = p.result.outcome
    const cuota = o === '1' ? p.odds.home : o === 'X' ? p.odds.draw : p.odds.away
    return isCorrect(p.pick as Pick, o) && cuota > 3.0
  })
  if (hasDificil) add('pick_dificil')

  return earned
}

// ─────────────────────────────────────────────────────────────────
// Leaderboard semanal — generado deterministamente por jornada
// ─────────────────────────────────────────────────────────────────
const LEADERBOARD_NAMES = [
  'Carlos M.','Laura P.','Javi G.','María R.','Álex T.',
  'Sergio F.','Ana L.','Pablo S.','Marta D.','Diego C.',
  'Elena V.','Rubén A.','Cristina H.','Iván N.','Sofía B.',
  'Marcos J.','Patricia O.','Daniel E.','Carmen U.','Adrián M.',
]

export function communityLeaderboard(jornada: string, totalMatches: number) {
  const seed = jornada.split('').reduce((s, c, i) => s + c.charCodeAt(0) * (i + 2), 0)
  return LEADERBOARD_NAMES.map((name, i) => {
    const raw = (seed * (i + 5) * 13 + i * 97) % 100
    const score = Math.round((raw / 100) * totalMatches)
    return { name, score }
  }).sort((a, b) => b.score - a.score)
}

// ─────────────────────────────────────────────────────────────────
// Consenso de comunidad — derivado de cuotas + ruido determinista
// ─────────────────────────────────────────────────────────────────
export function communityConsensus(match: QuinielaMatch): { p1: number; pX: number; p2: number } {
  if (match.odds) {
    const impl = (o: number) => 1 / o
    const ih = impl(match.odds.home), id = impl(match.odds.draw), ia = impl(match.odds.away)
    const sum = ih + id + ia
    const noise = ((match.home.charCodeAt(0) || 65) * 7 + (match.away.charCodeAt(0) || 65) * 3) % 19 - 9
    let p1 = Math.round((ih / sum) * 100 + noise * 0.5)
    let pX = Math.round((id / sum) * 100 - noise * 0.2)
    p1 = Math.max(8, Math.min(80, p1))
    pX = Math.max(5, Math.min(40, pX))
    const p2 = Math.max(8, Math.min(80, 100 - p1 - pX))
    return { p1, pX, p2 }
  }
  return { p1: 38, pX: 27, p2: 35 }
}

// ─────────────────────────────────────────────────────────────────
// AI pick suggestion — derived from implied probabilities
// ─────────────────────────────────────────────────────────────────
export function aiSuggest(odds: { home: number; draw: number; away: number }): { pick: Pick; confidence: number } {
  const impl = (o: number) => 1 / o
  const ih = impl(odds.home), id = impl(odds.draw), ia = impl(odds.away)
  const sum = ih + id + ia
  const ph = ih / sum, px = id / sum, pa = ia / sum

  if (ph >= pa && ph >= px) {
    if (ph < 0.52 && px > 0.17) return { pick: '1X', confidence: Math.round((ph + px) * 100) }
    return { pick: '1', confidence: Math.round(ph * 100) }
  }
  if (pa >= ph && pa >= px) {
    if (pa < 0.52 && px > 0.17) return { pick: 'X2', confidence: Math.round((pa + px) * 100) }
    return { pick: '2', confidence: Math.round(pa * 100) }
  }
  return { pick: 'X', confidence: Math.round(px * 100) }
}

// ─────────────────────────────────────────────────────────────────
// Scoreline chips per outcome
// ─────────────────────────────────────────────────────────────────
export function scorelinesFor(pick: Pick): [number, number][] {
  if (pick === '1') return [[1,0],[2,0],[2,1],[3,0],[3,1],[3,2]]
  if (pick === '2') return [[0,1],[0,2],[1,2],[0,3],[1,3],[2,3]]
  return [[0,0],[1,1],[2,2],[3,3]]
}

// ─────────────────────────────────────────────────────────────────
// Línea de contexto por partido — generada desde cuotas
// ─────────────────────────────────────────────────────────────────
export function getMatchContext(home: string, away: string, odds?: { home: number; draw: number; away: number }): string {
  if (!odds) return ''
  const { home: h, draw: d, away: a } = odds
  const spread = Math.abs(h - a)
  if (spread < 0.25) return `Partido muy igualado · Cuotas casi idénticas`
  if (h < 1.55) return `${home} gran favorito en casa · Cuota de ${h.toFixed(2)}`
  if (a < 1.55) return `${away} favorito · Sorpresa si gana el local`
  if (d < h && d < a) return `El empate tiene mucha probabilidad · Cuota ${d.toFixed(2)}`
  if (h > 3.2 && a < 2.2) return `${away} visitante favorito · Pick trampa`
  const seed = (home.charCodeAt(0) + away.charCodeAt(0)) % 4
  return [
    `${spread > 1 ? (h < a ? home : away) : home} parte favorito · Decisión ajustada`,
    `Duelo europeo de alto nivel · Cualquier resultado posible`,
    `${h < a ? home : away} con ventaja · ${d.toFixed(2)} el empate`,
    `Historial igualado · La cuota del empate invita a pensarlo`,
  ][seed]
}

// ─────────────────────────────────────────────────────────────────
// Division helper
// ─────────────────────────────────────────────────────────────────
export function getDivision(history: { correct: number; total: number }[]): { name: string; color: string; bg: string; border: string; emoji: string } {
  if (!history.length) return { name: 'Rookie', color: '#9090A4', bg: 'rgba(144,144,164,0.08)', border: 'rgba(144,144,164,0.2)', emoji: '🌱' }
  const avg = history.reduce((s, h) => s + (h.total ? h.correct / h.total : 0), 0) / history.length
  if (avg >= 0.65) return { name: 'Oro', color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', emoji: '🏆' }
  if (avg >= 0.45) return { name: 'Plata', color: '#C4B5FD', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)', emoji: '⭐' }
  return { name: 'Bronce', color: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.2)', emoji: '🔶' }
}

export function scoreForMember(picks: Record<number, string>, results: MatchResult[]): number {
  return Object.values(picks).filter((p, i) => {
    const r = results[i]
    return r && isCorrect(p as Pick, r.outcome)
  }).length
}
