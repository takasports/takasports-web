import { describe, it, expect } from 'vitest'
import { seasonLabel, previousSeasonLabel, classifySeason, finishedBadge, sameSeasonOnly } from './season-label'

// Todos los casos de abajo salen de una medición real de producción del
// 21/08/2026: ese día ocho bloques de /estadisticas servían el curso pasado con
// el sello ● LIVE. Las ventanas y displayName son los que devolvía ESPN.
const NOW = new Date('2026-08-21T23:00:00Z')

const rows = (gp: number, n = 18) => Array.from({ length: n }, () => ({ gp }))

describe('seasonLabel', () => {
  it('lee la etiqueta del displayName de fútbol', () => {
    expect(seasonLabel({ year: 2025, displayName: '2025-26 Italian Serie A' })).toBe('2025-26')
  })

  it('lee la etiqueta del displayName de la NBA (que es solo el rótulo)', () => {
    expect(seasonLabel({ year: 2027, displayName: '2026-27' })).toBe('2026-27')
  })

  it('no se fía del year, que significa lo contrario en cada deporte', () => {
    // Mismo curso 2026-27: el fútbol lo numera 2026 y la NBA 2027.
    expect(seasonLabel({ year: 2026, displayName: '2026-27 Spanish LALIGA' })).toBe('2026-27')
    expect(seasonLabel({ year: 2027, displayName: '2026-27' })).toBe('2026-27')
  })

  it('cae al year cuando no hay displayName', () => {
    expect(seasonLabel({ year: 2026 })).toBe('2026')
    expect(seasonLabel(undefined)).toBeUndefined()
    expect(seasonLabel({ displayName: 'Regular Season' })).toBeUndefined()
  })
})

describe('previousSeasonLabel', () => {
  it('retrocede un curso cruzado', () => {
    expect(previousSeasonLabel('2026-27')).toBe('2025-26')
    expect(previousSeasonLabel('2000-01')).toBe('1999-00')
  })

  it('retrocede un año natural', () => {
    expect(previousSeasonLabel('2026')).toBe('2025')
  })

  it('conserva el ancho del año final', () => {
    expect(previousSeasonLabel('2026-2027')).toBe('2025-2026')
  })

  it('devuelve nada ante un rótulo que no entiende', () => {
    expect(previousSeasonLabel('Apertura')).toBeUndefined()
    expect(previousSeasonLabel(undefined)).toBeUndefined()
  })
})

describe('classifySeason', () => {
  it('NBA antes del pitido inicial: 82 PJ bajo el rótulo del curso NUEVO son del VIEJO', () => {
    // Caso exacto del 21/08/2026: ESPN declaraba 2026-27 (arranca el 30/09) y
    // devolvía el 60-22 final de Detroit.
    const v = classifySeason({
      rows: rows(82, 30),
      season: { year: 2027, displayName: '2026-27', startDate: '2026-09-30T07:00Z', endDate: '2027-06-26T06:59Z' },
      now: NOW,
    })
    expect(v.kind).toBe('finished')
    expect(v.label).toBe('2025-26')
  })

  it('Champions ya cerrada: la etiqueta es la suya, no la anterior', () => {
    const v = classifySeason({
      rows: rows(8, 36),
      season: { year: 2025, displayName: '2025-26 UEFA Champions League', startDate: '2025-07-01T04:00Z', endDate: '2026-07-01T03:59Z' },
      now: NOW,
    })
    expect(v).toMatchObject({ kind: 'finished', label: '2025-26' })
  })

  it('Serie A traída con ?season=2025: la ventana de ESA respuesta ya venció', () => {
    const v = classifySeason({
      rows: rows(38, 20),
      season: { year: 2025, displayName: '2025-26 Italian Serie A', startDate: '2025-06-06T04:00Z', endDate: '2026-06-05T03:59Z' },
      now: NOW,
    })
    expect(v).toMatchObject({ kind: 'finished', label: '2025-26' })
  })

  it('LaLiga en la jornada 2: en marcha, pero la tabla aún no dice nada', () => {
    const v = classifySeason({
      rows: [{ gp: 2 }, { gp: 2 }, { gp: 1 }, ...rows(0, 17)],
      season: { year: 2026, displayName: '2026-27 Spanish LALIGA', startDate: '2026-06-01T04:00Z', endDate: '2027-06-01T03:59Z' },
      now: NOW,
    })
    expect(v).toMatchObject({ kind: 'early', label: '2026-27', played: 2 })
  })

  it('a partir de tres jornadas la tabla vale', () => {
    const v = classifySeason({
      rows: rows(3, 20),
      season: { year: 2026, displayName: '2026-27 Spanish LALIGA', startDate: '2026-06-01T04:00Z', endDate: '2027-06-01T03:59Z' },
      now: NOW,
    })
    expect(v).toMatchObject({ kind: 'current', label: '2026-27' })
  })

  it('NBA en octubre con filas fósiles: la ventana ya no la frena, los 82 PJ sí', () => {
    // 15 días de temporada no dan para 82 partidos: siguen siendo los del curso pasado.
    const v = classifySeason({
      rows: rows(82, 30),
      season: { year: 2027, displayName: '2026-27', startDate: '2026-09-30T07:00Z', endDate: '2027-06-26T06:59Z' },
      now: new Date('2026-10-15T12:00:00Z'),
    })
    expect(v).toMatchObject({ kind: 'finished', label: '2025-26' })
  })

  it('NBA en octubre ya con partidos de verdad', () => {
    const v = classifySeason({
      rows: rows(6, 30),
      season: { year: 2027, displayName: '2026-27', startDate: '2026-09-30T07:00Z', endDate: '2027-06-26T06:59Z' },
      now: new Date('2026-10-15T12:00:00Z'),
    })
    expect(v).toMatchObject({ kind: 'current', label: '2026-27' })
  })

  it('sin ventana de temporada solo decide el mínimo de jornadas', () => {
    expect(classifySeason({ rows: rows(30, 20), season: undefined, now: NOW }).kind).toBe('current')
    expect(classifySeason({ rows: rows(1, 20), season: undefined, now: NOW }).kind).toBe('early')
  })

  it('haber pedido el año anterior a propósito manda sobre lo que ESPN responda', () => {
    // Comprobado: `soccer/esp.w.1/statistics?season=2025` sirve los goleadores de
    // 2025-26 pero rotula la respuesta "2026-27 Spanish Liga F". Si nos fiáramos
    // del eco, Clàudia Pina con 21 goles del curso pasado saldría como en vivo.
    const v = classifySeason({
      rows: [],
      season: { year: 2026, displayName: '2026-27 Spanish Liga F' },
      now: NOW,
      fallbackYear: 2025,
    })
    expect(v).toMatchObject({ kind: 'finished', label: '2025-26' })
  })

  it('sin filas no hay nada jugado', () => {
    expect(classifySeason({ rows: [], season: undefined, now: NOW })).toMatchObject({ kind: 'early', played: 0 })
  })
})

describe('sameSeasonOnly', () => {
  const lg = (id: string, kind: 'current' | 'early' | 'finished', label?: string) =>
    ({ id, season: { kind, label } })

  it('en agosto se queda con las cuatro cerradas y descarta la que ya juega', () => {
    // Situación real del 21/08/2026: solo LaLiga traía la temporada nueva.
    const r = sameSeasonOnly([
      lg('esp.1', 'early', '2026-27'),
      lg('eng.1', 'finished', '2025-26'),
      lg('ita.1', 'finished', '2025-26'),
      lg('ger.1', 'finished', '2025-26'),
      lg('fra.1', 'finished', '2025-26'),
    ])
    expect(r.finished).toBe(true)
    expect(r.label).toBe('2025-26')
    expect(r.items.map(i => i.id)).toEqual(['eng.1', 'ita.1', 'ger.1', 'fra.1'])
  })

  it('en septiembre, cuando ya juegan casi todas, se queda con las vivas', () => {
    const r = sameSeasonOnly([
      lg('esp.1', 'current', '2026-27'),
      lg('eng.1', 'current', '2026-27'),
      lg('ita.1', 'current', '2026-27'),
      lg('ger.1', 'early', '2026-27'),
      lg('fra.1', 'finished', '2025-26'),
    ])
    expect(r.finished).toBe(false)
    expect(r.items.map(i => i.id)).toEqual(['esp.1', 'eng.1', 'ita.1', 'ger.1'])
  })

  it('el empate cae del lado de la temporada viva', () => {
    const r = sameSeasonOnly([
      lg('esp.1', 'early', '2026-27'),
      lg('eng.1', 'finished', '2025-26'),
    ])
    expect(r.finished).toBe(false)
    expect(r.items.map(i => i.id)).toEqual(['esp.1'])
  })

  it('sin información de temporada no descarta nada', () => {
    const r = sameSeasonOnly([{ id: 'a', season: undefined }, { id: 'b', season: undefined }])
    expect(r).toMatchObject({ finished: false })
    expect(r.items).toHaveLength(2)
  })
})

describe('finishedBadge', () => {
  it('nombra la temporada cuando se conoce', () => {
    expect(finishedBadge('2025-26')).toBe('Final 2025-26')
  })
  it('y no inventa cuando no', () => {
    expect(finishedBadge(undefined)).toBe('Temporada anterior')
  })
})
