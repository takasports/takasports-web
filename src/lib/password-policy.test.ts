import { describe, it, expect } from 'vitest'
import { checkPasswordPolicy, passwordErrorMessage } from './password-policy'

const FALLBACK = 'genérico'

describe('checkPasswordPolicy', () => {
  it('acepta una contraseña con minúscula, mayúscula y número', () => {
    expect(checkPasswordPolicy('Taka2026x')).toBeNull()
  })
  it('rechaza las cortas', () => {
    expect(checkPasswordPolicy('Ab1')).toMatch(/8 caracteres/)
  })
  it('rechaza sin mayúscula, sin minúscula o sin número', () => {
    expect(checkPasswordPolicy('takasports1')).toMatch(/mayúscula/)
    expect(checkPasswordPolicy('TAKASPORTS1')).toMatch(/mayúscula/)
    expect(checkPasswordPolicy('TakaSports')).toMatch(/mayúscula/)
  })
})

describe('passwordErrorMessage', () => {
  // Respuestas reales de producción del 11/11/2026 (PUT /user → 422).
  it('caracteres que faltan + filtrada → pide los caracteres primero', () => {
    const err = { name: 'AuthWeakPasswordError', code: 'weak_password', status: 422, reasons: ['characters', 'pwned'],
      message: 'Password should contain at least one character of each: abc..., 0123456789. Password is known to be weak and easy to guess, please choose a different one.' }
    expect(passwordErrorMessage(err, FALLBACK)).toMatch(/mayúscula/)
  })
  it('solo filtrada → dice que es común, NO que el enlace caducó', () => {
    const err = { name: 'AuthWeakPasswordError', code: 'weak_password', status: 422, reasons: ['pwned'],
      message: 'Password is known to be weak and easy to guess, please choose a different one.' }
    const out = passwordErrorMessage(err, FALLBACK)
    expect(out).toMatch(/filtraciones/)
    expect(out).not.toMatch(/caducad/)
  })
  it('sin reasons, por el texto del mensaje', () => {
    expect(passwordErrorMessage({ status: 422, message: 'Password is known to be weak and easy to guess' }, FALLBACK)).toMatch(/filtraciones/)
  })
  it('misma contraseña que la anterior', () => {
    expect(passwordErrorMessage({ code: 'same_password', status: 422, message: 'New password should be different from the old password.' }, FALLBACK)).toMatch(/distinta/)
  })
  it('sin sesión → ahora sí, enlace caducado', () => {
    expect(passwordErrorMessage({ name: 'AuthSessionMissingError', status: 400, message: 'Auth session missing!' }, FALLBACK)).toMatch(/caducado/)
    expect(passwordErrorMessage({ code: 'session_not_found', status: 403, message: 'x' }, FALLBACK)).toMatch(/caducado/)
  })
  it('error desconocido → mensaje genérico', () => {
    expect(passwordErrorMessage({ status: 500, message: 'boom' }, FALLBACK)).toBe(FALLBACK)
  })
})
