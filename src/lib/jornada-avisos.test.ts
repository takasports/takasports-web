import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendPushToUser = vi.fn(async (_uid: string, _p: unknown) => ({ sent: 1 }))
vi.mock('./push-helper', () => ({ sendPushToUser: (uid: string, p: unknown) => sendPushToUser(uid, p) }))
vi.mock('./badge-awards', () => ({
  awardBadges: vi.fn(async () => ({ awarded: [], alreadyHad: [], invalid: [] })),
  badgesEarnedOnRankedCorrect: () => [],
}))
vi.mock('./level-progression', () => ({ processLevelProgression: vi.fn(async () => ({})) }))

import { avisarJornadasCerradas, claveAvisoJornada, resumenPorUsuario, textoAvisoJornada } from './jornada-avisos'

describe('resumenPorUsuario', () => {
  it('cuenta aciertos y total por usuario e ignora las no puntuadas', () => {
    const r = resumenPorUsuario([
      { user_id: 'a', event_id: '1', is_correct: true },
      { user_id: 'a', event_id: '2', is_correct: false },
      { user_id: 'a', event_id: '3', is_correct: null },
      { user_id: 'b', event_id: '1', is_correct: false },
    ])
    expect(r.get('a')).toEqual({ aciertos: 1, total: 2 })
    expect(r.get('b')).toEqual({ aciertos: 0, total: 1 })
  })
})

describe('textoAvisoJornada', () => {
  it('título con X de Y', () => {
    expect(textoAvisoJornada(6, 9).title).toBe('Jornada: acertaste 6 de 9')
  })
  it('pleno y cero tienen su cuerpo', () => {
    expect(textoAvisoJornada(9, 9).body).toContain('Pleno')
    expect(textoAvisoJornada(0, 9).body).toContain('no hubo suerte')
  })
})

describe('claveAvisoJornada', () => {
  it('no choca con las semanas ISO de favorites-push', () => {
    expect(claveAvisoJornada('2026-09-28')).toBe('jornada:2026-09-28')
    expect(claveAvisoJornada('2026-09-28')).not.toMatch(/^\d{4}-W\d{2}$/)
  })
})

// Cliente Supabase mínimo: cada tabla devuelve lo que se le diga.
function adminFalso(opts: {
  eventos: Array<{ id: string; status: string }>
  preds: Array<{ user_id: string; event_id: string; is_correct: boolean | null }>
  reclamados: string[]
}) {
  const upserts: unknown[] = []
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'not']) c[m] = () => c
    c.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
    return c
  }
  const admin = {
    from(tabla: string) {
      if (tabla === 'ranked_events') return chain({ data: opts.eventos, error: null })
      if (tabla === 'ranked_predictions') return chain({ data: opts.preds, error: null })
      if (tabla === 'favorites_push_log') {
        return {
          upsert(rows: unknown) {
            upserts.push(rows)
            return chain({ data: opts.reclamados.map(user_id => ({ user_id })), error: null })
          },
        }
      }
      throw new Error(`tabla inesperada ${tabla}`)
    },
  }
  return { admin: admin as never, upserts }
}

describe('avisarJornadasCerradas', () => {
  beforeEach(() => sendPushToUser.mockClear())

  it('Jornada a medias → no avisa', async () => {
    const { admin, upserts } = adminFalso({
      eventos: [{ id: 'e1', status: 'resolved' }, { id: 'e2', status: 'closed' }],
      preds: [{ user_id: 'a', event_id: 'e1', is_correct: true }],
      reclamados: ['a'],
    })
    await expect(avisarJornadasCerradas(admin, ['2026-09-28'])).resolves.toEqual({ jornadas: 0, avisados: 0 })
    expect(upserts).toHaveLength(0)
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('Jornada cerrada → avisa SOLO a los reclamados ahora (idempotencia)', async () => {
    const { admin, upserts } = adminFalso({
      eventos: [{ id: 'e1', status: 'resolved' }, { id: 'e2', status: 'resolved' }],
      preds: [
        { user_id: 'a', event_id: 'e1', is_correct: true },
        { user_id: 'a', event_id: 'e2', is_correct: false },
        { user_id: 'b', event_id: 'e1', is_correct: true },
      ],
      reclamados: ['a'], // b ya fue avisado en una pasada anterior
    })
    const r = await avisarJornadasCerradas(admin, ['2026-09-28'])
    expect(r).toEqual({ jornadas: 1, avisados: 1 })
    expect(upserts[0]).toEqual([
      { user_id: 'a', week: 'jornada:2026-09-28' },
      { user_id: 'b', week: 'jornada:2026-09-28' },
    ])
    expect(sendPushToUser).toHaveBeenCalledTimes(1)
    const [uid, payload] = sendPushToUser.mock.calls[0] as [string, { title: string; url: string }]
    expect(uid).toBe('a')
    expect(payload.title).toBe('Jornada: acertaste 1 de 2')
    expect(payload.url).toBe('/predicciones')
  })

  it('un fallo de la BD no lanza', async () => {
    const admin = { from() { throw new Error('caída') } } as never
    await expect(avisarJornadasCerradas(admin, ['x'])).resolves.toEqual({ jornadas: 0, avisados: 0 })
  })
})
