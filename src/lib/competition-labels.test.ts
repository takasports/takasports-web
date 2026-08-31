import { describe, it, expect } from 'vitest'
import { competitionLabel, limpiarEtiquetaEspn, COMPETITION_LABELS } from './competition-labels'

describe('competitionLabel', () => {
  it('usa nuestro nombre cuando lo tenemos', () => {
    expect(competitionLabel('soccer/esp.1')).toBe('LaLiga')
    expect(competitionLabel('soccer/usa.1', 'Major League Soccer')).toBe('MLS')
  })

  it('arregla la errata que motivó esto', () => {
    // La ficha de Altin Gjokaj se titulaba "UEFA Europa League Qualfiying" (sic)
    // y ese título se indexa. Con el slug mapeado ya ni llega a usarse el de ESPN.
    expect(competitionLabel('soccer/uefa.europa_qual')).toBe('Previa de Europa League')
  })

  it('si un slug de previa se nos escapa, al menos no repite la errata', () => {
    expect(competitionLabel('soccer/otra.cosa_qual', 'Some League Qualfiying'))
      .toBe('Some League Qualifying')
  })

  it('cae al nombre de ESPN cuando no conocemos el slug', () => {
    expect(competitionLabel('soccer/xyz.9', 'Liga Desconocida')).toBe('Liga Desconocida')
  })

  it('nunca devuelve vacío: sin nombre de ESPN, el slug', () => {
    expect(competitionLabel('soccer/xyz.9')).toBe('soccer/xyz.9')
    expect(competitionLabel('soccer/xyz.9', '   ')).toBe('soccer/xyz.9')
  })

  it('aguanta slug nulo sin romper', () => {
    expect(competitionLabel(null)).toBe('')
    expect(competitionLabel(undefined, 'Copa Algo')).toBe('Copa Algo')
  })
})

describe('limpiarEtiquetaEspn', () => {
  it('corrige Qualfiying en cualquier posición y capitalización', () => {
    expect(limpiarEtiquetaEspn('UEFA Europa League Qualfiying')).toBe('UEFA Europa League Qualifying')
    expect(limpiarEtiquetaEspn('qualfiying round')).toBe('Qualifying round')
  })

  it('normaliza espacios sobrantes', () => {
    expect(limpiarEtiquetaEspn('  Serie   A  ')).toBe('Serie A')
  })

  it('deja en paz lo que ya está bien', () => {
    expect(limpiarEtiquetaEspn('Copa del Rey')).toBe('Copa del Rey')
  })
})

describe('COMPETITION_LABELS', () => {
  it('cubre las ligas con más fichas publicadas', () => {
    // Los diez slugs con más jugadores con foto, consultados el 31/08/2026.
    for (const s of ['soccer/usa.1', 'soccer/eng.fa', 'soccer/eng.1', 'soccer/eng.2',
                     'soccer/ned.1', 'soccer/uefa.europa', 'soccer/ita.1', 'soccer/fra.1',
                     'soccer/tur.1', 'soccer/esp.1'])
      expect(COMPETITION_LABELS[s], `falta ${s}`).toBeTruthy()
  })

  it('no deja ningún nombre vacío ni con espacios de sobra', () => {
    for (const [slug, nombre] of Object.entries(COMPETITION_LABELS)) {
      expect(nombre.trim(), slug).toBe(nombre)
      expect(nombre.length, slug).toBeGreaterThan(1)
    }
  })

  it('ningún nombre arrastra una errata conocida de ESPN', () => {
    for (const [slug, nombre] of Object.entries(COMPETITION_LABELS))
      expect(limpiarEtiquetaEspn(nombre), slug).toBe(nombre)
  })
})
