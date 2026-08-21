import { describe, it, expect } from 'vitest'
import {
  isValidDayParam, dayOffsetFrom, isServableDay, longDayLabel, shortDayLabel,
  relativeDayLabel, addDays, dayPageTitle, DAY_PAGE_PAST, DAY_PAGE_FUTURE,
} from './calendar-day-page'

describe('isValidDayParam', () => {
  it('acepta una fecha bien formada', () => {
    expect(isValidDayParam('2026-08-21')).toBe(true)
    expect(isValidDayParam('2026-01-01')).toBe(true)
  })

  it('rechaza formatos que no son YYYY-MM-DD', () => {
    expect(isValidDayParam('laliga')).toBe(false)
    expect(isValidDayParam('2026-8-21')).toBe(false)
    expect(isValidDayParam('21-08-2026')).toBe(false)
    expect(isValidDayParam('2026-08-21T10:00')).toBe(false)
    expect(isValidDayParam('')).toBe(false)
  })

  it('rechaza fechas que no existen aunque tengan el formato', () => {
    expect(isValidDayParam('2026-02-31')).toBe(false)
    expect(isValidDayParam('2026-13-01')).toBe(false)
    expect(isValidDayParam('2026-00-10')).toBe(false)
    expect(isValidDayParam('2026-04-31')).toBe(false)
  })

  it('acepta el 29 de febrero solo en año bisiesto', () => {
    expect(isValidDayParam('2028-02-29')).toBe(true)
    expect(isValidDayParam('2026-02-29')).toBe(false)
  })
})

describe('dayOffsetFrom', () => {
  it('cuenta días en ambos sentidos', () => {
    expect(dayOffsetFrom('2026-08-21', '2026-08-21')).toBe(0)
    expect(dayOffsetFrom('2026-08-22', '2026-08-21')).toBe(1)
    expect(dayOffsetFrom('2026-08-20', '2026-08-21')).toBe(-1)
  })

  it('cruza meses y años sin desviarse', () => {
    expect(dayOffsetFrom('2026-09-01', '2026-08-31')).toBe(1)
    expect(dayOffsetFrom('2027-01-01', '2026-12-31')).toBe(1)
    expect(dayOffsetFrom('2026-08-21', '2026-07-21')).toBe(31)
  })

  it('no se desvía por el cambio de hora (marzo/octubre en Madrid)', () => {
    // El último domingo de marzo dura 23 h en hora local; en UTC no.
    expect(dayOffsetFrom('2026-03-30', '2026-03-28')).toBe(2)
    expect(dayOffsetFrom('2026-10-26', '2026-10-24')).toBe(2)
  })
})

describe('isServableDay', () => {
  const today = '2026-08-21'

  it('sirve hoy y los bordes de la ventana', () => {
    expect(isServableDay(today, today)).toBe(true)
    expect(isServableDay(addDays(today, -DAY_PAGE_PAST), today)).toBe(true)
    expect(isServableDay(addDays(today, DAY_PAGE_FUTURE), today)).toBe(true)
  })

  it('no sirve fuera de la ventana (daría un 200 vacío)', () => {
    expect(isServableDay(addDays(today, -DAY_PAGE_PAST - 1), today)).toBe(false)
    expect(isServableDay(addDays(today, DAY_PAGE_FUTURE + 1), today)).toBe(false)
    expect(isServableDay('2020-01-01', today)).toBe(false)
  })

  it('no sirve una fecha inválida', () => {
    expect(isServableDay('laliga', today)).toBe(false)
    expect(isServableDay('2026-02-31', today)).toBe(false)
  })
})

describe('etiquetas', () => {
  it('formatea el día largo en español', () => {
    expect(longDayLabel('2026-08-21')).toBe('viernes, 21 de agosto de 2026')
    expect(longDayLabel('2026-01-04')).toBe('domingo, 4 de enero de 2026')
  })

  it('formatea el día corto sin año', () => {
    expect(shortDayLabel('2026-12-25')).toBe('25 de diciembre')
  })

  it('usa el relativo solo en ±1 día', () => {
    expect(relativeDayLabel('2026-08-21', '2026-08-21')).toBe('Hoy')
    expect(relativeDayLabel('2026-08-20', '2026-08-21')).toBe('Ayer')
    expect(relativeDayLabel('2026-08-22', '2026-08-21')).toBe('Mañana')
    expect(relativeDayLabel('2026-08-23', '2026-08-21')).toBeNull()
  })

  it('el título antepone el relativo cuando lo hay', () => {
    expect(dayPageTitle('2026-08-21', '2026-08-21')).toBe('Partidos de Hoy, 21 de agosto: horarios y dónde ver')
    expect(dayPageTitle('2026-08-25', '2026-08-21')).toBe('Partidos de 25 de agosto: horarios y dónde ver')
  })
})

describe('addDays', () => {
  it('cruza mes y año', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})
