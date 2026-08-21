import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SportEvent } from './types'

// La lectura de la caché ya está probada en producción (la usan /jugador y las
// plantillas); aquí se comprueba lo que añade esta pasada: a QUIÉN se le pone la
// foto y con qué prioridad.
const spy = vi.fn()
vi.mock('./sport-entities', () => ({
  getPhotosByEspnId: (...args: unknown[]) => spy(...args),
}))

const { attachAthletePhotos } = await import('./athlete-photos-attach')

const ev = (over: Partial<SportEvent>): SportEvent => ({
  id: 'x', home: 'A', away: 'B', sport: 'Tenis', comp: 'Cincinnati Open',
  date: '', time: '', accent: '', ...over,
})

// Con LLAVES a propósito: `() => spy.mockReset()` devuelve el mock, vitest lo
// toma por valor de limpieza del hook y acaba sacando a flote —como error no
// manejado— el rechazo que el código bajo prueba SÍ captura. Cuesta media hora
// encontrarlo porque el fallo señala al mock, no al hook.
beforeEach(() => { spy.mockReset() })

describe('attachAthletePhotos', () => {
  it('la foto resuelta MANDA sobre la que traía el evento', async () => {
    // Caso real: el headshot de ESPN suele ser 404 en tenis; la de Wikimedia es la buena.
    spy.mockResolvedValue(new Map([['4030', { url: 'https://commons/sweeny.jpg' }]]))
    const events = [ev({ homeAthleteId: '4030', homePhoto: 'https://espn/roto.png' })]
    await attachAthletePhotos(events)
    expect(events[0].homePhoto).toBe('https://commons/sweeny.jpg')
  })

  it('sin foto en la caché se conserva la que hubiera', async () => {
    spy.mockResolvedValue(new Map())
    const events = [ev({ homeAthleteId: '999', homePhoto: 'https://lista-estatica/keys.png' })]
    await attachAthletePhotos(events)
    expect(events[0].homePhoto).toBe('https://lista-estatica/keys.png')
  })

  it('resuelve los dos lados por separado', async () => {
    spy.mockResolvedValue(new Map([['2', { url: 'https://commons/b.jpg' }]]))
    const events = [ev({ homeAthleteId: '1', awayAthleteId: '2' })]
    await attachAthletePhotos(events)
    expect(events[0].homePhoto).toBeUndefined()
    expect(events[0].awayPhoto).toBe('https://commons/b.jpg')
  })

  it('no toca los deportes que enseñan escudo (fútbol, NBA)', async () => {
    const events = [ev({ sport: 'Fútbol', homeAthleteId: '4030' })]
    await attachAthletePhotos(events)
    expect(spy).not.toHaveBeenCalled()
  })

  it('busca el UFC en su propio sport, no en el del tenis', async () => {
    spy.mockResolvedValue(new Map())
    await attachAthletePhotos([ev({ sport: 'UFC', homeAthleteId: '77' })])
    expect(spy).toHaveBeenCalledWith('mma', ['77'])
  })

  it('sin ids no consulta nada', async () => {
    await attachAthletePhotos([ev({})])
    expect(spy).not.toHaveBeenCalled()
  })

  it('si la caché falla, los eventos se quedan como estaban', async () => {
    spy.mockImplementation(async () => { throw new Error('sin base') })
    const events = [ev({ homeAthleteId: '1', homePhoto: 'https://previa.png' })]
    await attachAthletePhotos(events)     // no debe propagar el fallo
    expect(events[0].homePhoto).toBe('https://previa.png')
  })
})
