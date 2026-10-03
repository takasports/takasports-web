// Idempotencia y topes de los avisos, con una base de datos en memoria.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { crearFakeDb, type FakeDb } from './avisos-fake-db.test-util'

let db: FakeDb
vi.mock('./supabase-admin', () => ({ adminSupabase: () => db }))
const sendPushToUser = vi.fn(async (_u: string, _p: unknown) => ({
  sent: 1, pruned: 0, failed: 0, web: { sent: 1, pruned: 0, failed: 0 }, app: { sent: 0, pruned: 0, failed: 0 },
}))
vi.mock('./push-helper', () => ({ sendPushToUser: (u: string, p: unknown) => sendPushToUser(u, p), initVapid: () => false }))
const sendPushToTopic = vi.fn(async (topic: string, _p: unknown) => ({ topic, web: { sent: 3, pruned: 0, failed: 0 }, app: { sent: 1, pruned: 0, failed: 0 } }))
vi.mock('./push-topic', () => ({
  sendPushToTopic: (t: string, p: unknown) => sendPushToTopic(t, p),
  audienciaDeTema: async () => ({ web: 3, app: 1 }),
}))
vi.mock('./espn', () => ({ fetchEspnEvents: async () => [] }))

import { calcularAvisosEquipo } from './avisos-equipo-run'
import { avisarNoticiaPublicada } from './avisos-noticias-run'
import type { PartidoAviso } from './avisos-equipo'

const U1 = '11111111-aaaa-4aaa-8aaa-111111111111'
const U2 = '22222222-bbbb-4bbb-8bbb-222222222222'
const partido: PartidoAviso = {
  id: 'espn-soccer-esp.1-1', home: 'Atlético Madrid', away: 'Barcelona',
  isoDate: '2026-10-03T19:00:00Z', comp: 'LaLiga', sport: 'Fútbol', broadcast: 'DAZN', matchRef: 'soccer_esp.1_1',
}
const AHORA_HOY = new Date('2026-10-03T17:00:00Z') // 19:00 Madrid, 2 h antes

function dbEquipo(log: Record<string, unknown>[] = []) {
  return crearFakeDb({
    user_favorites: [
      { user_id: U1, entry_id: 'team:Atlético Madrid' },
      { user_id: U2, entry_id: 'team:Atlético Madrid' },
    ],
    profiles: [{ id: U1, timezone: 'Europe/Madrid' }, { id: U2, timezone: null }],
    push_subscriptions: [{ user_id: U1 }],
    push_tokens: [],
    avisos_equipo_log: log,
  }, { avisos_equipo_log: [['user_id', 'kind', 'ref']] })
}

beforeEach(() => {
  sendPushToUser.mockClear()
  sendPushToTopic.mockClear()
})

describe('calcularAvisosEquipo', () => {
  it('apagado: propone, no envía ni escribe', async () => {
    db = dbEquipo()
    const r = await calcularAvisosEquipo({ enviar: false, ahora: AHORA_HOY, partidos: [partido] })
    expect(r.avisos).toHaveLength(2)
    expect(r.avisos[0].texto.title).toBe('Hoy juega tu Atlético Madrid')
    expect(r.avisos.find((a) => a.usuario === U2.slice(0, 8))?.tienePush).toBe(false)
    expect(sendPushToUser).not.toHaveBeenCalled()
    expect(db.tablas.avisos_equipo_log).toHaveLength(0)
  })

  it('encendido: reclama y envía una vez; repetir el cron no reenvía', async () => {
    db = dbEquipo()
    const r1 = await calcularAvisosEquipo({ enviar: true, ahora: AHORA_HOY, partidos: [partido] })
    expect(sendPushToUser).toHaveBeenCalledTimes(1) // U2 no tiene push: ni se reclama
    expect(sendPushToUser.mock.calls[0][0]).toBe(U1)
    expect(sendPushToUser.mock.calls[0][1]).toMatchObject({ topic: null, url: '/partido/soccer_esp.1_1' })
    expect(db.tablas.avisos_equipo_log).toEqual([expect.objectContaining({ user_id: U1, kind: 'equipo_hoy', ref: '2026-10-03' })])
    expect(r1.avisos.find((a) => a.usuario === U2.slice(0, 8))?.resultado?.motivo).toBe('sin_push')

    const r2 = await calcularAvisosEquipo({ enviar: true, ahora: new Date('2026-10-03T17:15:00Z'), partidos: [partido] })
    expect(sendPushToUser).toHaveBeenCalledTimes(1)
    expect(r2.descartes['hoy:ya_avisado']).toBe(1)
  })

  it('si otra pasada reclamó entre medias, no envía (at-most-once)', async () => {
    db = dbEquipo()
    // La lectura del registro no lo ve (fuera de la ventana de 3 días), pero la PK sí.
    db.tablas.avisos_equipo_log.push({ user_id: U1, kind: 'equipo_hoy', ref: '2026-10-03', sent_at: '2026-09-20T00:00:00Z' })
    const r = await calcularAvisosEquipo({ enviar: true, ahora: AHORA_HOY, partidos: [partido] })
    expect(sendPushToUser).not.toHaveBeenCalled()
    expect(r.avisos.find((a) => a.usuario === U1.slice(0, 8))?.resultado).toMatchObject({ reclamado: false, motivo: 'ya_avisado' })
  })

  it('resultado: consulta ESPN y avisa del final una sola vez por partido', async () => {
    db = dbEquipo()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      header: { competitions: [{ status: { type: { name: 'STATUS_FULL_TIME' } }, competitors: [
        { homeAway: 'home', score: '2' }, { homeAway: 'away', score: '0' },
      ] }] },
    })))
    vi.stubGlobal('fetch', fetchMock)
    const tras = new Date('2026-10-03T21:00:00Z') // 23:00 Madrid, 2 h después del saque
    await calcularAvisosEquipo({ enviar: true, ahora: tras, partidos: [partido] })
    expect(fetchMock).toHaveBeenCalledTimes(1) // un summary por partido, no por usuario
    expect(sendPushToUser).toHaveBeenCalledTimes(1)
    expect(sendPushToUser.mock.calls[0][1]).toMatchObject({ title: '¡Gana tu Atlético Madrid! Atlético Madrid 2-0 Barcelona' })
    await calcularAvisosEquipo({ enviar: true, ahora: new Date('2026-10-03T21:15:00Z'), partidos: [partido] })
    expect(sendPushToUser).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('sin la tabla de registro nunca envía', async () => {
    db = dbEquipo()
    const original = db.from
    db.from = (t: string) => t === 'avisos_equipo_log'
      ? { select: () => ({ in: () => ({ gte: async () => ({ data: null, error: { message: 'relation does not exist' } }) }) }) }
      : original(t)
    const r = await calcularAvisosEquipo({ enviar: true, ahora: AHORA_HOY, partidos: [partido] })
    expect(r.aviso).toMatch(/registro no disponible/)
    expect(sendPushToUser).not.toHaveBeenCalled()
  })
})

describe('avisarNoticiaPublicada', () => {
  const AHORA = new Date('2026-10-03T16:00:00Z') // 18:00 Madrid
  const doc = (n: number, extra: Record<string, unknown> = {}) => ({
    _type: 'article', _id: `taka-job-${n}`, slug: { current: `noticia-${n}` }, headline: `Titular ${n}`,
    sport: 'futbol', publishedAt: '2026-10-03T15:30:00Z', takaScore: 90, status: 'normal', ...extra,
  })
  const dbNoticias = () => crearFakeDb({ avisos_noticias_log: [] }, {
    avisos_noticias_log: [['article_id', 'topic'], ['topic', 'madrid_day', 'slot']],
  })

  it('apagado: decide y cuenta audiencia, sin escribir ni enviar', async () => {
    db = dbNoticias()
    const r = await avisarNoticiaPublicada(doc(1), { enviar: false, ahora: AHORA })
    expect(r.decision).toMatchObject({ ok: true, tema: 'noticias:futbol' })
    expect(r.resultado).toEqual({ plaza: 1, motivo: 'simulacion' })
    expect(r.audiencia).toEqual({ web: 3, app: 1 })
    expect(sendPushToTopic).not.toHaveBeenCalled()
    expect(db.tablas.avisos_noticias_log).toHaveLength(0)
  })

  it('encendido: un aviso por artículo aunque el webhook se repita', async () => {
    db = dbNoticias()
    await avisarNoticiaPublicada(doc(1), { enviar: true, ahora: AHORA })
    const r = await avisarNoticiaPublicada(doc(1, { seoTitle: 'parche del cron' }), { enviar: true, ahora: AHORA })
    expect(sendPushToTopic).toHaveBeenCalledTimes(1)
    expect(sendPushToTopic.mock.calls[0]).toEqual(['noticias:futbol', expect.objectContaining({ url: '/noticias/noticia-1' })])
    expect(r.resultado?.motivo).toBe('ya_avisado')
  })

  it('tope de 2 por tema y día; otro deporte tiene su propio tope', async () => {
    db = dbNoticias()
    for (const n of [1, 2, 3]) await avisarNoticiaPublicada(doc(n), { enviar: true, ahora: AHORA })
    expect(sendPushToTopic).toHaveBeenCalledTimes(2)
    const r = await avisarNoticiaPublicada(doc(4), { enviar: true, ahora: AHORA })
    expect(r.resultado?.motivo).toBe('tope_diario')
    await avisarNoticiaPublicada(doc(5, { sport: 'formula1' }), { enviar: true, ahora: AHORA })
    expect(sendPushToTopic).toHaveBeenCalledTimes(3)
    expect(sendPushToTopic.mock.calls[2][0]).toBe('noticias:formula1')
  })

  it('al día siguiente se vuelve a poder avisar', async () => {
    db = dbNoticias()
    for (const n of [1, 2]) await avisarNoticiaPublicada(doc(n), { enviar: true, ahora: AHORA })
    const manana = new Date('2026-10-04T08:00:00Z') // 10:00 Madrid
    await avisarNoticiaPublicada(doc(3, { publishedAt: '2026-10-04T07:50:00Z' }), { enviar: true, ahora: manana })
    expect(sendPushToTopic).toHaveBeenCalledTimes(3)
  })

  it('no importante o vieja: ni toca la base de datos', async () => {
    db = dbNoticias()
    const r1 = await avisarNoticiaPublicada(doc(1, { takaScore: 60 }), { enviar: true, ahora: AHORA })
    const r2 = await avisarNoticiaPublicada(doc(2, { publishedAt: '2026-10-03T10:00:00Z' }), { enviar: true, ahora: AHORA })
    expect(r1.decision).toMatchObject({ ok: false })
    expect(r2.decision).toEqual({ ok: false, motivo: 'antigua' })
    expect(sendPushToTopic).not.toHaveBeenCalled()
  })
})
