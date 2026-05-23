import type { Pick } from '@/components/QuinielaModule'
import type { QuinielaMatch } from '@/components/QuinielaModule'
import type { BadgeId, MatchResult } from './types'
import { ALIAS_KEY } from './constants'
import { scorePick, nameMatch, SCORING } from '@/lib/quiniela'

// ─────────────────────────────────────────────────────────────────
// Alias del jugador (identidad visible en ligas / ranking).
// Nunca devolvemos 'Tú': si no hay alias elegido, generamos un
// «Invitado-XXXX» estable para que cada invitado sea distinguible.
// ─────────────────────────────────────────────────────────────────
export function getPlayerAlias(): string {
  if (typeof window === 'undefined') return ''
  try { return (localStorage.getItem(ALIAS_KEY) ?? '').trim() } catch { return '' }
}

export function setPlayerAlias(alias: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(ALIAS_KEY, alias.trim().slice(0, 24)) } catch { /* ignore */ }
}

export function ensurePlayerAlias(): string {
  const existing = getPlayerAlias()
  if (existing) return existing
  const guest = `Invitado-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  setPlayerAlias(guest)
  return guest
}

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
// Sistema de monedas internas — vive en `useCoins` (./hooks).
// (La función legacy computeCoinRewards fue eliminada en el rediseño
// de scoring; ya no quedan callers. lib/quiniela.scorePicks es la
// fuente única.)
// ─────────────────────────────────────────────────────────────────

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
// Consenso de comunidad — fallback ESTIMADO derivado de cuotas reales
// (se usa solo cuando aún no hay suficientes votos reales; la UI lo
// etiqueta explícitamente como «ESTIMADO», nunca como dato de comunidad)
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

// ─────────────────────────────────────────────────────────────────
// Clasificación de liga PRIVADA — sistema de puntos.
// Ligas privadas son por puntos internos (no monedas, no cuotas).
// El scoring se simplificó: 1 punto por tendencia acertada, +5 si
// hace pleno. Desempates: hits, luego nickname alfabético.
// ─────────────────────────────────────────────────────────────────
export interface LeagueMatchKey { home: string; away: string; isoDate?: string }
export interface LeagueMemberLite {
  nickname: string
  picks?: Record<string, string>
}
export interface LeagueStanding {
  nickname: string
  points: number
  hits: number
  picked: number
  pleno: boolean
}

export function computeStandings(
  matchKeys: LeagueMatchKey[],
  members: LeagueMemberLite[],
  results: MatchResult[],
): LeagueStanding[] {
  const resultFor = (mk: LeagueMatchKey) =>
    results.find(r => nameMatch(r.home, mk.home) && nameMatch(r.away, mk.away))

  return members
    .map(m => {
      const total = matchKeys.length
      let points = 0, hits = 0, picked = 0
      matchKeys.forEach((mk, i) => {
        const pk = m.picks?.[String(i)]
        if (!pk) return
        picked++
        const s = scorePick(
          { home: mk.home, away: mk.away, pick: pk as Pick },
          resultFor(mk),
        )
        points += s.points
        if (s.hit) hits++
      })
      const pleno = total > 0 && picked === total && hits === total
      if (pleno) points += SCORING.PLENO_BONUS
      return { nickname: m.nickname, points, hits, picked, pleno }
    })
    .sort((a, b) =>
      b.points - a.points ||
      b.hits - a.hits ||
      a.nickname.localeCompare(b.nickname),
    )
}

// ─────────────────────────────────────────────────────────────────
// Cuotas "vivas" estilo casa de apuestas — la línea se mueve por la
// ACCIÓN REAL de la gente (consenso de picks) y se aprieta al acercarse
// el inicio. Base = cuota real del bookmaker; preservamos su margen
// (overround) para que sigan pareciendo cuotas reales. Sin aleatoriedad:
// si no hay suficientes votos reales, devolvemos la base sin tocar.
// ─────────────────────────────────────────────────────────────────
export interface OddsTriple { home: number; draw: number; away: number }

const ODDS_MIN_VOTES = 8          // por debajo: no movemos la línea (sería humo)
const ODDS_MAX_PULL  = 0.45       // tope de desplazamiento hacia el consenso
const ODDS_RAMP_HOURS = 6         // en las últimas N horas el book "aprieta"

export function liveOdds(
  base: OddsTriple | undefined,
  consensus: { p1: number; px: number; p2: number; total: number } | null,
  isoDate: string | undefined,
  now: number = Date.now(),
): OddsTriple | undefined {
  if (!base || !base.home || !base.away) return base
  const drawO = base.draw || 0
  const iH = 1 / base.home
  const iD = drawO ? 1 / drawO : 0
  const iA = 1 / base.away
  const margin = iH + iD + iA            // overround real del bookmaker
  if (margin <= 0) return base
  const bH = iH / margin, bD = iD / margin, bA = iA / margin   // prob justa

  if (!consensus || consensus.total < ODDS_MIN_VOTES) return base

  const cTot = consensus.p1 + consensus.px + consensus.p2 || 1
  const cH = consensus.p1 / cTot, cD = consensus.px / cTot, cA = consensus.p2 / cTot

  // Peso: más volumen de picks + más cerca del inicio → más arrastre.
  const volumeW = Math.min(consensus.total / 60, 1)
  let timeW = 0.4
  if (isoDate) {
    const hoursToKO = (new Date(isoDate).getTime() - now) / 3_600_000
    const t = Math.max(0, Math.min(1, (ODDS_RAMP_HOURS - hoursToKO) / ODDS_RAMP_HOURS))
    timeW = 0.4 + 0.6 * t
  }
  const w = ODDS_MAX_PULL * volumeW * timeW

  const pH = bH * (1 - w) + cH * w
  const pD = bD * (1 - w) + cD * w
  const pA = bA * (1 - w) + cA * w
  const sum = pH + pD + pA || 1

  // Reaplicamos el margen original para que la cuota siga "de casa".
  const mk = (p: number) => Math.max(1.01, Math.round((1 / ((p / sum) * margin)) * 100) / 100)
  return { home: mk(pH), draw: drawO ? mk(pD) : 0, away: mk(pA) }
}
