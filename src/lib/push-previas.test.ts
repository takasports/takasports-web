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
  it('el texto lleva la hora de España y la de México', () => {
    const t = textoAviso(p('clasico', 'Barcelona', 'Real Madrid', 180))
    expect(t.title).toBe('⚽ Hoy: Barcelona - Real Madrid')
    expect(t.body).toBe('21:00 en España · 14:00 en México. Dónde verlo y lo que se juega.')
  })
})
