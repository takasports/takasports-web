import { describe, it, expect } from 'vitest'
import { standingsAreMeaningful, STANDINGS_MIN_GP, byGroup, groupLabel } from './espn-standings'

const table = (...gps: number[]) => gps.map(gp => ({ gp }))

describe('standingsAreMeaningful', () => {
  it('tabla vacía no vale', () => {
    expect(standingsAreMeaningful([])).toBe(false)
  })

  it('pretemporada: todos a 0 jugados → la tabla es alfabética, no vale', () => {
    // Caso real Premier 21/08/2026: 20 equipos, 0 partidos, "1º AFC Bournemouth".
    expect(standingsAreMeaningful(table(...Array(20).fill(0)))).toBe(false)
  })

  it('1-2 jornadas siguen siendo ruido', () => {
    // Caso real LaLiga 21/08/2026: 2 jornadas, "líder" Alavés con 4 pts.
    expect(standingsAreMeaningful(table(2, 2, 1, 2))).toBe(false)
  })

  it('a partir del umbral la tabla ya dice algo', () => {
    expect(standingsAreMeaningful(table(STANDINGS_MIN_GP, 2, 2))).toBe(true)
    // Caso real Brasileirão 21/08/2026: 23 jornadas.
    expect(standingsAreMeaningful(table(23, 23, 22))).toBe(true)
  })

  it('basta con que UN equipo llegue al umbral (calendarios desiguales)', () => {
    expect(standingsAreMeaningful(table(0, 1, 4))).toBe(true)
  })
})

describe('byGroup', () => {
  const fila = (name: string, group?: string) => ({ name, group })

  it('una liga sin grupos sale entera en un solo bloque', () => {
    const r = byGroup([fila('Barcelona'), fila('Real Madrid')])
    expect(r).toHaveLength(1)
    expect(r[0].name).toBeUndefined()
    expect(r[0].rows).toHaveLength(2)
  })

  it('separa las dos zonas de la Liga Argentina', () => {
    // Medido el 21/08/2026: ESPN da soccer/arg.1 en dos grupos de 15, y leer solo
    // children[0] dejaba fuera a la mitad del campeonato.
    const r = byGroup([
      fila('Boca', 'Group A'), fila('River', 'Group A'),
      fila('Racing', 'Group B'), fila('Independiente', 'Group B'),
    ])
    expect(r.map(g => g.name)).toEqual(['Group A', 'Group B'])
    expect(r.map(g => g.rows.length)).toEqual([2, 2])
  })

  it('conserva el orden de llegada y no reordena nada', () => {
    const r = byGroup([
      fila('Inter Miami', 'Eastern Conference'),
      fila('LA Galaxy', 'Western Conference'),
      fila('Orlando', 'Eastern Conference'),
    ])
    // Tres bloques: el segundo Este llega DESPUÉS del Oeste, así que abre bloque
    // propio. fetchLeagueTable emite grupo a grupo, pero la función no lo presupone.
    expect(r.map(g => g.rows.length)).toEqual([1, 1, 1])
  })

  it('sin filas no hay bloques', () => {
    expect(byGroup([])).toEqual([])
  })
})

describe('groupLabel', () => {
  it('traduce los nombres que ESPN da en inglés', () => {
    expect(groupLabel('Group A')).toBe('Grupo A')
    expect(groupLabel('Eastern Conference')).toBe('Conferencia Este')
    expect(groupLabel('Western Conference')).toBe('Conferencia Oeste')
    expect(groupLabel('Regular Season')).toBe('Temporada regular')
  })

  it('deja intacto lo que no reconoce', () => {
    expect(groupLabel('Apertura')).toBe('Apertura')
    expect(groupLabel(undefined)).toBeUndefined()
  })
})
