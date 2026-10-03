import { describe, it, expect } from 'vitest'
import {
  asuntoSemanal, claveDeporte, conUtm, contenidoSuficiente, diaHoraMadrid, edicionSemanal,
  elegirDestacadas, elegirPartidosGrandes, juegoDeLaSemana, medianocheMadrid, nombreVisible,
  rangoCorto, sumarDias, fechaLarga, resumenUtil,
  type ContenidoSemanal, type NoticiaCandidata, type PartidoCandidato,
} from './semanal'

describe('edicionSemanal', () => {
  it('en modo envío, un lunes es la edición de ese lunes', () => {
    // Lunes 5 oct 2026, 09:30 Madrid (07:30 UTC, horario de verano)
    const e = edicionSemanal(new Date('2026-10-05T07:30:00Z'), 'envio')
    expect(e.lunes).toBe('2026-10-05')
    expect(e.semanaISO).toBe('2026-W41')
    expect(e.clave).toBe('semanal-2026-41')
    expect(e.lunesAnterior).toBe('2026-09-28')
  })

  it('un reintento el martes sigue siendo la MISMA edición (idempotencia)', () => {
    const lunes = edicionSemanal(new Date('2026-10-05T07:30:00Z'), 'envio')
    const martes = edicionSemanal(new Date('2026-10-06T07:30:00Z'), 'envio')
    expect(martes.clave).toBe(lunes.clave)
  })

  it('en modo vista, un sábado es la edición del lunes siguiente', () => {
    const e = edicionSemanal(new Date('2026-10-03T10:00:00Z'), 'vista')
    expect(e.lunes).toBe('2026-10-05')
    expect(e.clave).toBe('semanal-2026-41')
  })

  it('la semana va de medianoche a medianoche de Madrid', () => {
    const e = edicionSemanal(new Date('2026-10-05T07:30:00Z'))
    expect(new Date(e.desdeMs).toISOString()).toBe('2026-10-04T22:00:00.000Z')
    expect(new Date(e.hastaMs).toISOString()).toBe('2026-10-11T22:00:00.000Z')
  })

  it('cruza bien el cambio de hora de octubre (la semana dura 7 días + 1 h)', () => {
    const e = edicionSemanal(new Date('2026-10-19T08:00:00Z'))
    expect(new Date(e.desdeMs).toISOString()).toBe('2026-10-18T22:00:00.000Z')
    // El domingo 25 se atrasa la hora: el lunes 26 empieza a las 23:00 UTC.
    expect(new Date(e.hastaMs).toISOString()).toBe('2026-10-25T23:00:00.000Z')
  })

  it('a las 00:30 del lunes en Madrid (domingo en UTC) ya es la edición del lunes', () => {
    const e = edicionSemanal(new Date('2026-10-04T22:30:00Z'), 'envio')
    expect(e.lunes).toBe('2026-10-05')
  })

  it('año ISO en el borde de año', () => {
    const e = edicionSemanal(new Date('2026-12-28T09:00:00Z'))
    expect(e.semanaISO).toBe('2026-W53')
    expect(e.clave).toBe('semanal-2026-53')
  })
})

describe('fechas', () => {
  it('sumarDias cruza meses', () => {
    expect(sumarDias('2026-09-28', 7)).toBe('2026-10-05')
    expect(sumarDias('2026-03-02', -7)).toBe('2026-02-23')
  })
  it('medianocheMadrid en invierno', () => {
    expect(new Date(medianocheMadrid('2026-01-12')).toISOString()).toBe('2026-01-11T23:00:00.000Z')
  })
  it('diaHoraMadrid', () => {
    expect(diaHoraMadrid('2026-10-05T18:45:00Z')).toEqual({ dia: 'Lun 5', hora: '20:45' })
    expect(diaHoraMadrid('2026-10-05T18:45:00Z', true)).toEqual({ dia: 'Lun 5', hora: '' })
  })
  it('rangoCorto y fechaLarga', () => {
    expect(rangoCorto('2026-09-24', '2026-09-30')).toBe('del 24 al 30 sep')
    expect(rangoCorto('2026-09-28', '2026-10-04')).toBe('del 28 sep al 4 oct')
    expect(fechaLarga('2026-10-05')).toBe('lunes 5 de octubre de 2026')
  })
})

describe('conUtm', () => {
  it('añade las tres UTM y el bloque', () => {
    const u = new URL(conUtm('/noticias/x', 'semanal-2026-41', 'destacadas'))
    expect(u.origin).toBe('https://www.takasportsmedia.com')
    expect(u.pathname).toBe('/noticias/x')
    expect(u.searchParams.get('utm_source')).toBe('newsletter')
    expect(u.searchParams.get('utm_medium')).toBe('email')
    expect(u.searchParams.get('utm_campaign')).toBe('semanal-2026-41')
    expect(u.searchParams.get('utm_content')).toBe('destacadas')
  })
  it('respeta la query que ya traía', () => {
    const u = new URL(conUtm('/calendario?d=1', 'semanal-2026-41'))
    expect(u.searchParams.get('d')).toBe('1')
    expect(u.searchParams.has('utm_content')).toBe(false)
  })
})

const AHORA = new Date('2026-10-05T07:30:00Z').getTime()
function nota(slug: string, sport: string, competition: string, horasAtras = 24, extra: Partial<NoticiaCandidata> = {}): NoticiaCandidata {
  return {
    slug, title: `Titular ${slug}`, sport, competition,
    publishedAt: new Date(AHORA - horasAtras * 3600_000).toISOString(), ...extra,
  }
}

describe('elegirDestacadas', () => {
  it('una por deporte antes de repetir deporte', () => {
    const r = elegirDestacadas([
      nota('a', 'futbol', 'Champions'), nota('b', 'futbol', 'LaLiga'), nota('c', 'futbol', 'Premier'),
      nota('d', 'formula1', 'F1'), nota('e', 'ufc', 'UFC'), nota('f', 'tenis', 'ATP 500'),
    ], { ahora: AHORA, n: 5 })
    expect(r.map(x => x.slug)).toEqual(['a', 'd', 'e', 'f', 'b'])
  })

  it('NBA y Euroliga cuentan como el mismo deporte', () => {
    expect(claveDeporte('nba')).toBe(claveDeporte('baloncesto'))
    expect(claveDeporte(null)).toBe('otros')
  })

  it('los clics de Google suben una noticia por encima de la liga', () => {
    const r = elegirDestacadas([nota('a', 'futbol', 'LaLiga'), nota('b', 'futbol', 'Amistoso')], {
      ahora: AHORA, n: 1, clics: new Map([['b', 60]]),
    })
    expect(r[0].slug).toBe('b')
  })

  it('fuera previas, repetidas y lo que ya sale en Lo más leído', () => {
    const r = elegirDestacadas([
      nota('a', 'futbol', 'Champions', 10, { type: 'previa' }),
      nota('b', 'futbol', 'LaLiga'), nota('b', 'futbol', 'LaLiga'),
      nota('c', 'tenis', 'ATP'),
    ], { ahora: AHORA, excluir: new Set(['c']) })
    expect(r.map(x => x.slug)).toEqual(['b'])
  })

  it('lo reciente gana el empate', () => {
    const r = elegirDestacadas([nota('vieja', 'futbol', 'LaLiga', 150), nota('nueva', 'futbol', 'LaLiga', 20)], { ahora: AHORA, n: 1 })
    expect(r[0].slug).toBe('nueva')
  })
})

describe('elegirPartidosGrandes', () => {
  const e = edicionSemanal(new Date('2026-10-05T07:30:00Z'))
  const p = (id: string, home: string, away: string | null, comp: string, iso: string, sport = 'Fútbol', extra: Partial<PartidoCandidato> = {}): PartidoCandidato =>
    ({ id, home, away, comp, sport, isoDate: iso, ...extra })

  it('solo la semana que empieza, ordenados por fecha', () => {
    const r = elegirPartidosGrandes([
      p('1', 'Real Madrid', 'Villarreal', 'LaLiga', '2026-10-10T19:00:00Z'),
      p('2', 'Francia', 'Bélgica', 'Nations League', '2026-10-05T18:45:00Z'),
      p('fuera-antes', 'Barcelona', 'Sevilla', 'LaLiga', '2026-10-04T19:00:00Z'),
      p('fuera-despues', 'Liverpool', 'Arsenal', 'Premier League', '2026-10-12T15:00:00Z'),
    ], e.desdeMs, e.hastaMs)
    expect(r.map(x => x.id)).toEqual(['2', '1'])
  })

  it('el ranking de Destacados decide: un cartel gana a un partido menor', () => {
    const r = elegirPartidosGrandes([
      p('menor', 'Getafe', 'Alavés', 'LaLiga 2', '2026-10-06T19:00:00Z'),
      p('cartel', 'Real Madrid', 'Barcelona', 'LaLiga', '2026-10-10T19:00:00Z'),
    ], e.desdeMs, e.hastaMs, 1)
    expect(r[0].id).toBe('cartel')
  })

  it('tope de 3 en fútbol y 2 en el resto para dejar sitio a otros', () => {
    const futbol = ['a', 'b', 'c', 'd'].map((id, i) => p(id, `Equipo ${id}`, `Rival ${id}`, 'Champions', `2026-10-0${6 + i}T19:00:00Z`))
    const f1 = p('gp', 'GP de Japón', null, 'F1', '2026-10-11T05:00:00Z', 'F1')
    const r = elegirPartidosGrandes([...futbol, f1], e.desdeMs, e.hastaMs, 4)
    expect(r.filter(x => x.sport === 'Fútbol')).toHaveLength(3)
    expect(r.some(x => x.id === 'gp')).toBe(true)
    const nba = ['n1', 'n2', 'n3'].map((id, i) => p(id, 'Los Angeles Lakers', `Rival ${id}`, 'NBA', `2026-10-0${6 + i}T19:00:00Z`, 'NBA'))
    expect(elegirPartidosGrandes(nba, e.desdeMs, e.hastaMs, 6)).toHaveLength(2)
  })

  it('sin duplicados, sin pasados y sin fecha', () => {
    const r = elegirPartidosGrandes([
      p('1', 'Francia', 'Bélgica', 'Nations League', '2026-10-05T18:45:00Z'),
      p('2', 'Francia', 'Bélgica', 'Nations League', '2026-10-05T18:45:00Z'),
      p('3', 'Italia', 'Turquía', 'Nations League', '2026-10-05T18:45:00Z', 'Fútbol', { isPast: true }),
      { id: '4', home: 'X', away: 'Y', comp: 'LaLiga', sport: 'Fútbol' },
    ], e.desdeMs, e.hastaMs)
    expect(r.map(x => x.id)).toEqual(['1'])
  })

  it('pone el motivo del badge cuando lo hay', () => {
    const r = elegirPartidosGrandes([p('1', 'España', 'Croacia', 'Nations League', '2026-10-06T18:45:00Z')], e.desdeMs, e.hastaMs)
    expect(r[0].motivo).toBe('Selección')
  })
})

describe('nombreVisible', () => {
  it('nunca enseña un correo', () => {
    expect(nombreVisible('pepe@gmail.com', 'Takero 0042')).toBe('Takero 0042')
    expect(nombreVisible(null, 'Takero 0042')).toBe('Takero 0042')
    expect(nombreVisible('  ', 'Takero 0042')).toBe('Takero 0042')
    expect(nombreVisible('Gabriel Guerrero', 'Takero 0042')).toBe('Gabriel Guerrero')
  })
  it('recorta nombres larguísimos', () => {
    expect(nombreVisible('x'.repeat(40), 'T').length).toBe(28)
  })
})

describe('juegoDeLaSemana', () => {
  it('se turnan Mi Once (par) y Sopa de Cracks (impar)', () => {
    expect(juegoDeLaSemana('2026-W41')).toBe('sopacracks')
    expect(juegoDeLaSemana('2026-W42')).toBe('mionce')
  })
})

function contenido(over: Partial<ContenidoSemanal> = {}): ContenidoSemanal {
  const noticia = (t: string) => ({ titulo: t, resumen: null, deporte: 'futbol', competicion: null, url: 'https://x', imagen: null })
  return {
    edicion: edicionSemanal(new Date('2026-10-05T07:30:00Z')),
    generadoEn: '2026-10-05T07:30:00Z',
    destacadas: [noticia('Uno'), noticia('Dos'), noticia('Tres')],
    masLeidas: [],
    masLeidasVentana: null,
    partidos: [{ dia: 'Lun 5', hora: '20:45', comp: 'Nations', sport: 'Fútbol', titulo: 'Francia – Bélgica', motivo: 'Selección', canal: null, url: 'https://x' }],
    movimientos: [],
    ligaTaka: { jornada: [], jornadaParticipantes: 0, jornadaUrl: '', general: [], generalUrl: '', abierta: null },
    juego: { id: 'mionce', nombre: 'Mi Once', titulo: 't', descripcion: 'd', url: 'https://x' },
    ...over,
  }
}

describe('contenidoSuficiente y asunto', () => {
  it('sin 3 noticias no sale', () => {
    expect(contenidoSuficiente(contenido()).ok).toBe(true)
    expect(contenidoSuficiente(contenido({ destacadas: [] })).ok).toBe(false)
    expect(contenidoSuficiente(contenido({ partidos: [] })).ok).toBe(false)
  })
  it('el asunto abre con la marca y no pasa de 78 caracteres', () => {
    const largo = contenido({ destacadas: [{ titulo: 'Lewandowski celebra su séptimo hat-trick internacional y rompe el récord de goles con Polonia en la Nations League', resumen: null, deporte: 'futbol', competicion: null, url: '', imagen: null }] })
    const a = asuntoSemanal(largo)
    expect(a.startsWith('Taka Semanal: Lewandowski')).toBe(true)
    expect(a.length).toBeLessThanOrEqual(78)
    expect(a.endsWith('…')).toBe(true)
  })
})

describe('resumenUtil', () => {
  it('no repite el titular como entradilla', () => {
    expect(resumenUtil('De la Fuente elogia a Lamine', 'De la Fuente elogia a Lamine y analiza su papel.')).toBeNull()
    expect(resumenUtil('Título', '  ')).toBeNull()
    expect(resumenUtil('Kane marca dos', 'El inglés ya suma 14 goles en la Bundesliga.')).toBe('El inglés ya suma 14 goles en la Bundesliga.')
  })
})
