// Derivación SERVER-AUTORITATIVA del score de una partida.
//
// El cliente (web o app) manda su parte en `payload`; aquí se RECALCULA el
// score contra el contenido oficial del día/semana y se ignora el `score` que
// venga en el POST. Dos motivos:
//
//   1. PARIDAD. Web y app implementan cada una su UI; si cada una calcula su
//      propio score, acaban compitiendo en la misma tabla con escalas
//      distintas (pasaba: CrackQuiz web 0–180 vs app 0–10). Con la derivación
//      aquí, la escala es una sola por definición.
//   2. ANTITRAMPA. Era el hardening que la migración 062 dejaba pendiente
//      ("recomputar el score desde p_payload por juego"). Un POST con score
//      inflado ya no entra: el score sale de las respuestas verificadas.
//
// DEGRADACIÓN: si el payload no trae la forma canónica (cliente antiguo en la
// store, juego sin datos verificables, contenido no resoluble) se cae a una
// derivación aproximada desde los agregados del payload y, en último término,
// al score del cliente acotado por el techo del juego. Nunca se pierde una
// partida legítima por no poder verificarla.

import type { SupabaseClient } from '@supabase/supabase-js'
import { adminSupabase } from './supabase-admin'
import {
  CRACKQUIZ,
  SCORE_CAP,
  scoreCrackquizRound,
  scoreMionce,
  scoreSopa,
  scoreTakagrid,
  type CrackquizAnswerOutcome,
  type ScoredGameId,
} from './game-scoring'
import { answerKeyFor, composeDailyRound, normalizeFeatured } from './crackquiz-day'
import { getDailyPuzzle, isValidAnswer } from './takagrid-puzzles'
import { getPlayerById } from './players-catalog'
import { getChallengeForWeek } from './mionce-challenges'
import { FORMATIONS } from './mionce-formations'
import { PUZZLES as SOPA_PUZZLES } from './sopa-puzzles'

const SCORED_GAMES: ReadonlySet<string> = new Set<ScoredGameId>([
  'crackquiz', 'takagrid', 'sopacracks', 'mionce',
])

export interface DeriveResult {
  /** Score final que se manda a record_game_play. */
  score: number
  /** 'server' = recalculado desde respuestas verificadas · 'aggregate' =
   *  derivado de los totales del payload · 'client' = no verificable. */
  source: 'server' | 'aggregate' | 'client'
}

/**
 * Recalcula el score de una partida. `clientScore` solo se usa si no hay nada
 * verificable en el payload.
 */
export async function deriveGameScore(
  gameId: string,
  period: string,
  payload: Record<string, unknown> | undefined,
  clientScore: number,
): Promise<DeriveResult> {
  if (!SCORED_GAMES.has(gameId)) {
    // quiniela / strikerrush tienen su propio camino: se respeta el cliente.
    return { score: clientScore, source: 'client' }
  }
  const cap = SCORE_CAP[gameId as ScoredGameId]
  const fallback = (): DeriveResult => ({ score: Math.min(clientScore, cap), source: 'client' })
  const p = payload ?? {}

  try {
    switch (gameId as ScoredGameId) {
      case 'crackquiz':  return await deriveCrackquiz(period, p, clientScore, fallback)
      case 'takagrid':   return deriveTakagrid(period, p, fallback)
      case 'sopacracks': return await deriveSopa(period, p, fallback)
      case 'mionce':     return deriveMionce(period, p, fallback)
    }
  } catch {
    // Cualquier fallo resolviendo contenido → no penalizamos al jugador.
    return fallback()
  }
}

// ── CrackQuiz ────────────────────────────────────────────────────

interface RawAnswer {
  qId?: unknown
  selected?: unknown
  secondsLeft?: unknown
}

async function deriveCrackquiz(
  day: string,
  p: Record<string, unknown>,
  clientScore: number,
  fallback: () => DeriveResult,
): Promise<DeriveResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fallback()

  const answers = Array.isArray(p.answers) ? (p.answers as RawAnswer[]) : null

  if (answers && answers.length > 0) {
    const round = composeDailyRound(day, await loadFeatured(day))
    const key = answerKeyFor(round)

    const seen = new Set<string>()
    const outcomes: CrackquizAnswerOutcome[] = []
    // ¿El parte trae el reloj de cada respuesta? Los clientes anteriores a esta
    // fase no lo mandaban (ver más abajo).
    let hasTiming = false
    for (const a of answers.slice(0, CRACKQUIZ.QUESTIONS_PER_ROUND * 2)) {
      const qId = typeof a?.qId === 'string' ? a.qId : ''
      // qId ajeno al set del día o repetido → no computa (antiinyección).
      if (!qId || seen.has(qId)) continue
      const correctIndex = key.get(qId)
      if (correctIndex === undefined) continue
      seen.add(qId)
      const selected = typeof a?.selected === 'number' ? a.selected : -1
      const timed = typeof a?.secondsLeft === 'number' && Number.isFinite(a.secondsLeft)
      if (timed) hasTiming = true
      outcomes.push({
        correct: selected === correctIndex,
        secondsLeft: timed ? (a.secondsLeft as number) : 0,
      })
      if (outcomes.length >= CRACKQUIZ.QUESTIONS_PER_ROUND) break
    }

    if (outcomes.length > 0) {
      const don = p.don === 'accepted' ? 'accepted' : p.don === 'declined' ? 'declined' : null
      if (hasTiming) {
        return { score: scoreCrackquizRound(outcomes, don), source: 'server' }
      }
      // Sin reloj en el parte (bundle viejo en caché tras el despliegue):
      // recalcular sin bonus de rapidez le robaría hasta 50 puntos legítimos a
      // quien acaba de jugar bien. Se acepta su score PERO acotado al máximo que
      // esas mismas respuestas podrían haber dado respondiendo al instante — el
      // techo sigue siendo estrecho, así que un parte inflado tampoco pasa.
      const best = scoreCrackquizRound(
        outcomes.map(o => ({ ...o, secondsLeft: CRACKQUIZ.QUESTION_TIME })),
        don,
      )
      return { score: Math.min(clientScore, best), source: 'aggregate' }
    }
  }

  // Cliente sin detalle por pregunta (builds antiguos de la app): solo
  // aciertos → puntos base, sin bonus de rapidez ni combo.
  const correct = intIn(p.correct, 0, CRACKQUIZ.QUESTIONS_PER_ROUND)
  if (correct !== null) {
    return { score: correct * CRACKQUIZ.BASE_PTS, source: 'aggregate' }
  }
  return fallback()
}

async function loadFeatured(day: string) {
  const admin: SupabaseClient | null = adminSupabase()
  if (!admin) return null
  const { data } = await admin
    .from('crackquiz_featured')
    .select('question')
    .eq('day_iso', day)
    .maybeSingle()
  return normalizeFeatured(data?.question ?? null)
}

// ── TakaGrid ─────────────────────────────────────────────────────

function deriveTakagrid(
  day: string,
  p: Record<string, unknown>,
  fallback: () => DeriveResult,
): DeriveResult {
  const hardMode = p.hardMode === true
  const picks = Array.isArray(p.picks) ? p.picks : null

  if (picks && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const { puzzle } = getDailyPuzzle(new Date(`${day}T12:00:00Z`))
    const used = new Set<string>()
    let solved = 0
    picks.slice(0, 9).forEach((raw, i) => {
      if (typeof raw !== 'string' || used.has(raw)) return
      const player = getPlayerById(raw)
      if (!player) return
      used.add(raw)
      const cell = { row: Math.floor(i / 3) as 0 | 1 | 2, col: (i % 3) as 0 | 1 | 2 }
      if (isValidAnswer(player, puzzle, cell)) solved++
    })
    return { score: scoreTakagrid(solved, hardMode), source: 'server' }
  }

  // Agregados: `solved` puede venir como bool[9] (web) o como número (app).
  const raw = p.solved
  let solved: number | null = null
  if (Array.isArray(raw)) solved = raw.filter(Boolean).length
  else solved = intIn(raw, 0, 9)
  if (solved !== null) return { score: scoreTakagrid(solved, hardMode), source: 'aggregate' }
  return fallback()
}

// ── Sopa de Cracks ───────────────────────────────────────────────

async function deriveSopa(
  week: string,
  p: Record<string, unknown>,
  fallback: () => DeriveResult,
): Promise<DeriveResult> {
  const found = intIn(p.found, 0, 99)
  if (found === null) return fallback()
  // Techo real: nº de palabras de la sopa de esa semana (estática o featured).
  const maxWords = await weekWordCount(week)
  return { score: scoreSopa(Math.min(found, maxWords)), source: 'aggregate' }
}

async function weekWordCount(week: string): Promise<number> {
  const m = /^(\d{4})-W(\d{2})$/.exec(week)
  if (!m) return 14
  const admin = adminSupabase()
  if (admin) {
    const { data } = await admin
      .from('sopa_cracks_featured')
      .select('words')
      .eq('week_iso', week)
      .maybeSingle()
    if (data && Array.isArray(data.words) && data.words.length >= 5) return data.words.length
  }
  const weekNumber = Number(m[2])
  return SOPA_PUZZLES[weekNumber % SOPA_PUZZLES.length].words.length
}

// ── Mi Once ──────────────────────────────────────────────────────

function deriveMionce(
  week: string,
  p: Record<string, unknown>,
  fallback: () => DeriveResult,
): DeriveResult {
  const slots = isRecord(p.slots) ? p.slots : null
  const challenge = getChallengeForWeek(week)

  if (slots && challenge) {
    const defs = FORMATIONS[challenge.recommendedFormation] ?? []
    const used = new Set<string>()
    let valid = 0
    for (const def of defs) {
      const pid = slots[def.id]
      if (typeof pid !== 'string' || used.has(pid)) continue
      const player = getPlayerById(pid)
      if (!player) continue
      used.add(pid)
      if (player.position !== def.position) continue
      const tag = challenge.slotTags?.[def.id]
      if (tag && !tag.match(player)) continue
      valid++
    }
    return { score: scoreMionce(valid), source: 'server' }
  }

  const valid = intIn(p.valid, 0, 11)
  if (valid !== null) return { score: scoreMionce(valid), source: 'aggregate' }
  return fallback()
}

// ── Utilidad ─────────────────────────────────────────────────────

function intIn(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}
