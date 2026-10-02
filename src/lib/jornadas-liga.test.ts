import { describe, it, expect } from 'vitest'
import { asignarJornadas, rangoJornada, type FilaTabla } from './jornadas-liga'
import type { SportEvent } from './types'

const dia = (e: SportEvent) => (e.isoDate ?? '').slice(0, 10)
const p = (id: string, fecha: string, home: string, away: string): SportEvent =>
  ({ id, isoDate: `${fecha}T19:00:00Z`, home, away, homeTeamId: home, awayTeamId: away } as unknown as SportEvent)
const tabla = (gp: Record<string, number>): FilaTabla[] =>
  Object.entries(gp).map(([k, v]) => ({ teamId: k, name: k, gp: v }))

describe('asignarJornadas', () => {
  const t = tabla({ A: 5, B: 5, C: 5, D: 5 })

  it('el siguiente partido de quien lleva 5 jugados es su jornada 6', () => {
    const js = asignarJornadas([
      p('1', '2026-10-09', 'A', 'B'), p('2', '2026-10-10', 'C', 'D'),
      p('3', '2026-10-16', 'A', 'C'), p('4', '2026-10-18', 'B', 'D'),
    ], t, dia)!
    expect(js.map(j => j.numero)).toEqual([6, 7])
    expect(js[0]).toMatchObject({ desde: '2026-10-09', hasta: '2026-10-10' })
    expect(js[0].partidos.map(x => x.id)).toEqual(['1', '2'])
  })

  it('un equipo con un aplazado no arrastra su partido a una jornada ya jugada', () => {
    // B lleva un partido menos: su partido contra A es de la jornada 6 de A.
    const js = asignarJornadas([p('1', '2026-10-09', 'A', 'B'), p('2', '2026-10-10', 'C', 'D')],
      tabla({ A: 5, B: 4, C: 5, D: 5 }), dia)!
    expect(js.map(j => j.numero)).toEqual([6])
  })

  it('si un equipo no está en la tabla, no inventa: devuelve null', () => {
    expect(asignarJornadas([p('1', '2026-10-09', 'A', 'Z')], t, dia)).toBeNull()
  })

  it('con una tabla incompleta (menos de 4 equipos) no se arriesga', () => {
    expect(asignarJornadas([p('1', '2026-10-09', 'A', 'B')], tabla({ A: 5, B: 5 }), dia)).toBeNull()
  })

  it('empareja por nombre cuando falta el id, sin acentos ni mayúsculas', () => {
    const sinId = { id: '1', isoDate: '2026-10-09T19:00:00Z', home: 'Atlético Madrid', away: 'Alavés' } as unknown as SportEvent
    const js = asignarJornadas([sinId], [
      { name: 'Atletico Madrid', gp: 5 }, { name: 'Alaves', gp: 5 }, { name: 'X', gp: 5 }, { name: 'Y', gp: 5 },
    ], dia)!
    expect(js[0].numero).toBe(6)
  })
})

describe('aplazados', () => {
  it('un partido recuperado no se mete en la jornada en curso: va aparte', () => {
    // Caso real del 21/10/2026: Levante y Athletic llevaban uno menos.
    const js = asignarJornadas([
      p('1', '2026-10-10', 'A', 'B'), p('2', '2026-10-12', 'L', 'C'),
      p('3', '2026-10-17', 'L', 'B'), p('4', '2026-10-18', 'A', 'C'),
      p('5', '2026-10-21', 'A', 'L'),
    ], tabla({ A: 6, L: 6, B: 7, C: 7 }), dia)!
    expect(js.map(j => [j.numero, j.partidos.map(x => x.id)])).toEqual([[8, ['1', '2']], [9, ['3', '4']], [null, ['5']]])
  })
})

describe('rangoJornada', () => {
  it('mismo mes, varios días', () => expect(rangoJornada('2026-10-09', '2026-10-12')).toBe('del 9 al 12 de octubre'))
  it('cambia de mes', () => expect(rangoJornada('2026-10-30', '2026-11-02')).toBe('del 30 de octubre al 2 de noviembre'))
  it('un solo día', () => expect(rangoJornada('2026-10-09', '2026-10-09')).toBe('el 9 de octubre'))
})
