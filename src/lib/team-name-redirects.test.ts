import { describe, it, expect } from 'vitest'
import { teamNameRedirectsFrom } from './team-name-redirects'

describe('teamNameRedirectsFrom', () => {
  it('lleva el nombre sin id a la ficha canónica', () => {
    const r = teamNameRedirectsFrom({
      football: [
        { rows: [{ teamId: '86', name: 'Real Madrid' }, { teamId: '1068', name: 'Atlético Madrid' }] },
        // El mismo club en Champions: no duplica ni se vuelve ambiguo.
        { rows: [{ teamId: 86, name: 'Real Madrid' }] },
      ],
      nbaEast: [{ teamId: '2', name: 'Boston Celtics' }],
    })
    expect(r).toEqual([
      { source: '/equipo/atletico-madrid', destination: '/equipo/atletico-madrid-1068', permanent: true },
      { source: '/equipo/boston-celtics', destination: '/equipo/boston-celtics-2', permanent: true },
      { source: '/equipo/real-madrid', destination: '/equipo/real-madrid-86', permanent: true },
    ])
  })

  it('descarta nombres ambiguos (dos clubes, mismo slug)', () => {
    const r = teamNameRedirectsFrom({
      football: [{ rows: [{ teamId: '1', name: 'Nacional' }, { teamId: '2', name: 'Nacional' }, { teamId: '3', name: 'Getafe' }] }],
    })
    expect(r.map(x => x.source)).toEqual(['/equipo/getafe'])
  })

  it('no toca slugs que acaban en número (la ruta los lee como nombre-id)', () => {
    const r = teamNameRedirectsFrom({ football: [{ rows: [{ teamId: '9', name: 'Schalke 04' }, { teamId: '10', name: 'Philadelphia 76ers' }] }] })
    expect(r.map(x => x.source)).toEqual(['/equipo/philadelphia-76ers'])
  })

  it('sin datos no hay reglas', () => {
    expect(teamNameRedirectsFrom({})).toEqual([])
  })
})
