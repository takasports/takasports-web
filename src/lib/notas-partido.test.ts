import { describe, expect, it, vi } from 'vitest'

vi.mock('./past-events', () => ({ getPastEventsByRefs: async () => new Map() }))
vi.mock('./espn', () => ({ fetchEspnEvents: async () => [] }))

import { camposPartidoApi } from './notas-partido'

describe('camposPartidoApi', () => {
  it('en F1 no hace pasar el GP y el circuito por dos equipos', () => {
    const f = camposPartidoApi({
      type: 'previa', matchRef: 'racing_f1_202620', matchHome: 'Gran Premio de Brasil', matchAway: 'Interlagos',
    })
    expect(f.matchHome).toBeNull()
    expect(f.matchAway).toBeNull()
  })
  it('en una previa de fútbol sin datos de ESPN conserva los nombres de la nota', () => {
    const f = camposPartidoApi({
      type: 'previa', matchRef: 'soccer_esp.1_1', matchHome: 'Valencia', matchAway: 'Real Madrid',
    })
    expect(f.matchHome).toBe('Valencia')
    expect(f.matchAway).toBe('Real Madrid')
  })
})
