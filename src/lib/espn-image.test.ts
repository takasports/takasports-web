import { describe, it, expect } from 'vitest'
import { espnAt } from './espn-image'

describe('espnAt', () => {
  it('reescribe un escudo al ancho que se va a ver', () => {
    expect(espnAt('https://a.espncdn.com/i/teamlogos/soccer/500/357.png', 40))
      .toBe('https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/357.png&w=40')
  })

  it('vale igual para las caras', () => {
    expect(espnAt('https://a.espncdn.com/i/headshots/soccer/players/full/236721.png', 80))
      .toBe('https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/236721.png&w=80')
  })

  it('redondea y acota el ancho', () => {
    expect(espnAt('https://a.espncdn.com/i/teamlogos/soccer/500/357.png', 13.7)).toContain('&w=16')
    expect(espnAt('https://a.espncdn.com/i/teamlogos/soccer/500/357.png', 5000)).toContain('&w=1000')
  })

  it('no toca lo que no es suyo', () => {
    const otra = 'https://upload.wikimedia.org/foo.png'
    expect(espnAt(otra, 40)).toBe(otra)
    const yaCombinada = 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/357.png&w=160'
    expect(espnAt(yaCombinada, 40)).toBe(yaCombinada)
  })

  it('ante una URL rota devuelve el original en vez de romper la imagen', () => {
    expect(espnAt('no-es-una-url', 40)).toBe('no-es-una-url')
    expect(espnAt('https://a.espncdn.com/otra/cosa.png', 40)).toBe('https://a.espncdn.com/otra/cosa.png')
    expect(espnAt(undefined, 40)).toBeUndefined()
  })
})
