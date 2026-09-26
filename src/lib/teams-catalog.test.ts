// El catálogo de equipos no se puede creer por número.
//
// 26/09/2026: 31 de sus 95 entradas tenían el `espnId` de OTRO equipo. El
// directo busca primero por número, así que Osasuna salía con las siglas y los
// colores de la Real Sociedad, Lazio con los de Fiorentina, Leverkusen con los
// de Hoffenheim… Y ESPN reutiliza números entre clubes y selecciones: el 162 era
// «Nantes» en el catálogo e Italia en ESPN, e Italia–Bélgica se pintó
// «Nantes vs Bélgica» en la tira «En directo» de la web y en la app.
//
// Se corrigieron los 31 verificando cada uno contra ESPN, pero lo que evita que
// vuelva a pasar es la regla que prueba este fichero: un número solo vale si el
// nombre también encaja.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeTeam, normalizeRawTeam, findTeamByEspnId } from './teams-catalog'

describe('un número de ESPN solo vale si el nombre encaja', () => {
  it('Italia no se convierte en ningún club aunque su número choque', () => {
    // Si algún día el catálogo vuelve a tener un club con el 162, da igual.
    const t = normalizeTeam({ id: '162', displayName: 'Italy', abbreviation: 'ITA' })
    expect(t?.name).toBe('Italy')
    expect(t?.abbr).toBe('ITA')
  })

  it('un club con el número de otro no hereda sus siglas ni sus colores', () => {
    // Número del catálogo de un equipo, nombre de otro: se ignora el número.
    const cualquiera = findTeamByEspnId('89') // Real Sociedad, ya corregido
    expect(cualquiera?.name).toBe('Real Sociedad')
    const t = normalizeTeam({ id: '89', displayName: 'Osasuna', abbreviation: 'OSA' })
    expect(t?.name).toBe('Osasuna')
    // Ignorado el número, lo encuentra por NOMBRE y le pone sus propios colores,
    // no los de la Real Sociedad.
    expect(t?.primary).toBe(findTeamByEspnId('97')?.primary)
    expect(t?.primary).not.toBe(cualquiera?.primary)
  })

  it('cuando número y nombre encajan, el catálogo sí aporta', () => {
    const t = normalizeTeam({ id: '89', displayName: 'Real Sociedad', abbreviation: 'RSO' })
    expect(t?.name).toBe('Real Sociedad')
    expect(t?.primary).toBeTruthy()
  })

  it('tolera cómo escribe ESPN los nombres largos', () => {
    // ESPN dice «Brighton & Hove Albion», «VfB Stuttgart», «AS Monaco»,
    // «Internazionale», «LA Clippers»; el catálogo, la forma corta.
    for (const [id, crudo] of [
      ['331', 'Brighton & Hove Albion'], ['134', 'VfB Stuttgart'],
      ['174', 'AS Monaco'], ['7911', 'TSG Hoffenheim'],
    ] as const) {
      const rec = findTeamByEspnId(id)
      expect(rec, `el ${id} debería estar en el catálogo`).toBeTruthy()
      expect(normalizeTeam({ id, displayName: crudo })?.primary).toBe(rec!.primary)
    }
  })

  it('sin nombre con el que comparar, manda el número', () => {
    expect(normalizeTeam({ id: '89' })?.name).toBe('Real Sociedad')
  })
})

describe('normalizeRawTeam', () => {
  it('usa solo lo que manda ESPN', () => {
    const t = normalizeRawTeam({ id: '162', displayName: 'Italy', abbreviation: 'ita' })
    expect(t).toEqual({ id: '162', name: 'Italy', shortName: 'Italy', abbr: 'ITA', logo: undefined })
  })
})

describe('el catálogo no repite números', () => {
  it('ningún espnId aparece dos veces', () => {
    // Los 31 errores eran en buena parte INTERCAMBIOS (A tenía el de B y B el de
    // C): un número repetido es la pista más barata de que algo se cruzó.
    const src = readFileSync(join(__dirname, 'teams-catalog.ts'), 'utf8')
    const ids = [...src.matchAll(/espnId: '(\d+)'/g)].map((m) => m[1])
    expect(ids.length).toBeGreaterThan(50)
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
  })
})
