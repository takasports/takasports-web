import { describe, it, expect } from 'vitest'
import { storyTitleSize, truncate, displayCompetition } from './og-image'

describe('storyTitleSize', () => {
  it('encoge según crece el titular', () => {
    const corto = storyTitleSize('Xavi agita Holanda')
    const medio = storyTitleSize('Mercedes sanciona a Kimi Antonelli y saldrá último en Monza')
    const largo = storyTitleSize('La oferta del Manchester City por Frenkie de Jong que puede cambiar el mercado del Barcelona')
    expect(corto).toBeGreaterThan(medio)
    expect(medio).toBeGreaterThan(largo)
  })

  it('no baja del tamaño que sigue siendo legible en una historia', () => {
    expect(storyTitleSize('x'.repeat(110))).toBeGreaterThanOrEqual(74)
  })
})

describe('truncate', () => {
  it('deja intacto lo que cabe', () => {
    expect(truncate('corto', 20)).toBe('corto')
  })

  it('corta por PALABRA, no a mitad de una', () => {
    // El bug original dejaba "…tras cambio de motor. Retos y expectativas para la contr…"
    const out = truncate('Kimi Antonelli saldrá último en Monza por sanción de Mercedes tras cambio de motor y sus contratos', 90)
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toMatch(/contr…$/)
    expect(out.length).toBeLessThanOrEqual(90)
  })

  it('no deja el corte colgando de una coma o un punto', () => {
    expect(truncate('uno dos tres, cuatro cinco', 14)).not.toMatch(/[,.]…$/)
  })

  it('cae al corte duro si la palabra no tiene espacios', () => {
    const out = truncate('a'.repeat(50), 20)
    expect(out.length).toBeLessThanOrEqual(20)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('displayCompetition', () => {
  it('pinta la competición cuando aporta', () => {
    expect(displayCompetition('Gran Premio de Italia', 'F1')).toBe('Gran Premio de Italia')
    expect(displayCompetition('LaLiga', 'Fútbol')).toBe('LaLiga')
    expect(displayCompetition('US Open', 'Tenis')).toBe('US Open')
  })

  it('descarta la jerga de calendario que llega de la fuente', () => {
    expect(displayCompetition('Formula 1 2026 Season', 'F1')).toBeNull()
    expect(displayCompetition('Eurocopa qualifiers', 'Fútbol')).toBeNull()
    expect(displayCompetition('Regular Season', 'NBA')).toBeNull()
  })

  it('no repite lo que ya dice la píldora del deporte', () => {
    expect(displayCompetition('Fútbol', 'Fútbol')).toBeNull()
    expect(displayCompetition('NBA Finals', 'NBA')).toBeNull()
  })

  it('descarta lo demasiado largo, que no cabe junto a la píldora', () => {
    expect(displayCompetition('Campeonato Mundial de Clubes de la FIFA', 'Fútbol')).toBeNull()
  })

  it('aguanta vacíos', () => {
    expect(displayCompetition(null, 'F1')).toBeNull()
    expect(displayCompetition('   ', 'F1')).toBeNull()
  })
})
