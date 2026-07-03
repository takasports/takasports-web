import { describe, it, expect } from 'vitest'
import { buildChallengeToken, parseChallengeToken, buildChallengeUrl } from './porra-challenge'

// ─────────────────────────────────────────────────────────────────────────────
// L50: el token usaba '_' como separador — el MISMO carácter del id real
// 'rl_<hex>' — así que troceaba y corrompía el league id ('rl_1a2b…' →
// 'RL1A2B…'), y el join .eq('id', leagueId) NUNCA casaba → el reto no unía a
// nadie. El separador ahora es '-' y el id se conserva tal cual.
// ─────────────────────────────────────────────────────────────────────────────

describe('porra-challenge — round-trip del league id real', () => {
  it('conserva el id real rl_<hex> intacto (con handle)', () => {
    const parsed = parseChallengeToken(buildChallengeToken('rl_1a2b3c4d5e', 'Álex'))
    expect(parsed?.leagueId).toBe('rl_1a2b3c4d5e')
    expect(parsed?.handle).toBe('alex')
  })

  it('sin handle: el token es solo el id y round-trip lo conserva', () => {
    const token = buildChallengeToken('rl_1a2b3c4d5e', '')
    expect(token).toBe('rl_1a2b3c4d5e')
    expect(parseChallengeToken(token)?.leagueId).toBe('rl_1a2b3c4d5e')
    expect(parseChallengeToken(token)?.handle).toBeNull()
  })

  it('el league id parseado casa con el id de la BD (antes daba mayúsculas sin _)', () => {
    const real = 'rl_deadbeef01'
    expect(parseChallengeToken(buildChallengeToken(real, 'pep'))?.leagueId).toBe(real)
  })

  it('sanea el handle (acentos/símbolos) y no toca el id', () => {
    const parsed = parseChallengeToken(buildChallengeToken('rl_abc', 'José$'))
    expect(parsed?.leagueId).toBe('rl_abc')
    expect(parsed?.handle).toBe('jose')
  })

  it('token nulo/vacío/espacios → null', () => {
    expect(parseChallengeToken(null)).toBeNull()
    expect(parseChallengeToken('')).toBeNull()
    expect(parseChallengeToken('   ')).toBeNull()
  })

  it('la URL de reto lleva el token intacto en ?reto=', () => {
    const token = buildChallengeToken('rl_1a2b3c4d5e', 'alex')
    expect(buildChallengeUrl(token, 'https://x.com')).toBe(
      'https://x.com/predicciones?reto=rl_1a2b3c4d5e-alex',
    )
  })
})
