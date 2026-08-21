import { describe, it, expect } from 'vitest'
import { matchStakes, standingLabel } from './match-stakes'
import type { TeamStanding } from './types'

const st = (rank: number, pts = 40, zone?: string, of = 20): TeamStanding => ({ rank, pts, zone, of })

describe('matchStakes', () => {
  it('sin datos de tabla no inventa motivo', () => {
    expect(matchStakes(undefined, undefined)).toBeNull()
    expect(matchStakes(st(1), undefined)).toBeNull()
    expect(matchStakes(undefined, st(2))).toBeNull()
  })

  it('1º vs 2º es el cartel máximo, en cualquier orden', () => {
    expect(matchStakes(st(1), st(2))).toEqual({ label: 'Líder vs 2º', tone: 'alta' })
    expect(matchStakes(st(2), st(1))).toEqual({ label: 'Líder vs 2º', tone: 'alta' })
  })

  it('el líder contra otro del top 4 nombra el puesto del rival', () => {
    expect(matchStakes(st(1), st(4))).toEqual({ label: 'Líder vs 4º', tone: 'alta' })
    expect(matchStakes(st(3), st(1))).toEqual({ label: 'Líder vs 3º', tone: 'alta' })
  })

  it('dos del top 4 sin el líder es duelo de cabeza', () => {
    expect(matchStakes(st(2), st(4))).toEqual({ label: 'Duelo de cabeza', tone: 'alta' })
  })

  it('el líder contra un equipo de media tabla no es duelo de cabeza', () => {
    expect(matchStakes(st(1), st(12))).toBeNull()
  })

  it('ambos en zona continental → puestos europeos', () => {
    expect(matchStakes(st(5, 30, 'europa'), st(7, 28, 'conference'))).toEqual({
      label: 'Puestos europeos',
      tone: 'media',
    })
  })

  it('la zona continental no pisa al duelo de cabeza (top 4 gana)', () => {
    expect(matchStakes(st(2, 50, 'champions'), st(3, 48, 'champions'))).toEqual({
      label: 'Duelo de cabeza',
      tone: 'alta',
    })
  })

  it('ambos en descenso → duelo de descenso', () => {
    expect(matchStakes(st(18, 12, 'relegation'), st(19, 10, 'relegation'))).toEqual({
      label: 'Duelo de descenso',
      tone: 'media',
    })
    expect(matchStakes(st(16, 14, 'relegation_playoff'), st(18, 11, 'relegation'))).toEqual({
      label: 'Duelo de descenso',
      tone: 'media',
    })
  })

  it('uno en descenso y otro a salvo no es duelo de descenso', () => {
    expect(matchStakes(st(18, 12, 'relegation'), st(9, 30))).toBeNull()
  })

  it('sin zonas, dos colistas se detectan por el tamaño de la tabla', () => {
    // Tabla de 20: los puestos 17-20 son la franja baja.
    expect(matchStakes(st(18, 12, undefined, 20), st(20, 8, undefined, 20))).toEqual({
      label: 'Duelo de descenso',
      tone: 'media',
    })
    // 15 no entra (no es franja baja de una tabla de 20).
    expect(matchStakes(st(15, 20, undefined, 20), st(18, 12, undefined, 20))).toBeNull()
  })

  it('no aplica la heurística de tamaño en tablas diminutas (grupos)', () => {
    expect(matchStakes(st(6, 2, undefined, 6), st(5, 3, undefined, 6))).toBeNull()
  })
})

describe('standingLabel', () => {
  it('formatea puesto y puntos', () => {
    expect(standingLabel(st(4, 38))).toBe('4º · 38 pts')
  })
  it('sin clasificación devuelve null', () => {
    expect(standingLabel(undefined)).toBeNull()
  })
})
