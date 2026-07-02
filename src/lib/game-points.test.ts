import { describe, it, expect } from 'vitest'
import { pointsFor, POINTS_ENABLED_GAMES } from './game-points'

// ─────────────────────────────────────────────────────────────────────────────
// Tarifa de puntos por juego (lo que se acredita a la Liga Taka tras un
// record_game_play OK). Escala acordada (dígitos bajos):
//   · CrackQuiz / TakaGrid  — diarios  —  jugar 1 → perfecto 5
//   · Mi Once / Sopa        — semanales — jugar 2 → perfecto 12
//
// Centinelas: floor (solo jugar) y techo (perfecto) exactos + monotonía.
// Mi Once además protege el bug M3 (el cliente manda válidos×10, la tarifa
// razona en válidos 0–11).
// ─────────────────────────────────────────────────────────────────────────────

describe('pointsFor — CrackQuiz (diario · 1 → 5)', () => {
  it('floor: jugar (0 aciertos) = 1', () => {
    expect(pointsFor('crackquiz', 0, { correct: 0, total: 10 })).toBe(1)
  })
  it('techo: 10/10 = 5', () => {
    expect(pointsFor('crackquiz', 150, { correct: 10, total: 10 })).toBe(5)
  })
  it('parcial 6/10 escala dentro de 1..5', () => {
    expect(pointsFor('crackquiz', 90, { correct: 6, total: 10 })).toBe(3) // 1 + round(0.6*4)=1+2
  })
  it('sin payload de aciertos cae al floor', () => {
    expect(pointsFor('crackquiz', 80)).toBe(1)
  })
})

describe('pointsFor — TakaGrid (diario · 1 → 5)', () => {
  it('floor: 0 resueltas = 1', () => {
    expect(pointsFor('takagrid', 0, { solved: new Array(9).fill(false) })).toBe(1)
  })
  it('techo: 9/9 = 5', () => {
    expect(pointsFor('takagrid', 90, { solved: new Array(9).fill(true) })).toBe(5)
  })
  it('parcial 5/9 escala dentro de 1..5', () => {
    const solved = [true, true, true, true, true, false, false, false, false]
    expect(pointsFor('takagrid', 50, { solved })).toBe(3) // 1 + round(5/9*4)=1+2
  })
  it('fallback desde score (sin array): score 90 normal = 9 resueltas = 5', () => {
    expect(pointsFor('takagrid', 90)).toBe(5)
  })
  it('fallback hardMode: score 180 con hardMode = 9 resueltas = 5', () => {
    expect(pointsFor('takagrid', 180, { hardMode: true })).toBe(5)
  })
})

describe('pointsFor — Mi Once (semanal · 2 → 12, escala 0–110 → 0–11)', () => {
  it('floor: 0 válidos (score 0) = 2', () => {
    expect(pointsFor('mionce', 0)).toBe(2)
  })
  it('techo: 11/11 (score 110) = 12', () => {
    expect(pointsFor('mionce', 110)).toBe(12)
  })
  it('no satura: 2 válidos (score 20) NO paga el máximo', () => {
    expect(pointsFor('mionce', 20)).toBe(4) // 2 + round(2/11*10)=2+2
  })
  it('10 válidos (score 100) queda por debajo del techo', () => {
    expect(pointsFor('mionce', 100)).toBe(11) // 2 + round(10/11*10)=2+9
    expect(pointsFor('mionce', 100)).toBeLessThan(pointsFor('mionce', 110))
  })
  it('clamp a 11: score 200 = mismo que 110', () => {
    expect(pointsFor('mionce', 200)).toBe(pointsFor('mionce', 110))
  })
  it('monótona en el rango real 0..110', () => {
    const vals = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110].map(s => pointsFor('mionce', s))
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1])
    expect(vals[0]).toBe(2)
    expect(vals[vals.length - 1]).toBe(12)
  })
})

describe('pointsFor — Sopa de Cracks (semanal · 2 → 12)', () => {
  it('floor: 0 palabras = 2', () => {
    expect(pointsFor('sopacracks', 0, { found: 0, total: 8 })).toBe(2)
  })
  it('techo: completar (8/8) = 12', () => {
    expect(pointsFor('sopacracks', 80, { found: 8, total: 8 })).toBe(12)
  })
  it('techo independiente del nº de palabras (10/10) = 12', () => {
    expect(pointsFor('sopacracks', 100, { found: 10, total: 10 })).toBe(12)
  })
  it('parcial 4/8 escala dentro de 2..12', () => {
    expect(pointsFor('sopacracks', 40, { found: 4, total: 8 })).toBe(7) // 2 + round(0.5*10)=2+5
  })
})

describe('pointsFor — whitelist y guardas', () => {
  it('los 4 minijuegos están habilitados', () => {
    expect(POINTS_ENABLED_GAMES.has('crackquiz')).toBe(true)
    expect(POINTS_ENABLED_GAMES.has('takagrid')).toBe(true)
    expect(POINTS_ENABLED_GAMES.has('mionce')).toBe(true)
    expect(POINTS_ENABLED_GAMES.has('sopacracks')).toBe(true)
  })
  it('quiniela y strikerrush NO acreditan por esta vía', () => {
    expect(POINTS_ENABLED_GAMES.has('quiniela')).toBe(false)
    expect(pointsFor('quiniela', 1000)).toBe(0)
    expect(pointsFor('strikerrush', 50)).toBe(0)
  })
  it('score inválido (negativo / NaN) devuelve 0', () => {
    expect(pointsFor('mionce', -5)).toBe(0)
    expect(pointsFor('mionce', Number.NaN)).toBe(0)
  })
  it('todas las tarifas habilitadas caen en dígitos bajos (≤12)', () => {
    expect(pointsFor('crackquiz', 999, { correct: 10, total: 10 })).toBeLessThanOrEqual(5)
    expect(pointsFor('takagrid', 999, { solved: new Array(9).fill(true) })).toBeLessThanOrEqual(5)
    expect(pointsFor('mionce', 999)).toBeLessThanOrEqual(12)
    expect(pointsFor('sopacracks', 999, { found: 99, total: 10 })).toBeLessThanOrEqual(12)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Payloads MANIPULADOS (defensa en profundidad). El payload viaja del cliente
// sin firmar: correct>total, total gigante, tipos raros, arrays inflados,
// ±Infinity/NaN… La tarifa se calcula sobre valores acotados a cada dominio
// real (GAME_LIMITS) → un parte mentido nunca acredita por encima del techo,
// ni cae por debajo del floor de participar.
// ─────────────────────────────────────────────────────────────────────────────
describe('pointsFor — payloads manipulados no inflan (crackquiz)', () => {
  it('correct > total se recorta a total → nunca > techo 5', () => {
    expect(pointsFor('crackquiz', 0, { correct: 999, total: 10 })).toBe(5)
    expect(pointsFor('crackquiz', 0, { correct: 50, total: 3 })).toBe(5) // correct≤3 → ratio 1
  })
  it('total gigante se recorta a 10 preguntas', () => {
    // total→10, correct→10 → 5 (no se razona sobre 100)
    expect(pointsFor('crackquiz', 0, { correct: 100, total: 100 })).toBe(5)
    expect(pointsFor('crackquiz', 0, { correct: 20, total: 100 })).toBe(5) // 10/10
  })
  it('negativos, NaN, ±Infinity y objetos caen al floor 1', () => {
    expect(pointsFor('crackquiz', 0, { correct: -5, total: 10 })).toBe(1)
    expect(pointsFor('crackquiz', 0, { correct: Number.NaN, total: 10 })).toBe(1)
    expect(pointsFor('crackquiz', 0, { correct: Infinity, total: Infinity })).toBe(1)
    expect(pointsFor('crackquiz', 0, { correct: {}, total: [] })).toBe(1)
  })
  it('strings y arrays numéricos se coaccionan y acotan', () => {
    expect(pointsFor('crackquiz', 0, { correct: '10', total: '10' })).toBe(5)
    expect(pointsFor('crackquiz', 0, { correct: [999], total: [999] })).toBe(5)
  })
})

describe('pointsFor — payloads manipulados no inflan (takagrid)', () => {
  it('array de solved inflado se recorta a 9 celdas → techo 5', () => {
    expect(pointsFor('takagrid', 0, { solved: new Array(100).fill(true) })).toBe(5)
  })
  it('solved numérico gigante o negativo se acota', () => {
    expect(pointsFor('takagrid', 0, { solved: 999 })).toBe(5)
    expect(pointsFor('takagrid', 0, { solved: -5 })).toBe(1)
  })
  it('score inflado sin array no supera el techo (fallback acotado)', () => {
    expect(pointsFor('takagrid', 9999)).toBe(5)
  })
})

describe('pointsFor — payloads manipulados no inflan (mionce)', () => {
  it('score inflado se acota a 11 válidos → techo 12', () => {
    expect(pointsFor('mionce', 99999)).toBe(12)
  })
  it('el payload es irrelevante: solo cuenta el score', () => {
    // aunque el parte declare 999 válidos, con score 0 solo se paga el floor 2
    expect(pointsFor('mionce', 0, { valid: 999, filled: 999 })).toBe(2)
  })
})

describe('pointsFor — payloads manipulados no inflan (sopacracks)', () => {
  it('found > total se recorta a total → techo 12', () => {
    expect(pointsFor('sopacracks', 0, { found: 999, total: 8 })).toBe(12)
  })
  it('total por encima de 14 palabras se recorta', () => {
    expect(pointsFor('sopacracks', 0, { found: 20, total: 20 })).toBe(12) // 14/14
  })
  it('negativos y tipos raros caen al floor 2 / se coaccionan', () => {
    expect(pointsFor('sopacracks', 0, { found: -3, total: 8 })).toBe(2)
    expect(pointsFor('sopacracks', 0, { found: '8', total: '8' })).toBe(12)
    expect(pointsFor('sopacracks', 0, { found: Infinity, total: Infinity })).toBe(2)
  })
})

describe('pointsFor — barrido adversarial: resultado siempre en rango e int', () => {
  const evil: Array<Record<string, unknown>> = [
    { correct: 1e9, total: 1e9 }, { correct: -1, total: -1 }, { correct: '99', total: '2' },
    { solved: new Array(999).fill(true) }, { solved: -50 }, { solved: 'x' }, { solved: [1, 1, 1] },
    { found: 9e9, total: 1 }, { found: -9, total: 9e9 }, { total: {}, found: [] },
    { correct: Infinity }, { total: Number.NaN }, {}, { garbage: true },
  ]
  const bounds: Record<string, [number, number]> = {
    crackquiz: [1, 5], takagrid: [1, 5], mionce: [2, 12], sopacracks: [2, 12],
  }
  for (const game of ['crackquiz', 'takagrid', 'mionce', 'sopacracks'] as const) {
    it(`${game}: cualquier payload malicioso (score válido) → [${bounds[game][0]}..${bounds[game][1]}] entero`, () => {
      for (const score of [0, 50, 110, 180, 9999]) {
        for (const payload of evil) {
          const pts = pointsFor(game, score, payload)
          expect(Number.isInteger(pts)).toBe(true)
          expect(pts).toBeGreaterThanOrEqual(bounds[game][0])
          expect(pts).toBeLessThanOrEqual(bounds[game][1])
        }
      }
    })
  }
})
