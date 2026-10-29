import { describe, it, expect } from 'vitest'
import { construirAviso, diaQueToca, diasFuente } from './agenda-noche'
import type { SportEvent } from './types'

const ev = (id: string, home: string, away: string, isoDate: string, extra: Partial<SportEvent> = {}): SportEvent => ({
  id, home, away, isoDate, sport: 'Fútbol', comp: 'LaLiga', date: '', time: 'XX:XX', accent: '#fff', ...extra,
})

// Puntuación de prueba: lo que diga el mapa; el resto, por debajo del listón.
const puntos: Record<string, number> = { villarreal: 50, havre: 40, hawks: 30 }
const score = (e: SportEvent) => puntos[e.id] ?? 0
const canal = (e: SportEvent) => e.broadcast

describe('diaQueToca', () => {
  // 29/10/2026 21:00Z = 22:00 en Madrid (horario de invierno, UTC+1).
  const a22Madrid = new Date('2026-10-29T21:00:00Z')

  it('a las 22:00 de su zona toca avisar de mañana', () => {
    expect(diaQueToca(a22Madrid, 'Europe/Madrid', null)).toBe('2026-10-30')
  })

  it('a cualquier otra hora, no', () => {
    expect(diaQueToca(new Date('2026-10-29T20:00:00Z'), 'Europe/Madrid', null)).toBeNull()
    expect(diaQueToca(new Date('2026-10-29T21:59:00Z'), 'Europe/Madrid', null)).toBe('2026-10-30')
  })

  it('no repite un día ya avisado', () => {
    expect(diaQueToca(a22Madrid, 'Europe/Madrid', '2026-10-30')).toBeNull()
    expect(diaQueToca(a22Madrid, 'Europe/Madrid', '2026-10-29')).toBe('2026-10-30')
  })

  it('cada lector a SUS 22:00', () => {
    // 22:00 en Ciudad de México (UTC-6) = 04:00Z del día siguiente.
    expect(diaQueToca(a22Madrid, 'America/Mexico_City', null)).toBeNull()
    expect(diaQueToca(new Date('2026-10-30T04:00:00Z'), 'America/Mexico_City', null)).toBe('2026-10-30')
  })

  it('sin zona o con una corrupta, la de España', () => {
    expect(diaQueToca(a22Madrid, null, null)).toBe('2026-10-30')
    expect(diaQueToca(a22Madrid, 'Marte/Olympus', null)).toBe('2026-10-30')
  })
})

describe('diasFuente', () => {
  it('en España basta el propio día; fuera, también los vecinos', () => {
    expect(diasFuente('2026-10-30', 'Europe/Madrid')).toEqual(['2026-10-30'])
    expect(diasFuente('2026-10-30', 'America/Mexico_City')).toEqual(['2026-10-29', '2026-10-30', '2026-10-31'])
  })
})

describe('construirAviso', () => {
  const partidos = [
    ev('villarreal', 'Villarreal', 'Espanyol', '2026-10-30T20:00:00Z', { broadcast: 'DAZN' }),
    ev('havre', 'Le Havre AC', 'Paris Saint-Germain', '2026-10-30T18:00:00Z', { comp: 'Ligue 1', broadcast: 'DAZN' }),
    // 01:00 del sábado en Madrid: no es del viernes en España…
    ev('hawks', 'Atlanta Hawks', 'Cleveland Cavaliers', '2026-10-31T00:00:00Z', { comp: 'NBA', sport: 'Baloncesto' }),
    ev('otro', 'Nice', 'Rennes', '2026-10-30T18:00:00Z', { comp: 'Ligue 1' }),
  ]

  it('título con el día y el total; cuerpo con los grandes, hora y canal', () => {
    const a = construirAviso(partidos, '2026-10-30', 'Europe/Madrid', score, canal)
    expect(a).toEqual({
      title: 'Mañana, viernes 30: 3 partidos',
      body: 'Villarreal–Espanyol 21:00 (DAZN) · Le Havre AC–Paris Saint-Germain 19:00 (DAZN) · y 1 más',
      url: '/calendario/dia/2026-10-30',
    })
  })

  it('las horas y el día, en la zona del lector', () => {
    // …pero sí lo es en México, donde son las 18:00 del viernes.
    const a = construirAviso(partidos, '2026-10-30', 'America/Mexico_City', score, canal)!
    expect(a.title).toBe('Mañana, viernes 30: 4 partidos')
    expect(a.body).toBe('Villarreal–Espanyol 14:00 (DAZN) · Le Havre AC–Paris Saint-Germain 12:00 (DAZN) · Atlanta Hawks–Cleveland Cavaliers 18:00 · y 1 más')
  })

  it('no repite un partido que llega de dos días de origen', () => {
    const a = construirAviso([...partidos, partidos[0]], '2026-10-30', 'Europe/Madrid', score, canal)!
    expect(a.title).toBe('Mañana, viernes 30: 3 partidos')
  })

  it('sin nada destacado, no hay aviso', () => {
    expect(construirAviso([partidos[3]], '2026-10-30', 'Europe/Madrid', score, canal)).toBeNull()
    expect(construirAviso([], '2026-10-30', 'Europe/Madrid', score, canal)).toBeNull()
  })

  it('un partido sin hora no se inventa una', () => {
    const sinHora = ev('villarreal', 'Villarreal', 'Espanyol', '2026-10-30T20:00:00Z', { timeTbd: true, time: '' })
    expect(construirAviso([sinHora], '2026-10-30', 'Europe/Madrid', score, canal)!.body).toBe('Villarreal–Espanyol')
  })
})
