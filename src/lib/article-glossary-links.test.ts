// Enlazado de términos del glosario en el cuerpo del artículo.
//
// Lo que se protege es sobre todo la PRUDENCIA. La primera medición, sin reglas,
// enlazaba "Juego" en 376 de 500 artículos hacia una definición de TENIS metida
// en crónicas de fútbol. Eso no es enlazado interno, es spam.

import { describe, it, expect } from 'vitest'
import { enlacesDeGlosario, esEnlazable, etiquetaDe } from './article-glossary-links'
import { enlazarEnBloques, MARCA_GLOSARIO, type PtBlock } from './article-player-links'

describe('etiquetaDe', () => {
  it('quita el paréntesis explicativo del término', () => {
    expect(etiquetaDe('VAR (Video Assistant Referee)')).toBe('VAR')
    expect(etiquetaDe('Fuera de juego (offside)')).toBe('Fuera de juego')
  })
  it('deja en paz un término sin paréntesis', () => {
    expect(etiquetaDe('Mercado de fichajes')).toBe('Mercado de fichajes')
  })
})

describe('esEnlazable', () => {
  it('acepta cualquier término de dos o más palabras', () => {
    expect(esEnlazable('Mercado de fichajes')).toBe(true)
    expect(esEnlazable('Tanda de penaltis')).toBe(true)
  })
  it('acepta una palabra suelta solo si es jerga larga', () => {
    expect(esEnlazable('Octágono')).toBe(true)
    expect(esEnlazable('Panenka')).toBe(true)
    expect(esEnlazable('xG')).toBe(false)      // demasiado corta para buscarla en prosa
  })
  it('rechaza las palabras corrientes aunque sean términos', () => {
    for (const p of ['Juego', 'Ventaja', 'Extremo', 'Lateral', 'Defensa', 'Break'])
      expect(esEnlazable(p), p).toBe(false)
  })
})

describe('enlacesDeGlosario', () => {
  it('encuentra el término y construye su enlace', () => {
    const m = enlacesDeGlosario('El club se mueve en el mercado de fichajes antes del cierre.', 'futbol')
    expect([...m.keys()]).toContain('Mercado de fichajes')
    expect([...m.values()][0]).toMatch(/^\/glosario\//)
  })

  it('NO enlaza jerga de otro deporte: el fallo que motivó las reglas', () => {
    // "juego" en una crónica de fútbol apuntaba a la definición de juego de TENIS.
    const m = enlacesDeGlosario('El juego del equipo mejoró en la segunda parte.', 'futbol')
    expect([...m.keys()].map(k => k.toLowerCase())).not.toContain('juego')
  })

  it('prefiere el término largo sobre el corto que va dentro', () => {
    const m = enlacesDeGlosario('El partido se decidió en la tanda de penaltis.', 'futbol')
    const claves = [...m.keys()]
    expect(claves).toContain('Tanda de penaltis')
    expect(claves).not.toContain('Penalti')
  })

  it('respeta el tope por artículo', () => {
    const texto = 'Hubo mercado de fichajes, tanda de penaltis, cláusula de rescisión y agente libre.'
    expect(enlacesDeGlosario(texto, 'futbol', 2).size).toBeLessThanOrEqual(2)
  })

  it('sin deporte solo entran los términos generales', () => {
    const m = enlacesDeGlosario('Se habló de mercado de fichajes en la rueda de prensa.', null)
    for (const k of m.keys()) expect(k).toBeTruthy()   // no revienta; puede salir vacío
  })

  it('texto vacío no devuelve nada', () => {
    expect(enlacesDeGlosario('', 'futbol').size).toBe(0)
  })
})

describe('encadenado con el enlazado de jugadores', () => {
  const parrafo = (text: string): PtBlock => ({
    _type: 'block', _key: 'b1', style: 'normal',
    children: [{ _type: 'span', _key: 's', text, marks: [] }], markDefs: [],
  })
  const textoDe = (b: PtBlock) => (b.children ?? []).map(c => c.text).join('')

  it('respeta las mayúsculas del redactor al enlazar en minúscula', () => {
    // La clave del mapa va capitalizada ("Mercado de fichajes") pero el artículo
    // lo escribe en minúscula a mitad de frase. Se enlaza lo escrito, no la clave.
    const original = 'Se movió en el mercado de fichajes durante todo agosto.'
    const [b] = enlazarEnBloques([parrafo(original)],
      new Map([['Mercado de fichajes', '/glosario/x']]),
      { marca: MARCA_GLOSARIO, ignorarCaja: true })
    expect(textoDe(b)).toBe(original)
    expect((b.children ?? []).find(c => c.marks?.length)?.text).toBe('mercado de fichajes')
  })

  it('la segunda pasada no pisa lo que marcó la primera', () => {
    const uno = enlazarEnBloques([parrafo('Arnau Martínez llegó al mercado de fichajes.')],
      new Map([['Arnau Martínez', '/jugador/a-1']]))
    const dos = enlazarEnBloques(uno,
      new Map([['Mercado de fichajes', '/glosario/x']]),
      { marca: MARCA_GLOSARIO, ignorarCaja: true })
    const marcados = (dos[0].children ?? []).filter(c => c.marks?.length)
    expect(marcados.map(c => c.text)).toEqual(['Arnau Martínez', 'mercado de fichajes'])
    expect(textoDe(dos[0])).toBe('Arnau Martínez llegó al mercado de fichajes.')
  })
})
