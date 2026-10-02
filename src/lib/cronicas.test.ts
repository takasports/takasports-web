import { describe, expect, it } from 'vitest'
import type { SportEvent } from '@/lib/types'
import { candidatasCronica } from '@/lib/cronicas'
import { golesPorEquipo } from '@/lib/placa-previa'

const NOW = Date.parse('2026-09-29T22:30:00Z')
const haceH = (h: number) => new Date(NOW - h * 3600_000).toISOString()
let n = 0
const ev = (p: Partial<SportEvent>): SportEvent => ({
  id: `e${++n}`, home: 'España', away: 'Croacia', sport: 'Fútbol', comp: 'Nations', date: '', time: '', accent: '',
  isoDate: haceH(4), matchRef: `soccer_uefa.nations_${n}`, isPast: true, homeScore: 4, awayScore: 1, ...p,
})

describe('candidatasCronica', () => {
  it('coge partidos destacados ya terminados que empezaron hace 1 h 45 min - 8 h', () => {
    const r = candidatasCronica([ev({}), ev({ isoDate: haceH(1.5) }), ev({ isoDate: haceH(10) }), ev({ isoDate: haceH(1.9) })], NOW)
    expect(r).toHaveLength(2)
  })
  it('sin marcador o sin terminar no hay crónica', () => {
    expect(candidatasCronica([ev({ homeScore: null }), ev({ isPast: false })], NOW)).toHaveLength(0)
  })
  it('no repite ni coge partidos sin cartel', () => {
    const e = ev({})
    expect(candidatasCronica([e], NOW, new Set([e.matchRef!]))).toHaveLength(0)
    expect(candidatasCronica([ev({ home: 'Chipre', away: 'Armenia' })], NOW)).toHaveLength(0)
  })
})

describe('golesPorEquipo', () => {
  const ke = [
    { type: { text: 'Goal' }, clock: { displayValue: "2'" }, team: { id: '1' }, participants: [{ athlete: { displayName: 'Lamine Yamal' } }] },
    { type: { text: 'Goal - Header' }, clock: { displayValue: "28'" }, team: { id: '2' }, participants: [{ athlete: { displayName: 'Dion Beljo' } }] },
    { type: { text: 'Yellow Card' }, clock: { displayValue: "30'" }, team: { id: '2' }, participants: [{ athlete: { displayName: 'X Y' } }] },
    { type: { text: 'Penalty - Scored' }, clock: { displayValue: "63'" }, team: { id: '1' }, participants: [{ athlete: { displayName: 'Lamine Yamal' } }] },
  ]
  it('agrupa por jugador, marca penaltis e ignora tarjetas', () => {
    expect(golesPorEquipo(ke, '1', '2')).toEqual({ home: ["Yamal 2', 63' (pen.)"], away: ["Beljo 28'"] })
  })
})
