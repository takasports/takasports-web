import { describe, it, expect, vi } from 'vitest'
import { isExpoToken, sendExpoPush } from './expo-push'

const TOK = (n: number) => `ExponentPushToken[xxxxxxxxxxxxxxxxxxx${n}]`
const ok = (n: number) => ({ ok: true, json: async () => ({ data: Array.from({ length: n }, () => ({ status: 'ok' })) }) }) as unknown as Response

describe('isExpoToken', () => {
  it('acepta los dos prefijos que emite Expo', () => {
    expect(isExpoToken('ExponentPushToken[abc]')).toBe(true)
    expect(isExpoToken('ExpoPushToken[abc]')).toBe(true)
  })
  it('rechaza basura, vacíos y tokens de otra cosa', () => {
    for (const t of ['', null, undefined, 'abc', 'fcm:xyz', 'ExponentPushToken[]'])
      expect(isExpoToken(t as string)).toBe(false)
  })
})

describe('sendExpoPush', () => {
  it('no llama a Expo si no hay ningún token válido', async () => {
    const f = vi.fn()
    const r = await sendExpoPush(['basura', ''], { title: 'a', body: 'b' }, f as unknown as typeof fetch)
    expect(f).not.toHaveBeenCalled()
    expect(r).toMatchObject({ sent: 0, reason: 'no_tokens' })
  })

  it('deduplica tokens repetidos', async () => {
    const f = vi.fn(async (_u: string, init: RequestInit) => { void init; return ok(1) })
    await sendExpoPush([TOK(1), TOK(1)], { title: 'a', body: 'b' }, f as unknown as typeof fetch)
    const enviados = JSON.parse(f.mock.calls[0][1].body as string)
    expect(enviados).toHaveLength(1)
  })

  it('trocea en lotes de 100', async () => {
    const f = vi.fn(async (_u: string, init: RequestInit) => ok(JSON.parse(init.body as string).length))
    const tokens = Array.from({ length: 250 }, (_, i) => TOK(i))
    const r = await sendExpoPush(tokens, { title: 'a', body: 'b' }, f as unknown as typeof fetch)
    expect(f).toHaveBeenCalledTimes(3)
    expect(r.sent).toBe(250)
  })

  it('devuelve como MUERTOS los DeviceNotRegistered, y solo esos', async () => {
    const f = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [
        { status: 'ok' },
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
        { status: 'error', details: { error: 'MessageTooBig' } },
      ] }),
    }) as unknown as Response)
    const r = await sendExpoPush([TOK(1), TOK(2), TOK(3)], { title: 'a', body: 'b' }, f as unknown as typeof fetch)
    expect(r.sent).toBe(1)
    expect(r.dead).toEqual([TOK(2)])
    expect(r.failed).toBe(1)
  })

  it('un error HTTP de Expo cuenta el lote como fallido, sin matar tokens', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) }) as unknown as Response)
    const r = await sendExpoPush([TOK(1), TOK(2)], { title: 'a', body: 'b' }, f as unknown as typeof fetch)
    expect(r).toMatchObject({ sent: 0, failed: 2, dead: [] })
  })

  it('si la red se cae, no lanza', async () => {
    const f = vi.fn(async () => { throw new Error('offline') })
    const r = await sendExpoPush([TOK(1)], { title: 'a', body: 'b' }, f as unknown as typeof fetch)
    expect(r).toMatchObject({ sent: 0, failed: 1 })
  })

  it('exige título y cuerpo', async () => {
    const f = vi.fn()
    const r = await sendExpoPush([TOK(1)], { title: '', body: '' }, f as unknown as typeof fetch)
    expect(f).not.toHaveBeenCalled()
    expect(r.reason).toBe('no_payload')
  })

  it('el `url` viaja en data, que es lo que enruta la app', async () => {
    const f = vi.fn(async (_u: string, init: RequestInit) => { void init; return ok(1) })
    await sendExpoPush([TOK(1)], { title: 'a', body: 'b', data: { url: '/partido/x' } }, f as unknown as typeof fetch)
    const [msg] = JSON.parse(f.mock.calls[0][1].body as string)
    expect(msg.data).toEqual({ url: '/partido/x' })
  })
})
