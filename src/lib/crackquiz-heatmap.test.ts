import { describe, it, expect } from 'vitest'
import { aggregateCrackquizHeatmap, CRACKQUIZ_ROUND_SIZE } from './crackquiz-heatmap'
import { getDailyQuestionsFor } from './crackquiz-questions'

// ─────────────────────────────────────────────────────────────────────────────
// El heatmap "% de la comunidad" recalcula el acierto EN SERVIDOR contra la
// respuesta oficial del día e ignora el flag `correct` del cliente. Un parte
// manipulado no puede inflar el porcentaje.
// ─────────────────────────────────────────────────────────────────────────────

const PERIOD = '2026-07-02'
const DAY = getDailyQuestionsFor(PERIOD, CRACKQUIZ_ROUND_SIZE)
const q0 = DAY[0]
const q1 = DAY[1]
const wrong = (correctIndex: number) => (correctIndex + 1) % 4

const row = (answers: unknown) => ({ payload: { answers } })

describe('aggregateCrackquizHeatmap — recálculo autoritativo', () => {
  it('cuenta acierto solo si selected == respuesta oficial', () => {
    const { byQuestion } = aggregateCrackquizHeatmap(PERIOD, [
      row([{ qId: q0.id, selected: q0.correctIndex }]),          // acierto real
      row([{ qId: q0.id, selected: wrong(q0.correctIndex) }]),   // fallo real
    ])
    expect(byQuestion[q0.id]).toEqual({ plays: 2, correct: 1 })
  })

  it('IGNORA el flag correct del cliente (falsificable en ambos sentidos)', () => {
    const { byQuestion } = aggregateCrackquizHeatmap(PERIOD, [
      // miente "correct:true" con opción equivocada → NO cuenta como acierto
      row([{ qId: q0.id, selected: wrong(q0.correctIndex), correct: true }]),
      // dice "correct:false" pero eligió la buena → SÍ cuenta (verdad manda)
      row([{ qId: q0.id, selected: q0.correctIndex, correct: false }]),
    ])
    expect(byQuestion[q0.id]).toEqual({ plays: 2, correct: 1 })
  })

  it('respuesta sin selected (cliente legacy) se ignora por completo', () => {
    const { byQuestion } = aggregateCrackquizHeatmap(PERIOD, [
      row([{ qId: q0.id, correct: true }]),        // legacy, no verificable
      row([{ qId: q0.id, selected: '2', correct: true }]), // string no es índice → skip
    ])
    expect(byQuestion[q0.id]).toBeUndefined()
  })

  it('qId ajeno al set del día se ignora (anti-inyección)', () => {
    const { byQuestion } = aggregateCrackquizHeatmap(PERIOD, [
      row([{ qId: 'q-no-existe', selected: 0, correct: true }]),
      row([{ qId: '', selected: 0 }]),
      row([{ qId: 42, selected: 0 }]),
    ])
    expect(Object.keys(byQuestion)).toHaveLength(0)
  })

  it('qId repetido en el mismo parte cuenta 1 sola vez', () => {
    const { byQuestion } = aggregateCrackquizHeatmap(PERIOD, [
      row([
        { qId: q0.id, selected: q0.correctIndex },
        { qId: q0.id, selected: q0.correctIndex },
        { qId: q0.id, selected: q0.correctIndex },
      ]),
    ])
    expect(byQuestion[q0.id]).toEqual({ plays: 1, correct: 1 })
  })

  it('selected fuera de rango o -1 cuenta como jugada NO acertada', () => {
    const { byQuestion } = aggregateCrackquizHeatmap(PERIOD, [
      row([{ qId: q0.id, selected: 99 }]),
      row([{ qId: q0.id, selected: -1 }]),
      row([{ qId: q0.id, selected: 1.5 }]), // no entero → skip
    ])
    expect(byQuestion[q0.id]).toEqual({ plays: 2, correct: 0 })
  })

  it('payload no-array / vacío / basura se ignora; totalPlays = nº de filas', () => {
    const rows = [
      { payload: null },
      { payload: {} },
      { payload: { answers: 'no-es-array' } },
      { payload: { answers: [] } },
      row([{ qId: q1.id, selected: q1.correctIndex }]),
    ]
    const { byQuestion, totalPlays } = aggregateCrackquizHeatmap(PERIOD, rows)
    expect(totalPlays).toBe(5)
    expect(byQuestion[q1.id]).toEqual({ plays: 1, correct: 1 })
    expect(byQuestion[q0.id]).toBeUndefined()
  })

  it('invariante: correct nunca supera plays, sea cual sea el parte', () => {
    const evil = [
      row([{ qId: q0.id, selected: q0.correctIndex, correct: true }]),
      row([{ qId: q0.id, selected: 999, correct: true }]),
      row([{ qId: q0.id, correct: true }]),
      row([{ qId: 'x', selected: 0, correct: true }]),
      row('no-array'),
      row([{ qId: q1.id, selected: wrong(q1.correctIndex), correct: true }]),
      row([{ qId: q1.id, selected: q1.correctIndex }]),
    ]
    const { byQuestion } = aggregateCrackquizHeatmap(PERIOD, evil)
    for (const slot of Object.values(byQuestion)) {
      expect(slot.correct).toBeLessThanOrEqual(slot.plays)
      expect(slot.correct).toBeGreaterThanOrEqual(0)
    }
  })
})
