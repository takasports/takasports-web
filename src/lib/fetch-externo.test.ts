import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchExterno, fetchJsonExterno, urlParaLog } from './fetch-externo'

describe('urlParaLog', () => {
  it('tapa el valor de parámetros con pinta de secreto', () => {
    const out = urlParaLog('https://api.x.com/v1/a?apiKey=abc123&limit=50&access_token=zzz')
    expect(out).not.toContain('abc123')
    expect(out).not.toContain('zzz')
    expect(out).toContain('limit=50')
    expect(out).toContain('apiKey=***')
  })

  it('quita usuario y contraseña embebidos', () => {
    expect(urlParaLog('https://u:p@host.com/x')).toBe('https://host.com/x')
  })

  it('con una URL no absoluta se queda con la ruta', () => {
    expect(urlParaLog('/api/x?token=1')).toBe('/api/x')
  })
})

describe('fetchExterno / fetchJsonExterno', () => {
  const warn = vi.fn()
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(warn)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    warn.mockReset()
  })

  it('devuelve el JSON cuando la respuesta es 2xx, sin avisar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"a":1}', { status: 200 })))
    await expect(fetchJsonExterno<{ a: number }>('https://espn.test/x')).resolves.toEqual({ a: 1 })
    expect(warn).not.toHaveBeenCalled()
  })

  it('respeta las opciones de caché de Next y añade la señal de tope', async () => {
    const f = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', f)
    await fetchExterno('https://espn.test/x', { next: { revalidate: 300 } } as RequestInit)
    const init = f.mock.calls[0][1] as RequestInit & { next?: { revalidate?: number } }
    expect(init.next?.revalidate).toBe(300)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('con !ok devuelve null y avisa con estado, URL limpia y duración', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })))
    const out = await fetchJsonExterno('https://espn.test/x?key=SECRETO', {}, { etiqueta: 'upcoming' })
    expect(out).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
    const msg = String(warn.mock.calls[0][0])
    expect(msg).toContain('[upcoming]')
    expect(msg).toContain('HTTP 503')
    expect(msg).toMatch(/\d+ ms\)$/)
    expect(msg).not.toContain('SECRETO')
  })

  it('un error de red no lanza: null + aviso', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
    await expect(fetchExterno('https://espn.test/x')).resolves.toBeNull()
    expect(String(warn.mock.calls[0][0])).toContain('error de red: fetch failed')
  })

  it('corta por tiempo y lo dice', async () => {
    vi.stubGlobal('fetch', vi.fn((_u: string, init?: RequestInit) => new Promise((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(init.signal!.reason))
    })))
    const out = await fetchExterno('https://espn.test/lento', {}, { timeoutMs: 20 })
    expect(out).toBeNull()
    expect(String(warn.mock.calls[0][0])).toContain('timeout 20 ms')
  })

  it('JSON roto → null + aviso', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200 })))
    await expect(fetchJsonExterno('https://espn.test/x')).resolves.toBeNull()
    expect(String(warn.mock.calls[0][0])).toContain('JSON ilegible')
  })
})
