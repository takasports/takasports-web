import { describe, it, expect } from 'vitest'
import {
  seasonLooksComplete, previousSeasonYear, canPromote, pairLastSeason, type SeasonRow,
} from './last-season'
import { matchStakes, standingLabel } from './match-stakes'

const row = (name: string, rank: number, over: Partial<SeasonRow> = {}): SeasonRow =>
  ({ name, rank, pts: 100 - rank, gp: 38, ...over })

describe('seasonLooksComplete', () => {
  it('una liga terminada (38 jornadas) cuenta como completa', () => {
    expect(seasonLooksComplete(Array.from({ length: 20 }, () => ({ gp: 38 })))).toBe(true)
  })
  it('la foto de la jornada 3 NO se anuncia como cierre del año pasado', () => {
    expect(seasonLooksComplete(Array.from({ length: 20 }, () => ({ gp: 3 })))).toBe(false)
  })
  it('un solo registro alto no basta: puede ser un resto de datos', () => {
    const rows = [{ gp: 38 }, ...Array.from({ length: 19 }, () => ({ gp: 0 }))]
    expect(seasonLooksComplete(rows)).toBe(false)
  })
  it('tabla vacía → no', () => {
    expect(seasonLooksComplete([])).toBe(false)
  })
})

describe('previousSeasonYear', () => {
  it('2026 → 2025', () => expect(previousSeasonYear({ year: 2026 })).toBe(2025))
  it('sin año no se puede pedir la anterior', () => {
    expect(previousSeasonYear(undefined)).toBeUndefined()
    expect(previousSeasonYear({})).toBeUndefined()
  })
})

describe('canPromote', () => {
  const liga = [row('Barcelona', 1), row('Madrid', 2)]
  it('una liga doméstica de fútbol sí tiene ascensos', () => {
    expect(canPromote('soccer/esp.1', liga)).toBe(true)
  })
  it('en la Champions faltar es NO clasificarse, no ascender', () => {
    expect(canPromote('soccer/uefa.champions', liga)).toBe(false)
  })
  it('la NBA no tiene ascensos', () => {
    expect(canPromote('basketball/nba', liga)).toBe(false)
  })
  it('EN SEGUNDA no se puede afirmar: el que falta pudo BAJAR de primera', () => {
    // Caso real del feed del 21/08/2026: el Wolverhampton no estaba en la
    // Championship del año pasado porque venía descendido de la Premier, y la
    // primera versión lo anunciaba como "Recién ascendido".
    expect(canPromote('soccer/eng.2', liga)).toBe(false)
    expect(canPromote('soccer/esp.2', liga)).toBe(false)
  })
  it('la primera división femenina sí cuenta como primera', () => {
    expect(canPromote('soccer/esp.w.1', liga)).toBe(true)
  })
  it('con varias tablas (conferencias) faltar puede ser estar en la otra', () => {
    const conf = [row('Inter Miami', 1, { group: 'Este' }), row('LA Galaxy', 1, { group: 'Oeste' })]
    expect(canPromote('soccer/usa.1', conf)).toBe(false)
  })
})

describe('pairLastSeason', () => {
  const opts = { canPromote: true, of: 20 }

  it('los dos en la tabla → los dos con su puesto del año pasado', () => {
    const r = pairLastSeason(row('Barcelona', 1), row('Madrid', 2), opts)
    expect(r?.home.rank).toBe(1)
    expect(r?.away.rank).toBe(2)
    expect(r?.home.lastSeason).toBe(true)
  })

  it('EL CASO ÚTIL: el que falta subió de categoría', () => {
    const r = pairLastSeason(row('Madrid', 2), undefined, opts)
    expect(r?.home).toMatchObject({ rank: 2, lastSeason: true })
    expect(standingLabel(r?.away)).toBe('Recién ascendido')
  })

  it('funciona igual si el ascendido juega en casa', () => {
    const r = pairLastSeason(undefined, row('Madrid', 2), opts)
    expect(standingLabel(r?.home)).toBe('Recién ascendido')
    expect(r?.away).toMatchObject({ rank: 2, lastSeason: true })
  })

  it('donde no hay ascensos, un solo puesto no se enseña', () => {
    expect(pairLastSeason(row('Madrid', 2), undefined, { canPromote: false, of: 20 })).toBeNull()
  })

  it('ninguno de los dos en la tabla → nada que contar', () => {
    expect(pairLastSeason(undefined, undefined, opts)).toBeNull()
  })

  it('puestos de grupos distintos no se comparan', () => {
    const r = pairLastSeason(
      row('Inter Miami', 1, { group: 'Este' }),
      row('LA Galaxy', 1, { group: 'Oeste' }),
      opts,
    )
    expect(r).toBeNull()
  })
})

describe('el puesto viejo NO se disfraza de tabla viva', () => {
  it('no dispara ningún motivo, ni siquiera un 1º contra un 2º', () => {
    const r = pairLastSeason(row('Barcelona', 1), row('Madrid', 2), { canPromote: true, of: 20 })
    expect(matchStakes(r!.home, r!.away)).toBeNull()
  })

  it('con la tabla VIVA el mismo cruce sí lo dispara', () => {
    const vivo = matchStakes({ rank: 1, pts: 10 }, { rank: 2, pts: 8 })
    expect(vivo?.label).toBe('Líder vs 2º')
  })

  it('el puesto del año pasado NO se pinta en la fila', () => {
    // Salía en TODAS las filas —doce veces en una pantalla en agosto— y un "13º
    // el año pasado" no sitúa a nadie. El dato se sigue calculando y vuelve solo,
    // con sus puntos, cuando la tabla nueva es real. [José Tomás, 26/08/2026]
    expect(standingLabel({ rank: 4, pts: 72, lastSeason: true })).toBeNull()
  })

  it('pero "Recién ascendido" sí se queda: eso no caduca', () => {
    expect(standingLabel({ rank: 0, pts: 0, promoted: true })).toBe('Recién ascendido')
  })

  it('la etiqueta normal no cambia', () => {
    expect(standingLabel({ rank: 4, pts: 38 })).toBe('4º · 38 pts')
  })
})
