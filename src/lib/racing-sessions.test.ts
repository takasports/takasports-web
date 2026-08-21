import { describe, it, expect } from 'vitest'
import { pickRacingSession } from './racing-sessions'

/** Sesión tal como la sirve ESPN. */
const s = (abbr: string, date: string, status = 'STATUS_SCHEDULED') => ({
  type: { abbreviation: abbr },
  date,
  status: { type: { name: status } },
})

// Fin de semana REAL del Dutch GP 2026, leído de ESPN el 21/08/2026.
const DUTCH = [
  s('FP1', '2026-08-21T10:30Z', 'STATUS_FINAL'),
  s('SS', '2026-08-21T14:30Z', 'STATUS_IN_PROGRESS'),
  s('SR', '2026-08-22T10:00Z'),
  s('Qual', '2026-08-22T14:00Z'),
  s('Race', '2026-08-23T13:00Z'),
]

describe('pickRacingSession', () => {
  it('elige la CARRERA, no los libres del viernes', () => {
    const picked = pickRacingSession(DUTCH)
    expect(picked?.comp.date).toBe('2026-08-23T13:00Z')
    expect(picked?.label).toBe('Carrera')
  })

  it('la carrera manda aunque no sea la última del array', () => {
    const desordenado = [DUTCH[4], DUTCH[0], DUTCH[3]]
    expect(pickRacingSession(desordenado)?.comp.date).toBe('2026-08-23T13:00Z')
  })

  it('el estado que se lee es el de la carrera, no el de unos libres ya acabados', () => {
    // Justo el fallo: con FP1 en STATUS_FINAL, el GP se daba por terminado el
    // viernes — dos días antes de correrse.
    const picked = pickRacingSession(DUTCH)
    const status = (picked?.comp.status as { type: { name: string } }).type.name
    expect(status).toBe('STATUS_SCHEDULED')
  })

  it('sin carrera publicada, cae a la última sesión (nunca a los primeros libres)', () => {
    const soloLibres = [s('FP1', '2026-08-21T10:30Z'), s('FP2', '2026-08-21T14:30Z')]
    const picked = pickRacingSession(soloLibres)
    expect(picked?.comp.date).toBe('2026-08-21T14:30Z')
    expect(picked?.label).toBe('Libres 2')
  })

  it('traduce las sesiones conocidas', () => {
    expect(pickRacingSession([s('Qual', 'x')])?.label).toBe('Clasificación')
    expect(pickRacingSession([s('SR', 'x')])?.label).toBe('Sprint')
    expect(pickRacingSession([s('SS', 'x')])?.label).toBe('Clasificación del sprint')
  })

  it('una sesión desconocida se queda sin etiqueta, no se inventa', () => {
    expect(pickRacingSession([s('WTF', 'x')])?.label).toBeUndefined()
  })

  it('sin sesiones no devuelve nada', () => {
    expect(pickRacingSession([])).toBeNull()
    expect(pickRacingSession(undefined)).toBeNull()
    expect(pickRacingSession('no es un array')).toBeNull()
  })
})
