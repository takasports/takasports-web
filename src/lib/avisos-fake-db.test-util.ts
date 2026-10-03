// Supabase de mentira, en memoria, para probar la idempotencia de los avisos
// (lib/avisos-*-run) sin red. Solo implementa lo que esos módulos usan.
// No es un *.test.ts: lo importan las pruebas.

type Fila = Record<string, unknown>
type Filtro = (f: Fila) => boolean

export interface FakeDb {
  tablas: Record<string, Fila[]>
  from: (t: string) => unknown
}

export function crearFakeDb(tablas: Record<string, Fila[]>, unicas: Record<string, string[][]> = {}): FakeDb {
  const choca = (t: string, fila: Fila) =>
    (unicas[t] ?? []).some((cols) => (tablas[t] ?? []).some((e) => cols.every((c) => e[c] === fila[c])))

  function builder(t: string) {
    const filtros: Filtro[] = []
    let op: 'select' | 'upsert' | 'insert' | 'delete' = 'select'
    let filas: Fila[] = []
    let ignorar = false
    let cabeza = false
    let uno = false
    let devolver = false

    const ejecutar = () => {
      tablas[t] ??= []
      if (op === 'select') {
        const data = tablas[t].filter((f) => filtros.every((fn) => fn(f)))
        if (cabeza) return { data: null, error: null, count: data.length }
        return { data: uno ? (data[0] ?? null) : data, error: null }
      }
      if (op === 'delete') {
        tablas[t] = tablas[t].filter((f) => !filtros.every((fn) => fn(f)))
        return { data: null, error: null }
      }
      const nuevas: Fila[] = []
      for (const f of filas) {
        if (choca(t, f)) {
          if (op === 'insert' || !ignorar) return { data: null, error: { code: '23505', message: 'duplicate key' } }
          continue
        }
        tablas[t].push({ ...f })
        nuevas.push(f)
      }
      return { data: devolver ? nuevas : null, error: null }
    }

    const b: Record<string, unknown> = {
      select: (_c?: string, o?: { head?: boolean }) => { if (op === 'select') cabeza = !!o?.head; else devolver = true; return b },
      eq: (c: string, v: unknown) => { filtros.push((f) => f[c] === v); return b },
      in: (c: string, v: unknown[]) => { filtros.push((f) => v.includes(f[c])); return b },
      like: (c: string, p: string) => { const pre = p.replace(/%$/, ''); filtros.push((f) => String(f[c]).startsWith(pre)); return b },
      gte: (c: string, v: string) => { filtros.push((f) => String(f[c]) >= v); return b },
      lt: (c: string, v: string) => { filtros.push((f) => String(f[c]) < v); return b },
      contains: (c: string, v: unknown[]) => { filtros.push((f) => Array.isArray(f[c]) && v.every((x) => (f[c] as unknown[]).includes(x))); return b },
      not: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: () => { uno = true; return b },
      upsert: (r: Fila | Fila[], o?: { ignoreDuplicates?: boolean }) => { op = 'upsert'; filas = Array.isArray(r) ? r : [r]; ignorar = !!o?.ignoreDuplicates; return b },
      insert: (r: Fila | Fila[]) => { op = 'insert'; filas = Array.isArray(r) ? r : [r]; return b },
      delete: () => { op = 'delete'; return b },
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(ejecutar()).then(ok, ko),
    }
    return b
  }

  return { tablas, from: (t: string) => builder(t) }
}
