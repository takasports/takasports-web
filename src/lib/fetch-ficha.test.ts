import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchFicha, FichaFetchError } from './fetch-ficha'

function respond(status: number, body: unknown = {}) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })))
}

afterEach(() => vi.unstubAllGlobals())

describe('fetchFicha', () => {
  it('devuelve el JSON cuando la API responde 200', async () => {
    respond(200, { id: '1' })
    await expect(fetchFicha('/api/jugador/x-1', 60)).resolves.toEqual({ id: '1' })
  })

  it('404 y 400 significan que la ficha no existe', async () => {
    respond(404)
    await expect(fetchFicha('/api/jugador/x-1', 60)).resolves.toBeNull()
    respond(400)
    await expect(fetchFicha('/api/jugador/x-1', 60)).resolves.toBeNull()
  })

  it('un 5xx no se confunde con «no existe»', async () => {
    respond(500)
    await expect(fetchFicha('/api/team/x-1', 60)).rejects.toBeInstanceOf(FichaFetchError)
  })

  it('un fallo de red tampoco', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
    await expect(fetchFicha('/api/match/1', 60)).rejects.toThrow('fetch failed')
  })
})
