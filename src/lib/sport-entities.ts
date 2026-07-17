// Alta y consulta de entidades deportivas canónicas (sport_entities).
//
// sport_entities es el hub que desacopla la web de las APIs externas: sembramos aquí a
// quien la web YA muestra (los líderes de ESPN) y el cron le resuelve la foto por su
// cuenta. El slug es la clave de upsert — determinista a partir de la fuente y su id,
// para que volver a sembrar sea idempotente sin necesitar constraints extra.

import { adminSupabase } from '@/lib/supabase-admin'
import type { EntityType, ResolvableEntity } from '@/lib/entity-images'

export interface SeedEntity {
  type: EntityType
  sport: string
  name: string
  espnId?: string | null
  apisportsId?: number | null
  wikidataId?: string | null
  /** "soccer/esp.1" — necesario para pedir las stats por jugador a ESPN Core. Se guarda en meta. */
  leagueSlug?: string | null
  /** Club actual (para detectar traspasos entre snapshots). Se guarda en meta. */
  club?: string | null
}

/**
 * Clave estable e idempotente. Sin id de fuente no hay clave fiable —los nombres se
 * repiten y cambian de grafía—, así que esas entidades no se siembran.
 */
export function entitySlug(entity: SeedEntity): string | null {
  if (entity.espnId) return `${entity.sport}-${entity.type}-espn-${entity.espnId}`
  if (entity.apisportsId) return `${entity.sport}-${entity.type}-as-${entity.apisportsId}`
  if (entity.wikidataId) return `${entity.sport}-${entity.type}-wd-${entity.wikidataId}`
  return null
}

export function sportEntitiesConfigured(): boolean {
  return adminSupabase() !== null
}

/**
 * Upsert idempotente por slug. Deduplica el lote ANTES de enviarlo: Postgres rechaza un
 * ON CONFLICT que afecte dos veces a la misma fila, y los líderes de ESPN repiten
 * jugador entre categorías (un goleador suele salir también en tiros y en faltas).
 */
export async function upsertSportEntities(entities: SeedEntity[]): Promise<number> {
  const db = adminSupabase()
  if (!db) return 0

  const bySlug = new Map<string, Record<string, unknown>>()
  for (const entity of entities) {
    const slug = entitySlug(entity)
    if (!slug || !entity.name) continue
    const meta: Record<string, string> = {}
    if (entity.leagueSlug) meta.leagueSlug = entity.leagueSlug
    if (entity.club) meta.club = entity.club
    bySlug.set(slug, {
      type: entity.type,
      sport: entity.sport,
      name: entity.name,
      slug,
      espn_id: entity.espnId ?? null,
      apisports_id: entity.apisportsId ?? null,
      wikidata_id: entity.wikidataId ?? null,
      meta,
      updated_at: new Date().toISOString(),
    })
  }
  const rows = [...bySlug.values()]
  if (!rows.length) return 0

  const { error } = await db.from('sport_entities').upsert(rows, { onConflict: 'slug' })
  return error ? 0 : rows.length
}

export interface EntityPhoto {
  url: string
  /** Texto a mostrar cuando la licencia lo exige (Wikimedia CC). */
  attribution: string | null
}

/**
 * Fotos YA resueltas, indexadas por el id de ESPN del jugador. Es una lectura barata de
 * NUESTRA caché: la cascada contra terceros ocurre en el cron, nunca en una petición de
 * usuario. Si Supabase no está, devuelve vacío y la UI cae al escudo como siempre.
 */
export async function getPhotosByEspnId(
  sport: string,
  espnIds: string[],
): Promise<Map<string, EntityPhoto>> {
  const photos = new Map<string, EntityPhoto>()
  const db = adminSupabase()
  if (!db || !espnIds.length) return photos

  const { data, error } = await db
    .from('sport_entities')
    .select('espn_id, sport_entity_images!inner(url, attribution)')
    .eq('sport', sport)
    .in('espn_id', espnIds)
    .eq('sport_entity_images.kind', 'headshot')
    .eq('sport_entity_images.status', 'ok')
  if (error || !data) return photos

  for (const row of data) {
    const espnId = row.espn_id as string | null
    const image = (row.sport_entity_images as Array<{ url?: string; attribution?: string | null }>)?.[0]
    if (!espnId || !image?.url) continue
    photos.set(espnId, { url: image.url, attribution: image.attribution ?? null })
  }
  return photos
}

/**
 * Entidades a las que aún no se les ha resuelto imagen, en lotes.
 *
 * Filtra por "sin NINGUNA fila en sport_entity_images". Hoy resolvemos un único kind por
 * tipo de entidad (headshot para jugadores, logo para equipos), así que equivale a "le
 * falta la suya". Si algún día resolvemos varios kinds por entidad, hay que filtrar por
 * kind. Los 'missing' cuentan como resueltos: ya tienen fila, así que no se reintentan.
 */
export async function listEntitiesNeedingImage(
  type: EntityType,
  limit: number,
): Promise<ResolvableEntity[]> {
  const db = adminSupabase()
  if (!db) return []
  const { data, error } = await db
    .from('sport_entities')
    .select('id, type, sport, name, espn_id, apisports_id, wikidata_id, sport_entity_images!left(kind)')
    .eq('type', type)
    .is('sport_entity_images', null)
    .limit(limit)
  if (error || !data) return []

  return data.map(row => ({
    id: row.id as string,
    type: row.type as EntityType,
    sport: row.sport as string,
    name: row.name as string,
    espnId: (row.espn_id as string | null) ?? null,
    apisportsId: (row.apisports_id as number | null) ?? null,
    wikidataId: (row.wikidata_id as string | null) ?? null,
  }))
}

export interface SnapshotEntity {
  id: string
  espnId: string
  name: string
  leagueSlug: string   // "soccer/esp.1"
  club: string | null
}

/**
 * Jugadores de fútbol a los que aún NO se les ha tomado snapshot de rendimiento en la
 * semana `weekStart` (YYYY-MM-DD del lunes), en lotes.
 *
 * A esta escala (~cientos) traigo todos los jugadores y filtro contra el set de "ya hechos
 * esta semana" en memoria: es correcto sin depender del anti-join de PostgREST (que es
 * frágil cuando el filtro va sobre la tabla embebida). Solo devuelve entidades con
 * meta.leagueSlug — sin liga no se puede pedir la línea de stats a ESPN Core.
 */
export async function listEntitiesNeedingSnapshot(
  weekStart: string,
  limit: number,
): Promise<SnapshotEntity[]> {
  const db = adminSupabase()
  if (!db) return []

  const { data: done } = await db
    .from('player_stat_snapshots')
    .select('entity_id')
    .eq('week_start', weekStart)
  const doneSet = new Set((done ?? []).map(r => r.entity_id as string))

  const { data, error } = await db
    .from('sport_entities')
    .select('id, espn_id, name, meta')
    .eq('type', 'player')
    .eq('sport', 'football')
    .not('espn_id', 'is', null)
  if (error || !data) return []

  const out: SnapshotEntity[] = []
  for (const row of data) {
    const id = row.id as string
    if (doneSet.has(id)) continue
    const meta = (row.meta as Record<string, unknown> | null) ?? {}
    const leagueSlug = typeof meta.leagueSlug === 'string' ? meta.leagueSlug : null
    if (!leagueSlug || !row.espn_id) continue
    out.push({
      id,
      espnId: row.espn_id as string,
      name: row.name as string,
      leagueSlug,
      club: typeof meta.club === 'string' ? meta.club : null,
    })
    if (out.length >= limit) break
  }
  return out
}
