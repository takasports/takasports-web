import { describe, it, expect } from 'vitest'
import {
  ligasAbiertasPorDefecto, diasAbiertosPorDefecto, estaAbierto, LIGAS_ABIERTAS_POR_ORDEN,
} from './calendar-collapse'

const liga = (comp: string, extra: Partial<{ enVivo: boolean; conFavorito: boolean; fijada: boolean }> = {}) =>
  ({ comp, ...extra })

describe('ligasAbiertasPorDefecto', () => {
  it('abre las primeras y pliega la cola', () => {
    const ligas = ['A', 'B', 'C', 'D', 'E'].map(c => liga(c))
    const abiertas = ligasAbiertasPorDefecto(ligas)
    expect([...abiertas].sort()).toEqual(['A', 'B', 'C'])
    expect(abiertas.size).toBe(LIGAS_ABIERTAS_POR_ORDEN)
  })

  it('abre siempre la que tiene un partido en vivo, esté donde esté', () => {
    const ligas = ['A', 'B', 'C', 'D', liga('E', { enVivo: true }).comp].map((c, i) =>
      i === 4 ? liga('E', { enVivo: true }) : liga(c as string))
    expect(ligasAbiertasPorDefecto(ligas).has('E')).toBe(true)
  })

  it('abre la que tiene un equipo tuyo y la que has fijado', () => {
    const ligas = [liga('A'), liga('B'), liga('C'), liga('D', { conFavorito: true }), liga('E', { fijada: true })]
    const abiertas = ligasAbiertasPorDefecto(ligas)
    expect(abiertas.has('D')).toBe(true)
    expect(abiertas.has('E')).toBe(true)
  })

  it('con una sola liga no pliega nada: no compensa', () => {
    expect(ligasAbiertasPorDefecto([liga('A')]).has('A')).toBe(true)
    expect(ligasAbiertasPorDefecto([]).size).toBe(0)
  })
})

describe('diasAbiertosPorDefecto', () => {
  const dias = ['2026-09-02', '2026-09-03', '2026-09-04']

  it('abre hoy y solo hoy', () => {
    expect([...diasAbiertosPorDefecto(dias, '2026-09-03')]).toEqual(['2026-09-03'])
  })

  it('si hoy no está en la lista, abre el primero para no dejarlo todo cerrado', () => {
    expect([...diasAbiertosPorDefecto(dias, '2026-12-25')]).toEqual(['2026-09-02'])
  })

  it('sin días, no abre nada', () => {
    expect(diasAbiertosPorDefecto([], '2026-09-03').size).toBe(0)
  })
})

describe('estaAbierto', () => {
  const porDefecto = new Set(['A'])

  it('sin tocar nada, manda la regla', () => {
    expect(estaAbierto('A', porDefecto, new Map())).toBe(true)
    expect(estaAbierto('B', porDefecto, new Map())).toBe(false)
  })

  it('lo que toca el usuario gana, en los dos sentidos', () => {
    // Plegar algo que la regla abría (p. ej. hoy) tiene que respetarse.
    expect(estaAbierto('A', porDefecto, new Map([['A', false]]))).toBe(false)
    expect(estaAbierto('B', porDefecto, new Map([['B', true]]))).toBe(true)
  })
})
