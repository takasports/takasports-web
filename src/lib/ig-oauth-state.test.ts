import { describe, it, expect } from 'vitest'
import {
  generateOAuthState,
  stateMatches,
  readCookie,
  buildStateCookie,
  buildClearStateCookie,
  IG_STATE_COOKIE,
} from './ig-oauth-state'

// ─────────────────────────────────────────────────────────────────────────────
// El `state` es el cerrojo anti-CSRF del OAuth de Instagram: /auth lo siembra en
// una cookie httpOnly y /callback exige que el que devuelve Instagram coincida
// con él antes de canjear el `code`. Sin coincidencia no se conecta la cuenta.
// ─────────────────────────────────────────────────────────────────────────────

describe('generateOAuthState', () => {
  it('devuelve 64 hex chars (32 bytes)', () => {
    expect(generateOAuthState()).toMatch(/^[0-9a-f]{64}$/)
  })
  it('genera valores distintos en llamadas sucesivas', () => {
    expect(generateOAuthState()).not.toBe(generateOAuthState())
  })
})

describe('stateMatches — anti-CSRF', () => {
  it('true solo si cookie y query coinciden exactamente', () => {
    const s = generateOAuthState()
    expect(stateMatches(s, s)).toBe(true)
  })
  it('false si no coinciden', () => {
    expect(stateMatches('a'.repeat(64), 'b'.repeat(64))).toBe(false)
  })
  it('false si falta la cookie (ningún flujo iniciado por admin)', () => {
    expect(stateMatches(null, 'x')).toBe(false)
    expect(stateMatches(undefined, 'x')).toBe(false)
    expect(stateMatches('', 'x')).toBe(false)
  })
  it('false si falta el state de la query', () => {
    expect(stateMatches('x', null)).toBe(false)
    expect(stateMatches('x', undefined)).toBe(false)
    expect(stateMatches('x', '')).toBe(false)
  })
  it('false si difieren en longitud (no revienta timingSafeEqual)', () => {
    expect(stateMatches('abc', 'abcd')).toBe(false)
  })
})

describe('readCookie', () => {
  it('extrae el valor por nombre', () => {
    expect(readCookie('a=1; ig_oauth_state=deadbeef; b=2', IG_STATE_COOKIE)).toBe('deadbeef')
  })
  it('null si no está o el header está vacío', () => {
    expect(readCookie('a=1; b=2', IG_STATE_COOKIE)).toBeNull()
    expect(readCookie(null, IG_STATE_COOKIE)).toBeNull()
    expect(readCookie('', IG_STATE_COOKIE)).toBeNull()
  })
  it('no confunde una cookie con nombre que es prefijo de la buscada', () => {
    expect(readCookie('ig_oauth_state_x=nope; ig_oauth_state=yes', IG_STATE_COOKIE)).toBe('yes')
  })
})

describe('cookies serializadas', () => {
  it('el set incluye HttpOnly, SameSite=Lax, Path acotado y Max-Age', () => {
    const c = buildStateCookie('abc', true)
    expect(c).toContain(`${IG_STATE_COOKIE}=abc`)
    expect(c).toContain('HttpOnly')
    expect(c).toContain('SameSite=Lax')
    expect(c).toContain('Path=/api/instagram')
    expect(c).toContain('Max-Age=600')
    expect(c).toContain('Secure')
  })
  it('sin secure (dev/http) omite Secure para no perder la cookie', () => {
    expect(buildStateCookie('abc', false)).not.toContain('Secure')
  })
  it('el clear caduca la cookie con Max-Age=0', () => {
    expect(buildClearStateCookie(true)).toContain('Max-Age=0')
    expect(buildClearStateCookie(true)).toContain(`${IG_STATE_COOKIE}=;`)
  })
})
