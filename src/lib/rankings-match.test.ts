import { describe, it, expect } from 'vitest'
import { entryMentioned } from './rankings-match'

// El texto que llega aquí ya viene sin acentos (deaccent) pero CON mayúsculas.
const de = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const hit = (texto: string, entry: string, needle = entry) =>
  entryMentioned(de(texto), entry, needle)

describe('entryMentioned', () => {
  it('acepta el nombre completo', () => {
    expect(hit('Lamine Yamal marcó dos goles', 'Lamine Yamal')).toBe(true)
  })

  it('acepta el apellido suelto tras una palabra corriente', () => {
    expect(hit('el Barça de Yamal volvió a ganar', 'Lamine Yamal', 'Yamal')).toBe(true)
  })

  it('acepta el apellido al principio del texto', () => {
    expect(hit('Yamal fue decisivo', 'Lamine Yamal', 'Yamal')).toBe(true)
  })

  it('rechaza el apellido de un homónimo', () => {
    // Caso real: la nota hablaba de Raquel Rodríguez (WWE) y se colaba la
    // ficha de Arón Rodríguez (fútbol), incluso con un "de Rodríguez" suelto.
    const texto = 'Vaquer derribó a Raquel Rodríguez y a Roxanne Perez, con un powerbomb de Rodríguez para rematar'
    expect(hit(texto, 'Arón Rodríguez', 'Rodríguez')).toBe(false)
  })

  it('acepta a la persona correcta aunque el texto cite también a un homónimo', () => {
    const texto = 'Raquel Rodríguez atacó primero; después llegó Arón Rodríguez'
    expect(hit(texto, 'Arón Rodríguez', 'Rodríguez')).toBe(true)
  })

  it('rechaza un nombre de una sola palabra que forma parte de otro nombre propio', () => {
    // "Mercedes Moné" (luchadora) no debe activar la ficha de Mercedes (F1).
    expect(hit('lo perdió ante Mercedes Moné aquel verano', 'Mercedes')).toBe(false)
    expect(hit('Mercedes dominó la clasificación', 'Mercedes')).toBe(true)
  })

  it('no confunde palabras que solo comparten prefijo', () => {
    expect(hit('habló de Rodriguezalgo', 'Arón Rodríguez', 'Rodríguez')).toBe(false)
  })

  it('ignora la palabra corriente en minúscula, no la entidad', () => {
    // El club Como 1907 no debe activarse con cualquier "como" de una frase.
    expect(hit('la abrazó como un padre a una hija', 'Como')).toBe(false)
    expect(hit('el Como remontó en Milán', 'Como')).toBe(true)
  })

  it('no cuela un club femenino en un texto que solo dice "femenino"', () => {
    // Este caso lo cubre STOPWORDS (el último token no es candidato), pero
    // el nombre completo tampoco debe aparecer.
    expect(hit('la división femenina de RAW', 'FC Barcelona Femenino')).toBe(false)
  })
})
