import { describe, expect, it } from 'vitest'
import { buildDaily } from './push-juegos'

const DAY = 86_400_000

describe('buildDaily', () => {
  it('devuelve UN solo aviso, todos los días de la semana', () => {
    const lunes = Date.parse('2026-10-05T09:00:00Z')
    for (let i = 0; i < 14; i++) {
      const m = buildDaily(lunes + i * DAY)
      expect(m.title && m.body && m.url && m.tag).toBeTruthy()
    }
  })

  it('el lunes es la novedad semanal (Sopa o Mi Once)', () => {
    for (const d of ['2026-10-05', '2026-10-12', '2026-10-19']) {
      expect(['/sopa-cracks', '/mionce']).toContain(buildDaily(Date.parse(`${d}T09:00:00Z`)).url)
    }
    // Se turnan de una semana a la siguiente.
    const a = buildDaily(Date.parse('2026-10-05T09:00:00Z')).url
    const b = buildDaily(Date.parse('2026-10-12T09:00:00Z')).url
    expect(a).not.toBe(b)
  })

  it('el resto de días alterna CrackQuiz y TakaGrid', () => {
    const mar = buildDaily(Date.parse('2026-10-06T09:00:00Z')).url
    const mie = buildDaily(Date.parse('2026-10-07T09:00:00Z')).url
    expect(['/crackquiz', '/takagrid']).toContain(mar)
    expect(['/crackquiz', '/takagrid']).toContain(mie)
    expect(mar).not.toBe(mie)
  })

  it('sin la prueba social inventada', () => {
    for (let i = 0; i < 60; i++) {
      expect(buildDaily(Date.parse('2026-10-01T09:00:00Z') + i * DAY).body).not.toMatch(/jugaron ayer|ya están dentro/)
    }
  })
})
