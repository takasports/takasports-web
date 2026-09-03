import { describe, it, expect } from 'vitest'
import { hubHrefForCategory, HOME_SPORT_CATEGORIES, CATEGORY_TO_SLUG } from './sports'

describe('hubHrefForCategory', () => {
  it('lleva cada chip a su hub', () => {
    expect(hubHrefForCategory('Fútbol')).toBe('/futbol')
    expect(hubHrefForCategory('Lucha libre')).toBe('/wwe')
    expect(hubHrefForCategory('MMA')).toBe('/ufc')
    expect(hubHrefForCategory('F1')).toBe('/formula1')
  })

  it('"Todo" respeta la sección en la que estás', () => {
    expect(hubHrefForCategory('Todo')).toBe('/')
    expect(hubHrefForCategory('Todo', '/noticias')).toBe('/noticias')
  })

  it('un chip desconocido no genera una URL rota', () => {
    expect(hubHrefForCategory('Petanca')).toBe('/')
    expect(hubHrefForCategory('Petanca', '/noticias')).toBe('/noticias')
  })

  it('TODOS los chips que se pintan tienen hub, o el chip llevaría a un 404', () => {
    // `/[sport]` tiene `dynamicParams = false`: un slug fuera de SLUG_TO_LABEL
    // devuelve 404 real. Si alguien añade un chip sin hub, esto lo caza.
    for (const cat of HOME_SPORT_CATEGORIES) {
      if (cat === 'Todo') continue
      expect.soft(CATEGORY_TO_SLUG[cat], `el chip "${cat}" no tiene slug`).toBeTruthy()
      expect.soft(hubHrefForCategory(cat), `el chip "${cat}" no tiene hub`).not.toBe('/')
    }
  })
})
