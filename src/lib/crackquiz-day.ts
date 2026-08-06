// Resolución de la ronda diaria de CrackQuiz — fuente ÚNICA del set de
// preguntas de un día (y por tanto de la clave de respuestas oficial).
//
// La ronda = las 10 preguntas deterministas de `getDailyQuestionsFor(day)` y,
// si la redacción inyectó una pregunta de actualidad para ese día
// (tabla `crackquiz_featured`), esa antepuesta como Q1 deduplicando por id.
// Es exactamente lo que hace el cliente web al arrancar la ronda.
//
// Lo consumen: /api/crackquiz/today (lo que juega la app), la derivación de
// score en el servidor (game-score-server) y el heatmap social. Antes cada uno
// recomponía la ronda por su cuenta y el heatmap ignoraba la featured.

import { getDailyQuestionsFor, type QuizQuestion, type QuizSport } from './crackquiz-questions'
import { CRACKQUIZ } from './game-scoring'

/** Pregunta servida al cliente: la featured trae `category` libre (string),
 *  no el union QuizCategory, así que ensanchamos ese campo. */
export interface RoundQuestion {
  id: string
  question: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  category: string
  sport: QuizSport
  difficulty: 1 | 2 | 3
}

export interface DailyRound {
  questions: RoundQuestion[]
  /** id de la pregunta de actualidad si se inyectó (para el badge). */
  featuredId: string | null
}

/** Valida la fila cruda de `crackquiz_featured` y la normaliza. Devuelve null
 *  si no cumple el contrato (options de 4 strings, correctIndex 0–3, id). */
export function normalizeFeatured(raw: unknown): RoundQuestion | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>
  if (typeof f.id !== 'string' || f.id.length === 0) return null
  if (!Array.isArray(f.options) || f.options.length !== 4) return null
  if (!f.options.every(o => typeof o === 'string' && o.length > 0)) return null
  if (typeof f.correctIndex !== 'number' || !Number.isInteger(f.correctIndex)) return null
  if (f.correctIndex < 0 || f.correctIndex > 3) return null
  const opts = f.options as string[]
  return {
    id: f.id,
    question: typeof f.question === 'string' ? f.question : '',
    options: [opts[0], opts[1], opts[2], opts[3]],
    correctIndex: f.correctIndex as 0 | 1 | 2 | 3,
    category: typeof f.category === 'string' ? f.category : 'actualidad',
    sport: 'general',
    difficulty: 1,
  }
}

/** Compone la ronda del día. `featured` ya normalizada (o null). Puro. */
export function composeDailyRound(
  day: string,
  featured: RoundQuestion | null,
  count: number = CRACKQUIZ.QUESTIONS_PER_ROUND,
): DailyRound {
  const base: RoundQuestion[] = getDailyQuestionsFor(day, count) as QuizQuestion[]
  if (!featured) return { questions: base, featuredId: null }
  const questions = [featured, ...base.filter(q => q.id !== featured.id)].slice(0, count)
  return { questions, featuredId: featured.id }
}

/** Mapa autoritativo qId → índice correcto para un día. Puro. */
export function answerKeyFor(round: DailyRound): Map<string, number> {
  const key = new Map<string, number>()
  for (const q of round.questions) key.set(q.id, q.correctIndex)
  return key
}
