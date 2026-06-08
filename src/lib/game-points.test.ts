import { describe, it, expect } from 'vitest'
import { pointsFor, POINTS_ENABLED_GAMES } from './game-points'

// ─────────────────────────────────────────────────────────────────────────────
// Tarifa de puntos por juego (lo que se acredita tras un record_game_play OK).
//
// Centinela del bug M3: el cliente de Mi Once manda score = válidos × 10
// (0–110, mismo valor que va al ranking), pero la tarifa razona en válidos
// (0–11). Si no se normaliza, `perf` satura con 2 jugadores y "perfecto"
// salta sin el 11/11 real. Estos tests fijan la escala correcta y protegen
// las ramas de crackquiz/sopa de regresiones.
// ─────────────────────────────────────────────────────────────────────────────

describe('pointsFor — Mi Once (escala 0–110 normalizada a 0–11)', () => {
  it('no satura: 2 válidos (score 20) NO paga el máximo', () => {
    // base 10 + perf 2*2=4 = 14, NO 47
    expect(pointsFor('mionce', 20)).toBe(14)
  })

  it('0 válidos (score 0) = solo base', () => {
    expect(pointsFor('mionce', 0)).toBe(10)
  })

  it('1 válido (score 10) escala lineal', () => {
    expect(pointsFor('mionce', 10)).toBe(12) // 10 + 1*2
  })

  it('10 válidos (score 100): sin bonus de perfecto', () => {
    expect(pointsFor('mionce', 100)).toBe(30) // 10 + 10*2, perfecto=0
  })

  it('11/11 (score 110) = máximo real con perfecto', () => {
    expect(pointsFor('mionce', 110)).toBe(47) // 10 + 11*2 + 15
  })

  it('"perfecto" (+15) solo salta en 11/11, no antes', () => {
    expect(pointsFor('mionce', 100)).toBeLessThan(pointsFor('mionce', 110))
    // 105 nunca ocurre (score es múltiplo de 10), pero el clamp lo cubre:
    expect(pointsFor('mionce', 110)).toBe(pointsFor('mionce', 200)) // clamp a 11
  })

  it('la escala es monótona en el rango real 0..110', () => {
    const vals = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110].map(s => pointsFor('mionce', s))
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1])
  })
})

describe('pointsFor — CrackQuiz (regresión)', () => {
  it('partida perfecta con combo', () => {
    // base 5 + floor(100/10)=10 + combo 5 + perfecto 10 = 30
    expect(pointsFor('crackquiz', 100, { combo: 5, total: 10, correct: 10 })).toBe(30)
  })
  it('partida parcial sin combo ni perfecto', () => {
    // base 5 + floor(60/10)=6 = 11
    expect(pointsFor('crackquiz', 60, { combo: 3, total: 10, correct: 6 })).toBe(11)
  })
})

describe('pointsFor — Sopa de Cracks (regresión)', () => {
  it('completar sin extras', () => {
    expect(pointsFor('sopacracks', 80)).toBe(18) // base 10 + floor(80/10)=8
  })
  it('con intruso + contrarreloj', () => {
    expect(pointsFor('sopacracks', 100, { intruder: true, timeAttack: true })).toBe(35) // 10 + 10 + 10 + 5
  })
})

describe('pointsFor — whitelist y guardas', () => {
  it('juegos fuera de la whitelist devuelven 0', () => {
    expect(POINTS_ENABLED_GAMES.has('takagrid')).toBe(false)
    expect(pointsFor('takagrid', 180)).toBe(0)
    expect(pointsFor('quiniela', 1000)).toBe(0)
    expect(pointsFor('strikerrush', 50)).toBe(0)
  })
  it('score inválido (negativo / NaN) devuelve 0', () => {
    expect(pointsFor('mionce', -5)).toBe(0)
    expect(pointsFor('mionce', Number.NaN)).toBe(0)
  })
})
