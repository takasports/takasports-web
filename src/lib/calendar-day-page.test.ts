import { describe, it, expect } from 'vitest'
import {
  isValidDayParam, dayOffsetFrom, longDayLabel, shortDayLabel,
  relativeDayLabel, addDays, dayPageTitle, DAY_PAGE_PAST, DAY_PAGE_FUTURE,
  isPastDay, dayPageDescription, servableDays, sitemapDays,
  pickDayStars, DAY_DESCRIPTION_MAX, DAY_STAR_MIN_SCORE, type DayStar,
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
    expect(dayPageTitle('2026-08-21', '2026-08-21')).toBe('Partidos de hoy, viernes 21 de agosto de 2026')
    expect(dayPageTitle('2026-08-25', '2026-08-21')).toBe('Partidos del martes 25 de agosto de 2026: horarios y TV')
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
      .toBe('Resultados del sábado 22 de agosto de 2026: todos los marcadores')
  })

  it('hoy y ayer siguen prometiendo horarios', () => {
    expect(dayPageTitle(today, today)).toBe('Partidos de hoy, domingo 6 de septiembre de 2026')
    expect(dayPageTitle('2026-09-05', today)).toBe('Partidos de ayer, sábado 5 de septiembre de 2026')
  })
})

describe('dayPageDescription', () => {
  const today = '2026-09-06'

  it('en pasado habla de resultados', () => {
    expect(dayPageDescription('2026-08-22', 89, today)).toContain('Resultados de los 89 partidos')
  })

  it('en presente habla de horarios y canal', () => {
    expect(dayPageDescription('2026-09-07', 12, today)).toBe('Quién juega el lunes 7 de septiembre de 2026: los 12 partidos con horario y canal de televisión. Fútbol, NBA, tenis, F1 y más.')
  })

  it('sin todayIso se trata como día por jugar', () => {
    expect(dayPageDescription('2026-08-22', 89)).toContain('con horario y canal de televisión')
  })

  it('un día vacío no promete nada', () => {
    expect(dayPageDescription('2026-08-22', 0, today)).toBe('Agenda deportiva del sábado, 22 de agosto de 2026 en TakaSports.')
  })
})

describe('dayPageDescription con partidos estrella', () => {
  const today = '2026-10-01'
  const clasico: DayStar = { home: 'Barcelona', away: 'Real Madrid', time: '17:00', channel: 'DAZN' }
  const derbi: DayStar = { home: 'Inter', away: 'Juventus', time: '20:45' }

  it('nombra los dos partidos con hora y canal y cuenta el resto', () => {
    const d = dayPageDescription('2026-10-03', 33, today, [clasico, derbi])
    expect(d).toBe('Quién juega el sábado 3 de octubre de 2026: Barcelona–Real Madrid (17:00, DAZN), Inter–Juventus (20:45) y 31 partidos más con horario y TV.')
    expect(d.length).toBeLessThanOrEqual(DAY_DESCRIPTION_MAX)
  })

  it('sin canal ni hora no deja paréntesis vacíos', () => {
    const d = dayPageDescription('2026-10-03', 5, today, [{ home: 'Lakers', away: 'Celtics' }])
    expect(d).toBe('Quién juega el sábado 3 de octubre de 2026: Lakers–Celtics y 4 partidos más con horario y TV.')
  })

  it('singular y «sin resto» se escriben bien', () => {
    expect(dayPageDescription('2026-10-03', 3, today, [clasico, derbi])).toContain('y 1 partido más con horario')
    expect(dayPageDescription('2026-10-03', 2, today, [clasico, derbi]))
      .toBe('Quién juega el sábado 3 de octubre de 2026: Barcelona–Real Madrid (17:00, DAZN) y Inter–Juventus (20:45), con horario y TV.')
  })

  it('un día sin partidos grandes conserva la descripción genérica', () => {
    expect(dayPageDescription('2026-10-03', 12, today, []))
      .toBe('Quién juega el sábado 3 de octubre de 2026: los 12 partidos con horario y canal de televisión. Fútbol, NBA, tenis, F1 y más.')
  })

  it('con nombres largos recorta: primero el canal, luego el segundo partido', () => {
    const largo1: DayStar = { home: 'Borussia Mönchengladbach', away: 'Eintracht Frankfurt', time: '18:30', channel: 'Movistar Plus+ Liga de Campeones' }
    const largo2: DayStar = { home: 'Wolverhampton Wanderers', away: 'Brighton & Hove Albion', time: '21:00', channel: 'DAZN' }
    const d = dayPageDescription('2026-10-03', 40, today, [largo1, largo2])
    expect(d.length).toBeLessThanOrEqual(DAY_DESCRIPTION_MAX)
    expect(d).toContain('Borussia Mönchengladbach–Eintracht Frankfurt (18:30)')
    expect(d).not.toContain('Movistar')
  })

  it('si ni un partido cabe, vuelve a la genérica en vez de cortar a medias', () => {
    const imposible: DayStar = { home: 'A'.repeat(80), away: 'B'.repeat(80), time: '12:00' }
    expect(dayPageDescription('2026-10-03', 9, today, [imposible])).toContain('los 9 partidos con horario y canal de televisión')
  })

  it('un día ya jugado sigue hablando de resultados aunque haya estrellas', () => {
    expect(dayPageDescription('2026-09-20', 30, today, [clasico])).toContain('Resultados de los 30 partidos')
  })
})

describe('pickDayStars', () => {
  type Ev = {
    id: string; home: string; away: string | null; comp: string; sport: string
    time: string; isoDate: string; score: number; broadcast?: string; timeTbd?: boolean
  }
  const ev = (id: string, home: string, away: string | null, score: number, extra: Partial<Ev> = {}): Ev =>
    ({ id, home, away, comp: 'X', sport: 'Fútbol', time: '20:00', isoDate: `2026-10-03T${id}`, score, ...extra })
  const score = (e: Ev) => e.score
  const channel = (e: Ev) => e.broadcast

  it('elige los de más puntuación por encima del listón y solo cara a cara', () => {
    const stars = pickDayStars([
      ev('1', 'Getafe', 'Alavés', DAY_STAR_MIN_SCORE - 0.5),
      ev('2', 'Barcelona', 'Real Madrid', 17, { broadcast: 'DAZN' }),
      ev('3', 'Gran Premio de Japón', null, 20),
      ev('4', 'Inter', 'Juventus', 14),
      ev('5', 'Lazio', 'Torino', 11),
    ], score, channel)
    expect(stars).toEqual([
      { home: 'Barcelona', away: 'Real Madrid', time: '20:00', channel: 'DAZN' },
      { home: 'Inter', away: 'Juventus', time: '20:00', channel: undefined },
    ])
  })

  it('sin partidos grandes no devuelve nada', () => {
    expect(pickDayStars([ev('1', 'Mirandés', 'Eldense', 6)], score, channel)).toEqual([])
  })

  it('no repite cruce ni inventa hora si no la hay', () => {
    const stars = pickDayStars([
      ev('1', 'Sinner', 'Alcaraz', 15, { timeTbd: true, time: '' }),
      ev('2', 'Alcaraz', 'Sinner', 15),
    ], score, channel)
    expect(stars).toEqual([{ home: 'Sinner', away: 'Alcaraz', time: undefined, channel: undefined }])
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

describe('el título se escribe como se busca', () => {
  it('lleva el año y el día de la semana, que es como llegan las búsquedas', () => {
    const t = dayPageTitle('2026-10-03', '2026-09-20')
    expect(t).toContain('2026')
    expect(t).toContain('sábado')
    expect(t.startsWith('Partidos del ')).toBe(true)
  })
  it('cabe en lo que enseña Google (~60) en el caso más largo', () => {
    expect(dayPageTitle('2026-09-30', '2026-09-01').length).toBeLessThanOrEqual(62)
    expect(dayPageTitle('2026-09-30', '2026-09-30').length).toBeLessThanOrEqual(62)
  })
})
