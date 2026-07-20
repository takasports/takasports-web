// Alta y consulta de entidades deportivas canónicas (sport_entities).
//
// sport_entities es el hub que desacopla la web de las APIs externas: sembramos aquí a
// quien la web YA muestra (los líderes de ESPN) y el cron le resuelve la foto por su
// cuenta. El slug es la clave de upsert — determinista a partir de la fuente y su id,
// para que volver a sembrar sea idempotente sin necesitar constraints extra.

import { adminSupabase } from '@/lib/supabase-admin'
import { FOOTBALL_LEAGUE_SLUGS } from '@/lib/football-leagues'
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
  /** Club actual (detecta traspasos entre snapshots Y ancla el rescate de foto). Se guarda en meta. */
  club?: string | null
  /** País en INGLÉS (ESPN) — corrobora el match de foto contra homónimos. Se guarda en meta. */
  nationality?: string | null
  /** Fecha de nacimiento ISO "YYYY-MM-DD" (ESPN) — señal dura anti-homónimo. Se guarda en meta. */
  birthDate?: string | null
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

  const metaBySlug = new Map<string, Record<string, string>>()
  const bySlug = new Map<string, Record<string, unknown>>()
  for (const entity of entities) {
    const slug = entitySlug(entity)
    if (!slug || !entity.name) continue
    const meta: Record<string, string> = {}
    if (entity.leagueSlug) meta.leagueSlug = entity.leagueSlug
    if (entity.club) meta.club = entity.club
    if (entity.nationality) meta.nationality = entity.nationality
    if (entity.birthDate) meta.birthDate = entity.birthDate
    metaBySlug.set(slug, meta)
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
  const slugs = [...bySlug.keys()]
  if (!slugs.length) return 0

  // Merge NO destructivo de meta: una re-siembra pobre (el cron de líderes solo trae
  // leagueSlug+club) no debe borrar la nacionalidad/fecha de nacimiento que el team route ya
  // guardó — son las señales que corroboran la foto. Se leen los meta actuales y las claves
  // nuevas mandan por clave, pero las ausentes conservan su valor previo.
  const { data: existing } = await db.from('sport_entities').select('slug, meta').in('slug', slugs)
  for (const row of existing ?? []) {
    const prev = (row.meta as Record<string, string> | null) ?? {}
    const slug = row.slug as string
    metaBySlug.set(slug, { ...prev, ...(metaBySlug.get(slug) ?? {}) })
  }
  const rows = slugs.map(slug => ({ ...bySlug.get(slug)!, meta: metaBySlug.get(slug) }))

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

const PENDING_SELECT =
  'id, type, sport, name, espn_id, apisports_id, wikidata_id, meta, sport_entity_images!left(kind)'

// Un 'missing' se reintenta pasado este plazo. Motivo doble: (1) Commons gana fotos nuevas
// con el tiempo —un debutante de hoy puede tener foto en 3 meses—, y (2) rescata falsos
// negativos por rate-limit de Wikimedia, que marcaban 'missing' a jugadores que SÍ tienen
// foto (le pasó a Vitão). Al reintentarse se actualiza checked_at, así que se auto-limita:
// si sigue sin foto, no vuelve a probar hasta dentro de otros 90 días.
const MISSING_RETRY_DAYS = 90

const STALE_MISSING_SELECT =
  'id, type, sport, name, espn_id, apisports_id, wikidata_id, meta, sport_entity_images!inner(kind,status,checked_at)'

function toResolvable(row: Record<string, unknown>): ResolvableEntity {
  const meta = (row.meta as Record<string, unknown> | null) ?? {}
  const metaStr = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : null)
  return {
    id: row.id as string,
    type: row.type as EntityType,
    sport: row.sport as string,
    name: row.name as string,
    espnId: (row.espn_id as string | null) ?? null,
    apisportsId: (row.apisports_id as number | null) ?? null,
    wikidataId: (row.wikidata_id as string | null) ?? null,
    // Señales de identidad para corroborar el match de foto (ver entity-images.ts).
    club: metaStr('club'),
    nationality: metaStr('nationality'),
    birthDate: metaStr('birthDate'),
  }
}

/** Un lote de pendientes (SIN fila de imagen); `onlyCovered` lo restringe a competiciones que el sitio cubre. */
async function queryPendingEntities(
  db: NonNullable<ReturnType<typeof adminSupabase>>,
  type: EntityType,
  limit: number,
  onlyCovered: boolean,
): Promise<ResolvableEntity[]> {
  let query = db
    .from('sport_entities')
    .select(PENDING_SELECT)
    .eq('type', type)
    .is('sport_entity_images', null)
  if (onlyCovered) query = query.in('meta->>leagueSlug', [...FOOTBALL_LEAGUE_SLUGS])
  const { data, error } = await query.limit(limit)
  return error || !data ? [] : data.map(toResolvable)
}

/** Un lote de entidades CUBIERTAS marcadas 'missing' hace más de MISSING_RETRY_DAYS, para reintentar. */
async function queryStaleMissingEntities(
  db: NonNullable<ReturnType<typeof adminSupabase>>,
  type: EntityType,
  limit: number,
  cutoffIso: string,
): Promise<ResolvableEntity[]> {
  const { data, error } = await db
    .from('sport_entities')
    .select(STALE_MISSING_SELECT)
    .eq('type', type)
    .in('meta->>leagueSlug', [...FOOTBALL_LEAGUE_SLUGS])
    .eq('sport_entity_images.kind', 'headshot')
    .eq('sport_entity_images.status', 'missing')
    .lt('sport_entity_images.checked_at', cutoffIso)
    .limit(limit)
  return error || !data ? [] : data.map(toResolvable)
}

/**
 * Entidades a las que hay que resolver imagen, en lotes, POR PRIORIDAD. Tres pasadas, cada
 * una rellena los huecos que deje la anterior (dedup por id, se corta en `limit`):
 *
 *   1. Cubiertas SIN foto aún — lo que de verdad importa. Antes la consulta no tenía orden,
 *      así que los 12 huecos iban a filas arbitrarias y, con el 75% de la cola en ligas que
 *      no mostramos (6.000 jugadoras de la NCAA femenina, quinta división inglesa…), un
 *      titular del Madrid podía esperar detrás de decenas de miles que nadie mira.
 *   2. Cubiertas marcadas 'missing' pero caducadas → reintento (ver MISSING_RETRY_DAYS).
 *      Antes un 'missing' no se reintentaba JAMÁS, así que un falso negativo por rate-limit
 *      condenaba al jugador para siempre.
 *   3. El resto sin foto (ligas no cubiertas / sin leagueSlug) para que nada quede sin
 *      procesar nunca. Sin filtro de liga a propósito: si filtrara por "no cubierta", las
 *      entidades sin leagueSlug se caerían de las tres pasadas.
 *
 * Nota: hoy resolvemos un único kind por tipo (headshot para jugadores). Si algún día hay
 * varios kinds por entidad, las pasadas 1 y 3 (que miran "sin NINGUNA fila") habrá que
 * filtrarlas por kind.
 */
export async function listEntitiesNeedingImage(
  type: EntityType,
  limit: number,
): Promise<ResolvableEntity[]> {
  const db = adminSupabase()
  if (!db) return []

  const out: ResolvableEntity[] = []
  const seen = new Set<string>()
  const take = (batch: ResolvableEntity[]) => {
    for (const e of batch) {
      if (out.length >= limit) break
      if (!seen.has(e.id)) { seen.add(e.id); out.push(e) }
    }
  }

  take(await queryPendingEntities(db, type, limit, true))
  if (out.length < limit) {
    const cutoff = new Date(Date.now() - MISSING_RETRY_DAYS * 86_400_000).toISOString()
    take(await queryStaleMissingEntities(db, type, limit, cutoff))
  }
  if (out.length < limit) take(await queryPendingEntities(db, type, limit, false))

  return out
}

export interface SnapshotEntity {
  id: string
  espnId: string
  name: string
  leagueSlug: string   // "soccer/esp.1"
  club: string | null
}

/**
 * Tamaño de la COHORTE de snapshots: los jugadores a los que seguimos la pista semana a
 * semana. Capacidad semanal del cron = 48 pasadas (cada hora lun+mar) × BATCH 20 = 960,
 * así que 600 completa la cohorte cada semana con margen de sobra para reintentos.
 */
const SNAPSHOT_COHORT = 600

/**
 * Jugadores de fútbol a los que aún NO se les ha tomado snapshot de rendimiento en la
 * semana `weekStart` (YYYY-MM-DD del lunes), en lotes.
 *
 * COHORTE ESTABLE (arreglo 2026-07-20): antes esta consulta no filtraba por liga ni tenía
 * orden, así que cada semana medía a ~40 jugadores DISTINTOS y arbitrarios de los 53.000
 * de la tabla (medido: cero jugadores con dos semanas, y la muestra llena de ligas que no
 * cubrimos — Malasia, Rusia, México 2ª). Sin repetir sujeto no hay serie temporal, así que
 * la curva histórica que necesita el Valor Taka nunca habría existido por mucho que
 * pasaran los meses.
 *
 * Ahora se restringe a NUESTRAS competiciones y se ordena por id (arbitrario pero
 * ESTABLE), tomando siempre los mismos `SNAPSHOT_COHORT` primeros: cada semana se mide al
 * MISMO grupo, que es lo que produce curva. De paso, la consulta baja de traer 53.000
 * filas por pasada a traer 600.
 *
 * Se filtra contra el set de "ya hechos esta semana" en memoria: es correcto sin depender
 * del anti-join de PostgREST (frágil cuando el filtro va sobre la tabla embebida). Solo
 * devuelve entidades con meta.leagueSlug — sin liga no se puede pedir la línea a ESPN Core.
 *
 * Refinamiento futuro: la cohorte ideal serían los jugadores que el sitio muestra de verdad
 * (los líderes de /estadisticas), pero hoy no hay marca de relevancia en `meta` para
 * distinguirlos; "primeros N de nuestras ligas" ya es un salto enorme frente a aleatorio.
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
    .in('meta->>leagueSlug', [...FOOTBALL_LEAGUE_SLUGS])
    .order('id', { ascending: true })
    .limit(SNAPSHOT_COHORT)
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
