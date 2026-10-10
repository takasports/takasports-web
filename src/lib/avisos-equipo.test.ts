import { describe, expect, it } from 'vitest'
import {
  cruzarPartidos, equiposPorUsuario, horaDecente, leerEstadoSummary, planAvisoHoy,
  textoAvisoFinal, textoAvisoHoy, tocaMirarResultado, zonaValida, SIN_MADRUGADA_HOY,
  type PartidoAviso,
} from './avisos-equipo'

// Octubre: Madrid UTC+2, Ciudad de México UTC-6, Buenos Aires UTC-3.
const atletiBarsa: PartidoAviso = {
  id: 'espn-soccer-esp.1-1', home: 'Atlético Madrid', away: 'Barcelona',
  isoDate: '2026-10-03T19:00:00Z', comp: 'LaLiga', sport: 'Fútbol',
  broadcast: 'DAZN', matchRef: 'soccer_esp.1_1',
}
const betisSevilla: PartidoAviso = {
  id: 'espn-soccer-esp.1-2', home: 'Sevilla', away: 'Real Betis',
  isoDate: '2026-10-03T16:30:00Z', comp: 'LaLiga', sport: 'Fútbol',
  broadcast: 'DAZN', matchRef: 'soccer_esp.1_2',
}
const ligaF: PartidoAviso = {
  id: 'espn-soccer-esp.w.1-3', home: 'Barcelona', away: 'Real Madrid',
  isoDate: '2026-10-03T15:00:00Z', comp: 'Liga F', sport: 'Fútbol', matchRef: 'soccer_esp.w.1_3',
}
const enUTC = (iso: string) => new Date(iso)

describe('equiposPorUsuario', () => {
  it('solo coge `team:` y quita duplicados sin distinguir mayúsculas', () => {
    const m = equiposPorUsuario([
      { user_id: 'u1', entry_id: 'team:Atlético Madrid' },
      { user_id: 'u1', entry_id: 'team:atlético madrid' },
      { user_id: 'u1', entry_id: 'sport:futbol' },
      { user_id: 'u1', entry_id: 'noticia:algo' },
      { user_id: 'u2', entry_id: 'team:' },
      { user_id: 'u3', entry_id: 'messi' },
    ])
    expect(m.get('u1')).toEqual(['Atlético Madrid'])
    expect(m.has('u2')).toBe(false)
    expect(m.has('u3')).toBe(false)
  })
})

describe('cruzarPartidos', () => {
  it('casa como local o visitante y devuelve el rival', () => {
    const [c] = cruzarPartidos(['Real Betis'], [atletiBarsa, betisSevilla])
    expect(c.equipo).toBe('Real Betis')
    expect(c.rival).toBe('Sevilla')
    expect(c.sigueAmbos).toBe(false)
  })
  it('un favorito masculino NO casa con la liga femenina homónima', () => {
    expect(cruzarPartidos(['Barcelona'], [ligaF])).toEqual([])
    const [c] = cruzarPartidos(['Real Madrid Femenino'], [ligaF])
    expect(c.equipo).toBe('Real Madrid')
    expect(c.femenino).toBe(true)
  })
  it('marca sigueAmbos si sigue a los dos', () => {
    const [c] = cruzarPartidos(['Atlético Madrid', 'Barcelona'], [atletiBarsa])
    expect(c.sigueAmbos).toBe(true)
  })
  it('ignora eventos sin rival (F1, UFC)', () => {
    expect(cruzarPartidos(['Alonso'], [{ ...atletiBarsa, home: 'Alonso', away: null }])).toEqual([])
  })
})

describe('planAvisoHoy — ventana', () => {
  const base = { equipos: ['Atlético Madrid'], partidos: [atletiBarsa], tz: 'Europe/Madrid' }

  it('más de 3 h antes del saque: aún no', () => {
    const r = planAvisoHoy({ ...base, ahora: enUTC('2026-10-03T15:30:00Z') })
    expect(r).toEqual({ ok: false, motivo: 'aun_no' })
  })
  it('dentro de la ventana: aviso con el día local como clave', () => {
    const r = planAvisoHoy({ ...base, ahora: enUTC('2026-10-03T17:00:00Z') })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.ref).toBe('2026-10-03')
    expect(r.texto.title).toBe('Hoy juega tu Atlético Madrid')
    expect(r.texto.body).toBe('21:00 vs Barcelona · LaLiga · DAZN')
    expect(r.texto.url).toBe('/partido/soccer_esp.1_1')
  })
  it('a menos de 15 min o empezado: ya no', () => {
    expect(planAvisoHoy({ ...base, ahora: enUTC('2026-10-03T18:50:00Z') })).toEqual({ ok: false, motivo: 'ya_empezado' })
    // Empezado = deja de ser «próximo»: no queda ninguno ese día.
    expect(planAvisoHoy({ ...base, ahora: enUTC('2026-10-03T19:30:00Z') })).toEqual({ ok: false, motivo: 'sin_partidos' })
  })
  it('nunca de madrugada en la hora del usuario', () => {
    // 21:00 Madrid = 13:00 CDMX, pero un partido a las 04:00 de Madrid (02:00Z)
    // pillaría al usuario de Madrid a la 01:00-03:45.
    const madrugon = { ...atletiBarsa, isoDate: '2026-10-04T02:00:00Z' }
    const r = planAvisoHoy({ equipos: ['Atlético Madrid'], partidos: [madrugon], tz: 'Europe/Madrid', ahora: enUTC('2026-10-04T00:30:00Z') })
    expect(r).toEqual({ ok: false, motivo: 'madrugada' })
  })
  it('respeta la zona del usuario: hora y sin canal de España fuera de España', () => {
    const r = planAvisoHoy({ ...base, tz: 'America/Mexico_City', ahora: enUTC('2026-10-03T17:00:00Z') })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.texto.body).toBe('13:00 vs Barcelona · LaLiga')
  })
  it('el «hoy» es el del usuario: a las 23:00 de México el partido de mañana no cuenta', () => {
    // 05:00Z = 23:00 CDMX del día 2; el partido es el 3 a las 13:00 CDMX.
    const r = planAvisoHoy({ ...base, tz: 'America/Mexico_City', ahora: enUTC('2026-10-03T05:00:00Z') })
    expect(r).toEqual({ ok: false, motivo: 'sin_partidos' })
  })
  it('elige el primer partido del día y menciona el de otro equipo suyo', () => {
    const r = planAvisoHoy({
      equipos: ['Atlético Madrid', 'Real Betis'], partidos: [atletiBarsa, betisSevilla],
      tz: 'Europe/Madrid', ahora: enUTC('2026-10-03T14:00:00Z'),
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.texto.title).toBe('Hoy juega tu Real Betis')
    expect(r.texto.body).toBe('18:30 vs Sevilla · LaLiga · DAZN. Y a las 21:00, tu Atlético Madrid')
  })
  it('una zona corrupta cae a Madrid en vez de romper', () => {
    expect(zonaValida('Marte/Olympus')).toBe('Europe/Madrid')
    const r = planAvisoHoy({ ...base, tz: 'Marte/Olympus', ahora: enUTC('2026-10-03T17:00:00Z') })
    expect(r.ok).toBe(true)
  })
  it('partidos sin hora no avisan', () => {
    const r = planAvisoHoy({ ...base, partidos: [{ ...atletiBarsa, timeTbd: true }], ahora: enUTC('2026-10-03T17:00:00Z') })
    expect(r).toEqual({ ok: false, motivo: 'sin_partidos' })
  })
})

describe('textoAvisoHoy', () => {
  it('si sigue a los dos, el título nombra el partido', () => {
    const [c] = cruzarPartidos(['Atlético Madrid', 'Barcelona'], [atletiBarsa])
    const t = textoAvisoHoy(c, 'Europe/Madrid', undefined, '2026-10-03')
    expect(t.title).toBe('Hoy: Atlético Madrid vs Barcelona')
    expect(t.body).toBe('21:00 · LaLiga · DAZN')
    expect(t.tag).toBe('equipo-hoy-2026-10-03')
  })
  it('la sección femenina se nombra como tal', () => {
    const [c] = cruzarPartidos(['Real Madrid Femenino'], [ligaF])
    expect(textoAvisoHoy(c, 'Europe/Madrid').title).toBe('Hoy juega tu Real Madrid femenino')
  })
})

describe('horaDecente', () => {
  it('franja 9-23 en la zona dada', () => {
    expect(horaDecente(enUTC('2026-10-03T06:59:00Z'), 'Europe/Madrid', SIN_MADRUGADA_HOY)).toBe(false) // 08:59
    expect(horaDecente(enUTC('2026-10-03T07:00:00Z'), 'Europe/Madrid', SIN_MADRUGADA_HOY)).toBe(true)  // 09:00
    expect(horaDecente(enUTC('2026-10-03T21:00:00Z'), 'Europe/Madrid', SIN_MADRUGADA_HOY)).toBe(false) // 23:00
    expect(horaDecente(enUTC('2026-10-03T21:00:00Z'), 'America/Mexico_City', SIN_MADRUGADA_HOY)).toBe(true) // 15:00
  })
})

describe('resultado final', () => {
  it('tocaMirarResultado: ni antes de la duración mínima ni pasadas 6 h', () => {
    expect(tocaMirarResultado(atletiBarsa, enUTC('2026-10-03T20:30:00Z'))).toBe(false) // 90 min
    expect(tocaMirarResultado(atletiBarsa, enUTC('2026-10-03T20:50:00Z'))).toBe(true)  // 110 min
    expect(tocaMirarResultado(atletiBarsa, enUTC('2026-10-04T01:30:00Z'))).toBe(false) // 6,5 h
    expect(tocaMirarResultado({ ...atletiBarsa, matchRef: undefined }, enUTC('2026-10-03T20:50:00Z'))).toBe(false)
  })

  const summary = (status: string, h: string, a: string, extra: { hw?: boolean; aw?: boolean } = {}) => ({
    header: { competitions: [{
      status: { type: { name: status } },
      competitors: [
        { homeAway: 'home', score: h, winner: extra.hw },
        { homeAway: 'away', score: a, winner: extra.aw },
      ],
    }] },
  })

  it('lee el summary de ESPN', () => {
    expect(leerEstadoSummary(summary('STATUS_FULL_TIME', '2', '1'))).toMatchObject({ final: true, homeScore: 2, awayScore: 1 })
    expect(leerEstadoSummary(summary('STATUS_SECOND_HALF', '0', '0'))?.final).toBe(false)
    expect(leerEstadoSummary({})).toBeNull()
  })

  const [atleti] = cruzarPartidos(['Atlético Madrid'], [atletiBarsa])
  const [barsa] = cruzarPartidos(['Barcelona'], [atletiBarsa])

  it('victoria, derrota y empate desde el lado del usuario', () => {
    const e = leerEstadoSummary(summary('STATUS_FULL_TIME', '2', '1'))!
    expect(textoAvisoFinal(atleti, e)?.title).toBe('¡Gana tu Atlético Madrid! Atlético Madrid 2-1 Barcelona')
    const derrota = textoAvisoFinal(barsa, e)!
    expect(derrota.title).toBe('Final: Atlético Madrid 2-1 Barcelona')
    expect(derrota.body).toBe('Derrota de tu Barcelona en LaLiga. Mira las estadísticas del partido.')
    const empate = leerEstadoSummary(summary('STATUS_FULL_TIME', '1', '1'))!
    expect(textoAvisoFinal(atleti, empate)?.title).toBe('Empate de tu Atlético Madrid: Atlético Madrid 1-1 Barcelona')
  })
  it('penaltis: gana quien ESPN marca como ganador', () => {
    const e = leerEstadoSummary(summary('STATUS_FINAL_PEN', '1', '1', { aw: true }))!
    expect(textoAvisoFinal(barsa, e)?.title).toBe('¡Gana tu Barcelona! Atlético Madrid 1-1 Barcelona (penaltis)')
  })
  it('no avisa si no ha acabado o no hay marcador', () => {
    expect(textoAvisoFinal(atleti, leerEstadoSummary(summary('STATUS_HALFTIME', '1', '0'))!)).toBeNull()
    expect(textoAvisoFinal(atleti, { final: true, statusName: 'STATUS_FINAL', homeScore: null, awayScore: 1 })).toBeNull()
  })
  it('la etiqueta usa el id numérico de ESPN, el mismo que «Pitido final»', () => {
    const [ambos] = cruzarPartidos(['Atlético Madrid', 'Barcelona'], [atletiBarsa])
    const e = leerEstadoSummary(summary('STATUS_FULL_TIME', '2', '1'))!
    expect(textoAvisoFinal(ambos, e)?.tag).toBe('equipo-final-1')
  })
  it('si sigue a los dos, resultado neutro', () => {
    const [ambos] = cruzarPartidos(['Atlético Madrid', 'Barcelona'], [atletiBarsa])
    const e = leerEstadoSummary(summary('STATUS_FULL_TIME', '2', '1'))!
    expect(textoAvisoFinal(ambos, e)?.title).toBe('Final: Atlético Madrid 2-1 Barcelona')
  })
})
