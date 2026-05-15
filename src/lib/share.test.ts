import { describe, it, expect } from 'vitest'
import { buildShareResult } from './share'
import type { GamePlay } from './games-store'

function play(partial: Partial<GamePlay> & Pick<GamePlay, 'game_id' | 'period'>): GamePlay {
  return {
    score:       partial.score ?? 0,
    payload:     partial.payload ?? {},
    duration_ms: partial.duration_ms ?? null,
    ...partial,
  } as GamePlay
}

describe('buildShareResult', () => {
  it('Quiniela: counts hits and renders emoji string', () => {
    const r = buildShareResult(play({
      game_id: 'quiniela', period: '2026-J38', score: 7,
      payload: { picks: ['1','X','2','1','X'], results: ['1','X','1','1',null] },
    }))
    expect(r.text).toContain('Taka Quiniela 2026-J38')
    expect(r.text).toContain('3/5')
    expect(r.text).toContain('✅✅❌✅⚪')
    expect(r.url).toBe('https://takasportsmedia.com/quiniela')
  })

  it('TakaGrid: 3x3 layout with mixed cells', () => {
    const solved = [true, true, false, true, false, false, true, true, true]
    const r = buildShareResult(play({
      game_id: 'takagrid', period: '2026-05-15', score: 6,
      payload: { solved },
    }))
    expect(r.text).toContain('6/9')
    // Three lines of 3 cells (rendered)
    const lines = r.text.split('\n')
    expect(lines.some(l => l === '✅✅❌')).toBe(true)
    expect(lines.some(l => l === '✅✅✅')).toBe(true)
  })

  it('CrackQuiz: includes streak when present', () => {
    const r = buildShareResult(play({
      game_id: 'crackquiz', period: '2026-05-15', score: 90,
      payload: { correct: 9, total: 10, streak: 5 },
    }))
    expect(r.text).toContain('9/10')
    expect(r.text).toContain('🔥 racha 5')
  })

  it('Sopa: formats elapsed time', () => {
    const r = buildShareResult(play({
      game_id: 'sopacracks', period: '2026-W20', score: 80,
      payload: { found: 8, total: 10, seconds: 125 },
    }))
    expect(r.text).toContain('8/10')
    expect(r.text).toContain('2m 05s')
  })

  it('Mi Once: formation and captain optional', () => {
    const r = buildShareResult(play({
      game_id: 'mionce', period: '2026-W20', score: 11,
      payload: { formation: '4-3-3', filled: 11, captain: 'Vinícius' },
    }))
    expect(r.text).toContain('4-3-3')
    expect(r.text).toContain('11/11')
    expect(r.text).toContain('© Vinícius')
  })

  it('falls back gracefully if payload shape is unknown', () => {
    const r = buildShareResult(play({
      game_id: 'quiniela', period: '2026-J38', score: 50,
      payload: { foo: 'bar' },
    }))
    expect(r.text).toContain('Taka Quiniela')
    // 0/0 acceptable — defensive fallback
    expect(r.url).toContain('takasportsmedia.com')
  })
})
