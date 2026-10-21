import { describe, it, expect } from 'vitest'
import {
  ligasAbiertasPorDefecto, diasAbiertosPorDefecto, estaAbierto, LIGAS_ABIERTAS_POR_ORDEN,
  diasVisiblesDeArranque, DIAS_VISIBLES_DE_ARRANQUE,
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

describe('diasVisiblesDeArranque', () => {
  const hoy = '2026-10-21'
  const semanas = Array.from({ length: 12 }, (_, i) => `2026-10-${String(21 + i).padStart(2, '0')}`)

  it('enseña hoy y los seis días siguientes y cuenta el resto', () => {
    const { visibles, ocultos } = diasVisiblesDeArranque(semanas, hoy)
    expect(DIAS_VISIBLES_DE_ARRANQUE).toBe(7)
    expect(visibles).toEqual(semanas.slice(0, 7))
    expect(ocultos).toBe(5)
  })

  it('cuenta DÍAS CON PARTIDOS, no días de calendario: un hueco no gasta plaza', () => {
    const conHueco = ['2026-10-21', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-30']
    const { visibles, ocultos } = diasVisiblesDeArranque(conHueco, hoy)
    expect(visibles.at(-1)).toBe('2026-10-28')
    expect(ocultos).toBe(1)
  })

  it('los días pasados que pidió el usuario se ven siempre y no gastan plaza', () => {
    const conPasado = ['2026-10-18', '2026-10-19', '2026-10-20', ...semanas]
    const { visibles, ocultos } = diasVisiblesDeArranque(conPasado, hoy)
    expect(visibles.slice(0, 3)).toEqual(['2026-10-18', '2026-10-19', '2026-10-20'])
    expect(visibles).toHaveLength(10)
    expect(ocultos).toBe(5)
  })

  it('si hoy no tiene partidos, la semana empieza en el primer día con ellos', () => {
    const { visibles } = diasVisiblesDeArranque(semanas.slice(1), hoy)
    expect(visibles[0]).toBe('2026-10-22')
    expect(visibles).toHaveLength(7)
  })

  it('con pocos días no oculta nada; «sin fecha» va a la cola', () => {
    expect(diasVisiblesDeArranque(['2026-10-21', '2026-10-22'], hoy)).toEqual({ visibles: ['2026-10-21', '2026-10-22'], ocultos: 0 })
    expect(diasVisiblesDeArranque([...semanas.slice(0, 7), 'unknown'], hoy).ocultos).toBe(1)
  })
})
