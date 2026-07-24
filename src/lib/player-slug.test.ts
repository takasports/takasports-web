import { describe, it, expect } from 'vitest'
import {
  toNameSlug,
  canonicalPlayerSlug,
  isLegacyPlayerSlug,
  parseLegacyPlayerSlug,
  extractEspnId,
} from './player-slug'

describe('toNameSlug', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(toNameSlug('Kylian Mbappé')).toBe('kylian-mbappe')
    expect(toNameSlug('Ousmane Dembélé')).toBe('ousmane-dembele')
    expect(toNameSlug('Íñigo Martínez')).toBe('inigo-martinez')
  })

  it('colapsa signos y espacios en un solo guion, sin guiones colgando', () => {
    expect(toNameSlug("N'Golo Kanté")).toBe('n-golo-kante')
    expect(toNameSlug('  Vinícius   Júnior  ')).toBe('vinicius-junior')
    expect(toNameSlug('Aleksandar Mitrović.')).toBe('aleksandar-mitrovic')
  })

  it('conserva la última letra en nombres eslavos y nórdicos', () => {
    // NFD no descompone đ/ø/ł: sin tratarlas aparte, el slug se comía la letra.
    expect(toNameSlug('Dušan Vlahović')).toBe('dusan-vlahovic')
    expect(toNameSlug('Benjamin Šeško')).toBe('benjamin-sesko')
    expect(toNameSlug('Mateo Kovačić')).toBe('mateo-kovacic')
    expect(toNameSlug('Luka Modrić')).toBe('luka-modric')
    expect(toNameSlug('Josip Đurđević')).toBe('josip-durdevic')
    expect(toNameSlug('Erling Braut Håland')).toBe('erling-braut-haland')
    expect(toNameSlug('Robert Lewandowski')).toBe('robert-lewandowski')
    expect(toNameSlug('Kasper Højlund-Ø')).toBe('kasper-hojlund-o')
  })

  it('nunca emite guion bajo: es lo que distingue el formato legacy', () => {
    expect(toNameSlug('Peter_Crouch')).not.toContain('_')
    expect(toNameSlug('Peter_Crouch')).toBe('peter-crouch')
  })

  it('devuelve cadena vacía si el nombre no deja nada latino', () => {
    expect(toNameSlug('東京')).toBe('')
  })
})

describe('canonicalPlayerSlug', () => {
  it('compone nombre + id', () => {
    expect(canonicalPlayerSlug('Kylian Mbappé', '231388')).toBe('kylian-mbappe-231388')
  })

  it('cae al id pelado si el nombre no aporta slug', () => {
    expect(canonicalPlayerSlug('東京', '99')).toBe('99')
    expect(canonicalPlayerSlug(null, '99')).toBe('99')
    expect(canonicalPlayerSlug(undefined, '99')).toBe('99')
  })

  it('desambigua homónimos por el id, no por el nombre', () => {
    // Los dos Vitinha indexados: PSG y Genoa. Mismo nombre, URLs distintas.
    expect(canonicalPlayerSlug('Vitinha', '288897')).toBe('vitinha-288897')
    expect(canonicalPlayerSlug('Vitinha', '403234')).toBe('vitinha-403234')
  })
})

describe('isLegacyPlayerSlug', () => {
  it('reconoce el formato histórico por el guion bajo', () => {
    expect(isLegacyPlayerSlug('soccer_esp.1_231388')).toBe(true)
    expect(isLegacyPlayerSlug('basketball_nba_1966')).toBe(true)
  })

  it('no confunde el formato nuevo', () => {
    expect(isLegacyPlayerSlug('kylian-mbappe-231388')).toBe(false)
    expect(isLegacyPlayerSlug('231388')).toBe(false)
  })
})

describe('parseLegacyPlayerSlug', () => {
  it('separa liga e id', () => {
    expect(parseLegacyPlayerSlug('soccer_esp.1_231388')).toEqual({
      espnId: '231388',
      leagueSlug: 'soccer/esp.1',
    })
    expect(parseLegacyPlayerSlug('basketball_nba_1966')).toEqual({
      espnId: '1966',
      leagueSlug: 'basketball/nba',
    })
  })

  it('rechaza lo que no tiene forma de slug legacy', () => {
    expect(parseLegacyPlayerSlug('soccer_esp.1')).toBeNull()
    expect(parseLegacyPlayerSlug('soccer_esp.1_abc')).toBeNull()
  })
})

describe('extractEspnId', () => {
  it('saca el id del final del slug nuevo', () => {
    expect(extractEspnId('kylian-mbappe-231388')).toBe('231388')
    expect(extractEspnId('vitinha-403234')).toBe('403234')
  })

  it('acepta un id pelado', () => {
    expect(extractEspnId('231388')).toBe('231388')
  })

  it('devuelve null si no termina en número', () => {
    expect(extractEspnId('kylian-mbappe')).toBeNull()
  })

  it('se queda con el ÚLTIMO grupo numérico, no con uno del nombre', () => {
    // Nombres con dígitos dentro no deben secuestrar la resolución.
    expect(extractEspnId('player-2000-champion-231388')).toBe('231388')
  })
})
