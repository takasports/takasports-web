import { describe, it, expect } from 'vitest'
import { userProgressFrom } from './user-progress'
import { XP_PER_BADGE } from './levels'

describe('userProgressFrom', () => {
  it('usuario sin puntos ni insignias → XP 0, nivel 1 (Novato)', () => {
    const p = userProgressFrom([], [])
    expect(p.lifetimePts).toBe(0)
    expect(p.badgesCount).toBe(0)
    expect(p.xp).toBe(0)
    expect(p.level.current.level).toBe(1)
  })

  it('suma solo los puntos del ledger cuando no hay insignias', () => {
    const p = userProgressFrom([100, 250, 50], [])
    expect(p.lifetimePts).toBe(400)
    expect(p.xp).toBe(400)
    expect(p.level.current.level).toBe(1) // 400 < 500 → sigue en L1
  })

  it('cada insignia suma XP_PER_BADGE y puede subir de nivel', () => {
    // 100 pts + 2 insignias (200 c/u) = 500 XP → L2 Aficionado.
    const p = userProgressFrom([100], ['pleno_jornada', 'sp_semana_1'])
    expect(p.badgesCount).toBe(2)
    expect(p.xp).toBe(100 + 2 * XP_PER_BADGE)
    expect(p.xp).toBe(500)
    expect(p.level.current.level).toBe(2)
    expect(p.level.current.name).toBe('Aficionado')
  })

  it('cuenta insignias DISTINTAS (deduplica ids repetidos)', () => {
    const p = userProgressFrom([], ['a', 'a', 'b'])
    expect(p.badgesCount).toBe(2)
    expect(p.xp).toBe(2 * XP_PER_BADGE)
  })

  it('ignora importes nulos/indefinidos sin romper la suma', () => {
    const p = userProgressFrom([100, undefined as unknown as number, 50], [])
    expect(p.lifetimePts).toBe(150)
    expect(p.xp).toBe(150)
  })

  it('la placa y el perfil, con los MISMOS datos, dan el mismo nivel', () => {
    const pts = [1200, 800, 40]
    const badges = ['b1', 'b2', 'b3']
    const a = userProgressFrom(pts, badges)
    const b = userProgressFrom(pts, badges)
    expect(a.xp).toBe(b.xp)
    expect(a.level.current.level).toBe(b.level.current.level)
    // 2040 pts + 600 = 2640 XP → L3 Pronosticador (1500..3500)
    expect(a.xp).toBe(2640)
    expect(a.level.current.level).toBe(3)
  })
})
