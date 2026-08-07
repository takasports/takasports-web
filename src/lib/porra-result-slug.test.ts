import { describe, it, expect } from 'vitest'
import {
  jornadaToSlug,
  formatJornadaFromSlug,
  buildResultSlug,
  parseResultSlug,
} from './porra-result-slug'

describe('slug de resultado compartible', () => {
  it('sobrevive la ida y vuelta de una Fecha', () => {
    const slug = buildResultSlug('sábado 22 ago', 5, 6, 21)
    expect(slug).toBe('sabado-22-ago-h5-t6-w21')
    expect(parseResultSlug(slug)).toEqual({
      jornadaSlug: 'sabado-22-ago',
      hits: 5,
      total: 6,
      totalWon: 21,
    })
  })

  it('devuelve la tilde a los días que el slug tuvo que quitar', () => {
    // Esta etiqueta se imprime en la imagen de OpenGraph que se comparte por
    // WhatsApp: "SABADO 22 AGO" en una tarjeta de marketing canta.
    expect(formatJornadaFromSlug('sabado-22-ago')).toBe('Sábado 22 Ago')
    expect(formatJornadaFromSlug('miercoles-12-ago')).toBe('Miércoles 12 Ago')
  })

  it('deja intactos los días que no llevan tilde', () => {
    expect(formatJornadaFromSlug('lunes-3-nov')).toBe('Lunes 3 Nov')
    expect(formatJornadaFromSlug('hoy')).toBe('Hoy')
  })

  it('rechaza un slug con formato ajeno', () => {
    expect(parseResultSlug('cualquier-cosa')).toBeNull()
    expect(parseResultSlug('')).toBeNull()
  })

  it('acota los números para que nadie invente un resultado por URL', () => {
    const slug = buildResultSlug('hoy', -3, 999999, 42.9)
    expect(parseResultSlug(slug)).toEqual({
      jornadaSlug: 'hoy',
      hits: 0,
      total: 9999,
      totalWon: 42,
    })
  })

  it('normaliza etiquetas con puntuación', () => {
    expect(jornadaToSlug('Mundial · Fase de grupos · 14 jun')).toBe('mundial-fase-de-grupos-14-jun')
  })
})
