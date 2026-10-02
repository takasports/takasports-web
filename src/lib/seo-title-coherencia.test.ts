import { describe, expect, it } from 'vitest'
import { revisarSeoTitle } from './seo-title-coherencia'

describe('revisarSeoTitle', () => {
  it('caso real Mitchell: cifra que el titular no da', () => {
    expect(revisarSeoTitle(
      'Donovan Mitchell renueva con los Cavs por 273 millones',
      'Donovan Mitchell renueva con Adidas y firma extensión multimillonaria con los Cavs',
    )).toEqual(['cifra-ajena'])
  })

  it('caso real City: comilla abierta por el recorte', () => {
    expect(revisarSeoTitle(
      'Expulsión del Manchester City sería un "desastre comercial',
      'Los ejecutivos de la Premier League advierten que la expulsión del Manchester City sería un "desastre comercial"',
    )).toContain('comillas-sin-cerrar')
  })

  it('habla de otra cosa: sin palabras en común', () => {
    expect(revisarSeoTitle(
      'Alcaraz gana en Pekín y suma su quinto título',
      'El Betis remonta al Sevilla en el derbi',
    )).toContain('sin-palabras-comunes')
  })

  it('cola truncada', () => {
    expect(revisarSeoTitle('Raphinha regresa al Barça tras lesión con', 'Raphinha regresa al Barça tras lesión con Brasil'))
      .toContain('truncado')
    expect(revisarSeoTitle('Raphinha regresa al Barça…', 'Raphinha regresa al Barça tras lesión'))
      .toContain('truncado')
  })

  it('reformulaciones buenas no saltan', () => {
    const buenos: Array<[string, string]> = [
      ['Tim Ream se retira de la Selección de EE. UU.', 'Tim Ream anuncia su retiro de la Selección de Estados Unidos'],
      ["Nico O'Reilly abandona la convocatoria inglesa y vuelve", "Nico O'Reilly abandona la convocatoria inglesa y vuelve al City por lesión"],
      ['Verstappen logra su quinto podio en Monza 2026 de F1', 'Verstappen firma en Monza su quinto podio tras otra lección de garra'],
      ['Portugal asigna "RL7" a Rafael Leão contra Dinamarca', 'Portugal asigna la icónica "RL7" a Rafael Leão para el duelo contra Dinamarca'],
      ['Hellas Verona presenta su nuevo estadio de 30.000 plazas', 'Hellas Verona presenta su nuevo estadio de 30.000 plazas con la mira puesta en la Euro 2032'],
      ['Fichaje de 50 millones: el Madrid cierra a Kerkez', 'El Madrid cierra el fichaje de Kerkez por 50 millones'],
    ]
    for (const [st, h] of buenos) expect(revisarSeoTitle(st, h), st).toEqual([])
  })

  it('vacíos no se marcan', () => {
    expect(revisarSeoTitle('', 'algo')).toEqual([])
  })
})
