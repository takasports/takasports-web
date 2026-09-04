import { describe, it, expect } from 'vitest'
import type { SportEvent } from '@/lib/types'
import { candidatosDestacados, pickTopEvents } from './destacados-home'

// La invariante que sostiene el recorte del servidor: elegir sobre los
// candidatos tiene que dar EXACTAMENTE lo mismo que elegir sobre el calendario
// entero. Si algún día alguien toca la ventana, el descarte o el desempate en
// un sitio y no en el otro, esto lo caza.
//
// Se comprueba con varios husos porque el huso cambia la PUNTUACIÓN (prime time
// + empujón regional) pero no debe cambiar qué partidos son candidatos.

const H = 3_600_000
const AHORA = Date.parse('2026-09-04T12:00:00.000Z')

function ev(over: Partial<SportEvent> & { id: string }): SportEvent {
  return {
    home: 'Equipo A', away: 'Equipo B', sport: 'Fútbol', comp: 'LaLiga',
    date: '2026-09-04', time: '21:00', accent: '#fff', ...over,
  } as SportEvent
}

/** Calendario realista: pasado, ventana, lejano, sin hora y duplicados. */
function calendario(): SportEvent[] {
  const out: SportEvent[] = []
  for (let i = 0; i < 12; i++) out.push(ev({ id: `pasado-${i}`, isoDate: new Date(AHORA - (3 + i) * H).toISOString(), isPast: true }))
  const comps = ['LaLiga', 'Premier League', 'Serie A', 'Liga MX', 'Brasileirao', 'NBA', 'Roland Garros']
  const deportes = ['Fútbol', 'Fútbol', 'Fútbol', 'Baloncesto', 'Tenis']
  for (let i = 0; i < 40; i++) {
    out.push(ev({
      id: `ventana-${i}`, isoDate: new Date(AHORA + (i % 35) * H + 30 * 60_000).toISOString(),
      comp: comps[i % comps.length], sport: deportes[i % deportes.length],
      home: `Local ${i}`, away: `Visitante ${i}`,
    }))
  }
  for (let i = 0; i < 60; i++) {
    out.push(ev({
      id: `lejano-${i}`, isoDate: new Date(AHORA + (40 + i * 6) * H).toISOString(),
      comp: comps[i % comps.length], home: `Lejano ${i}`, away: `Rival ${i}`,
    }))
  }
  out.push(ev({ id: 'sin-fecha-1', isoDate: undefined, home: 'Sin', away: 'Fecha' }))
  // duplicados exactos (misma clave home|away|hora): el dedup debe quedarse con el primero
  out.push(ev({ id: 'ventana-0-dup', isoDate: new Date(AHORA + 30 * 60_000).toISOString(), home: 'Local 0', away: 'Visitante 0' }))
  return out
}

const HUSOS = [null, 'Europe/Madrid', 'America/Mexico_City', 'America/Argentina/Buenos_Aires', 'Asia/Tokyo']

describe('candidatosDestacados: recortar en el servidor no cambia la elección', () => {
  for (const tz of HUSOS) {
    it(`da los mismos Destacados con huso ${tz ?? 'null (servidor)'}`, () => {
      const todos = calendario()
      const conTodo = pickTopEvents(todos, AHORA, 4, tz)
      const conRecorte = pickTopEvents(candidatosDestacados(todos, AHORA), AHORA, 4, tz)
      expect(conRecorte.map(e => e.id)).toEqual(conTodo.map(e => e.id))
    })
  }

  it('también cuando el día viene casi vacío y hay que tirar de reserva', () => {
    const flojo = [
      ev({ id: 'unico-en-ventana', isoDate: new Date(AHORA + 2 * H).toISOString() }),
      ...Array.from({ length: 30 }, (_, i) => ev({
        id: `lejano-${i}`, isoDate: new Date(AHORA + (40 + i * 12) * H).toISOString(), home: `L${i}`, away: `R${i}`,
      })),
    ]
    for (const tz of HUSOS) {
      expect(pickTopEvents(candidatosDestacados(flojo, AHORA), AHORA, 4, tz).map(e => e.id))
        .toEqual(pickTopEvents(flojo, AHORA, 4, tz).map(e => e.id))
    }
  })

  it('deja fuera lo que no puede elegirse nunca', () => {
    const todos = calendario()
    const pool = candidatosDestacados(todos, AHORA)
    const ids = new Set(pool.map(e => e.id))
    // ni pasados, ni duplicados, ni más reserva de la declarada
    expect(pool.some(e => e.isPast)).toBe(false)
    expect(todos.filter(e => e.isPast).every(e => !ids.has(e.id))).toBe(true)
    expect(ids.has('ventana-0-dup')).toBe(false)
    expect(pool.filter(e => e.id.startsWith('lejano-')).length).toBe(20)
    expect(pool.length).toBeLessThan(todos.length)
  })
})
