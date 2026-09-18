import { describe, it, expect } from 'vitest'
import {
  isValidDayParam, dayOffsetFrom, longDayLabel, shortDayLabel,
  relativeDayLabel, addDays, dayPageTitle, DAY_PAGE_PAST, DAY_PAGE_FUTURE,
  isPastDay, dayPageDescription, servableDays, sitemapDays,
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

// ── Archivo de resultados ────────────────────────────────────────────────────
// El calendario servía una ventana fija de -30 días mientras `past_events`
// guardaba ~130 días con partidos. Estas pruebas cubren el cambio a "se sirve
// un día pasado porque TIENE resultados", no porque caiga en un número redondo.

describe('isPastDay', () => {
  const today = '2026-09-06'

  it('hoy, mañana y AYER no cuentan como pasado', () => {
    expect(isPastDay(today, today)).toBe(false)
    expect(isPastDay('2026-09-07', today)).toBe(false)
    // Ayer sigue en presente a propósito: se busca igual el horario que el
    // marcador, y la página aún mezcla feed en vivo y archivo.
    expect(isPastDay('2026-09-05', today)).toBe(false)
  })

  it('a partir de anteayer sí', () => {
    expect(isPastDay('2026-09-04', today)).toBe(true)
    expect(isPastDay('2026-05-12', today)).toBe(true)
  })
})

describe('dayPageTitle en pasado', () => {
  const today = '2026-09-06'

  it('un día jugado promete marcadores, no horarios', () => {
    expect(dayPageTitle('2026-08-22', today))
      .toBe('Resultados del 22 de agosto: todos los marcadores')
  })

  it('hoy y ayer siguen prometiendo horarios', () => {
    expect(dayPageTitle(today, today)).toBe('Partidos de Hoy, 6 de septiembre: horarios y dónde ver')
    expect(dayPageTitle('2026-09-05', today)).toBe('Partidos de Ayer, 5 de septiembre: horarios y dónde ver')
  })
})

describe('dayPageDescription', () => {
  const today = '2026-09-06'

  it('en pasado habla de resultados', () => {
    expect(dayPageDescription('2026-08-22', 89, today)).toContain('Resultados de los 89 partidos')
  })

  it('en presente habla de horarios y canal', () => {
    expect(dayPageDescription('2026-09-07', 12, today)).toContain('horarios, canal de televisión')
  })

  it('sin todayIso mantiene el texto de siempre (compatibilidad)', () => {
    expect(dayPageDescription('2026-08-22', 89)).toContain('horarios, canal de televisión')
  })

  it('un día vacío no promete nada', () => {
    expect(dayPageDescription('2026-08-22', 0, today)).toBe('Agenda deportiva del sábado, 22 de agosto de 2026 en TakaSports.')
  })
})

describe('servableDays', () => {
  const today = '2026-09-06'

  it('devuelve la ventana viva completa cuando no hay archivo', () => {
    const days = servableDays(today)
    expect(days.length).toBe(DAY_PAGE_PAST + DAY_PAGE_FUTURE + 1)
    expect(days[0]).toBe(addDays(today, DAY_PAGE_FUTURE))
    expect(days[days.length - 1]).toBe(addDays(today, -DAY_PAGE_PAST))
  })

  it('suma los días archivados sin duplicar los que ya estaban', () => {
    const dentro = addDays(today, -3)          // ya en la ventana
    const fuera = '2026-05-12'                 // solo en el archivo
    const days = servableDays(today, [dentro, fuera])
    expect(days.filter(d => d === dentro)).toHaveLength(1)
    expect(days).toContain(fuera)
    expect(days.length).toBe(DAY_PAGE_PAST + DAY_PAGE_FUTURE + 2)
  })

  it('ignora la basura que pueda venir de la base', () => {
    const days = servableDays(today, ['no-es-fecha', '2026-02-31', addDays(today, 999)])
    expect(days.length).toBe(DAY_PAGE_PAST + DAY_PAGE_FUTURE + 1)
  })

  it('sale ordenado de más reciente a más antiguo', () => {
    const days = servableDays(today, ['2026-05-12'])
    expect([...days].sort((a, b) => b.localeCompare(a))).toEqual(days)
  })
})

// ── Lo que el sitemap ANUNCIA no es lo que la ruta SIRVE ──────────────────────
//
// El 18/09/2026 el sitemap anunciaba 45 días de futuro y ESPN solo publica
// calendario unas tres semanas: 36 de esos 45 estaban vacíos, y una página de
// día vacía ya sale con `noindex`. O sea que le pedíamos a Google que rastreara
// páginas que nosotros mismos marcábamos como no indexables.
//
// La ruta sigue sirviendo los 45 a propósito: una URL que existe y responde 200
// con `noindex` es mejor que un 404, y el feed puede traer un partido suelto muy
// lejano. Lo que cambia es solo lo que anunciamos.
describe('sitemapDays', () => {
  const today = '2026-09-18'
  const conPartidos = new Set([addDays(today, 1), addDays(today, 5), addDays(today, 20)])

  it('anuncia del futuro solo los días que tienen partidos', () => {
    const days = sitemapDays(today, [], conPartidos)
    const futuros = days.filter(d => dayOffsetFrom(d, today) > 0)
    expect(futuros.sort()).toEqual([...conPartidos].sort())
  })

  it('no toca el pasado ni el archivo, que es lo que mejor convierte', () => {
    const archivo = ['2026-05-12', '2026-06-30']
    const days = sitemapDays(today, archivo, conPartidos)
    for (const d of archivo) expect(days).toContain(d)
    // Los 30 días hacia atrás más hoy siguen enteros.
    const pasados = days.filter(d => dayOffsetFrom(d, today) <= 0 && !archivo.includes(d))
    expect(pasados.length).toBe(DAY_PAGE_PAST + 1)
  })

  it('hoy se anuncia aunque el feed no lo mencione', () => {
    expect(sitemapDays(today, [], new Set([addDays(today, 3)]))).toContain(today)
  })

  it('nunca anuncia un día que la ruta no serviría', () => {
    const servibles = new Set(servableDays(today, ['2026-05-12']))
    for (const d of sitemapDays(today, ['2026-05-12'], conPartidos)) {
      expect(servibles.has(d)).toBe(true)
    }
  })

  it('SIN datos del feed no recorta nada: un fallo de red no encoge el sitemap', () => {
    // El modo de fallo que queremos evitar es justo el que nos dejó tres días
    // sin fútbol: una llamada que falla y se lee como «no hay nada».
    expect(sitemapDays(today, ['2026-05-12'], new Set()))
      .toEqual(servableDays(today, ['2026-05-12']))
  })

  it('sale ordenado de más reciente a más antiguo, como antes', () => {
    const days = sitemapDays(today, ['2026-05-12'], conPartidos)
    expect([...days].sort((a, b) => b.localeCompare(a))).toEqual(days)
  })
})
