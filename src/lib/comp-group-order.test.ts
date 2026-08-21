import { describe, it, expect } from 'vitest'
import { orderCompGroups, groupTier, type CompGroupInput } from './comp-group-order'
import { getLeagueScore } from './competitions'

const g = (comp: string, events: CompGroupInput['events'], pinned = false): CompGroupInput =>
  ({ comp, events, pinned })

describe('groupTier', () => {
  it('en vivo manda sobre lo demás del grupo', () => {
    expect(groupTier([{ over: true }, { live: true }, { over: false }])).toBe(0)
  })
  it('queda algo por jugarse → 1', () => {
    expect(groupTier([{ over: true }, { over: false }])).toBe(1)
  })
  it('todo terminado → 2', () => {
    expect(groupTier([{ over: true }, { over: true }])).toBe(2)
  })
  it('sin banderas se considera por jugarse (día futuro)', () => {
    expect(groupTier([{}, {}])).toBe(1)
  })
})

describe('orderCompGroups', () => {
  it('EL CASO REAL: la liga de madrugada ya acabada no encabeza el día', () => {
    // 21/08/2026, 09:00 en Madrid: la Liga Argentina se jugó de madrugada y está
    // toda en FINAL; Premier y LaLiga son por la tarde.
    const order = orderCompGroups([
      g('Liga Argentina', [
        { isoDate: '2026-08-21T00:30:00Z', over: true },
        { isoDate: '2026-08-21T01:30:00Z', over: true },
      ]),
      g('Premier', [{ isoDate: '2026-08-21T19:00:00Z' }]),
      g('LaLiga', [{ isoDate: '2026-08-21T19:30:00Z' }]),
    ], getLeagueScore)
    // Premier y LaLiga puntúan IGUAL en la tabla de importancia, así que entre
    // ellas desempata la hora (19:00 antes que 19:30). Lo que importa aquí es
    // que la liga ya terminada cae al final.
    expect(order).toEqual(['Premier', 'LaLiga', 'Liga Argentina'])
  })

  it('lo que se juega AHORA va por delante de todo (menos lo fijado)', () => {
    const order = orderCompGroups([
      g('LaLiga', [{ isoDate: '2026-08-21T19:30:00Z' }]),
      g('Liga Argentina', [{ isoDate: '2026-08-21T17:00:00Z', live: true }]),
    ], getLeagueScore)
    expect(order[0]).toBe('Liga Argentina')
  })

  it('una liga fijada gana incluso a un directo de otra', () => {
    const order = orderCompGroups([
      g('Champions', [{ isoDate: '2026-08-21T19:00:00Z', live: true }]),
      g('Eredivisie', [{ isoDate: '2026-08-21T21:00:00Z' }], true),
    ], getLeagueScore)
    expect(order).toEqual(['Eredivisie', 'Champions'])
  })

  it('mismo estado → manda la importancia, no la hora', () => {
    const order = orderCompGroups([
      g('Eredivisie', [{ isoDate: '2026-08-21T12:00:00Z' }]),
      g('Champions',  [{ isoDate: '2026-08-21T21:00:00Z' }]),
    ], getLeagueScore)
    expect(order).toEqual(['Champions', 'Eredivisie'])
  })

  it('a igual importancia desempata la hora del primer partido', () => {
    // Dos ligas sin entrada propia en la tabla → ambas al valor por defecto.
    const order = orderCompGroups([
      g('Liga Chilena',   [{ isoDate: '2026-08-21T22:00:00Z' }]),
      g('Liga Peruana',   [{ isoDate: '2026-08-21T18:00:00Z' }]),
    ], getLeagueScore)
    expect(order).toEqual(['Liga Peruana', 'Liga Chilena'])
  })

  it('un día PASADO (todo terminado) queda por importancia', () => {
    const order = orderCompGroups([
      g('Liga Argentina', [{ isoDate: '2026-08-20T00:30:00Z', over: true }]),
      g('Premier',        [{ isoDate: '2026-08-20T19:00:00Z', over: true }]),
      g('Champions',      [{ isoDate: '2026-08-20T19:00:00Z', over: true }]),
    ], getLeagueScore)
    expect(order).toEqual(['Champions', 'Premier', 'Liga Argentina'])
  })

  it('una liga a medias (un partido jugado, otro por jugar) va con las de por jugar', () => {
    const order = orderCompGroups([
      g('Serie A', [
        { isoDate: '2026-08-21T12:30:00Z', over: true },
        { isoDate: '2026-08-21T20:45:00Z' },
      ]),
      g('Bundesliga', [{ isoDate: '2026-08-21T11:00:00Z', over: true }]),
    ], getLeagueScore)
    expect(order).toEqual(['Serie A', 'Bundesliga'])
  })

  it('no muta la lista de entrada', () => {
    const input = [g('Eredivisie', [{}]), g('Champions', [{}])]
    const copia = input.map(x => x.comp)
    orderCompGroups(input, getLeagueScore)
    expect(input.map(x => x.comp)).toEqual(copia)
  })

  it('un grupo sin fecha no se cuela por delante de uno con hora', () => {
    const order = orderCompGroups([
      g('Liga Chilena', [{}]),
      g('Liga Peruana', [{ isoDate: '2026-08-21T18:00:00Z' }]),
    ], getLeagueScore)
    expect(order).toEqual(['Liga Peruana', 'Liga Chilena'])
  })

  it('es determinista con dos ligas idénticas en todo', () => {
    const a = orderCompGroups([g('Bbb', [{}]), g('Aaa', [{}])], () => 5)
    const b = orderCompGroups([g('Aaa', [{}]), g('Bbb', [{}])], () => 5)
    expect(a).toEqual(b)
    expect(a).toEqual(['Aaa', 'Bbb'])
  })
})
