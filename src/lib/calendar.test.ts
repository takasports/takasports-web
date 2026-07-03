import { describe, it, expect } from 'vitest'
import { isoToLocalDate, groupEventsByDate, formatDateLabel } from './calendar'
import type { SportEvent } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Agrupado del calendario por zona horaria. El día de un partido se decide en la
// zona `tz` (huso del dispositivo del usuario en el calendario), no en Madrid
// fijo. Un mismo instante puede caer en día distinto según el huso — es justo lo
// que debe reflejar el separador de día. Por defecto (sin tz) sigue en Madrid
// para el resto de consumidores.
// ─────────────────────────────────────────────────────────────────────────────

const ev = (isoDate: string): SportEvent => ({ isoDate } as unknown as SportEvent)

describe('isoToLocalDate — el día depende del huso', () => {
  // 23:30 UTC del 4-jul → en Madrid (CEST, +2) ya es el 5; en Bogotá (−5) aún el 4.
  const iso = '2026-07-04T23:30:00Z'

  it('Madrid (por defecto) lo pone el 5', () => {
    expect(isoToLocalDate(iso)).toBe('2026-07-05')
    expect(isoToLocalDate(iso, 'Europe/Madrid')).toBe('2026-07-05')
  })

  it('Bogotá lo pone el 4 (día del usuario)', () => {
    expect(isoToLocalDate(iso, 'America/Bogota')).toBe('2026-07-04')
  })

  it('Tokio (+9) lo pone el 5', () => {
    expect(isoToLocalDate(iso, 'Asia/Tokyo')).toBe('2026-07-05')
  })
})

describe('groupEventsByDate — agrupa por el huso indicado', () => {
  const iso = '2026-07-04T23:30:00Z'
  const events = [ev(iso), ev('2026-07-04T10:00:00Z')]

  it('en Bogotá los dos caen el 4', () => {
    const g = groupEventsByDate(events, 'America/Bogota')
    expect(Object.keys(g).sort()).toEqual(['2026-07-04'])
    expect(g['2026-07-04']).toHaveLength(2)
  })

  it('en Madrid se reparten entre el 4 y el 5', () => {
    const g = groupEventsByDate(events, 'Europe/Madrid')
    expect(Object.keys(g).sort()).toEqual(['2026-07-04', '2026-07-05'])
  })

  it('sin fecha → clave "unknown"', () => {
    const g = groupEventsByDate([ev(undefined as unknown as string)], 'America/Bogota')
    expect(Object.keys(g)).toEqual(['unknown'])
  })
})

describe('formatDateLabel — "Hoy" se calcula en el huso del usuario', () => {
  it('la clave de HOY en un huso concreto se etiqueta "Hoy"', () => {
    const tz = 'America/Bogota'
    const todayKey = isoToLocalDate(new Date().toISOString(), tz)
    expect(formatDateLabel(todayKey, tz)).toBe('Hoy')
  })

  it('"Sin fecha" para unknown', () => {
    expect(formatDateLabel('unknown')).toBe('Sin fecha')
  })
})
