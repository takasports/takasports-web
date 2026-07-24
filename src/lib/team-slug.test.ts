import { describe, it, expect } from 'vitest'
import {
  canonicalTeamSlug,
  isLegacyTeamSlug,
  parseLegacyTeamSlug,
  extractTeamId,
} from './team-slug'

describe('canonicalTeamSlug', () => {
  it('compone nombre + teamId', () => {
    expect(canonicalTeamSlug('Real Madrid', '86')).toBe('real-madrid-86')
    expect(canonicalTeamSlug('Atlético de Madrid', '1068')).toBe('atletico-de-madrid-1068')
    expect(canonicalTeamSlug('Borussia Mönchengladbach', '268')).toBe('borussia-monchengladbach-268')
  })

  it('cae al id pelado si el nombre no aporta slug', () => {
    expect(canonicalTeamSlug('', '86')).toBe('86')
    expect(canonicalTeamSlug(null, '86')).toBe('86')
  })
})

describe('isLegacyTeamSlug', () => {
  it('reconoce el formato histórico por el guion bajo', () => {
    expect(isLegacyTeamSlug('soccer_esp.1_86')).toBe(true)
    expect(isLegacyTeamSlug('basketball_nba_13')).toBe(true)
  })
  it('no confunde el formato nuevo', () => {
    expect(isLegacyTeamSlug('real-madrid-86')).toBe(false)
    expect(isLegacyTeamSlug('86')).toBe(false)
  })
})

describe('parseLegacyTeamSlug', () => {
  it('separa liga e id', () => {
    expect(parseLegacyTeamSlug('soccer_esp.1_86')).toEqual({ teamId: '86', leagueSlug: 'soccer/esp.1' })
    expect(parseLegacyTeamSlug('basketball_nba_13')).toEqual({ teamId: '13', leagueSlug: 'basketball/nba' })
    // Un club en competición europea: su URL legacy también resuelve.
    expect(parseLegacyTeamSlug('soccer_uefa.champions_86')).toEqual({
      teamId: '86',
      leagueSlug: 'soccer/uefa.champions',
    })
  })
  it('rechaza lo que no tiene forma de slug legacy', () => {
    expect(parseLegacyTeamSlug('soccer_esp.1')).toBeNull()
    expect(parseLegacyTeamSlug('soccer_esp.1_abc')).toBeNull()
  })
})

describe('extractTeamId', () => {
  it('saca el id del final del slug nuevo', () => {
    expect(extractTeamId('real-madrid-86')).toBe('86')
    expect(extractTeamId('atletico-de-madrid-1068')).toBe('1068')
  })
  it('acepta un id pelado', () => {
    expect(extractTeamId('86')).toBe('86')
  })
  it('devuelve null si no termina en número', () => {
    expect(extractTeamId('real-madrid')).toBeNull()
  })
  it('se queda con el ÚLTIMO grupo numérico, no con uno del nombre', () => {
    // "Schalke 04" lleva número en el nombre: no debe secuestrar la resolución.
    expect(extractTeamId('schalke-04-124')).toBe('124')
  })
})
