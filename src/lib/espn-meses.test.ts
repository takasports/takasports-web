// El rango de fechas de ESPN murió y nadie se enteró.
//
// El 18/09/2026, un viernes con jornada completa en Europa, /calendario
// anunciaba «2 partidos» y eran dos cuartos de un torneo de tenis. La causa:
// `?dates=20260918-20261009` había empezado a responder **400** para fútbol y
// baloncesto. Once sitios del repo pedían así, y los once envolvían la llamada
// en `if (!res.ok) return []`, así que el fallo se leía como «hoy no hay
// partidos» —en el calendario, en el archivo de resultados y en la quiniela—.
//
// Lo que hace que esto no se repita no es la prueba de abajo sola: es que ahora
// hay UN solo sitio que habla de fechas con ESPN. [18/09/2026]

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mesesDeVentana, eventosDeVentana, diaDesplazado } from './espn-meses'

const RAIZ = resolve(__dirname, '../..')

describe('mesesDeVentana', () => {
  it('una ventana dentro de un mes es una sola llamada', () => {
    expect(mesesDeVentana('20260901', '20260930')).toEqual(['202609'])
  })

  it('una ventana que cruza de mes son dos', () => {
    expect(mesesDeVentana('20260918', '20261009')).toEqual(['202609', '202610'])
  })

  it('cruza el fin de año sin saltarse diciembre ni enero', () => {
    expect(mesesDeVentana('20261215', '20270120')).toEqual(['202612', '202701'])
  })

  it('acepta las fechas con guiones, que es como las escribe medio repo', () => {
    expect(mesesDeVentana('2026-09-18', '2026-10-09')).toEqual(['202609', '202610'])
  })

  it('da igual el orden en que le pases los extremos', () => {
    expect(mesesDeVentana('20261009', '20260918')).toEqual(['202609', '202610'])
  })

  it('una ventana absurda no se convierte en cientos de llamadas', () => {
    // El Mundial pide junio-julio; una fecha corrupta no debe poder pedir diez años.
    expect(mesesDeVentana('20200101', '20400101').length).toBeLessThanOrEqual(24)
  })
})

describe('eventosDeVentana', () => {
  afterEach(() => vi.unstubAllGlobals())

  const respuesta = (events: unknown[]) => ({
    ok: true, json: async () => ({ events }),
  })

  it('recorta lo que se sale de la ventana, que antes recortaba ESPN', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta([
      { id: '1', date: '2026-09-01T18:00Z' },   // del mes, pero antes de la ventana
      { id: '2', date: '2026-09-20T18:00Z' },   // dentro
      { id: '3', date: '2026-10-25T18:00Z' },   // del mes, pero después
    ])))
    const out = await eventosDeVentana({ slug: 'soccer/esp.1', desde: '20260918', hasta: '20261009' })
    expect(out.map(e => e.id)).toEqual(['2'])
  })

  it('funde los dos meses y no repite un partido que salga en ambos', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta([{ id: '7', date: '2026-09-20T18:00Z' }])))
    const out = await eventosDeVentana({ slug: 'soccer/esp.1', desde: '20260918', hasta: '20261009' })
    expect(out).toHaveLength(1)
  })

  it('si un mes falla, se queda con el otro en vez de devolver nada', async () => {
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      n++
      if (n === 1) throw new Error('ESPN se cayó')
      return respuesta([{ id: '9', date: '2026-10-02T18:00Z' }])
    }))
    const out = await eventosDeVentana({ slug: 'soccer/esp.1', desde: '20260918', hasta: '20261009' })
    expect(out.map(e => e.id)).toEqual(['9'])
  })

  it('devuelve los partidos ordenados por hora', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta([
      { id: 'tarde', date: '2026-09-20T21:00Z' },
      { id: 'pronto', date: '2026-09-20T12:00Z' },
    ])))
    const out = await eventosDeVentana({ slug: 'soccer/esp.1', desde: '20260918', hasta: '20260930' })
    expect(out.map(e => e.id)).toEqual(['pronto', 'tarde'])
  })

  it('nunca pide un rango: solo meses', async () => {
    const espia = vi.fn(async (url: string) => { void url; return respuesta([]) })
    vi.stubGlobal('fetch', espia)
    await eventosDeVentana({ slug: 'soccer/esp.1', desde: '20260918', hasta: '20261009' })
    expect(espia.mock.calls.length).toBeGreaterThan(0)
    for (const [url] of espia.mock.calls) {
      expect(url).toMatch(/[?&]dates=\d{6}(&|$)/)
      expect(url).not.toMatch(/dates=\d+-\d+/)
    }
  })
})

describe('diaDesplazado', () => {
  it('suma y resta días en el formato que espera ESPN', () => {
    const base = new Date('2026-09-18T10:00:00Z')
    expect(diaDesplazado(0, base)).toBe('20260918')
    expect(diaDesplazado(21, base)).toBe('20261009')
    expect(diaDesplazado(-10, base)).toBe('20260908')
  })
})

describe('nadie vuelve a pedirle un rango de fechas a ESPN', () => {
  function ficheros(dir: string): string[] {
    const out: string[] = []
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules' || e.startsWith('.')) continue
      const p = join(dir, e)
      if (statSync(p).isDirectory()) out.push(...ficheros(p))
      else if (e.endsWith('.ts') || e.endsWith('.tsx')) out.push(p)
    }
    return out
  }

  /** Quita comentarios: los de este repo explican el fallo citando el rango. */
  const sinComentarios = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

  it('ningún fichero construye `dates=<algo>-<algo>` contra el marcador', () => {
    const culpables: string[] = []
    for (const f of ficheros(join(RAIZ, 'src'))) {
      if (f.endsWith('espn-meses.test.ts')) continue
      // `dates=` con dos trozos separados por un guion: el rango muerto. Un solo
      // día (`dates=${today}`) y un mes (`dates=${mes}`) siguen valiendo.
      for (const m of sinComentarios(readFileSync(f, 'utf8')).matchAll(/dates=\$?\{?[^`&\s]*\}?-\$?\{?[^`&\s]*\}?/g)) {
        culpables.push(`${f.replace(RAIZ + '/', '')} → ${m[0]}`)
      }
    }
    expect(culpables).toEqual([])
  })
})

// ── Quién puede pedir la ventana ancha ───────────────────────────────────────
//
// Del feed de ESPN cuelgan nueve consumidores y dos de ellos PUBLICAN lo que
// reciben: `match-sitemap.xml` construye una URL `/partido/` por evento. Subir
// la ventana para todos —que es lo que parecía el arreglo evidente— metería
// unas 700 fichas de partido más en el índice, y `/partido` son 741 páginas
// para 44 clics en cuatro semanas: justo el patrón que costó la factura de
// septiembre.
//
// Así que la ventana ancha es opt-in y solo la piden los dos sitios donde la
// demanda existe: la página de día y la parte del sitemap que anuncia esos
// días. [18/09/2026]
describe('la ventana ancha del feed no se le escapa a nadie', () => {
  const PERMITIDOS = [
    'src/app/calendario/dia/[fecha]/page.tsx',
    'src/app/sitemap.ts',
  ]

  function ficherosDeApp(): string[] {
    const out: string[] = []
    const rec = (dir: string) => {
      for (const e of readdirSync(dir)) {
        if (e === 'node_modules' || e.startsWith('.')) continue
        const p = join(dir, e)
        if (statSync(p).isDirectory()) rec(p)
        else if (e.endsWith('.ts') || e.endsWith('.tsx')) out.push(p)
      }
    }
    rec(join(RAIZ, 'src'))
    return out
  }

  it('solo la página de día y el sitemap piden más de 21 días', () => {
    const pedigones: string[] = []
    for (const f of ficherosDeApp()) {
      const rel = f.replace(RAIZ + '/', '')
      if (rel === 'src/lib/espn.ts') continue
      const src = readFileSync(f, 'utf8')
      if (!/fetchEspnEvents\(\s*\{/.test(src)) continue
      if (PERMITIDOS.includes(rel)) continue
      pedigones.push(rel)
    }
    expect(pedigones).toEqual([])
  })

  it('el sitemap de partidos sigue con la ventana corta', () => {
    // Este es el que publica: si algún día pide la ancha, el índice se llena de
    // fichas de partido que nadie busca.
    const src = readFileSync(join(RAIZ, 'src/app/match-sitemap.xml/route.ts'), 'utf8')
    expect(src).toMatch(/fetchEspnEvents\(\)/)
    expect(src).not.toMatch(/fetchEspnEvents\(\s*\{/)
  })
})
