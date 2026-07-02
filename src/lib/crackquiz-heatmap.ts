// Agregación del heatmap "el X% de la comunidad también acertó" de CrackQuiz.
//
// INTEGRIDAD: el acierto se RECALCULA en el servidor contra la respuesta
// oficial de cada pregunta del día (getDailyQuestionsFor) — el flag `correct`
// que manda el cliente en el payload NO es de fiar y se IGNORA. Solo se cuentan
// respuestas verificables: qId perteneciente al set del día + índice elegido
// (`selected`) presente. Así un parte manipulado no puede inflar el porcentaje:
// un voto solo suma como acierto si la opción enviada ES la correcta (idéntico
// a haber acertado de verdad). record_game_play es idempotente por
// (user, game, period) → 1 fila por usuario/día, así que cada respuesta pesa 1
// voto; además deduplicamos qId dentro de un mismo parte por si viene repetido.

import { getDailyQuestionsFor } from './crackquiz-questions'

/** Nº de preguntas de la ronda diaria — debe coincidir con QUESTIONS_PER_ROUND
 *  del cliente (src/app/crackquiz/page.tsx). */
export const CRACKQUIZ_ROUND_SIZE = 10

export interface HeatmapPlayRow {
  payload: unknown
}

export interface HeatmapResult {
  byQuestion: Record<string, { plays: number; correct: number }>
  totalPlays: number
}

interface RawAnswer {
  qId?: unknown
  selected?: unknown
  correct?: unknown // legacy del cliente — IGNORADO a propósito
}

export function aggregateCrackquizHeatmap(
  period: string,
  rows: readonly HeatmapPlayRow[],
): HeatmapResult {
  // Mapa autoritativo qId → índice correcto, del set EXACTO del día.
  const answerKey = new Map<string, number>()
  for (const q of getDailyQuestionsFor(period, CRACKQUIZ_ROUND_SIZE)) {
    answerKey.set(q.id, q.correctIndex)
  }

  const byQuestion: Record<string, { plays: number; correct: number }> = {}
  for (const row of rows) {
    const ans = (row?.payload as { answers?: unknown } | null | undefined)?.answers
    if (!Array.isArray(ans)) continue

    const seenInRow = new Set<string>() // dedup: 1 voto por qId por parte
    for (const a of ans as RawAnswer[]) {
      const qId = typeof a?.qId === 'string' ? a.qId : ''
      if (!qId || seenInRow.has(qId)) continue
      const correctIndex = answerKey.get(qId)
      if (correctIndex === undefined) continue // qId ajeno al set del día → anti-inyección
      const selected = a?.selected
      if (typeof selected !== 'number' || !Number.isInteger(selected)) continue // no verificable → skip
      seenInRow.add(qId)
      const slot = byQuestion[qId] ?? (byQuestion[qId] = { plays: 0, correct: 0 })
      slot.plays += 1
      if (selected === correctIndex) slot.correct += 1
    }
  }

  return { byQuestion, totalPlays: rows.length }
}
