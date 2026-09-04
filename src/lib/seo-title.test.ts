import { describe, it, expect } from 'vitest'
import { cleanTrim, closeQuotes, grounded, stripBrand, MAXLEN } from './seo-title'

// Estos tests fijan la parte delicada del script del Mac, que ahora vive aquí.
// Cada caso viene de un fallo REAL que se publicó en su día.
describe('cleanTrim', () => {
  it('nunca pasa del tope', () => {
    const largo = 'Alejandro Balde sigue sin minutos en el Barça: la incógnita del lateral izquierdo bajo la lupa de Flick'
    expect(cleanTrim(largo).length).toBeLessThanOrEqual(MAXLEN)
  })

  it('no deja la frase colgando de una preposición', () => {
    // Se publicó «UFC 330: Makhachev y Garry se preparan para un» porque la
    // expresión anterior no casaba con «un» a secas.
    const r = cleanTrim('UFC 330: Makhachev y Garry se preparan para un combate histórico')
    expect(r).not.toMatch(/\s(para|un|de|en|el|la|por|con)$/i)
  })

  it('no deja una comilla abierta sin cerrar', () => {
    const r = cleanTrim('Cody Rhodes lamenta su tatuaje en el cuello: "El mayor error de mi vida"')
    const comillas = (r.match(/"/g) || []).length
    expect(comillas % 2).toBe(0)
  })

  it('un título corto se queda igual', () => {
    expect(cleanTrim('Mbappé marca dos goles')).toBe('Mbappé marca dos goles')
  })
})

describe('closeQuotes', () => {
  it('respeta el apóstrofo dentro de un nombre', () => {
    // «Tony D'Angelo» tiene que sobrevivir: la comilla no abre nada.
    expect(closeQuotes("Tony D'Angelo firma por la WWE")).toBe("Tony D'Angelo firma por la WWE")
  })

  it('si cortar dejaría un título ridículo, solo quita la comilla suelta', () => {
    const r = closeQuotes('Flick: "Julián Álvarez es el delantero que')
    expect(r.length).toBeGreaterThan(20)
    expect(r).not.toContain('"')
  })
})

describe('grounded — el cerrojo anti-invención', () => {
  const fuente = 'El Real Madrid ficha a Mbappé por 180 millones de euros'

  it('acepta un título hecho con los datos de la noticia', () => {
    expect(grounded('El Real Madrid ficha a Mbappé por 180 millones', fuente)).toBe(true)
  })

  it('rechaza una cifra que no está en la noticia', () => {
    expect(grounded('El Real Madrid ficha a Mbappé por 250 millones', fuente)).toBe(false)
  })

  it('rechaza un nombre propio inventado', () => {
    expect(grounded('El Real Madrid ficha a Haaland', fuente)).toBe(false)
  })
})

describe('stripBrand', () => {
  it('quita la marca y los separadores que deja detrás', () => {
    expect(stripBrand('Mbappé firma por el Madrid | TakaSports')).toBe('Mbappé firma por el Madrid')
    expect(stripBrand('Mbappé firma por el Madrid —')).toBe('Mbappé firma por el Madrid')
  })
})
