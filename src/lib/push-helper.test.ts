// Reparto de sendPushToUser a los DOS destinos (navegador + app).
//
// Por qué existe: cuando esto se escribió, `push_tokens` y `push_subscriptions`
// estaban las dos VACÍAS en producción, así que ningún envío real ejercitaba
// este código. Estos tests son la única prueba de que el reparto hace lo que
// dice, y en particular de las tres reglas que son fáciles de romper sin
// enterarse: el filtro por topic, el `topic: null` del que depende
// favorites-push, y que la falta de VAPID no deje a la app sin su aviso.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async () => ({ statusCode: 201 })),
  },
}))
vi.mock('./expo-push', () => ({
  sendExpoPush: vi.fn(async () => ({ sent: 1, dead: [] as string[], failed: 0 })),
}))
vi.mock('./supabase-admin', () => ({ adminSupabase: vi.fn() }))

const SUB = { endpoint: 'https://fcm/e1', p256dh: 'p', auth: 'a' }
const TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxx]'

/** Filtros que se aplicaron en la última consulta a cada tabla. */
type Filtro = [string, string, unknown]

interface Opciones {
  vapid?: boolean
  subs?: unknown[] | null
  tokens?: unknown[] | null
  errorSubs?: string
  sinAdmin?: boolean
}

/**
 * Carga push-helper LIMPIO en cada test: `initVapid` cachea su resultado en
 * ámbito de módulo, así que sin resetModules el segundo test heredaría el
 * VAPID del primero.
 */
async function cargar(o: Opciones = {}) {
  vi.resetModules()
  vi.clearAllMocks()

  if (o.vapid === false) {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
  } else {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
  }

  const borrados: { tabla: string; valores: unknown }[] = []
  const filtros: Record<string, Filtro[]> = {}

  const cliente = {
    from(tabla: string) {
      const propios: Filtro[] = []
      filtros[tabla] = propios
      let borrando = false
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (c: string, v: unknown) => { propios.push(['eq', c, v]); return chain },
        contains: (c: string, v: unknown) => { propios.push(['contains', c, v]); return chain },
        delete: () => { borrando = true; return chain },
        in: (c: string, v: unknown) => {
          if (borrando) { borrados.push({ tabla, valores: v }); return Promise.resolve({ error: null }) }
          propios.push(['in', c, v])
          return chain
        },
        then: (res: (x: unknown) => unknown, rej?: (x: unknown) => unknown) => {
          const salida = tabla === 'push_subscriptions'
            ? (o.errorSubs ? { data: null, error: { message: o.errorSubs } } : { data: o.subs ?? [], error: null })
            : { data: o.tokens ?? [], error: null }
          return Promise.resolve(salida).then(res, rej)
        },
      }
      return chain
    },
  }

  const { adminSupabase } = await import('./supabase-admin')
  vi.mocked(adminSupabase).mockReturnValue(
    (o.sinAdmin ? null : cliente) as unknown as ReturnType<typeof adminSupabase>,
  )

  const webpush = (await import('web-push')).default
  const { sendExpoPush } = await import('./expo-push')
  const { sendPushToUser } = await import('./push-helper')
  return { sendPushToUser, webpush, sendExpoPush: vi.mocked(sendExpoPush), borrados, filtros }
}

const MSG = { title: 'Ganaste 250🪙', body: 'Tu quiniela se liquidó' }

beforeEach(() => {
  // Sin valor de retorno a propósito: devolver el mock desde beforeEach saca a
  // flote rechazos ya capturados y el error señala al test equivocado.
  vi.clearAllMocks()
})

describe('sendPushToUser — reparto a los dos destinos', () => {
  it('entrega por navegador Y por app, y desglosa cada uno', async () => {
    const { sendPushToUser, webpush, sendExpoPush } = await cargar({ subs: [SUB], tokens: [{ token: TOKEN }] })
    const r = await sendPushToUser('u1', MSG)

    expect(webpush.sendNotification).toHaveBeenCalledTimes(1)
    expect(sendExpoPush).toHaveBeenCalledTimes(1)
    expect(r).toMatchObject({ sent: 2, web: { sent: 1 }, app: { sent: 1 } })
  })

  it('un destino vacío no impide al otro', async () => {
    const { sendPushToUser, sendExpoPush } = await cargar({ subs: [], tokens: [{ token: TOKEN }] })
    const r = await sendPushToUser('u1', MSG)

    expect(sendExpoPush).toHaveBeenCalledTimes(1)
    expect(r.sent).toBe(1)
    expect(r.web).toMatchObject({ sent: 0, reason: 'no_subs' })
  })

  it('sin nada en ningún lado devuelve 0 y explica los dos porqués', async () => {
    const { sendPushToUser } = await cargar({ subs: [], tokens: [] })
    const r = await sendPushToUser('u1', MSG)

    expect(r.sent).toBe(0)
    expect(r.reason).toContain('no_subs')
    expect(r.reason).toContain('no_tokens')
  })

  it('sin Supabase no lanza: devuelve la razón', async () => {
    const { sendPushToUser, webpush } = await cargar({ sinAdmin: true })
    const r = await sendPushToUser('u1', MSG)

    expect(r).toMatchObject({ sent: 0, reason: 'no_supabase' })
    expect(webpush.sendNotification).not.toHaveBeenCalled()
  })
})

describe('sendPushToUser — VAPID', () => {
  // La regresión que motivó todo esto: el helper se rendía en la primera línea
  // si faltaba VAPID, y de paso dejaba a la app sin su aviso. La app no usa VAPID.
  it('sin VAPID el navegador se queda fuera pero la app SÍ recibe', async () => {
    const { sendPushToUser, webpush, sendExpoPush } = await cargar({
      vapid: false, subs: [SUB], tokens: [{ token: TOKEN }],
    })
    const r = await sendPushToUser('u1', MSG)

    expect(webpush.sendNotification).not.toHaveBeenCalled()
    expect(sendExpoPush).toHaveBeenCalledTimes(1)
    expect(r).toMatchObject({ sent: 1, web: { sent: 0, reason: 'no_vapid' }, app: { sent: 1 } })
  })
})

describe('sendPushToUser — topics', () => {
  it('por defecto filtra las suscripciones por el topic quiniela', async () => {
    const { sendPushToUser, filtros } = await cargar({ subs: [SUB], tokens: [] })
    await sendPushToUser('u1', MSG)

    expect(filtros['push_subscriptions']).toContainEqual(['contains', 'topics', ['quiniela']])
  })

  it('topic: null NO filtra — es lo que conserva el público de favorites-push', async () => {
    const { sendPushToUser, filtros } = await cargar({ subs: [SUB], tokens: [] })
    await sendPushToUser('u1', { ...MSG, topic: null })

    expect(filtros['push_subscriptions'].some(([tipo]) => tipo === 'contains')).toBe(false)
    expect(filtros['push_subscriptions']).toContainEqual(['eq', 'user_id', 'u1'])
  })

  it('la app NUNCA se filtra por topic: push_tokens no tiene esa columna', async () => {
    const { sendPushToUser, filtros, sendExpoPush } = await cargar({ subs: [], tokens: [{ token: TOKEN }] })
    await sendPushToUser('u1', { ...MSG, topic: 'rankings' })

    expect(filtros['push_tokens'].some(([tipo]) => tipo === 'contains')).toBe(false)
    expect(sendExpoPush).toHaveBeenCalledTimes(1)
  })
})

describe('sendPushToUser — payload', () => {
  it('el destino por defecto es /predicciones, no la retirada /quiniela', async () => {
    const { sendPushToUser, webpush, sendExpoPush } = await cargar({ subs: [SUB], tokens: [{ token: TOKEN }] })
    await sendPushToUser('u1', MSG)

    const web = JSON.parse(vi.mocked(webpush.sendNotification).mock.calls[0][1] as string)
    expect(web.url).toBe('/predicciones')
    // En la app la ruta viaja en `data.url`: es lo que lee routeFromNotification.
    expect(sendExpoPush.mock.calls[0][1]).toMatchObject({ data: { url: '/predicciones' } })
  })

  it('respeta la url y el tag que le pasa el emisor', async () => {
    const { sendPushToUser, webpush } = await cargar({ subs: [SUB], tokens: [] })
    await sendPushToUser('u1', { ...MSG, url: '/rankings/messi', tag: 'fav-messi' })

    const web = JSON.parse(vi.mocked(webpush.sendNotification).mock.calls[0][1] as string)
    expect(web).toMatchObject({ url: '/rankings/messi', tag: 'fav-messi' })
  })
})

describe('sendPushToUser — limpieza de destinatarios muertos', () => {
  it('un endpoint 410 sale de push_subscriptions y cuenta como purgado', async () => {
    const { sendPushToUser, webpush, borrados } = await cargar({ subs: [SUB], tokens: [] })
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce({ statusCode: 410 })

    const r = await sendPushToUser('u1', MSG)

    expect(borrados).toContainEqual({ tabla: 'push_subscriptions', valores: [SUB.endpoint] })
    expect(r).toMatchObject({ sent: 0, pruned: 1, web: { pruned: 1 } })
  })

  it('un fallo que NO es endpoint muerto se cuenta como failed y no borra nada', async () => {
    const { sendPushToUser, webpush, borrados } = await cargar({ subs: [SUB], tokens: [] })
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce({ statusCode: 500 })

    const r = await sendPushToUser('u1', MSG)

    expect(borrados).toHaveLength(0)
    expect(r).toMatchObject({ failed: 1, pruned: 0 })
  })

  it('un token DeviceNotRegistered sale de push_tokens', async () => {
    const { sendPushToUser, sendExpoPush, borrados } = await cargar({ subs: [], tokens: [{ token: TOKEN }] })
    sendExpoPush.mockResolvedValueOnce({ sent: 0, dead: [TOKEN], failed: 0 })

    const r = await sendPushToUser('u1', MSG)

    expect(borrados).toContainEqual({ tabla: 'push_tokens', valores: [TOKEN] })
    expect(r).toMatchObject({ pruned: 1, app: { pruned: 1 } })
  })

  it('un error de consulta no tumba el envío: lo reporta y sigue', async () => {
    const { sendPushToUser, sendExpoPush } = await cargar({
      errorSubs: 'timeout', tokens: [{ token: TOKEN }],
    })
    const r = await sendPushToUser('u1', MSG)

    expect(r.web.reason).toContain('query_failed')
    expect(sendExpoPush).toHaveBeenCalledTimes(1)
    expect(r.sent).toBe(1)
  })
})
