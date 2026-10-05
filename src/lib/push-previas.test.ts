import { describe, expect, it } from 'vitest'
import { previasParaAvisar, textoAviso } from '@/lib/push-previas'

const NOW = Date.parse('2026-10-25T17:00:00Z')
const p = (slug: string, home: string, away: string, minutos: number, competicion = 'LaLiga') =>
  ({ slug, home, away, competicion, iso: new Date(NOW + minutos * 60000).toISOString() })

describe('aviso de previas', () => {
  it('solo entre 1 h y 3 h 30 min antes, de más a menos cartel y sin repetir', () => {
    const lista = [
      p('clasico', 'Barcelona', 'Real Madrid', 180),
      p('pronto', 'Barcelona', 'Real Madrid', 30),
      p('tarde', 'Barcelona', 'Real Madrid', 300),
      p('menor', 'Getafe', 'Alavés', 120),
      p('ya', 'Real Madrid', 'Sevilla', 120),
    ]
    expect(previasParaAvisar(lista, NOW, new Set(['ya'])).map((x) => x.slug)).toEqual(['clasico'])
  })
  it('las rivalidades llevan su frase y la hora de España y México', () => {
    const t = textoAviso(p('clasico', 'Real Madrid', 'Barcelona', 180))
    expect(t.title).toBe('Se viene el Clásico ⚽')
    expect(t.body).toBe('Barça y Madrid, cara a cara a las 21:00 🇪🇸 · 14:00 🇲🇽. Lo que se juega y dónde verlo, en la previa.')
    expect(textoAviso(p('av', 'Racing Club', 'Independiente', 120)).title).toBe('Avellaneda se tiñe de dos colores ⚽')
    expect(textoAviso(p('am', 'Club América', 'Guadalajara', 120)).title).toBe('Llega el Clásico Nacional ⚽')
  })
  it('sin confundir nombres parecidos ni el Clásico de baloncesto', () => {
    expect(textoAviso(p('rb', 'Racing Bulls', 'Independiente', 120)).title).not.toMatch(/Avellaneda/)
    expect(textoAviso(p('idv', 'Racing Club', 'Independiente del Valle', 120)).title).not.toMatch(/Avellaneda/)
    const basket = textoAviso(p('eb', 'Real Madrid', 'Barcelona', 120, 'Euroliga'))
    expect(basket.title).toMatch(/🏀$/)
    expect(basket.body).toMatch(/^Real Madrid y Barcelona, cara a cara/)
  })
  it('Champions y Copa tienen su frase; el resto rota pero es estable', () => {
    expect(textoAviso(p('ucl', 'Roma', 'Real Madrid', 120, 'Champions')).title).toMatch(/Champions/)
    expect(textoAviso(p('lib', 'Fluminense', 'Palmeiras', 120, 'Copa Libertadores')).title).toMatch(/Libertadores|Copa/)
    const a = textoAviso(p('x1', 'Villarreal', 'Valencia', 120))
    expect(a).toEqual(textoAviso(p('x1', 'Villarreal', 'Valencia', 120)))
    expect(a.body).toMatch(/^Villarreal y Valencia, cara a cara a las/)
  })
})
