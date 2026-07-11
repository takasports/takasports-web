import { describe, it, expect } from 'vitest'
import { userProgressFrom } from './user-progress'

describe('userProgressFrom', () => {
  it('usuario sin puntos ni insignias → XP 0, nivel 1 (Novato)', () => {
    const p = userProgressFrom([], [])
    expect(p.lifetimePts).toBe(0)
    expect(p.badgesCount).toBe(0)
    expect(p.xp).toBe(0)
    expect(p.level.current.level).toBe(1)
  })

  it('XP = suma de puntos del ledger', () => {
    const p = userProgressFrom([100, 250, 50], [])
    expect(p.lifetimePts).toBe(400)
    expect(p.xp).toBe(400)
    // Curva F4·T5: L3 Pronosticador = 300..700 → 400 cae en L3.
    expect(p.level.current.level).toBe(3)
    expect(p.level.current.name).toBe('Pronosticador')
  })

  it('las insignias se cuentan pero NO suman XP aparte (su +50 ya está en el ledger)', () => {
    // Los puntos de insignia entran al ledger como source=badge; aquí llegan
    // ya sumados en ptAmounts. badgeIds solo aporta el conteo informativo.
    const p = userProgressFrom([150], ['pleno_jornada', 'sp_semana_1'])
    expect(p.badgesCount).toBe(2)
    expect(p.xp).toBe(150)                 // NO 150 + bonus por insignia
    expect(p.level.current.level).toBe(2)  // 100..300 → Aficionado
    expect(p.level.current.name).toBe('Aficionado')
  })

  it('cuenta insignias DISTINTAS (deduplica ids repetidos)', () => {
    const p = userProgressFrom([], ['a', 'a', 'b'])
    expect(p.badgesCount).toBe(2)
    expect(p.xp).toBe(0)                    // sin puntos → XP 0 (insignias no suman aquí)
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
    // 2040 pts → curva F4·T5 L5 Experto (1500..3000).
    expect(a.xp).toBe(2040)
    expect(a.level.current.level).toBe(5)
    expect(a.level.current.name).toBe('Experto')
  })
})
