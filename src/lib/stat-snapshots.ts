// Lector de snapshots editoriales (tabla stat_block_snapshots de Supabase).
// Permite que /api/stats/standings devuelva datos para deportes sin API gratuita
// (MotoGP, ciclismo, golf, UFC streaks, WTA superficies). Las filas las puebla
// un cron n8n con scraping semanal o se inyectan a mano vía editorial.
import { adminSupabase } from './supabase-admin'
import type { StandingRow } from './stats-editorial'

export interface StatSnapshot {
  rows: StandingRow[]
  source: string
  asOf: string | null
  updatedAt: string
}

const TABLE = 'stat_block_snapshots'

// Cache en proceso para no pegarle a Supabase por bloque en cada request.
// El page-level revalidate (300s) ya limita el impacto, pero esto evita N
// queries cuando construimos la respuesta completa.
let _cache: { ts: number; map: Map<string, StatSnapshot> } | null = null
const CACHE_MS = 5 * 60 * 1000

export async function loadAllSnapshots(): Promise<Map<string, StatSnapshot>> {
  if (_cache && Date.now() - _cache.ts < CACHE_MS) return _cache.map
  const sb = adminSupabase()
  if (!sb) return new Map()
  try {
    const { data, error } = await sb
      .from(TABLE)
      .select('block_id, rows, source, as_of, updated_at')
    if (error || !data) {
      _cache = { ts: Date.now(), map: new Map() }
      return _cache.map
    }
    const map = new Map<string, StatSnapshot>()
    for (const r of data as Array<{ block_id: string; rows: unknown; source: string; as_of: string | null; updated_at: string }>) {
      if (!Array.isArray(r.rows)) continue
      map.set(r.block_id, {
        rows: r.rows as StandingRow[],
        source: r.source,
        asOf: r.as_of,
        updatedAt: r.updated_at,
      })
    }
    _cache = { ts: Date.now(), map }
    return map
  } catch {
    _cache = { ts: Date.now(), map: new Map() }
    return _cache.map
  }
}

export function getSnapshot(map: Map<string, StatSnapshot>, blockId: string): StatSnapshot | null {
  return map.get(blockId) ?? null
}
