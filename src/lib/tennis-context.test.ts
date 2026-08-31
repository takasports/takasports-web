// Contexto de la ficha de tenis: forma reciente + nota del Índice Taka.
//
// Lo que se protege aquí es sobre todo la CAÍDA: los datos existen para unos
// jugadores y no para otros, así que lo que importa no es cómo se ve lleno sino
// que no se pinte un bloque vacío ni se invente una derrota.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabase-admin', () => ({ adminSupabase: vi.fn() }))

const PASADO = (o: Partial<Record<string, unknown>> = {}) => ({
  iso_date: '2026-08-23T18:00:00Z', comp: 'Cincinnati Open',
  home: 'Arthur Fils', away: 'Frances Tiafoe',
  home_score: 2, away_score: 1, match_ref: 'tennis_atp_1', ...o,
})

interface Cfg {
  local?: unknown[]
  visitante?: unknown[]
  notas?: unknown[]
  sinAdmin?: boolean
  revienta?: boolean
}

async function cargar(cfg: Cfg = {}) {
  vi.resetModules()
  const cliente = {
    from(tabla: string) {
      const estado: { col?: string } = {}
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        in: (col: string) => { estado.col = col; return chain },
        then: (res: (x: unknown) => unknown, rej?: (x: unknown) => unknown) => {
          if (cfg.revienta) return Promise.reject(new Error('base caída')).then(res, rej)
          const data = tabla === 'ranking_entries'
            ? (cfg.notas ?? [])
            : estado.col === 'home' ? (cfg.local ?? []) : (cfg.visitante ?? [])
          return Promise.resolve({ data, error: null }).then(res, rej)
        },
      }
      return chain
    },
  }
  const { adminSupabase } = await import('./supabase-admin')
  vi.mocked(adminSupabase).mockReturnValue(
    (cfg.sinAdmin ? null : cliente) as unknown as ReturnType<typeof adminSupabase>,
  )
  return (await import('./tennis-context')).getTennisContext
}

beforeEach(() => { vi.clearAllMocks() })

describe('getTennisContext — forma reciente', () => {
  it('cuenta el partido desde el lado de cada jugador', async () => {
    const get = await cargar({ local: [PASADO()] })
    const ctx = await get('Arthur Fils', 'Frances Tiafoe')

    expect(ctx!.home.form[0]).toMatchObject({ rival: 'Frances Tiafoe', won: true, sets: '2-1' })
    expect(ctx!.away.form[0]).toMatchObject({ rival: 'Arthur Fils', won: false, sets: '1-2' })
  })

  it('mezcla los partidos de local y de visitante, del más reciente al más viejo', async () => {
    const get = await cargar({
      local: [PASADO({ iso_date: '2026-08-10T00:00:00Z', away: 'Rival Viejo' })],
      visitante: [PASADO({ iso_date: '2026-08-20T00:00:00Z', home: 'Rival Nuevo', away: 'Arthur Fils', home_score: 0, away_score: 2 })],
    })
    const ctx = await get('Arthur Fils', 'Otro')

    expect(ctx!.home.form.map(f => f.rival)).toEqual(['Rival Nuevo', 'Rival Viejo'])
    expect(ctx!.home.form[0]).toMatchObject({ won: true, sets: '2-0' })
  })

  it('se queda en cinco partidos aunque la consulta traiga más', async () => {
    const get = await cargar({
      local: Array.from({ length: 9 }, (_, i) =>
        PASADO({ iso_date: `2026-08-0${i + 1}T00:00:00Z`, away: `Rival ${i}` })),
    })
    const ctx = await get('Arthur Fils', 'Otro')
    expect(ctx!.home.form).toHaveLength(5)
  })

  it('un marcador archivado a medias no inventa una derrota', async () => {
    const get = await cargar({ local: [PASADO({ home_score: null, away_score: null })] })
    const ctx = await get('Arthur Fils', 'Frances Tiafoe')

    expect(ctx!.home.form[0]).toMatchObject({ won: null, sets: '' })
  })

  it('no cuela partidos de otro jugador que venga en la misma consulta', async () => {
    const get = await cargar({
      local: [PASADO(), PASADO({ home: 'Otro Tenista', away: 'Alguien' })],
    })
    const ctx = await get('Arthur Fils', 'Frances Tiafoe')

    expect(ctx!.home.form).toHaveLength(1)
    expect(ctx!.home.form[0].rival).toBe('Frances Tiafoe')
  })
})

describe('getTennisContext — Índice Taka', () => {
  it('adjunta la nota y el id para enlazar al ranking', async () => {
    const get = await cargar({
      local: [PASADO()],
      notas: [{ id: 'arthur-fils', name: 'Arthur Fils', score_auto: '85.70', score_manual: null }],
    })
    const ctx = await get('Arthur Fils', 'Frances Tiafoe')

    expect(ctx!.home).toMatchObject({ taka: 85.7, takaId: 'arthur-fils' })
    expect(ctx!.away.taka).toBeUndefined()   // el 60% no está rankeado: se cae solo
  })

  it('la nota editorial manda sobre la automática', async () => {
    const get = await cargar({
      local: [PASADO()],
      notas: [{ id: 'x', name: 'Arthur Fils', score_auto: '85.70', score_manual: '91.00' }],
    })
    const ctx = await get('Arthur Fils', 'Otro')
    expect(ctx!.home.taka).toBe(91)
  })

  it('con el mismo nombre en varias categorías se queda con la nota más alta', async () => {
    // La PK de ranking_entries es (id, category): el mismo tenista aparece en
    // 'jugadores', 'sub21', 'latam'… y cada fila trae su propia nota.
    const get = await cargar({
      local: [PASADO()],
      notas: [
        { id: 'fils-sub21', name: 'Arthur Fils', score_auto: '80.10', score_manual: null },
        { id: 'fils', name: 'Arthur Fils', score_auto: '85.70', score_manual: null },
      ],
    })
    const ctx = await get('Arthur Fils', 'Otro')
    expect(ctx!.home).toMatchObject({ taka: 85.7, takaId: 'fils' })
  })
})

describe('getTennisContext — cuándo NO se pinta', () => {
  it('sin forma y sin notas devuelve null, no un bloque vacío', async () => {
    const get = await cargar({})
    expect(await get('Uno', 'Otro')).toBeNull()
  })

  it('sin los dos nombres no consulta nada', async () => {
    const get = await cargar({ local: [PASADO()] })
    expect(await get('Arthur Fils', undefined)).toBeNull()
    expect(await get(undefined, 'Otro')).toBeNull()
  })

  it('sin Supabase devuelve null en vez de romper la ficha', async () => {
    const get = await cargar({ sinAdmin: true })
    expect(await get('Uno', 'Otro')).toBeNull()
  })

  it('si la base falla, la ficha se queda como estaba', async () => {
    const get = await cargar({ revienta: true })
    await expect(get('Uno', 'Otro')).resolves.toBeNull()
  })
})
