import { describe, it, expect } from 'vitest'
import { matchCompetition, paisDeSeleccion, filasParaPartido } from './broadcast'

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

describe('selecciones: solo los países que juegan', () => {
  const filas = ['ES', 'MX', 'AR', 'CO', 'PE', 'CL', 'US'].map((countryCode) => ({ countryCode, country: countryCode, channels: ['X'] }))

  it('reconoce los amistosos internacionales', () => {
    expect(matchCompetition('International Friendly', 'Colombia vs Perú: horario y dónde ver')).toBe('selecciones')
    expect(matchCompetition('Partido amistoso')).toBe('selecciones')
  })

  it('reconoce la selección por su nombre exacto', () => {
    expect(paisDeSeleccion('México')).toBe('MX')
    expect(paisDeSeleccion('Estados Unidos')).toBe('US')
    expect(paisDeSeleccion('EE.\u202fUU.')).toBe('US')
    expect(paisDeSeleccion('Selección de Chile')).toBe('CL')
    expect(paisDeSeleccion('Inter de Italia')).toBeNull()
    expect(paisDeSeleccion('Chile Sub-20')).toBeNull()
    expect(paisDeSeleccion(null)).toBeNull()
  })

  it('un Colombia–Perú enseña Colombia y Perú, y nada más', () => {
    const r = filasParaPartido('selecciones', filas, 'Colombia', 'Perú').map((f) => f.countryCode)
    expect(r.sort()).toEqual(['CO', 'PE'])
  })

  it('un amistoso de clubes se queda sin filas', () => {
    expect(filasParaPartido('selecciones', filas, 'FC Barcelona', 'Getafe')).toEqual([])
  })

  it('sin equipos no hay filas de selecciones (versiones viejas de la app)', () => {
    expect(filasParaPartido('selecciones', filas, null, null)).toEqual([])
  })

  it('el resto de competiciones no se filtra', () => {
    expect(filasParaPartido('nations_league', filas, 'Francia', 'Italia')).toHaveLength(filas.length)
  })
})
