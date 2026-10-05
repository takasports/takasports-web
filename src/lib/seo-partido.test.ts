import { describe, expect, it } from 'vitest'
import { fichaVisual } from '@/lib/partido-visual'
import { competicionCorta, descripcionSeoPartido, faqPartido, MAX_DESCRIPCION, MAX_TITULO, sportsEventJsonLd, tituloSeoPartido, unirPreguntas, type DatosSeoPartido } from '@/lib/seo-partido'

const summary = {
  header: { id: '999', league: { name: 'UEFA Nations League' }, competitions: [{ date: '2026-10-02T18:45Z', status: { type: { completed: true, state: 'post' } }, competitors: [
    { homeAway: 'home', score: '6', team: { id: '471', displayName: 'Poland' } },
    { homeAway: 'away', score: '0', team: { id: '473', displayName: 'Romania' } },
  ] }] },
  gameInfo: { venue: { fullName: 'Stadion Narodowy', address: { city: 'Varsovia', country: 'Poland' } } },
  keyEvents: [
    { clock: { displayValue: "24'" }, type: { text: 'Penalty - Scored' }, team: { id: '471' }, participants: [{ athlete: { displayName: 'Robert Lewandowski' } }] },
    { clock: { displayValue: "47'" }, type: { text: 'Goal' }, team: { id: '471' }, participants: [{ athlete: { displayName: 'Robert Lewandowski' } }, { athlete: { displayName: 'Nicola Zalewski' } }] },
    { clock: { displayValue: "49'" }, type: { text: 'Own Goal' }, team: { id: '471' }, participants: [{ athlete: { displayName: 'Virgil Ghita' } }] },
    { clock: { displayValue: "22'" }, type: { text: 'Red Card' }, team: { id: '473' }, participants: [{ athlete: { displayName: 'Radu Dragusin' } }] },
  ],
  standings: { groups: [{ standings: { entries: [
    { id: '471', team: 'Poland', stats: [{ name: 'rank', displayValue: '3' }, { name: 'points', displayValue: '4' }, { name: 'gamesPlayed', displayValue: '3' }] },
  ] } }] },
}
const ficha = fichaVisual(summary)!
const cronica: DatosSeoPartido = { tipo: 'cronica', home: 'Polonia', away: 'Rumanía', iso: ficha.iso!, competicion: 'Nations League', deporte: 'futbol', ficha, tv: [] }
const pre = (o: Partial<DatosSeoPartido> = {}): DatosSeoPartido => ({
  tipo: 'previa', home: 'Barcelona', away: 'Real Madrid', iso: '2026-10-25T20:00:00Z', competicion: 'LaLiga', deporte: 'futbol',
  ficha: { ...ficha, terminado: false, home: { ...ficha.home, goles: null }, away: { ...ficha.away, goles: null }, forma: { home: ['V', 'V', 'E', 'D', 'V'], away: ['V', 'V', 'V', 'V', 'E'] }, caraACara: [{ fecha: '2026-04-26', local: 'Real Madrid', golesLocal: 2, visitante: 'Barcelona', golesVisitante: 1 }], figura: null },
  tv: [{ countryCode: 'ES', country: 'España', channels: ['DAZN'] }, { countryCode: 'MX', country: 'México', channels: ['Sky Sports'] }],
  ...o,
})

describe('seo de partido', () => {
  it('la ficha trae fecha, liga y estadio', () => {
    expect([ficha.iso, ficha.liga, ficha.estadio, ficha.ciudad]).toEqual(['2026-10-02T18:45Z', 'UEFA Nations League', 'Stadion Narodowy', 'Varsovia'])
  })
  it('competición corta por la liga del matchRef', () => {
    expect(competicionCorta('soccer_esp.1_123', 'LaLiga EA Sports')).toBe('LaLiga')
    expect(competicionCorta('soccer_fifa.worldq.conmebol_1')).toBe('Eliminatorias')
    expect(competicionCorta(null, 'LaLiga EA Sports')).toBe('LaLiga')
  })
  it('título de previa con lo que se busca y la rivalidad, y encoge si no cabe', () => {
    expect(tituloSeoPartido(pre())).toBe('Barcelona vs Real Madrid: horario y dónde ver el Clásico')
    expect(tituloSeoPartido(pre({ home: 'Sevilla', away: 'Villarreal' }))).toBe('Sevilla vs Villarreal: horario y dónde ver el partido | LaLiga')
    const largo = tituloSeoPartido(pre({ home: 'Borussia Mönchengladbach', away: 'Eintracht Frankfurt', competicion: 'Bundesliga' }))
    expect(largo.length).toBeLessThanOrEqual(MAX_TITULO)
    expect(largo).toMatch(/^Borussia Mönchengladbach vs Eintracht Frankfurt: horario/)
  })
  it('título de crónica con el marcador', () => {
    expect(tituloSeoPartido(cronica)).toBe('Polonia 6-0 Rumanía: resumen, goles y figura | Nations League')
  })
  it('descripciones con día, horas y canal, o con goles y figura', () => {
    const dp = descripcionSeoPartido(pre())!
    expect(dp).toBe('Barcelona - Real Madrid (LaLiga): domingo 25 de octubre, 21:00 en España y 14:00 en México. Por DAZN. Previa con la forma, el cara a cara y lo que se juega.')
    expect(dp.length).toBeLessThanOrEqual(MAX_DESCRIPCION)
    const dc = descripcionSeoPartido(cronica)!
    expect(dc.length).toBeLessThanOrEqual(MAX_DESCRIPCION)
    expect(dc).toMatch(/^Polonia 6-0 Rumanía \(Nations League\): goles de Robert Lewandowski \(24' de penalti y 47'\) y Virgil Ghita \(49', en propia\)\./)
  })
  it('preguntas de la previa: hora por país, TV, estadio, cómo llegan y último cara a cara', () => {
    const f = faqPartido(pre())
    expect(f.map((x) => x.q)).toEqual([
      '¿A qué hora es el Barcelona - Real Madrid?', '¿Dónde ver el Barcelona - Real Madrid por TV?', '¿Dónde se juega el Barcelona - Real Madrid?',
      '¿Cómo llegan Barcelona y Real Madrid?', '¿Cuál fue el último Barcelona - Real Madrid?',
    ])
    expect(f[0].a).toMatch(/^Se juega el domingo 25 de octubre a las 21:00 en España \(hora peninsular\); en México, a las 14:00, en Argentina, a las 17:00/)
    expect(f[1].a).toBe('En España, por DAZN. En México, por Sky Sports.')
    expect(f[3].a).toMatch(/^Barcelona suma 3 victorias, 1 empate y 1 derrota en sus últimos 5 partidos; Real Madrid, 4 victorias y 1 empate/)
    expect(f[4].a).toBe('El último enfrentamiento fue el 26 de abril de 2026: Real Madrid 2-1 Barcelona.')
  })
  it('preguntas de la crónica: resultado, goles, figura, expulsados y clasificación', () => {
    const f = faqPartido(cronica)
    expect(f.map((x) => x.q)).toEqual([
      '¿Cómo quedó el Polonia - Rumanía?', '¿Quién marcó los goles del Polonia - Rumanía?', '¿Quién fue la figura del Polonia - Rumanía?',
      '¿Hubo expulsados en el Polonia - Rumanía?', '¿Cómo queda la clasificación?',
    ])
    expect(f[2].a).toBe('Robert Lewandowski, con 2 goles (1 de penalti).')
    expect(f[4].a).toBe('Polonia es 3.º con 4 puntos en 3 partidos.')
  })
  it('SportsEvent y la unión con las preguntas del pipeline sin repetir', () => {
    const j = sportsEventJsonLd(pre(), 'https://x/noticias/a')!
    expect(j).toMatchObject({ '@type': 'SportsEvent', name: 'Barcelona - Real Madrid', startDate: '2026-10-25T20:00:00Z', location: { name: 'Stadion Narodowy' }, superEvent: { name: 'LaLiga' } })
    const u = unirPreguntas(faqPartido(pre()), [{ q: '¿A qué hora es el Barcelona-Real Madrid?', a: 'x' }, { q: '¿Quién arbitra?', a: 'y' }])
    expect(u.map((x) => x.q).slice(-1)).toEqual(['¿Quién arbitra?'])
  })
})
