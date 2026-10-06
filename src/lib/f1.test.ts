import { describe, expect, it } from 'vitest'
import fx from '@/lib/f1.fixture.json'
import { construirDossierGpCronica, construirDossierGpPrevia, gpDesdeJolpica, nombreGp, refGp } from '@/lib/f1'
import { tituloSeoPartido } from '@/lib/seo-partido'

// Jolpica el 06/10/2026: próximo GP Singapur (ronda 17), último Baréin en Malasia (16).
describe('Grandes Premios de F1', () => {
  it('nombres en español', () => {
    expect(nombreGp('Singapore Grand Prix')).toBe('Gran Premio de Singapur')
    expect(nombreGp('Bahrain Grand Prix in Malaysia')).toBe('Gran Premio de Baréin en Malasia')
    expect(nombreGp('Mexico City Grand Prix')).toBe('Gran Premio de Ciudad de México')
  })
  it('el GP con sus sesiones en orden y su referencia', () => {
    const g = gpDesdeJolpica(fx.proximo)!
    expect(g.nombre).toBe('Gran Premio de Singapur')
    expect(g.sesiones.map((s) => s.nombre)).toEqual(['Libres 1', 'Clasificación al sprint', 'Sprint', 'Clasificación', 'Carrera'])
    expect(refGp(g)).toBe('racing_f1_202617')
  })
  it('previa con los horarios de todas las sesiones y el Mundial', () => {
    const { datos, texto } = construirDossierGpPrevia(gpDesdeJolpica(fx.proximo)!, fx.pilotos, fx.equipos)
    expect(texto).toMatch(/^GRAN PREMIO: Gran Premio de Singapur 2026, ronda 17 del Mundial de Fórmula 1\./)
    expect(texto).toMatch(/- Carrera: domingo, 11 de octubre, 14:00 · 06:00 · 07:00 · 09:00\./)
    expect(texto).toMatch(/MUNDIAL DE PILOTOS ANTES DE ESTE GRAN PREMIO:\n1\. Andrea Kimi Antonelli \(Mercedes\): 320 puntos, 8 victorias/)
    expect(texto).toMatch(/Fernando Alonso|Carlos Sainz/)
    expect(datos).toMatchObject({ matchRef: 'racing_f1_202617', sport: 'formula1', home: 'Gran Premio de Singapur', away: 'Marina Bay Street Circuit' })
  })
  it('crónica con resultado, puntos, salida, vuelta rápida y los hispanos más allá del 10.º', () => {
    const { texto } = construirDossierGpCronica(gpDesdeJolpica(fx.ultimo)!, fx.ultimo.Results, fx.pilotos, fx.equipos)
    expect(texto).toMatch(/1\. Max Verstappen \(neerlandés\), Red Bull: 1:47:14\.808, 25 puntos, salió 1\.º, VUELTA RÁPIDA\./)
    expect(texto).toMatch(/Franco Colapinto \(argentino\)/)
    expect(texto).toMatch(/Carlos Sainz \(español\)/)
    expect(texto).toMatch(/George Russell \(británico\), Mercedes: abandono, 0 puntos, salió 7\.º\./)
    expect(texto).toMatch(/10\. Arvid Lindblad .*: \+15\.928, 1 punto, salió 22\.º\./)
  })
  it('Google: horarios del GP', () => {
    const t = tituloSeoPartido({ tipo: 'previa', home: 'Gran Premio de Singapur', away: 'Marina Bay Street Circuit', iso: '2026-10-11T12:00:00Z', competicion: 'Fórmula 1', deporte: 'f1', ficha: null, tv: [] })
    expect(t).toBe('GP de Singapur: horarios y dónde ver la carrera | F1')
  })
})
