// Snapshot semanal de la línea completa de estadísticas de un jugador (ESPN Core),
// para acumular el histórico de rendimiento con el que luego se calculará el valor.
//
// Guardamos TODOS los stats numéricos crudos, sin filtrar: aún no sabemos qué variables
// usará el modelo, así que capturamos los ingredientes y ya elegiremos al cocinar.

import { adminSupabase } from '@/lib/supabase-admin'
import type { SnapshotEntity } from '@/lib/sport-entities'

// Deadline propio de ingesta (no el tfetch de 6 s de stats-cache, que es para rutas de
// usuario). Un cron puede esperar; colgarse sería peor.
const INGEST_TIMEOUT_MS = 15_000

function ifetch(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(INGEST_TIMEOUT_MS), cache: 'no-store' })
}

/**
 * Lunes 00:00 UTC de la semana ISO actual — mismo criterio que la función
 * f_current_iso_week_start() que ya usa ranking_score_history, para que las series sean
 * comparables. Devuelve 'YYYY-MM-DD'.
 */
export function currentWeekStart(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = d.getUTCDay()                 // 0=domingo … 6=sábado
  const sinceMonday = dow === 0 ? 6 : dow - 1
  d.setUTCDate(d.getUTCDate() - sinceMonday)
  return d.toISOString().slice(0, 10)
}

// Temporada europea: ago→may. Ago-dic → Y; ene-jul → Y-1. (igual que players/route)
function seasonStartYear(now: Date = new Date()): number {
  return now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}

export interface StatLine {
  season: string | null
  stats: Record<string, number>
}

interface CoreCategory { stats?: Array<{ name?: string; value?: number }> }

/**
 * Línea de stats de temporada del jugador desde ESPN Core (mismo endpoint que la ficha
 * /jugador). Devuelve null SOLO ante fallo transitorio (red / 5xx) para que el cron lo
 * reintente en la siguiente pasada; un 200 con pocos o ningún stat es una respuesta
 * legítima (el jugador aún no ha jugado) y se guarda como línea válida, posiblemente vacía.
 */
export async function fetchPlayerStatLine(entity: SnapshotEntity): Promise<StatLine | null> {
  const leagueId = entity.leagueSlug.split('/').slice(1).join('.')
  const y = seasonStartYear()
  const url = `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${leagueId}/seasons/${y}/types/1/athletes/${entity.espnId}/statistics/0?lang=en`

  let json: Record<string, unknown>
  try {
    const res = await ifetch(url)
    if (res.status >= 500) return null
    if (!res.ok) return { season: String(y), stats: {} }   // 404: sin stats esta temporada
    json = (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }

  const splits = json.splits as { categories?: CoreCategory[] } | undefined
  const cats = splits?.categories ?? []
  const stats: Record<string, number> = {}
  for (const cat of cats) {
    for (const s of cat.stats ?? []) {
      if (typeof s.name === 'string' && typeof s.value === 'number' && !(s.name in stats)) {
        stats[s.name] = s.value
      }
    }
  }
  const season = (json.season as { displayName?: string } | undefined)?.displayName ?? String(y)
  return { season, stats }
}

/** Upsert idempotente por (entity_id, week_start). Re-correr la misma semana refresca. */
export async function persistSnapshot(
  entity: SnapshotEntity,
  weekStart: string,
  line: StatLine,
): Promise<boolean> {
  const db = adminSupabase()
  if (!db) return false
  const { error } = await db.from('player_stat_snapshots').upsert(
    {
      entity_id: entity.id,
      week_start: weekStart,
      captured_at: new Date().toISOString(),
      season: line.season,
      club: entity.club,
      stats: line.stats,
    },
    { onConflict: 'entity_id,week_start' },
  )
  return !error
}
