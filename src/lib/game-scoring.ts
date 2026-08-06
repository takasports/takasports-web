// ─────────────────────────────────────────────────────────────────
// FÓRMULA CANÓNICA DE PUNTUACIÓN DE LOS MINIJUEGOS.
//
// Fuente ÚNICA del `score` que entra en game_plays (ranking por juego y
// periodo). Antes cada cliente calculaba lo suyo y web/app divergían:
//   · CrackQuiz web daba 0–180 (base + rapidez + combo) y la app 0–10
//     (aciertos pelados) → un usuario de app nunca podía superar a uno
//     de web en la MISMA tabla.
//   · TakaGrid web multiplicaba ×2 en modo hard y la app no lo tenía.
// Esto vive aquí, en funciones puras, y lo consume:
//   1. la UI web (para pintar el marcador en vivo),
//   2. `game-score-server.ts` (para RECALCULAR el score desde el payload
//      al registrar la partida) — el score que manda el cliente es solo
//      un aviso, el que cuenta es el que deriva el servidor.
//
// OJO: esto NO son los puntos de Liga Taka (eso es `game-points.ts`, que
// razona en ratios de acierto). Aquí se calcula el SCORE de la partida.
// ─────────────────────────────────────────────────────────────────

export type ScoredGameId = 'crackquiz' | 'takagrid' | 'sopacracks' | 'mionce'

// ── CrackQuiz ────────────────────────────────────────────────────

export const CRACKQUIZ = {
  /** Segundos por pregunta. */
  QUESTION_TIME: 20,
  /** Preguntas de la ronda diaria. */
  QUESTIONS_PER_ROUND: 10,
  /** Puntos base por acierto. */
  BASE_PTS: 10,
  /** Bonus máximo por responder rápido (proporcional al tiempo restante). */
  TIME_BONUS_MAX: 5,
  /** Bonus máximo por aciertos encadenados. */
  STREAK_BONUS_MAX: 5,
} as const

export interface ScoreBreakdown {
  total: number
  base: number
  time: number
  streak: number
}

/**
 * Puntos de UNA respuesta de CrackQuiz.
 * @param secondsLeft  Segundos que quedaban en el reloj al responder (0–20).
 * @param correct      Si la opción elegida era la correcta.
 * @param streakBefore Aciertos consecutivos ANTES de esta respuesta.
 */
export function scoreCrackquizAnswer(
  secondsLeft: number,
  correct: boolean,
  streakBefore: number,
): ScoreBreakdown {
  if (!correct) return { total: 0, base: 0, time: 0, streak: 0 }
  const secs = clampInt(secondsLeft, 0, CRACKQUIZ.QUESTION_TIME)
  const base = CRACKQUIZ.BASE_PTS
  const time = Math.round((secs / CRACKQUIZ.QUESTION_TIME) * CRACKQUIZ.TIME_BONUS_MAX)
  // El bonus arranca en la 2ª seguida (streakBefore = 1 → +1), con tope.
  const streak = Math.min(Math.max(0, Math.floor(streakBefore)), CRACKQUIZ.STREAK_BONUS_MAX)
  return { total: base + time + streak, base, time, streak }
}

/** Una respuesta ya resuelta (acierto sí/no + reloj), en orden de juego. */
export interface CrackquizAnswerOutcome {
  correct: boolean
  secondsLeft: number
}

/**
 * Score de una ronda completa de CrackQuiz. Replica exactamente el bucle del
 * cliente, incluido el "doble o nada" de la última pregunta:
 * si `don` es 'accepted', el combo bancado (suma de bonus de racha de todas
 * las respuestas menos la última) se DUPLICA al acertar la final y se PIERDE
 * al fallarla. El acumulado nunca baja de 0 (igual que la UI).
 */
export function scoreCrackquizRound(
  answers: readonly CrackquizAnswerOutcome[],
  don: 'accepted' | 'declined' | null = null,
): number {
  let score = 0
  let streakBefore = 0
  let bank = 0
  const lastIdx = answers.length - 1

  answers.forEach((a, i) => {
    const bd = scoreCrackquizAnswer(a.secondsLeft, a.correct, streakBefore)
    const isFinal = i === lastIdx
    const donDelta = isFinal && don === 'accepted' ? (a.correct ? bank : -bank) : 0
    score = Math.max(0, score + bd.total + donDelta)
    if (!isFinal) bank += bd.streak
    streakBefore = a.correct ? streakBefore + 1 : 0
  })

  return score
}

// ── TakaGrid ─────────────────────────────────────────────────────

export const TAKAGRID = {
  CELLS: 9,
  PTS_PER_CELL: 10,
  /** Modo hard (sin el contador de candidatos del catálogo) dobla puntos. */
  HARD_MULTIPLIER: 2,
} as const

export function scoreTakagrid(solvedCells: number, hardMode = false): number {
  const solved = clampInt(solvedCells, 0, TAKAGRID.CELLS)
  return solved * TAKAGRID.PTS_PER_CELL * (hardMode ? TAKAGRID.HARD_MULTIPLIER : 1)
}

// ── Sopa de Cracks ───────────────────────────────────────────────

export const SOPA = {
  POINTS_PER_WORD: 10,
  /** Tope de palabras por sopa (mismo dominio que GAME_LIMITS en game-points). */
  MAX_WORDS: 14,
} as const

export function scoreSopa(wordsFound: number): number {
  return clampInt(wordsFound, 0, SOPA.MAX_WORDS) * SOPA.POINTS_PER_WORD
}

// ── Mi Once ──────────────────────────────────────────────────────

export const MIONCE = {
  SLOTS: 11,
  PTS_PER_VALID: 10,
} as const

export function scoreMionce(validPlayers: number): number {
  return clampInt(validPlayers, 0, MIONCE.SLOTS) * MIONCE.PTS_PER_VALID
}

// ── Techos por juego (espejo del cap SQL de la migración 122) ────
//
// Máximos reales:
//   · crackquiz  10×(10+5) + racha 35 = 185, +30 del doble o nada = 215 (→220)
//   · takagrid   9 celdas × 10 × 2 (hard) = 180
//   · sopacracks 14 palabras × 10 = 140 (+margen)
//   · mionce     11 válidos × 10 = 110
export const SCORE_CAP: Record<ScoredGameId, number> = {
  crackquiz:  220,
  takagrid:   180,
  sopacracks: 150,
  mionce:     110,
}

// ── Utilidad ─────────────────────────────────────────────────────

function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}
