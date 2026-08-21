import { describe, it, expect } from 'vitest'
import {
  splitInitialWindow, mergeFeedEvents, windowEndDay, filterFromDay, INITIAL_WINDOW_DAYS,
} from './calendar-initial-window'

const ev = (id: string, isoDate?: string, source: 'espn' | 'sanity' | 'padel' = 'espn') =>
  ({ id, isoDate, source })

describe('windowEndDay', () => {
  it('8 días contando hoy → hoy + 7', () => {
    expect(windowEndDay('2026-08-21', 8)).toBe('2026-08-28')
  })
  it('cruza el cambio de mes', () => {
    expect(windowEndDay('2026-08-28', 8)).toBe('2026-09-04')
  })
  it('cruza el cambio de año', () => {
    expect(windowEndDay('2026-12-30', 8)).toBe('2027-01-06')
  })
  it('un solo día es hoy', () => {
    expect(windowEndDay('2026-08-21', 1)).toBe('2026-08-21')
  })
})

describe('splitInitialWindow', () => {
  const hoy = '2026-08-21'

  it('lo cercano se pinta y lo lejano se aplaza', () => {
    const { initial, deferred } = splitInitialWindow(
      [ev('a', '2026-08-21T18:00:00Z'), ev('b', '2026-09-15T18:00:00Z')], hoy, 8,
    )
    expect(initial.map(e => e.id)).toEqual(['a'])
    expect(deferred.map(e => e.id)).toEqual(['b'])
  })

  it('el último día de la ventana entra (frontera inclusiva)', () => {
    const { initial } = splitInitialWindow([ev('x', '2026-08-28T23:00:00Z')], hoy, 8)
    expect(initial).toHaveLength(1)
  })

  it('el día siguiente al final ya se aplaza', () => {
    const { deferred } = splitInitialWindow([ev('x', '2026-08-29T00:30:00Z')], hoy, 8)
    expect(deferred).toHaveLength(1)
  })

  it('LO IMPORTANTE: lo que no es de ESPN viaja siempre, esté donde esté', () => {
    // El cliente pide /api/events/feed, que es SOLO de ESPN: un evento de Sanity
    // o de pádel fuera de la ventana no volvería nunca.
    const { initial, deferred } = splitInitialWindow(
      [ev('p', '2026-11-01T10:00:00Z', 'padel'), ev('s', '2026-11-02T10:00:00Z', 'sanity')], hoy, 8,
    )
    expect(initial.map(e => e.id)).toEqual(['p', 's'])
    expect(deferred).toEqual([])
  })

  it('un evento sin fecha se manda: no se puede ubicar y perderlo sería peor', () => {
    const { initial } = splitInitialWindow([ev('sinfecha', undefined)], hoy, 8)
    expect(initial).toHaveLength(1)
  })

  it('los días pasados entran (son <= fin) y no se aplazan', () => {
    const { initial, deferred } = splitInitialWindow([ev('ayer', '2026-08-20T20:00:00Z')], hoy, 8)
    expect(initial).toHaveLength(1)
    expect(deferred).toHaveLength(0)
  })

  it('conserva el orden de entrada dentro de cada grupo', () => {
    const { initial } = splitInitialWindow(
      [ev('1', '2026-08-22T10:00:00Z'), ev('2', '2026-08-21T10:00:00Z')], hoy, 8,
    )
    expect(initial.map(e => e.id)).toEqual(['1', '2'])
  })

  it('la ventana por defecto son 8 días', () => {
    expect(INITIAL_WINDOW_DAYS).toBe(8)
  })
})

describe('mergeFeedEvents', () => {
  it('añade lo que falta sin duplicar lo que ya está', () => {
    const out = mergeFeedEvents([ev('a'), ev('b')], [ev('b'), ev('c')])
    expect(out.map(e => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('lo que YA estaba manda sobre lo que llega con el mismo id', () => {
    const local = { ...ev('a', '2026-08-21T18:00:00Z', 'sanity'), extra: 'curado' }
    const out = mergeFeedEvents([local], [{ ...ev('a'), extra: 'del feed' } as typeof local])
    expect(out).toHaveLength(1)
    expect(out[0].extra).toBe('curado')
  })

  it('sin nada que fundir devuelve lo mismo', () => {
    expect(mergeFeedEvents([ev('a')], []).map(e => e.id)).toEqual(['a'])
  })
})

describe('filterFromDay', () => {
  it('deja fuera lo anterior al corte y conserva el día del corte', () => {
    const out = filterFromDay(
      [ev('antes', '2026-08-27T20:00:00Z'), ev('corte', '2026-08-28T20:00:00Z'), ev('despues', '2026-09-01T20:00:00Z')],
      '2026-08-28',
    )
    expect(out.map(e => e.id)).toEqual(['corte', 'despues'])
  })

  it('un evento sin fecha se conserva: no se puede descartar con criterio', () => {
    expect(filterFromDay([ev('sinfecha', undefined)], '2026-08-28')).toHaveLength(1)
  })

  it('lo que sobrevive al corte es justo lo que splitInitialWindow aplazó, más el día de solape', () => {
    const hoy = '2026-08-21'
    const eventos = [
      ev('a', '2026-08-22T10:00:00Z'), ev('b', '2026-08-28T10:00:00Z'), ev('c', '2026-09-05T10:00:00Z'),
    ]
    const { deferred } = splitInitialWindow(eventos, hoy, 8)
    const pedidos = filterFromDay(eventos, windowEndDay(hoy, 8))
    // Todo lo aplazado tiene que venir en la petición; el solape añade el día 28.
    for (const d of deferred) expect(pedidos.map(e => e.id)).toContain(d.id)
    expect(pedidos.map(e => e.id)).toEqual(['b', 'c'])
  })
})
