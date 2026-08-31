// Enlazado de nombres de jugador dentro del cuerpo del artículo.
//
// Lo que se protege aquí es sobre todo lo que NO debe pasar: romper el formato
// del editor, enlazar dos veces al mismo, o llevarse por delante un homónimo.

import { describe, it, expect } from 'vitest'
import {
  extraerNombresCandidatos, enlazarJugadores, textoDeBloques, resolverFichas,
  MARCA_JUGADOR, type PtBlock,
} from './article-player-links'

const parrafo = (text: string, key = 'b1'): PtBlock => ({
  _type: 'block', _key: key, style: 'normal',
  children: [{ _type: 'span', _key: `${key}s`, text, marks: [] }],
  markDefs: [],
})
const textoDe = (b: PtBlock) => (b.children ?? []).map(c => c.text).join('')

describe('extraerNombresCandidatos', () => {
  it('saca nombres de dos y tres palabras', () => {
    const n = extraerNombresCandidatos('El Girona negocia por Arnau Martínez con el Valencia. Kylian Mbappé observa.')
    expect(n).toContain('Arnau Martínez')
    expect(n).toContain('Kylian Mbappé')
  })

  it('respeta las partículas del medio', () => {
    expect(extraerNombresCandidatos('Marc van Bommel dirigió el equipo.')).toContain('Marc van Bommel')
  })

  it('no repite el mismo nombre', () => {
    const n = extraerNombresCandidatos('Arnau Martínez marcó. Luego Arnau Martínez asistió.')
    expect(n.filter(x => x === 'Arnau Martínez')).toHaveLength(1)
  })

  it('ignora una sola palabra suelta', () => {
    expect(extraerNombresCandidatos('Ganó el Girona ayer.')).not.toContain('Girona')
  })
})

describe('enlazarJugadores', () => {
  const enlaces = new Map([['Arnau Martínez', '/jugador/arnau-martinez-123']])

  it('parte el fragmento y deja el nombre marcado', () => {
    const [b] = enlazarJugadores([parrafo('El Girona negocia por Arnau Martínez esta semana.')], enlaces)
    const marcado = (b.children ?? []).find(c => c.marks?.length)
    expect(marcado?.text).toBe('Arnau Martínez')
    expect(b.markDefs).toContainEqual(expect.objectContaining({ _type: MARCA_JUGADOR, href: '/jugador/arnau-martinez-123' }))
  })

  it('no pierde ni una letra del texto original', () => {
    const original = 'El Girona negocia por Arnau Martínez esta semana.'
    const [b] = enlazarJugadores([parrafo(original)], enlaces)
    expect(textoDe(b)).toBe(original)
  })

  it('enlaza SOLO la primera mención', () => {
    const [b] = enlazarJugadores([parrafo('Arnau Martínez jugó. Arnau Martínez marcó.')], enlaces)
    expect((b.children ?? []).filter(c => c.marks?.length)).toHaveLength(1)
  })

  it('tampoco lo repite en un párrafo posterior', () => {
    const bs = enlazarJugadores([parrafo('Arnau Martínez jugó.', 'b1'), parrafo('Arnau Martínez marcó.', 'b2')], enlaces)
    const total = bs.flatMap(b => (b.children ?? []).filter(c => c.marks?.length))
    expect(total).toHaveLength(1)
  })

  it('no toca un fragmento que ya tiene formato: partirlo se comería la negrita', () => {
    const b: PtBlock = { _type: 'block', _key: 'x', style: 'normal', markDefs: [],
      children: [{ _type: 'span', _key: 's', text: 'Arnau Martínez', marks: ['strong'] }] }
    expect(enlazarJugadores([b], enlaces)[0]).toBe(b)
  })

  it('no entra en titulares ni en bloques que no son texto', () => {
    const h: PtBlock = { ...parrafo('Arnau Martínez ficha'), style: 'h2' }
    const img: PtBlock = { _type: 'image', _key: 'i' }
    const out = enlazarJugadores([h, img], enlaces)
    expect(out[0]).toBe(h)
    expect(out[1]).toBe(img)
  })

  it('exige palabra completa: "Martínezos" no es Martínez', () => {
    const [b] = enlazarJugadores([parrafo('Los Arnau Martínezos no existen.')], enlaces)
    expect((b.children ?? []).some(c => c.marks?.length)).toBe(false)
  })

  it('respeta el tope de enlaces por artículo', () => {
    const muchos = new Map(Array.from({ length: 10 }, (_, i) => [`Jugador Numero${i}`, `/jugador/j${i}`]))
    const texto = Array.from({ length: 10 }, (_, i) => `Jugador Numero${i} corrió.`).join(' ')
    const [b] = enlazarJugadores([parrafo(texto)], muchos, 3)
    expect((b.children ?? []).filter(c => c.marks?.length)).toHaveLength(3)
  })

  it('sin enlaces devuelve los bloques intactos', () => {
    const bs = [parrafo('Nada que enlazar aquí.')]
    expect(enlazarJugadores(bs, new Map())).toBe(bs)
  })

  it('mete dos jugadores distintos del mismo párrafo, en orden', () => {
    const dos = new Map([['Arnau Martínez', '/jugador/a-1'], ['Kylian Mbappé', '/jugador/k-2']])
    const [b] = enlazarJugadores([parrafo('Kylian Mbappé saludó a Arnau Martínez en el túnel.')], dos)
    expect((b.children ?? []).filter(c => c.marks?.length).map(c => c.text))
      .toEqual(['Kylian Mbappé', 'Arnau Martínez'])
  })
})

describe('textoDeBloques', () => {
  it('junta solo los bloques de texto', () => {
    const t = textoDeBloques([parrafo('Hola'), { _type: 'image', _key: 'i' }, parrafo('Adiós', 'b2')])
    expect(t).toBe('Hola\nAdiós')
  })
})

describe('resolverFichas', () => {
  const fakeDb = (filas: Array<{ name: string; espn_id: string | null }>) => ({
    from: () => ({ select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: filas, error: null }) }) }) }),
  })

  it('construye el enlace canónico con nombre e id', async () => {
    const m = await resolverFichas(['Arnau Martínez'], fakeDb([{ name: 'Arnau Martínez', espn_id: '231388' }]))
    expect(m.get('Arnau Martínez')).toBe('/jugador/arnau-martinez-231388')
  })

  it('descarta homónimos en vez de enlazar al que no es', async () => {
    // "João Pedro" son siete jugadores distintos en la base. Enlazar al azar
    // sería peor que no enlazar.
    const m = await resolverFichas(['João Pedro'], fakeDb([
      { name: 'João Pedro', espn_id: '111' },
      { name: 'João Pedro', espn_id: '222' },
    ]))
    expect(m.size).toBe(0)
  })

  it('ignora filas sin id de ESPN, que no resuelven a ninguna ficha', async () => {
    const m = await resolverFichas(['Sin Id'], fakeDb([{ name: 'Sin Id', espn_id: null }]))
    expect(m.size).toBe(0)
  })

  it('sin base de datos no rompe la noticia', async () => {
    expect((await resolverFichas(['Quien Sea'], null)).size).toBe(0)
  })

  it('sin candidatos no consulta nada', async () => {
    let llamado = false
    const db = { from: () => { llamado = true; return { select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }) } } }
    await resolverFichas([], db)
    expect(llamado).toBe(false)
  })
})
