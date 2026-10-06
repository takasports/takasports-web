import { describe, it, expect } from 'vitest'
import { matchCompetition } from './broadcast'

describe('matchCompetition', () => {
  it('reconoce cada competición cubierta', () => {
    expect(matchCompetition('LaLiga')).toBe('laliga')
    expect(matchCompetition('La Liga EA Sports')).toBe('laliga')
    expect(matchCompetition('Primera División')).toBe('laliga')
    expect(matchCompetition('Premier League')).toBe('premier')
    expect(matchCompetition('UEFA Champions League')).toBe('champions')
    expect(matchCompetition('Liga de Campeones')).toBe('champions')
    expect(matchCompetition('UFC 320')).toBe('ufc')
    expect(matchCompetition('Eliminatorias Sudamericanas')).toBe('selecciones')
    expect(matchCompetition('UEFA Nations League')).toBe('nations_league')
  })

  it('la Nations League no cae en «selecciones»', () => {
    // La emite otro operador que los partidos de la selección local: con la clave
    // genérica, un Francia–Italia salía con TyC Sports en Argentina.
    expect(matchCompetition('UEFA Nations League', 'Francia vs Italia: horario, dónde ver y lo que se juega en la Nations League')).toBe('nations_league')
    expect(matchCompetition('Liga de las Naciones')).toBe('nations_league')
  })

  it('prioriza Champions sobre la liga doméstica', () => {
    // Un Barcelona-Inter es Champions, no LaLiga: si ganara el patrón de LaLiga
    // enseñaríamos el canal equivocado en los nueve países.
    expect(matchCompetition('Champions League', 'El Barcelona recibe al Inter en LaLiga')).toBe('champions')
  })

  it('ignora acentos y mayúsculas', () => {
    expect(matchCompetition('PRIMERA DIVISIÓN')).toBe('laliga')
    expect(matchCompetition('copa américa')).toBe('selecciones')
  })

  it('acepta varios textos y se queda con el primero que encaje', () => {
    expect(matchCompetition(null, undefined, 'Real Madrid', 'premier league')).toBe('premier')
  })

  it('devuelve null cuando no hay competición cubierta', () => {
    expect(matchCompetition('Serie A')).toBeNull()
    expect(matchCompetition('Roland Garros')).toBeNull()
    expect(matchCompetition('')).toBeNull()
    expect(matchCompetition(null, undefined)).toBeNull()
  })

  it('no confunde palabras que contienen el nombre por dentro', () => {
    // "premiere" no es la Premier League.
    expect(matchCompetition('la premiere del documental')).toBeNull()
  })
})
