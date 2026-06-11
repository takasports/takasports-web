// ── Estimaciones honestas de partido (fútbol) ───────────────────────────────
// Dos lecturas SIEMPRE etiquetadas como orientativas, calculadas con datos que
// ya tenemos ($0, sin casas de apuestas):
//   1) Probabilidad ESTIMADA (pre-partido): a partir de clasificación (puntos
//      por partido) + forma reciente + ventaja de local. NO es un consejo de
//      apuesta; es una lectura informativa al estilo de cualquier portal.
//   2) Dominio del partido (en juego/final): reparto de posesión + tiros a
//      puerta entre los dos equipos. Reformula estadística real, no predice.
import type { FormResult } from '@/lib/past-events'

export interface OutcomeEstimate {
  /** Porcentajes enteros que SIEMPRE suman 100. */
  home: number
  draw: number
  away: number
}

function formPointsPerGame(f?: FormResult[]): number | undefined {
  if (!f || f.length < 3) return undefined
  const pts = f.reduce((s, r) => s + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0)
  return pts / f.length
}

// Mezcla puntos-por-partido de la tabla (señal principal) con la forma reciente.
function strength(ppg?: number, formPpg?: number): number | undefined {
  if (ppg != null && formPpg != null) return 0.6 * ppg + 0.4 * formPpg
  return ppg ?? formPpg
}

// Redondea {home,draw,away} (fracciones que suman ~1) a enteros que suman 100,
// repartiendo el resto al de mayor parte fraccionaria (método de los restos).
function roundTo100(raw: { home: number; draw: number; away: number }): OutcomeEstimate {
  const scaled = [
    { k: 'home' as const, v: raw.home * 100 },
    { k: 'draw' as const, v: raw.draw * 100 },
    { k: 'away' as const, v: raw.away * 100 },
  ]
  const floored = scaled.map(s => ({ ...s, f: Math.floor(s.v), r: s.v - Math.floor(s.v) }))
  let rest = 100 - floored.reduce((s, x) => s + x.f, 0)
  floored.sort((a, b) => b.r - a.r)
  for (let i = 0; rest > 0 && i < floored.length; i++, rest--) floored[i].f++
  const out = { home: 0, draw: 0, away: 0 }
  for (const x of floored) out[x.k] = x.f
  return out
}

/**
 * Probabilidad estimada 1·X·2 para un partido de fútbol. Devuelve null si no
 * hay base suficiente (sin tabla ni forma para ambos equipos).
 */
export function estimateOutcome(args: {
  homePpg?: number
  awayPpg?: number
  homeForm?: FormResult[]
  awayForm?: FormResult[]
}): OutcomeEstimate | null {
  const hs = strength(args.homePpg, formPointsPerGame(args.homeForm))
  const as = strength(args.awayPpg, formPointsPerGame(args.awayForm))
  if (hs == null || as == null) return null

  const HOME_ADV = 0.35 // ventaja de jugar en casa, en escala de puntos/partido
  const diff = (hs + HOME_ADV) - as

  // El empate es más probable cuanto más parejos; se estrecha con la diferencia.
  const draw = Math.max(0.14, Math.min(0.32, 0.30 - 0.05 * Math.abs(diff)))
  const nonDraw = 1 - draw
  const homeShare = 1 / (1 + Math.exp(-1.2 * diff)) // logística de la diferencia

  return roundTo100({
    home: nonDraw * homeShare,
    draw,
    away: nonDraw * (1 - homeShare),
  })
}

export interface Dominance {
  /** Porcentajes enteros que suman 100. */
  home: number
  away: number
  /** Métricas usadas (para el tooltip/nota honesta). */
  basis: string[]
}

function parseStatNum(s: string | undefined): number | null {
  if (!s) return null
  const n = parseFloat(s.replace('%', '').replace(',', '.').trim())
  return Number.isNaN(n) ? null : n
}

/**
 * Dominio del partido = reparto entre los dos equipos de la posesión y los
 * tiros a puerta (las que estén disponibles). Devuelve null si no hay datos.
 */
export function matchDominance(stats: { label: string; home: string; away: string }[]): Dominance | null {
  const find = (needles: string[]) =>
    stats.find(s => needles.some(n => s.label.toLowerCase().includes(n)))

  const shares: number[] = []   // share del LOCAL (0-1) por métrica
  const basis: string[] = []

  const pos = find(['posesión', 'posesion'])
  if (pos) {
    const h = parseStatNum(pos.home); const a = parseStatNum(pos.away)
    if (h != null && a != null && h + a > 0) { shares.push(h / (h + a)); basis.push('posesión') }
  }
  const sot = find(['tiros a puerta'])
  if (sot) {
    const h = parseStatNum(sot.home); const a = parseStatNum(sot.away)
    if (h != null && a != null && h + a > 0) { shares.push(h / (h + a)); basis.push('tiros a puerta') }
  }

  if (!shares.length) return null
  const homeShare = shares.reduce((s, v) => s + v, 0) / shares.length
  const home = Math.round(homeShare * 100)
  return { home, away: 100 - home, basis }
}
