import { describe, it, expect } from 'vitest'
import { coberturaGa4, textoCobertura } from './analytics-coverage'

describe('coberturaGa4', () => {
  it('el TECHO compara todo GA4 con los clics: no puede ser mayor que eso', () => {
    const c = coberturaGa4(672, 29, 1308)
    expect(c.techo).toBeCloseTo(672 / 1308, 4)
  })

  it('la estimación estricta usa solo el orgánico y sale peor', () => {
    const c = coberturaGa4(672, 29, 1308)
    expect(c.ga4Organico).toBe(195)
    expect(c.estricta!).toBeLessThan(c.techo!)
  })

  it('el caso real medido el 31/08/2026: ni la cifra que le favorece llega a dos tercios', () => {
    const c = coberturaGa4(672, 29, 1308)
    expect(c.fiable).toBe(true)
    expect(c.techo!).toBeLessThan(0.66)
  })

  it('sin dato de orgánico no inventa la estricta', () => {
    const c = coberturaGa4(672, null, 1308)
    expect(c.ga4Organico).toBeNull()
    expect(c.estricta).toBeNull()
    expect(c.techo).not.toBeNull()
  })

  it('con pocos clics no se pronuncia en vez de inventar un número', () => {
    const c = coberturaGa4(5, 30, 12)
    expect(c.fiable).toBe(false)
    expect(c.techo).toBeNull()
  })

  it('aguanta nulos sin romper el panel', () => {
    expect(coberturaGa4(null, null, null).fiable).toBe(false)
    expect(coberturaGa4(undefined, undefined, undefined).techo).toBeNull()
  })
})

describe('textoCobertura', () => {
  it('dice "como mucho" y reconoce que la cifra favorece a GA4', () => {
    const t = textoCobertura(coberturaGa4(672, 29, 1308))
    expect(t).toMatch(/COMO MUCHO/)
    expect(t).toMatch(/le favorece/)
    expect(t).toMatch(/cookies/)
  })

  it('añade la estricta solo cuando es peor que el techo', () => {
    expect(textoCobertura(coberturaGa4(672, 29, 1308))).toMatch(/bajaría al/)
    expect(textoCobertura(coberturaGa4(672, null, 1308))).not.toMatch(/bajaría al/)
  })

  it('sin datos no afirma nada', () => {
    expect(textoCobertura(coberturaGa4(1, 30, 2))).toMatch(/Sin datos suficientes/)
  })

  it('si GA4 lo viera todo, lo dice sin alarmar', () => {
    expect(textoCobertura(coberturaGa4(2000, 100, 500))).toMatch(/prácticamente todas/)
  })
})
