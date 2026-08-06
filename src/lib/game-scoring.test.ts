import { describe, it, expect } from 'vitest'
import {
  CRACKQUIZ,
  SCORE_CAP,
  scoreCrackquizAnswer,
  scoreCrackquizRound,
  scoreMionce,
  scoreSopa,
  scoreTakagrid,
  type CrackquizAnswerOutcome,
} from './game-scoring'

const perfect = (n: number): CrackquizAnswerOutcome[] =>
  Array.from({ length: n }, () => ({ correct: true, secondsLeft: CRACKQUIZ.QUESTION_TIME }))

describe('scoreCrackquizAnswer', () => {
  it('falla → 0 en todos los conceptos', () => {
    expect(scoreCrackquizAnswer(20, false, 4)).toEqual({ total: 0, base: 0, time: 0, streak: 0 })
  })

  it('acierto instantáneo sin racha = base + bonus de tiempo máximo', () => {
    const bd = scoreCrackquizAnswer(CRACKQUIZ.QUESTION_TIME, true, 0)
    expect(bd).toEqual({ total: 15, base: 10, time: 5, streak: 0 })
  })

  it('acierto en el último segundo no da bonus de tiempo', () => {
    expect(scoreCrackquizAnswer(0, true, 0).total).toBe(CRACKQUIZ.BASE_PTS)
  })

  it('el bonus de racha tiene tope', () => {
    expect(scoreCrackquizAnswer(0, true, 99).streak).toBe(CRACKQUIZ.STREAK_BONUS_MAX)
  })

  it('acota valores fuera de dominio (secondsLeft negativo o gigante)', () => {
    expect(scoreCrackquizAnswer(-5, true, 0).time).toBe(0)
    expect(scoreCrackquizAnswer(9999, true, 0).time).toBe(CRACKQUIZ.TIME_BONUS_MAX)
    expect(scoreCrackquizAnswer(0, true, -3).streak).toBe(0)
  })
})

describe('scoreCrackquizRound', () => {
  it('ronda perfecta instantánea = 185 y cabe bajo el techo', () => {
    // 10 × (10 base + 5 rapidez) = 150, más racha 0+1+2+3+4+5+5+5+5+5 = 35.
    const score = scoreCrackquizRound(perfect(CRACKQUIZ.QUESTIONS_PER_ROUND))
    expect(score).toBe(185)
    expect(score).toBeLessThanOrEqual(SCORE_CAP.crackquiz)
  })

  it('ronda perfecta + doble o nada ganado = máximo absoluto, bajo el techo', () => {
    // El combo bancado antes de la final es 0+1+2+3+4+5+5+5+5 = 30.
    const score = scoreCrackquizRound(perfect(CRACKQUIZ.QUESTIONS_PER_ROUND), 'accepted')
    expect(score).toBe(215)
    expect(score).toBeLessThanOrEqual(SCORE_CAP.crackquiz)
  })

  it('ronda en blanco = 0', () => {
    const fails = Array.from({ length: 10 }, () => ({ correct: false, secondsLeft: 0 }))
    expect(scoreCrackquizRound(fails)).toBe(0)
  })

  it('un fallo rompe la racha y reinicia el combo', () => {
    const answers: CrackquizAnswerOutcome[] = [
      { correct: true,  secondsLeft: 0 },   // 10 (streakBefore 0)
      { correct: true,  secondsLeft: 0 },   // 11 (streakBefore 1)
      { correct: false, secondsLeft: 0 },   // 0, racha a cero
      { correct: true,  secondsLeft: 0 },   // 10 (streakBefore 0 otra vez)
    ]
    expect(scoreCrackquizRound(answers)).toBe(31)
  })

  it('doble o nada aceptado duplica el combo bancado si acierta la última', () => {
    // 3 aciertos: bonus de racha 0 + 1 = 1 bancado antes de la final.
    const answers = [
      { correct: true, secondsLeft: 0 },
      { correct: true, secondsLeft: 0 },
      { correct: true, secondsLeft: 0 },
    ]
    const sin = scoreCrackquizRound(answers, 'declined')
    const con = scoreCrackquizRound(answers, 'accepted')
    expect(con - sin).toBe(1)
  })

  it('doble o nada aceptado y fallado resta el combo bancado', () => {
    const answers = [
      { correct: true,  secondsLeft: 0 },
      { correct: true,  secondsLeft: 0 },
      { correct: false, secondsLeft: 0 },
    ]
    // 10 + 11 + 0 - 1 (combo perdido) = 20
    expect(scoreCrackquizRound(answers, 'accepted')).toBe(20)
  })

  it('nunca devuelve negativo aunque el doble o nada supere lo acumulado', () => {
    const answers = [{ correct: false, secondsLeft: 0 }, { correct: false, secondsLeft: 0 }]
    expect(scoreCrackquizRound(answers, 'accepted')).toBe(0)
  })
})

describe('UI en vivo ≡ derivación del servidor', () => {
  // La UI de CrackQuiz suma respuesta a respuesta con scoreCrackquizAnswer y el
  // servidor recalcula la ronda entera con scoreCrackquizRound. Si divergieran,
  // el jugador vería un marcador distinto del que acaba en el ranking. Este test
  // replica el bucle EXACTO de la página y compara con la derivación.
  function simulateUI(answers: readonly CrackquizAnswerOutcome[], don: 'accepted' | 'declined' | null) {
    let score = 0
    let streakBefore = 0
    const logged: number[] = [] // bonus de racha por respuesta (lo que se banca)
    answers.forEach((a, i) => {
      const bd = scoreCrackquizAnswer(a.secondsLeft, a.correct, streakBefore)
      const isFinal = i === answers.length - 1
      const bank = logged.reduce((acc, n) => acc + n, 0)
      const donDelta = isFinal && don === 'accepted' ? (a.correct ? bank : -bank) : 0
      score = Math.max(0, score + bd.total + donDelta)
      logged.push(bd.streak)
      streakBefore = a.correct ? streakBefore + 1 : 0
    })
    return score
  }

  const CASES: CrackquizAnswerOutcome[][] = [
    perfect(10),
    Array.from({ length: 10 }, () => ({ correct: false, secondsLeft: 0 })),
    Array.from({ length: 10 }, (_, i) => ({ correct: i % 2 === 0, secondsLeft: i })),
    Array.from({ length: 10 }, (_, i) => ({ correct: i < 7, secondsLeft: 20 - i })),
    Array.from({ length: 10 }, (_, i) => ({ correct: i !== 9, secondsLeft: 3 })),
  ]

  it.each([null, 'declined', 'accepted'] as const)('coinciden con doble o nada = %s', (don) => {
    for (const answers of CASES) {
      expect(simulateUI(answers, don)).toBe(scoreCrackquizRound(answers, don))
    }
  })
})

describe('scoreTakagrid', () => {
  it('grid perfecto normal y hard', () => {
    expect(scoreTakagrid(9)).toBe(90)
    expect(scoreTakagrid(9, true)).toBe(180)
  })

  it('acota celdas fuera de rango', () => {
    expect(scoreTakagrid(-1)).toBe(0)
    expect(scoreTakagrid(50, true)).toBe(SCORE_CAP.takagrid)
  })
})

describe('scoreSopa', () => {
  it('paga por palabra encontrada', () => {
    expect(scoreSopa(0)).toBe(0)
    expect(scoreSopa(9)).toBe(90)
  })

  it('no supera el techo del juego', () => {
    expect(scoreSopa(999)).toBeLessThanOrEqual(SCORE_CAP.sopacracks)
  })
})

describe('scoreMionce', () => {
  it('paga por jugador válido y topa en 11', () => {
    expect(scoreMionce(0)).toBe(0)
    expect(scoreMionce(11)).toBe(110)
    expect(scoreMionce(30)).toBe(SCORE_CAP.mionce)
  })
})
