import { describe, it, expect } from 'vitest'
import { topNWinners } from './special-badges'
import { badgesEarnedOnSettle } from './badge-awards'

// ─────────────────────────────────────────────────────────────────────────────
// topNWinners — corte del TOP N con empates. Es la parte delicada del badge
// "TOP N del ranking semanal": un off-by-one premiaría de más/de menos, y un
// empate en el puesto de corte debe incluir a TODOS los empatados.
// Asume ranking ya ordenado por puntos descendente.
// ─────────────────────────────────────────────────────────────────────────────

const R = (...pts: number[]) => pts.map((points, i) => ({ user_id: `u${i}`, points }))

describe('topNWinners — corte y empates', () => {
  it('lista vacía → nadie', () => {
    expect(topNWinners([], 3)).toEqual([])
  })
  it('N < 1 → nadie (guarda)', () => {
    expect(topNWinners(R(10, 8, 5), 0)).toEqual([])
  })
  it('menos participantes que N → entran todos', () => {
    expect(topNWinners(R(10), 3)).toEqual(['u0'])
    expect(topNWinners(R(10, 8), 3)).toEqual(['u0', 'u1'])
  })
  it('TOP N exacto sin empates', () => {
    expect(topNWinners(R(10, 8, 5, 3), 2)).toEqual(['u0', 'u1'])
  })
  it('empate EN el puesto de corte → entran ambos (puede superar N)', () => {
    // top 2 con dos jugadores empatados a 8 en el 2º puesto → 3 ganadores
    expect(topNWinners(R(10, 8, 8, 5), 2)).toEqual(['u0', 'u1', 'u2'])
  })
  it('empate POR ENCIMA del corte no infla el resultado', () => {
    expect(topNWinners(R(10, 10, 8, 5), 2)).toEqual(['u0', 'u1'])
  })
  it('todos empatados y N menor → entran todos (no se puede romper el empate)', () => {
    expect(topNWinners(R(5, 5, 5), 1)).toEqual(['u0', 'u1', 'u2'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// badgesEarnedOnSettle — rediseño de first_win y high_roller para la economía
// de PUNTOS (sin apuestas). first_win = primera vez que puntúas (≥1, no depende
// de stake). high_roller ("Gran jornada") = 15+ puntos en una jornada.
// ─────────────────────────────────────────────────────────────────────────────

const baseCtx = {
  hits: 0,
  totalPicks: 5,
  pleno: false,
  totalStake: 0,
  totalWon: 0,
  picksWithOdds: [] as Array<{ won: boolean; odds: number }>,
  prevStreak: 0,
  isFirstBet: false,
  isFirstWin: false,
  exactHits: 0,
}

describe('first_win — primera vez que puntúas', () => {
  it('se otorga con ≥1 punto si es la primera ganancia', () => {
    expect(badgesEarnedOnSettle({ ...baseCtx, isFirstWin: true, totalWon: 1 })).toContain('first_win')
  })
  it('NO se otorga con 0 puntos (sellaste pero no puntuaste)', () => {
    expect(badgesEarnedOnSettle({ ...baseCtx, isFirstWin: true, totalWon: 0 })).not.toContain('first_win')
  })
  it('NO se otorga si ya no es la primera ganancia', () => {
    expect(badgesEarnedOnSettle({ ...baseCtx, isFirstWin: false, totalWon: 8 })).not.toContain('first_win')
  })
  it('no depende del stake (apuestas retiradas): stake>0 no lo bloquea', () => {
    // Antes pedía totalWon > totalStake; ahora solo totalWon > 0.
    expect(badgesEarnedOnSettle({ ...baseCtx, isFirstWin: true, totalWon: 3, totalStake: 100 })).toContain('first_win')
  })
})

describe('high_roller (Gran jornada) — 15+ puntos en una jornada', () => {
  it('se otorga con 15 puntos justos', () => {
    expect(badgesEarnedOnSettle({ ...baseCtx, totalWon: 15 })).toContain('high_roller')
  })
  it('se otorga por encima del umbral', () => {
    expect(badgesEarnedOnSettle({ ...baseCtx, totalWon: 28 })).toContain('high_roller')
  })
  it('NO se otorga justo por debajo (14)', () => {
    expect(badgesEarnedOnSettle({ ...baseCtx, totalWon: 14 })).not.toContain('high_roller')
  })
  it('no necesita apuesta: 15 puntos con stake 0 basta (antes pedía stake≥500)', () => {
    expect(badgesEarnedOnSettle({ ...baseCtx, totalWon: 15, totalStake: 0 })).toContain('high_roller')
  })
})
