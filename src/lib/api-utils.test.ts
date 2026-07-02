import { describe, it, expect } from 'vitest'
import { sanitizeNickname } from './api-utils'

const CTRL = String.fromCharCode(0) + String.fromCharCode(7) + String.fromCharCode(27) + String.fromCharCode(127)

describe('sanitizeNickname', () => {
  it('quita los ángulos < > (defensa anti-inyección)', () => {
    expect(sanitizeNickname('<script>Bob</script>')).toBe('scriptBob/script')
    expect(sanitizeNickname('a<b>c')).toBe('abc')
  })
  it('quita caracteres de control (C0 + DEL)', () => {
    expect(sanitizeNickname('Ana' + CTRL + 'B')).toBe('AnaB')
  })
  it('colapsa espacios/saltos de línea y recorta', () => {
    expect(sanitizeNickname('  Juan   Pérez \n')).toBe('Juan Pérez')
    expect(sanitizeNickname('a\nb\tc')).toBe('a b c')
  })
  it('conserva acentos, dígitos, guiones y emoji', () => {
    expect(sanitizeNickname('Núñez_23 ⚽')).toBe('Núñez_23 ⚽')
  })
  it('limita a max caracteres (24 por defecto)', () => {
    expect(sanitizeNickname('a'.repeat(50)).length).toBe(24)
    expect(sanitizeNickname('abcdef', 3)).toBe('abc')
  })
  it('devuelve "" cuando no queda nada usable (el caller pone el fallback)', () => {
    expect(sanitizeNickname('<<<>>>')).toBe('')
    expect(sanitizeNickname('   ')).toBe('')
    expect(sanitizeNickname(null)).toBe('')
    expect(sanitizeNickname(undefined)).toBe('')
    expect(sanitizeNickname(123 as unknown)).toBe('123') // coacciona a string
  })
})
