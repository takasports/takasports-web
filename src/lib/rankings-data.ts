// Capa de datos del Índice Taka
//
// Estrategia: lee de Supabase (vista `ranking_view` que ya aplica overrides
// editoriales). Si Supabase no está configurado o falla, cae al array estático
// de `rankings.ts` para mantener la web siempre operativa.
//
// La vista `ranking_view` aplica transparentemente:
//   · Capa AUTO (cron semanal recalcula factors, score, rank, insight)
//   · Capa MANUAL (overrides editoriales — Taka mueve a placer)
//
// Cache: revalidate 1h por categoría. Invalidación manual con revalidateTag.

import { createClient } from '@supabase/supabase-js'
import {
  RankingEntry,
  RANKING_JUGADORES,
  RANKING_JUGADORAS,
  RANKING_CLUBES,
  RANKING_CLUBES_FEMENINO,
  RANKING_ENTRENADORES,
  RANKING_CREADORES,
  RANKING_PERIODISTAS,
  RANKING_LUCHADORAS_UFC,
  RANKING_CREADORES_WWE,
  RANKING_JUGADORES_SUB21,
  RANKING_JUGADORES_LATAM,
  RANKING_JUGADORES_CONCACAF,
} from './rankings'

export type RankingCategory =
  | 'jugadores'
  | 'jugadoras'
  | 'clubes'
  | 'clubes_femenino'
  | 'entrenadores'
  | 'creadores'
  | 'periodistas'
  | 'luchadoras_ufc'
  | 'creadores_wwe'
  | 'sub21'
  | 'latam'
  | 'concacaf'

const STATIC_FALLBACK: Record<RankingCategory, RankingEntry[]> = {
  jugadores:        RANKING_JUGADORES,
  jugadoras:        RANKING_JUGADORAS,
  clubes:           RANKING_CLUBES,
  clubes_femenino:  RANKING_CLUBES_FEMENINO,
  entrenadores:     RANKING_ENTRENADORES,
  creadores:        RANKING_CREADORES,
  periodistas:      RANKING_PERIODISTAS,
  luchadoras_ufc:   RANKING_LUCHADORAS_UFC,
  creadores_wwe:    RANKING_CREADORES_WWE,
  sub21:            RANKING_JUGADORES_SUB21,
  latam:            RANKING_JUGADORES_LATAM,
  concacaf:         RANKING_JUGADORES_CONCACAF,
}

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// Cliente "fetch" (no SSR cookies) — más rápido y cacheable.
function getReadClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
}

// Mapea fila de la vista `ranking_view` → RankingEntry
function rowToEntry(row: any): RankingEntry {
  return {
    id:           row.id,
    rank:         row.rank ?? 0,
    name:         row.name,
    subtitle:     row.subtitle ?? '',
    sport:        row.sport ?? undefined,
    score:        Number(row.score ?? 0),
    trend:        (row.trend ?? 'flat') as RankingEntry['trend'],
    insight:      row.insight ?? '',
    emoji:        row.emoji ?? undefined,
    image:        row.image_url ?? undefined,
    badge:        row.badge ?? undefined,
    region:       row.region ?? undefined,
    country:      row.country ?? undefined,
    league:       row.league ?? undefined,
    position:     row.position ?? undefined,
    gender:       row.gender ?? undefined,
    featured:     row.featured ?? undefined,
    scorePrev:    row.score_prev !== null ? Number(row.score_prev) : undefined,
    trendReason:  row.trend_reason ?? undefined,
    factors:      row.factors ?? undefined,
    editorialBoost: row.editorial_boost !== null ? Number(row.editorial_boost) : undefined,
    editorialNote:  row.editorial_note ?? undefined,
  }
}

/**
 * Obtiene un ranking por categoría.
 * Si Supabase falla o no está configurado, devuelve el array estático.
 */
export async function getRanking(category: RankingCategory): Promise<RankingEntry[]> {
  if (!supabaseConfigured()) return STATIC_FALLBACK[category] ?? []

  try {
    const sb = getReadClient()
    const { data, error } = await sb
      .from('ranking_view')
      .select('*')
      .eq('category', category)
      .order('rank', { ascending: true })

    if (error || !data || data.length === 0) {
      // Sin datos en DB todavía → fallback al estático (primera carga / pre-cron)
      return STATIC_FALLBACK[category] ?? []
    }
    return data.map(rowToEntry)
  } catch {
    return STATIC_FALLBACK[category] ?? []
  }
}

/**
 * Carga TODAS las categorías de un golpe (para la página principal).
 * Una sola query a Supabase → mapeo en memoria.
 */
export async function getAllRankings(): Promise<Record<RankingCategory, RankingEntry[]>> {
  if (!supabaseConfigured()) return STATIC_FALLBACK

  try {
    const sb = getReadClient()
    const { data, error } = await sb
      .from('ranking_view')
      .select('*')
      .order('category')
      .order('rank', { ascending: true })

    if (error || !data || data.length === 0) return STATIC_FALLBACK

    const grouped: Record<string, RankingEntry[]> = {}
    for (const row of data) {
      const cat = row.category as RankingCategory
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(rowToEntry(row))
    }
    // Rellena con estático las categorías que la DB no tenga aún
    const result = { ...STATIC_FALLBACK } as Record<RankingCategory, RankingEntry[]>
    for (const cat of Object.keys(grouped) as RankingCategory[]) {
      result[cat] = grouped[cat]
    }
    return result
  } catch {
    return STATIC_FALLBACK
  }
}

/**
 * Indica si la fuente actual viene de la DB o del fallback estático.
 * Útil para banners de admin / debugging.
 */
export async function getRankingSource(): Promise<'db' | 'static'> {
  if (!supabaseConfigured()) return 'static'
  try {
    const sb = getReadClient()
    const { count } = await sb
      .from('ranking_view')
      .select('*', { count: 'exact', head: true })
    return (count ?? 0) > 0 ? 'db' : 'static'
  } catch {
    return 'static'
  }
}

export interface MoverEntry {
  id: string
  name: string
  subtitle: string
  sport?: string
  emoji?: string
  country?: string
  trendReason?: string
  score: number
  scorePrev: number
  delta: number
}

/**
 * Devuelve los mayores movimientos de la semana desde la DB.
 * Si la DB no tiene datos con score_prev, devuelve arrays vacíos
 * (el componente cae al estático).
 */
export async function getTopMovers(limit = 3): Promise<{ movers: MoverEntry[]; fallers: MoverEntry[] }> {
  if (!supabaseConfigured()) return { movers: [], fallers: [] }
  try {
    const sb = getReadClient()
    const { data, error } = await sb
      .from('ranking_view')
      .select('id,name,subtitle,sport,emoji,country,trend_reason,score,score_prev')
      .not('score_prev', 'is', null)
    if (error || !data || data.length === 0) return { movers: [], fallers: [] }

    const entries: MoverEntry[] = data.map((r: any) => ({
      id:          r.id,
      name:        r.name,
      subtitle:    r.subtitle ?? '',
      sport:       r.sport ?? undefined,
      emoji:       r.emoji ?? undefined,
      country:     r.country ?? undefined,
      trendReason: r.trend_reason ?? undefined,
      score:       Number(r.score),
      scorePrev:   Number(r.score_prev),
      delta:       Math.round((Number(r.score) - Number(r.score_prev)) * 10) / 10,
    }))

    const sorted = [...entries].sort((a, b) => b.delta - a.delta)
    return {
      movers:  sorted.slice(0, limit),
      fallers: sorted.slice(-limit).reverse(),
    }
  } catch {
    return { movers: [], fallers: [] }
  }
}

/**
 * Busca una entry concreta en la DB por id (buscando en todas las categorías).
 * Devuelve la de mayor score si aparece en varias.
 * Fallback: undefined (el caller decide si usar el estático).
 */
export async function findEntryByIdFromDb(id: string): Promise<RankingEntry | undefined> {
  if (!supabaseConfigured()) return undefined
  try {
    const sb = getReadClient()
    const { data, error } = await sb
      .from('ranking_view')
      .select('*')
      .eq('id', id)
      .order('score', { ascending: false })
      .limit(1)
    if (error || !data || data.length === 0) return undefined
    return rowToEntry(data[0])
  } catch {
    return undefined
  }
}

/**
 * Devuelve todas las entries únicas de la DB, deduplicadas por id (mayor score gana).
 * Se usa en generateStaticParams para incluir entries que el cron añadió y
 * aún no están en el archivo estático.
 */
export async function getAllEntryIdsFromDb(): Promise<string[]> {
  if (!supabaseConfigured()) return []
  try {
    const sb = getReadClient()
    const { data, error } = await sb
      .from('ranking_view')
      .select('id')
    if (error || !data) return []
    return [...new Set(data.map((r: { id: string }) => r.id))]
  } catch {
    return []
  }
}
