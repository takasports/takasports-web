import { describe, it, expect } from 'vitest'
import { FINAL_STATUSES } from './espn'

// Regresión: la final del Mundial 2026 (ARG-ESP) llegó de ESPN como
// STATUS_FINAL_AET (decidida en la prórroga) y se caía de "Resultados" porque
// el set solo reconocía los estados de tiempo reglamentario. Las eliminatorias
// —finales incluidas— se deciden en prórroga o penaltis, así que esos estados
// DEBEN contar como partido terminado.
describe('FINAL_STATUSES — las eliminatorias en prórroga/penaltis cuentan como terminadas', () => {
  it('reconoce prórroga y penaltis (el bug de la final del Mundial)', () => {
    expect(FINAL_STATUSES.has('STATUS_FINAL_AET')).toBe(true)
    expect(FINAL_STATUSES.has('STATUS_FINAL_PEN')).toBe(true)
  })

  it('sigue reconociendo el tiempo reglamentario', () => {
    expect(FINAL_STATUSES.has('STATUS_FINAL')).toBe(true)
    expect(FINAL_STATUSES.has('STATUS_FULL_TIME')).toBe(true)
  })

  it('no marca como terminados los partidos en juego / programados', () => {
    expect(FINAL_STATUSES.has('STATUS_SCHEDULED')).toBe(false)
    expect(FINAL_STATUSES.has('STATUS_IN_PROGRESS')).toBe(false)
    expect(FINAL_STATUSES.has('STATUS_HALFTIME')).toBe(false)
  })
})
