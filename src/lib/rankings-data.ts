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

// Normaliza slugs de liga heredados de versiones anteriores del ingest
const LEAGUE_SLUG_MAP: Record<string, string> = {
  premierleague: 'premier',
  d1arkema:      'div1f',
}
function normalizeLeague(l: string | undefined): string | undefined {
  if (!l) return undefined
  return LEAGUE_SLUG_MAP[l] ?? l
}

// Normaliza posiciones con caracteres especiales o variantes antiguas
const POSITION_MAP: Record<string, string> = {
  'ala-pívot': 'ala-pivote',
}
function normalizePosition(p: string | undefined): string | undefined {
  if (!p) return undefined
  return POSITION_MAP[p] ?? p
}

// Deriva el país del club desde el slug de liga cuando country es null en la DB
const LEAGUE_COUNTRY_MAP: Record<string, string> = {
  laliga:        'spain',
  premier:       'england',
  premierleague: 'england',
  bundesliga:    'germany',
  seriea:        'italy',
  ligue1:        'france',
  mls:           'usa',
}
function deriveCountry(league: string | undefined, country: string | undefined): string | undefined {
  if (country) return country
  return league ? LEAGUE_COUNTRY_MAP[league] : undefined
}

// Convierte nombre de país o slug a emoji de bandera (para jugadores auto-generados de ESPN)
const COUNTRY_FLAG_MAP: Record<string, string> = {
  // Nombres en inglés (ESPN)
  'spain': '🇪🇸', 'france': '🇫🇷', 'germany': '🇩🇪', 'england': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'italy': '🇮🇹', 'portugal': '🇵🇹', 'brazil': '🇧🇷', 'argentina': '🇦🇷',
  'netherlands': '🇳🇱', 'belgium': '🇧🇪', 'croatia': '🇭🇷', 'serbia': '🇷🇸',
  'austria': '🇦🇹', 'switzerland': '🇨🇭', 'poland': '🇵🇱', 'czech republic': '🇨🇿',
  'denmark': '🇩🇰', 'sweden': '🇸🇪', 'norway': '🇳🇴', 'scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'republic of ireland': '🇮🇪', 'ireland': '🇮🇪',
  'nigeria': '🇳🇬', 'senegal': '🇸🇳', 'ivory coast': '🇨🇮', 'cameroon': '🇨🇲',
  'ghana': '🇬🇭', 'morocco': '🇲🇦', 'egypt': '🇪🇬', 'algeria': '🇩🇿',
  'mexico': '🇲🇽', 'colombia': '🇨🇴', 'uruguay': '🇺🇾', 'chile': '🇨🇱',
  'ecuador': '🇪🇨', 'peru': '🇵🇪', 'venezuela': '🇻🇪', 'paraguay': '🇵🇾',
  'united states': '🇺🇸', 'usa': '🇺🇸', 'canada': '🇨🇦', 'japan': '🇯🇵',
  'south korea': '🇰🇷', 'australia': '🇦🇺', 'turkey': '🇹🇷', 'ukraine': '🇺🇦',
  'russia': '🇷🇺', 'greece': '🇬🇷', 'slovakia': '🇸🇰', 'hungary': '🇭🇺',
  'romania': '🇷🇴', 'bulgaria': '🇧🇬', 'finland': '🇫🇮', 'kosovo': '🇽🇰',
  'north macedonia': '🇲🇰', 'albania': '🇦🇱', 'slovenia': '🇸🇮', 'estonia': '🇪🇪',
  'latvia': '🇱🇻', 'lithuania': '🇱🇹', 'bosnia and herzegovina': '🇧🇦',
  'mali': '🇲🇱', 'guinea': '🇬🇳', 'guinea-bissau': '🇬🇼', 'gabon': '🇬🇦',
  'republic of congo': '🇨🇬', 'dr congo': '🇨🇩', 'togo': '🇹🇬', 'benin': '🇧🇯',
  'cape verde': '🇨🇻', 'angola': '🇦🇴', 'zambia': '🇿🇲', 'zimbabwe': '🇿🇼',
  'qatar': '🇶🇦', 'saudi arabia': '🇸🇦', 'iran': '🇮🇷',
  // UK
  'united kingdom': '🇬🇧', 'great britain': '🇬🇧',
  // Slugs (LEAGUE_COUNTRY_MAP → flag)
}
function countryToFlag(country: string | undefined): string | undefined {
  if (!country) return undefined
  // Si ya es un emoji (empieza con \uD83C), devolverlo tal cual
  if (/^\p{Emoji}/u.test(country) || country.startsWith('🏴')) return country
  const key = country.toLowerCase().trim()
  return COUNTRY_FLAG_MAP[key] ?? undefined
}

// Mapea fila de la vista `ranking_view` → RankingEntry
function rowToEntry(row: any): RankingEntry {
  const league = normalizeLeague(row.league ?? undefined)

  // La vista devuelve `factors` como JSONB con posibles valores null si la entrada
  // es editorial (creadores, periodistas) y no tiene datos de ingest.
  // Solo usamos el objeto si al menos un valor es numérico para evitar NaN en calcScore.
  const rawF = row.factors
  const factors: RankingEntry['factors'] = rawF && (
    rawF.rendimiento !== null || rawF.contexto !== null ||
    rawF.mediatico   !== null || rawF.narrativa !== null
  )
    ? {
      rendimiento: Number(rawF.rendimiento ?? 0),
      contexto:    Number(rawF.contexto    ?? 0),
      mediatico:   Number(rawF.mediatico   ?? 0),
      narrativa:   Number(rawF.narrativa   ?? 0),
    }
    : undefined

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
    country:      countryToFlag(deriveCountry(league, row.country ?? undefined)),
    league,
    position:     normalizePosition(row.position ?? undefined),
    gender:       row.gender ?? undefined,
    featured:     row.featured ?? undefined,
    scorePrev:    row.score_prev !== null ? Number(row.score_prev) : undefined,
    scoreSport:   row.score_sport !== null && row.score_sport !== undefined ? Number(row.score_sport) : undefined,
    rankSport:    row.rank_sport  !== null && row.rank_sport  !== undefined ? Number(row.rank_sport)  : undefined,
    trendReason:  row.trend_reason ?? undefined,
    factors,
    editorialBoost: row.editorial_boost !== null ? Number(row.editorial_boost) : undefined,
    editorialNote:  row.editorial_note ?? undefined,
    category:       row.category ?? undefined,
    handles:        row.handles ?? undefined,
  }
}

// Categorías que tienen datos en Supabase (las demás siempre usan el estático)
const DB_CATEGORIES: RankingCategory[] = [
  'jugadores', 'jugadoras', 'sub21', 'latam', 'concacaf', 'clubes', 'clubes_femenino', 'entrenadores',
  'creadores', 'periodistas', 'creadores_wwe',
]
// Máximo de filas por categoría. Supabase limita a 1000 por defecto si no se especifica range.
// Top-N por categoría que servimos en el SSR de /rankings. Antes 1000 →
// el HTML llegaba a 1.4 MB (12 categorías × 1000 entries × ~20 campos =
// payload RSC monstruoso). 200 da margen para filtros/búsqueda local sin
// inflar el bundle; el detalle individual /rankings/[id] no depende de
// este límite. Si en el futuro hace falta navegar más profundo, paginar
// via API (no traer todo al cliente).
const MAX_ROWS_PER_CAT = 200

/**
 * Obtiene un ranking por categoría.
 * Si Supabase falla o no está configurado, devuelve el array estático.
 */
export async function getRanking(category: RankingCategory): Promise<RankingEntry[]> {
  if (!supabaseConfigured()) return STATIC_FALLBACK[category] ?? []
  if (!DB_CATEGORIES.includes(category)) return STATIC_FALLBACK[category] ?? []

  try {
    const sb = getReadClient()
    const { data, error } = await sb
      .from('ranking_view')
      .select('*')
      .eq('category', category)
      .order('rank', { ascending: true })
      .range(0, MAX_ROWS_PER_CAT - 1)

    if (error || !data || data.length === 0) {
      return STATIC_FALLBACK[category] ?? []
    }
    return data.map(rowToEntry)
  } catch {
    return STATIC_FALLBACK[category] ?? []
  }
}

/**
 * Carga TODAS las categorías en paralelo (para la página principal).
 * Cada categoría con Supabase data se fetcha por separado para evitar
 * el límite de 1000 filas de Supabase en una query única.
 */
export async function getAllRankings(
  only?: ReadonlyArray<RankingCategory>,
): Promise<Partial<Record<RankingCategory, RankingEntry[]>>> {
  // El SSR de /rankings llama con `only` (categorías de la vista activa)
  // para no serializar 12 categorías × 200 entries al HTML. Las categorías
  // omitidas no se devuelven aquí — el cliente cae al STATIC_FALLBACK
  // que ya vive en el bundle JS (importado por RankingsClient indirect).
  // Si no se pasa `only`, devolvemos todas (compat con otros consumidores).
  const targetCats = only && only.length > 0
    ? DB_CATEGORIES.filter(c => only.includes(c))
    : DB_CATEGORIES

  if (!supabaseConfigured()) {
    if (!only) return STATIC_FALLBACK
    const partial: Partial<Record<RankingCategory, RankingEntry[]>> = {}
    for (const c of only) partial[c] = STATIC_FALLBACK[c]
    return partial
  }

  try {
    const sb = getReadClient()

    // Fetch en paralelo — una query por categoría objetivo
    const fetches = targetCats.map(cat =>
      sb
        .from('ranking_view')
        .select('*')
        .eq('category', cat)
        .order('rank', { ascending: true })
        .range(0, MAX_ROWS_PER_CAT - 1)
        .then(({ data, error }) => ({ cat, rows: (!error && data) ? data : null }))
    )
    const results = await Promise.all(fetches)

    // Si `only` está, devolvemos SOLO esas categorías (no fundimos con
    // STATIC_FALLBACK aquí — el cliente lo hace por defecto si dbData[cat]
    // viene undefined). Si no, devolvemos el bag completo como antes.
    if (only) {
      const partial: Partial<Record<RankingCategory, RankingEntry[]>> = {}
      for (const { cat, rows } of results) {
        if (rows && rows.length > 0) {
          partial[cat] = rows.map(rowToEntry)
        } else {
          partial[cat] = STATIC_FALLBACK[cat]
        }
      }
      return partial
    }

    const result = { ...STATIC_FALLBACK } as Record<RankingCategory, RankingEntry[]>
    for (const { cat, rows } of results) {
      if (rows && rows.length > 0) {
        result[cat] = rows.map(rowToEntry)
      }
    }
    return result
  } catch {
    if (only) {
      const partial: Partial<Record<RankingCategory, RankingEntry[]>> = {}
      for (const c of only) partial[c] = STATIC_FALLBACK[c]
      return partial
    }
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
      .in('category', ['jugadores', 'jugadoras', 'sub21', 'latam', 'concacaf', 'clubes', 'entrenadores'])
      .range(0, 999)
    if (error || !data || data.length === 0) return { movers: [], fallers: [] }

    const entries: MoverEntry[] = data.map((r: any) => ({
      id:          r.id,
      name:        r.name,
      subtitle:    r.subtitle ?? '',
      sport:       r.sport ?? undefined,
      emoji:       r.emoji ?? undefined,
      country:     countryToFlag(r.country ?? undefined),
      trendReason: r.trend_reason ?? undefined,
      score:       Number(r.score),
      scorePrev:   Number(r.score_prev),
      delta:       Math.round((Number(r.score) - Number(r.score_prev)) * 10) / 10,
    }))

    const sorted = [...entries].sort((a, b) => b.delta - a.delta)
    return {
      movers:  sorted.filter(e => e.delta >= 1).slice(0, limit),
      fallers: sorted.filter(e => e.delta <= -1).slice(-limit).reverse(),
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
 * Devuelve la fecha del último ingest automático (MAX last_auto_update).
 * Útil para mostrar "Actualizado hace X días" en la UI.
 */
export async function getLastIngestTime(): Promise<string | null> {
  if (!supabaseConfigured()) return null
  try {
    const sb = getReadClient()
    const { data, error } = await sb
      .from('ranking_entries')
      .select('last_auto_update')
      .not('last_auto_update', 'is', null)
      .order('last_auto_update', { ascending: false })
      .limit(1)
    if (error || !data || data.length === 0) return null
    return (data[0] as { last_auto_update: string }).last_auto_update ?? null
  } catch {
    return null
  }
}

/**
 * Devuelve las entries únicas de la DB, deduplicadas por id.
 * Limitado a `limit` entradas ordenadas por score desc para evitar
 * generar miles de páginas estáticas en build time.
 * El resto se generan on-demand via ISR (dynamicParams = true).
 */
export async function getAllEntryIdsFromDb(limit = 1000): Promise<string[]> {
  if (!supabaseConfigured()) return []
  try {
    const sb = getReadClient()
    const { data, error } = await sb
      .from('ranking_view')
      .select('id')
      .order('score', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return [...new Set(data.map((r: { id: string }) => r.id))]
  } catch {
    return []
  }
}

/**
 * Top N entries de la DB para el comparador — más ligero que getAllRankings().
 * Solo devuelve los campos mínimos para el picker + radar del comparador.
 */
export async function getTopEntriesForCompare(limit = 600): Promise<RankingEntry[]> {
  if (!supabaseConfigured()) return []
  try {
    const sb = getReadClient()
    const { data, error } = await sb
      .from('ranking_view')
      .select('id,name,subtitle,sport,emoji,country,score,score_prev,factors,editorial_boost,editorial_note,trend,badge,image_url,position,gender,region,league,category')
      .order('score', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data.map(rowToEntry)
  } catch {
    return []
  }
}
