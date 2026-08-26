import { describe, it, expect } from 'vitest'
import { storySplitIndex } from './article-split'

const par   = (n = 1) => Array.from({ length: n }, () => ({ _type: 'block', style: 'normal' }))
const head  = () => ({ _type: 'block', style: 'h2' })
const item  = () => ({ _type: 'block', style: 'normal', listItem: 'bullet' })
const image = () => ({ _type: 'image' })

describe('storySplitIndex', () => {
  it('no parte artículos cortos: la llamada caería pegada a la del final', () => {
    expect(storySplitIndex(par(9))).toBeNull()
    expect(storySplitIndex(par(3))).toBeNull()
    expect(storySplitIndex([])).toBeNull()
    expect(storySplitIndex(null)).toBeNull()
  })

  it('parte hacia la mitad en un artículo normal', () => {
    const cut = storySplitIndex(par(20))
    expect(cut).toBe(9) // round(20 * 0.45)
  })

  it('inserta ANTE un párrafo, nunca dentro de una lista ni sobre una imagen', () => {
    // Los bloques 9 y 10 son lista e imagen → tiene que saltar al 11
    const blocks = [...par(9), item(), image(), ...par(10)]
    const cut = storySplitIndex(blocks)!
    expect(blocks[cut]._type).toBe('block')
    expect(blocks[cut].listItem).toBeUndefined()
    expect(cut).toBe(11)
  })

  it('no deja un titular huérfano de su primer párrafo', () => {
    // round(20*0.45) = 9, y ahí hay un h2 justo antes → se corre uno más
    const blocks = [...par(8), head(), ...par(11)]
    const cut = storySplitIndex(blocks)!
    expect(blocks[cut - 1].style).not.toBe('h2')
    expect(cut).toBe(10)
  })

  it('nunca corta en los últimos bloques, que ya son el final del artículo', () => {
    const blocks = [...par(9), ...Array.from({ length: 11 }, image)]
    const cut = storySplitIndex(blocks)
    // No hay párrafo válido hacia delante → busca hacia atrás, sin pasarse del tope
    expect(cut).not.toBeNull()
    expect(cut!).toBeLessThan(blocks.length - 3)
  })

  it('devuelve null si la segunda mitad no tiene un solo hueco limpio', () => {
    // Todo listas salvo los tres primeros bloques, que quedan fuera del rango
    const blocks = [...par(3), ...Array.from({ length: 17 }, item)]
    expect(storySplitIndex(blocks)).toBeNull()
  })
})
