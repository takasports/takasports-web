import { describe, it, expect } from 'vitest'
import { h2hSummary, shortTeamName } from './h2h-summary'

// Ayuda: construye el H2HResult tal como lo devuelve fetchH2H (más reciente
// primero, wins/draws/losses contados desde teamA).
function h2h(rows: Array<[string, number, string, number]>, teamA: string) {
  const matches = rows.map(([home, hs, away, as]) => ({
    home, away, homeScore: hs, awayScore: as,
  }))
  let wins = 0, draws = 0, losses = 0
  for (const m of matches) {
    const aIsHome = m.home === teamA
    const a = aIsHome ? m.homeScore : m.awayScore
    const b = aIsHome ? m.awayScore : m.homeScore
    if (a > b) wins++; else if (a < b) losses++; else draws++
  }
  return { matches, wins, draws, losses }
}

describe('h2hSummary', () => {
  it('sin datos no dice nada', () => {
    expect(h2hSummary(null, 'A', 'B')).toBeNull()
    expect(h2hSummary(undefined, 'A', 'B')).toBeNull()
  })

  it('con un solo precedente lo enuncia como tal, sin fingir historial', () => {
    const d = h2h([['Atlético de Madrid', 2, 'Sevilla FC', 0]], 'Atlético de Madrid')
    expect(h2hSummary(d, 'Atlético de Madrid', 'Sevilla FC')).toBe('Último: Atlético Madrid 2-0')
    // Caso real 21/08/2026 (único cruce archivado de esta pareja).
    const chi = h2h([['Chicago Fire FC', 3, 'Inter Miami CF', 2]], 'Chicago Fire FC')
    expect(h2hSummary(chi, 'Chicago Fire FC', 'Inter Miami CF')).toBe('Último: Chicago 3-2')
  })

  it('un único precedente en empate se dice sin ganador', () => {
    const d = h2h([['Atlético de Madrid', 1, 'Sevilla FC', 1]], 'Atlético de Madrid')
    expect(h2hSummary(d, 'Atlético de Madrid', 'Sevilla FC')).toBe('Último: empate 1-1')
  })

  it('sin ningún enfrentamiento archivado no dice nada', () => {
    expect(h2hSummary({ matches: [], wins: 0, draws: 0, losses: 0 }, 'A', 'B')).toBeNull()
  })

  it('racha viva: gana el mismo equipo los últimos seguidos', () => {
    const d = h2h([
      ['Atlético de Madrid', 2, 'Sevilla FC', 0],
      ['Sevilla FC', 0, 'Atlético de Madrid', 1],
      ['Atlético de Madrid', 3, 'Sevilla FC', 1],
      ['Sevilla FC', 2, 'Atlético de Madrid', 1],
    ], 'Atlético de Madrid')
    expect(h2hSummary(d, 'Atlético de Madrid', 'Sevilla FC')).toBe('3 victorias seguidas de Atlético Madrid')
  })

  it('la racha se corta con un empate reciente', () => {
    const d = h2h([
      ['Atlético de Madrid', 1, 'Sevilla FC', 1],
      ['Sevilla FC', 0, 'Atlético de Madrid', 2],
      ['Atlético de Madrid', 2, 'Sevilla FC', 0],
    ], 'Atlético de Madrid')
    // Sin racha (el más reciente es empate) → cae a dominio: 2-1-0 de 3.
    expect(h2hSummary(d, 'Atlético de Madrid', 'Sevilla FC')).toBe('Atlético Madrid domina el H2H: 2-1-0')
  })

  it('la racha se corta cuando cambia el ganador', () => {
    const d = h2h([
      ['Atlético de Madrid', 2, 'Sevilla FC', 0],
      ['Sevilla FC', 3, 'Atlético de Madrid', 1],
      ['Sevilla FC', 2, 'Atlético de Madrid', 0],
    ], 'Atlético de Madrid')
    // 1 sola victoria seguida → no es racha; 1-0-2 → domina Sevilla.
    expect(h2hSummary(d, 'Atlético de Madrid', 'Sevilla FC')).toBe('Sevilla domina el H2H: 2-0-1')
  })

  it('dominio del visitante se enuncia desde el visitante', () => {
    const d = h2h([
      ['Sevilla FC', 1, 'Atlético de Madrid', 0],
      ['Atlético de Madrid', 1, 'Sevilla FC', 1],
      ['Sevilla FC', 2, 'Atlético de Madrid', 1],
      ['Atlético de Madrid', 0, 'Sevilla FC', 2],
    ], 'Atlético de Madrid')
    // El empate en el 2º corta la racha (Sevilla solo encadena 1), así que
    // manda el dominio: 3 victorias y 1 empate de Sevilla en 4.
    expect(h2hSummary(d, 'Atlético de Madrid', 'Sevilla FC')).toBe('Sevilla domina el H2H: 3-1-0')
  })

  it('historial igualado devuelve el recuento crudo', () => {
    const d = h2h([
      ['Atlético de Madrid', 1, 'Sevilla FC', 1],
      ['Sevilla FC', 2, 'Atlético de Madrid', 1],
      ['Atlético de Madrid', 2, 'Sevilla FC', 0],
      ['Sevilla FC', 1, 'Atlético de Madrid', 1],
    ], 'Atlético de Madrid')
    expect(h2hSummary(d, 'Atlético de Madrid', 'Sevilla FC')).toBe('Últimos 4: 1-2-1')
  })

  it('ignora enfrentamientos sin marcador al contar la racha', () => {
    const d = {
      matches: [
        { home: 'A', away: 'B', homeScore: null, awayScore: null },
        { home: 'A', away: 'B', homeScore: 2, awayScore: 0 },
        { home: 'B', away: 'A', homeScore: 0, awayScore: 1 },
      ],
      wins: 2, draws: 0, losses: 0,
    }
    expect(h2hSummary(d, 'A', 'B')).toBe('2 victorias seguidas de A')
  })
})

describe('shortTeamName', () => {
  it('quita el sufijo de club y se queda con la primera palabra', () => {
    expect(shortTeamName('Sevilla FC')).toBe('Sevilla')
    expect(shortTeamName('Chicago Fire FC')).toBe('Chicago')
    expect(shortTeamName('Valencia')).toBe('Valencia')
  })

  it('usa dos palabras cuando la primera no identifica al club', () => {
    // "Inter" a secas se lee como el de Milán aunque sea el Inter Miami.
    expect(shortTeamName('Inter Miami CF')).toBe('Inter Miami')
    expect(shortTeamName('Real Sociedad')).toBe('Real Sociedad')
    expect(shortTeamName('Racing Santander')).toBe('Racing Santander')
  })

  it('salta los conectores al contar palabras', () => {
    expect(shortTeamName('Atlético de Madrid')).toBe('Atlético Madrid')
  })

  it('no deja un nombre demasiado corto', () => {
    expect(shortTeamName('CD Leganés')).toBe('Leganés')
  })
})
