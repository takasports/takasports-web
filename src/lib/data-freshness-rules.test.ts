import { describe, expect, it } from 'vitest'
import {
  diaSemanaEn, evaluarCalendarioHoy, evaluarNoticiasSemana, evaluarReels,
  FUTBOL_BASE_MIN, NOTICIAS_7D_MIN,
} from './data-freshness-rules'

describe('evaluarCalendarioHoy', () => {
  const sab = 6, mar = 2
  it('sábado con 0 partidos y 80 la semana pasada → avisa', () => {
    expect(evaluarCalendarioHoy({ futbolHoy: 0, futbolSemanaPasada: 80, diaSemana: sab })).toContain('SIN fútbol')
  })
  it('con algún partido no avisa', () => {
    expect(evaluarCalendarioHoy({ futbolHoy: 3, futbolSemanaPasada: 80, diaSemana: sab })).toBeNull()
  })
  it('entre semana no avisa aunque dé 0 (martes sin Champions)', () => {
    expect(evaluarCalendarioHoy({ futbolHoy: 0, futbolSemanaPasada: 26, diaSemana: mar })).toBeNull()
  })
  it('parón de verano (base baja) no avisa', () => {
    expect(evaluarCalendarioHoy({ futbolHoy: 0, futbolSemanaPasada: FUTBOL_BASE_MIN - 1, diaSemana: sab })).toBeNull()
  })
  it('si el calendario no se pudo leer, avisa siempre', () => {
    expect(evaluarCalendarioHoy({ futbolHoy: null, futbolSemanaPasada: 0, diaSemana: mar, error: 'HTTP 500' })).toContain('HTTP 500')
  })
})

describe('evaluarReels', () => {
  const ahora = Date.parse('2026-10-02T10:00:00Z')
  it('reel de hace 10 h → bien', () => {
    expect(evaluarReels({ ultimoReelIso: '2026-10-02T00:00:00Z', ahoraMs: ahora })).toBeNull()
  })
  it('reel de hace 3 días → avisa con las horas', () => {
    expect(evaluarReels({ ultimoReelIso: '2026-09-29T10:00:00Z', ahoraMs: ahora })).toContain('72 h')
  })
  it('sin reels → avisa', () => {
    expect(evaluarReels({ ultimoReelIso: null, ahoraMs: ahora })).toContain('Reels')
  })
})

describe('evaluarNoticiasSemana', () => {
  it('por debajo del mínimo avisa con la cifra', () => {
    expect(evaluarNoticiasSemana({ publicadas7d: 61 })).toContain('61')
  })
  it('en el mínimo o por encima no avisa', () => {
    expect(evaluarNoticiasSemana({ publicadas7d: NOTICIAS_7D_MIN })).toBeNull()
  })
  it('error de Sanity → avisa', () => {
    expect(evaluarNoticiasSemana({ publicadas7d: null, error: 'timeout' })).toContain('timeout')
  })
})

describe('diaSemanaEn', () => {
  it('usa la zona horaria, no UTC', () => {
    // Sábado 23:30 UTC = domingo 01:30 en Madrid (CEST).
    expect(diaSemanaEn(new Date('2026-10-03T23:30:00Z'), 'Europe/Madrid')).toBe(0)
    expect(diaSemanaEn(new Date('2026-10-03T23:30:00Z'), 'UTC')).toBe(6)
  })
})
