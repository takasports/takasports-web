import { describe, it, expect } from 'vitest'
import { coberturaDeMedicion } from './traffic-cobertura'

const d = (day: string, visits: number | null, clics: number | null) => ({ day, visits, clics, downloads: null })

describe('coberturaDeMedicion', () => {
  it('calcula qué parte del tráfico llega a verse', () => {
    const r = coberturaDeMedicion([d('2026-09-01', 24, 50), d('2026-09-02', 26, 50)])
    expect(r.medidas).toBe(50)
    expect(r.reales).toBe(100)
    expect(r.cobertura).toBe(50)
    expect(r.dias).toBe(2)
  })

  it('descarta los días sin dato de Search Console, que llega con retraso', () => {
    // GSC publica con ~3 días de demora: contar un día con clics a 0 hundiría
    // la media y haría creer que la medición ha empeorado.
    const r = coberturaDeMedicion([d('2026-09-01', 24, 50), d('2026-09-02', 30, null), d('2026-09-03', 10, 0)])
    expect(r.dias).toBe(1)
    expect(r.cobertura).toBe(48)
  })

  it('sin datos no inventa un número', () => {
    expect(coberturaDeMedicion([]).cobertura).toBeNull()
    expect(coberturaDeMedicion([d('2026-09-01', 10, null)]).cobertura).toBeNull()
  })

  it('un día sin visitas medidas cuenta como cero, no se salta', () => {
    const r = coberturaDeMedicion([d('2026-09-01', null, 100)])
    expect(r.medidas).toBe(0)
    expect(r.cobertura).toBe(0)
  })
})
