import { describe, expect, it } from 'vitest'
import type { SportEvent } from '@/lib/types'
import { candidatasPrevia, cabeEnTopes, elegirPrevias, esDiaGrande, esGrandeLatam, interesHispano, MAX_PREVIAS_POR_DIA, PUNTUACION_ANTICIPADA } from '@/lib/previas'
import { construirDossier, esPretemporada, parseMatchRef, probImplicita } from '@/lib/previas-dossier'

const NOW = Date.parse('2026-10-02T06:00:00Z')
const enHoras = (h: number) => new Date(NOW + h * 3600_000).toISOString()

let n = 0
function ev(p: Partial<SportEvent>): SportEvent {
  n++
  return {
    id: `e${n}`, home: 'A', away: 'B', sport: 'Fútbol', comp: 'LaLiga', date: '', time: '', accent: '',
    isoDate: enHoras(10), matchRef: `soccer_esp.1_${1000 + n}`, ...p,
  }
}

describe('candidatasPrevia', () => {
  it('entre 4 y 16 horas después; los grandes de fútbol, hasta 40 (la víspera)', () => {
    const evs = [
      ev({ home: 'Real Madrid', away: 'Barcelona', isoDate: enHoras(2) }),
      ev({ home: 'Real Madrid', away: 'Barcelona', isoDate: enHoras(10) }),
      ev({ home: 'Real Madrid', away: 'Barcelona', isoDate: enHoras(30) }),
      ev({ home: 'Real Madrid', away: 'Barcelona', isoDate: enHoras(44) }),
      ev({ home: 'Sevilla', away: 'Getafe', isoDate: enHoras(30) }),
    ]
    const cs = candidatasPrevia(evs, NOW)
    expect(cs.map((c) => c.ev.isoDate)).toEqual([enHoras(10), enHoras(30)])
    expect(cs[1].puntuacion).toBeGreaterThanOrEqual(PUNTUACION_ANTICIPADA)
  })
  it('el baloncesto no se adelanta aunque tenga cartel', () => {
    const nba = ev({ home: 'Los Angeles Lakers', away: 'Boston Celtics', sport: 'Baloncesto', comp: 'NBA', matchRef: 'basketball_nba_77', isoDate: enHoras(30) })
    expect(candidatasPrevia([nba], NOW)).toHaveLength(0)
  })

  it('descarta sin rival, sin matchRef, sin hora o de deportes sin previa', () => {
    const evs = [
      ev({ home: 'Real Madrid', away: null }),
      ev({ home: 'Real Madrid', away: 'Barcelona', matchRef: undefined }),
      ev({ home: 'Real Madrid', away: 'Barcelona', timeTbd: true }),
      ev({ home: 'Gran Premio', away: 'X', sport: 'F1', comp: 'Fórmula 1' }),
    ]
    expect(candidatasPrevia(evs, NOW)).toHaveLength(0)
  })

  it('no repite un partido que ya tiene previa encargada', () => {
    const e = ev({ home: 'Real Madrid', away: 'Barcelona' })
    expect(candidatasPrevia([e], NOW, new Set([e.matchRef!]))).toHaveLength(0)
  })

  it('deja fuera los partidos de poco cartel', () => {
    expect(candidatasPrevia([ev({ home: 'Chipre', away: 'Armenia', comp: 'Nations' })], NOW)).toHaveLength(0)
  })

  it('el interés hispano sube a las selecciones de habla hispana', () => {
    expect(interesHispano('Colombia', 'Paraguay')).toBe(4)
    expect(interesHispano('Suiza', 'Eslovenia')).toBe(0)
    const [c] = candidatasPrevia([ev({ home: 'España', away: 'Chequia', comp: 'Nations' })], NOW)
    expect(c?.puntuacion).toBeGreaterThan(13)
  })
})

describe('topes', () => {
  it('como mucho 4 de fútbol y el total del día', () => {
    const evs = Array.from({ length: 8 }, () => ev({ home: 'Real Madrid', away: 'Barcelona' }))
    const elegidas = elegirPrevias(evs, NOW)
    expect(elegidas).toHaveLength(4)
    expect(cabeEnTopes(elegidas, { ev: evs[0], sport: 'baloncesto', puntuacion: 20 })).toBe(true)
    expect(MAX_PREVIAS_POR_DIA).toBe(5)
  })
  it('los topes van por el día del partido: la víspera no gasta el cupo de hoy', () => {
    const hoy = Array.from({ length: 5 }, () => ev({ home: 'Real Madrid', away: 'Barcelona', isoDate: enHoras(10) }))
    const manana = Array.from({ length: 2 }, () => ev({ home: 'Real Madrid', away: 'Barcelona', isoDate: enHoras(34) }))
    const elegidas = elegirPrevias([...hoy, ...manana], NOW)
    expect(elegidas.filter((c) => c.ev.isoDate === enHoras(10))).toHaveLength(4)
    expect(elegidas.filter((c) => c.ev.isoDate === enHoras(34))).toHaveLength(2)
  })
  it('las de pasadas anteriores del día cuentan para el tope', () => {
    const yaHoy = [{ sport: 'futbol' }, { sport: 'futbol' }, { sport: 'futbol' }, { sport: 'futbol' }]
    const c = { ev: ev({}), sport: 'futbol' as const, puntuacion: 20 }
    expect(cabeEnTopes(yaHoy, c)).toBe(false)
    expect(cabeEnTopes(yaHoy, { ...c, sport: 'baloncesto' })).toBe(true)
    expect(cabeEnTopes([...yaHoy, { sport: 'baloncesto' }], { ...c, sport: 'baloncesto' })).toBe(false)
  })
})

describe('carril latinoamericano y días grandes', () => {
  it('un grande de Liga MX entra con su mínimo; un partido menor, no', () => {
    const clasico = ev({ home: 'América', away: 'Guadalajara', comp: 'Liga MX', matchRef: 'soccer_mex.1_9001' })
    const menor = ev({ home: 'Puebla', away: 'León', comp: 'Liga MX', matchRef: 'soccer_mex.1_9002' })
    const cs = candidatasPrevia([clasico, menor], NOW)
    expect(cs.map((c) => c.ev.home)).toEqual(['América'])
    expect(cs[0].latam).toBe(true)
  })
  it('Brasileirão solo con cartel; Argentina con un grande sí entra', () => {
    const menorBr = ev({ home: 'Remo', away: 'Grêmio', comp: 'Brasileirão', matchRef: 'soccer_bra.1_9003' })
    const boca = ev({ home: 'Boca Juniors', away: 'Tigre', comp: 'Liga Argentina', matchRef: 'soccer_arg.1_9004' })
    expect(candidatasPrevia([menorBr, boca], NOW).map((c) => c.ev.home)).toEqual(['Boca Juniors'])
  })
  it('los grandes: nombre exacto, sin homónimos', () => {
    expect(esGrandeLatam('Boca Juniors')).toBe(true)
    expect(esGrandeLatam('Independiente')).toBe(true)
    expect(esGrandeLatam('Independiente Rivadavia')).toBe(false)
    expect(esGrandeLatam('Deportivo Riestra')).toBe(false)
  })
  it('las latinoamericanas tienen su cupo de 3 y no quitan sitio a Europa', () => {
    const lat = { ev: ev({}), sport: 'futbol' as const, puntuacion: 12, latam: true }
    const eu = { ev: ev({}), sport: 'futbol' as const, puntuacion: 20 }
    const L = { sport: 'futbol', latam: true }
    expect(cabeEnTopes([L, L], lat)).toBe(true)
    expect(cabeEnTopes([L, L, L], lat)).toBe(false)
    const cuatroEuropa = [{ sport: 'futbol' }, { sport: 'futbol' }, { sport: 'futbol' }, { sport: 'futbol' }]
    expect(cabeEnTopes([...cuatroEuropa, L, L, L], eu)).toBe(false)
    expect(cabeEnTopes([L, L, L], eu)).toBe(true)
  })
  it('fin de semana o día de Champions: tope 8 y 6 de fútbol', () => {
    const sabado = Date.parse('2026-10-03T09:00:00Z')
    expect(esDiaGrande([], sabado)).toBe(true)
    expect(esDiaGrande([], NOW)).toBe(false)
    expect(esDiaGrande([ev({ comp: 'Champions', isoDate: '2026-10-02T19:00:00Z' })], NOW)).toBe(true)
    expect(esDiaGrande([ev({ comp: 'Champions League (F)', isoDate: '2026-10-02T19:00:00Z' })], NOW)).toBe(false)
    const cinco = Array.from({ length: 5 }, () => ({ sport: 'futbol' }))
    const c = { ev: ev({}), sport: 'futbol' as const, puntuacion: 20 }
    expect(cabeEnTopes(cinco, c, false)).toBe(false)
    expect(cabeEnTopes(cinco, c, true)).toBe(true)
    expect(cabeEnTopes([...cinco, { sport: 'futbol' }], c, true)).toBe(false)
  })
})

describe('dossier', () => {
  it('parseMatchRef y probImplicita', () => {
    expect(parseMatchRef('soccer_uefa.nations_401861118')).toEqual({ sport: 'soccer', league: 'uefa.nations', event: '401861118' })
    expect(parseMatchRef('racing_f1_1')).toBeNull()
    expect(probImplicita(-300)).toBe(75)
    expect(probImplicita(300)).toBe(25)
  })

  it('pretemporada NBA', () => {
    expect(esPretemporada({ header: { season: { type: 1 } } }, 'baloncesto')).toBe(true)
    expect(esPretemporada({ header: { season: { type: 2 } } }, 'baloncesto')).toBe(false)
    expect(esPretemporada({ header: { season: { type: 1 } } }, 'futbol')).toBe(false)
  })

  const summary = {
    header: {
      league: { name: 'UEFA Nations League' },
      season: { name: '2026-27 UEFA Nations League, League Phase' },
      competitions: [{ competitors: [
        { homeAway: 'home', team: { id: '1', displayName: 'France' }, record: [{ type: 'points', displayValue: '6' }] },
        { homeAway: 'away', team: { id: '2', displayName: 'Italy' }, record: [{ type: 'points', displayValue: '3' }] },
      ] }],
    },
    standings: { groups: [{ header: 'Tabla', standings: { entries: [
      { id: '1', team: 'France', stats: [{ name: 'rank', displayValue: '1' }, { name: 'points', displayValue: '6' }] },
      { id: '2', team: 'Italy', stats: [{ name: 'rank', displayValue: '3' }, { name: 'points', displayValue: '3' }] },
    ] } }] },
    lastFiveGames: [{ team: { id: '1' }, events: [
      { gameDate: '2026-09-25T18:00Z', gameResult: 'W', homeTeamId: '9', awayTeamId: '1', homeTeamScore: '0', awayTeamScore: '1', score: '1-0', opponent: { displayName: 'Türkiye' } },
      { gameDate: '2026-09-28T18:00Z', gameResult: 'L', homeTeamId: '1', awayTeamId: '8', homeTeamScore: '1', awayTeamScore: '1', homeShootoutScore: '2', awayShootoutScore: '4', opponent: { displayName: 'Belgium' } },
    ] }],
    seasonseries: [{ summary: 'FRA leads 1-0', events: [
      { date: '2024-11-17T19:45Z', status: 'post', competitors: [
        { homeAway: 'home', score: '1', team: { id: '2', displayName: 'Italy' } },
        { homeAway: 'away', score: '3', team: { id: '1', displayName: 'France' } },
      ] },
    ] }],
  }
  const { datos, texto } = construirDossier(summary, {
    matchRef: 'soccer_uefa.nations_1', sport: 'futbol', home: 'Francia', away: 'Italia',
    competicion: 'Nations', kickoffIso: '2026-10-02T18:45:00Z',
  })

  it('usa el nombre largo de la competición y los nombres en español', () => {
    expect(datos.competicion).toBe('UEFA Nations League')
    expect(texto).toContain('Turquía')
    expect(texto).not.toContain('Türkiye')
  })

  it('el último partido va primero y con el marcador desde su lado, penaltis incluidos', () => {
    const i = texto.indexOf('SU ÚLTIMO PARTIDO')
    expect(texto.slice(i - 40, i + 120)).toContain('28 de septiembre')
    expect(texto).toContain('derrota 1-1 (2-4 en los penaltis) contra Bélgica')
    expect(texto).toContain('victoria 1-0 contra Turquía')
  })

  it('el cara a cara lleva el ganador escrito y el recuento calculado', () => {
    expect(texto).toContain('ganó Francia — Italia (local) 1, Francia (visitante) 3')
    expect(texto).toContain('Francia ganó 1')
  })

  it('los escenarios de puntos vienen calculados', () => {
    expect(texto).toContain('si gana Francia, Francia 9 y Italia 3')
    expect(texto).toContain('si empatan, Francia 7 y Italia 4')
  })

  it('sin derechos de TV lo dice, para que el redactor no invente canales', () => {
    expect(texto).toContain('TELEVISIÓN: no consta')
    const conTv = construirDossier(summary, { ...datos }, [{ country: 'España', channels: ['La 1'] }]).texto
    expect(conTv).toContain('- España: La 1')
  })
})
