// Resolver de imágenes de entidades deportivas (jugador / equipo / liga).
//
// La cascada se resuelve en INGESTA (cron), nunca en render: los CDNs de terceros
// tienen rate limit por segundo y <DynamicImage> pinta un único src — no encadena
// fuentes. El ganador se persiste en sport_entity_images con su licencia y
// atribución, y a partir de ahí la web sirve siempre lo mismo sin volver a preguntar.
//
// Cascada (coste 0 estricto):
//   1. api-sports media  — gratis y sin key, pero indexado por SU player_id, que hoy
//      no tenemos (la cuenta de api-football está suspendida). Se deja cableado: en
//      cuanto haya apisportsId, entra solo sin tocar nada más.
//   2. ESPN CDN          — gratis, sin key. Resuelve tenis/MMA/NBA; en fútbol casi
//      siempre da 404 (ESPN no publica headshots de futbolistas: ese es el hueco).
//   3. Wikidata + Commons — foto real libre buscada POR NOMBRE. Es la primaria de
//      fútbol. Exige atribución (CC).
//   4. null              — se marca 'missing' y la UI pinta el placeholder de marca.
//
// Nota de diseño: son fotos enmarcadas, no cutouts con fondo transparente. El recorte
// exigiría un servicio de pago o créditos de generación, ambos fuera del presupuesto.

import { adminSupabase } from '@/lib/supabase-admin'
import {
  WIKIDATA_OCCUPATION,
  rescueCandidateByClub,
  selectCorroboratedCandidate,
  type Candidate,
  type WikiClaims,
} from '@/lib/wikidata-identity'

export type ImageKind = 'headshot' | 'logo'
export type EntityType = 'player' | 'team' | 'league'

export interface ResolvableEntity {
  /** uuid de sport_entities */
  id: string
  type: EntityType
  sport: string
  name: string
  apisportsId?: number | null
  espnId?: string | null
  wikidataId?: string | null
  /**
   * Señales de identidad (de ESPN) para CORROBORAR el match por nombre contra Wikidata y no
   * coger un homónimo. Todas opcionales: cuantas más falten, más conservador es el match.
   */
  nationality?: string | null   // país en INGLÉS, tal cual lo da ESPN ("Brazil", "Spain")
  birthDate?: string | null     // ISO "YYYY-MM-DD"
  club?: string | null          // club actual (nombre ESPN) — habilita el rescate por club
}

export interface ResolvedImage {
  url: string
  source: string
  license: string | null
  attribution: string | null
}

/**
 * Distinguir "no hay foto" de "no pude comprobarlo" es CRÍTICO: los miss se persisten
 * para no reintentarlos, así que confundir un error transitorio con una ausencia real
 * condena al jugador a quedarse sin cara para siempre. Solo 'ok' y 'missing' se
 * guardan; 'error' se deja sin fila para que el próximo cron lo reintente.
 */
export type ResolveOutcome =
  | { status: 'ok'; image: ResolvedImage }
  | { status: 'missing' }
  | { status: 'error' }

/** Fallo de red/servidor: no permite concluir que la entidad no tenga imagen. */
class TransientError extends Error {}

// Wikimedia pide un User-Agent identificable y contactable en su política de uso.
const WIKI_HEADERS = { 'User-Agent': 'TakaSports/1.0 (+https://www.takasportsmedia.com)' }

// Deadline propio en lugar del tfetch de stats-cache (6 s). Aquel está tuneado para la
// ruta de un usuario, donde colgarse es peor que fallar; esto es un cron de ingesta que
// sí puede esperar. Con 6 s, Wikidata y Commons expiraban a media pasada y jugadores tan
// obvios como Lewandowski o Lamine Yamal quedaban marcados 'missing' por TIMEOUT —no por
// falta de foto—, y como los miss no se reintentan, los perdíamos para siempre.
const INGEST_TIMEOUT_MS = 20_000

function ifetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(INGEST_TIMEOUT_MS) })
}

// sport (nuestro slug) → segmento de media.api-sports.io
const API_SPORTS_MEDIA: Record<string, string> = {
  football: 'football',
  basketball: 'basketball',
  formula1: 'formula-1',
  tennis: 'tennis',
  mma: 'mma',
  rugby: 'rugby',
}

// sport → segmento del CDN de ESPN. SOLO patrones verificados en producción (ver
// athlete-photos.ts, generado comprobando 200 reales). Un deporte que no esté aquí
// se salta ESPN: preferimos un hueco a machacar con 404 en cada pasada del cron.
const ESPN_SPORT: Record<string, string> = {
  football: 'soccer',
  basketball: 'nba',
  tennis: 'tennis',
  mma: 'mma',
}

/** El campo P18 (imagen) llega como string con el nombre de fichero en Commons. */
function claimString(claims: WikiClaims | null, property: string): string | null {
  const value = claims?.[property]?.[0]?.mainsnak?.datavalue?.value
  return typeof value === 'string' ? value : null
}

/**
 * ¿La URL devuelve una imagen real? ESPN y api-sports dan 404 (con content-type
 * text/html) cuando no existe. Un 4xx es una respuesta legítima de "no está"; un 5xx o
 * un fallo de red NO lo es y se propaga como transitorio.
 */
async function imageExists(url: string): Promise<boolean> {
  let res: Response
  try {
    res = await ifetch(url, { method: 'HEAD', cache: 'no-store' })
  } catch {
    throw new TransientError(`probe ${url}`)
  }
  if (res.status >= 500) throw new TransientError(`probe ${res.status}`)
  if (!res.ok) return false
  return (res.headers.get('content-type') ?? '').startsWith('image/')
}

function apiSportsCandidate(e: ResolvableEntity, kind: ImageKind): ResolvedImage | null {
  const segment = API_SPORTS_MEDIA[e.sport]
  if (!segment || !e.apisportsId) return null
  const bucket = kind === 'logo' ? (e.type === 'league' ? 'leagues' : 'teams') : 'players'
  return {
    url: `https://media.api-sports.io/${segment}/${bucket}/${e.apisportsId}.png`,
    source: 'api-sports',
    license: null,
    attribution: null,
  }
}

function espnCandidate(e: ResolvableEntity, kind: ImageKind): ResolvedImage | null {
  const segment = ESPN_SPORT[e.sport]
  if (!segment || !e.espnId) return null
  const url =
    kind === 'logo'
      ? `https://a.espncdn.com/i/teamlogos/${segment}/500/${e.espnId}.png`
      : `https://a.espncdn.com/i/headshots/${segment}/players/full/${e.espnId}.png`
  return { url, source: 'espn', license: null, attribution: null }
}

/**
 * Cualquier fallo aquí es transitorio por definición: si Wikidata no contesta (o nos
 * limita por ratio al encadenar peticiones), lo único que sabemos es que no sabemos.
 * Nunca devuelve null por error — para eso está TransientError.
 */
async function wikiJson<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await ifetch(url, { headers: WIKI_HEADERS, cache: 'no-store' })
  } catch {
    throw new TransientError(`wiki ${url}`)
  }
  if (!res.ok) throw new TransientError(`wiki ${res.status}`)
  try {
    return (await res.json()) as T
  } catch {
    throw new TransientError('wiki json')
  }
}

/**
 * Claims de Wikidata del deportista. Con QID conocido va directo; si no, busca por nombre y
 * CORROBORA la identidad (fecha de nacimiento / nacionalidad / club) antes de aceptar un
 * candidato — ese filtro es lo único que impide traerse la foto de un homónimo. Si no puede
 * confirmar a nadie por nombre, intenta el rescate anclado en el club. Toda la decisión vive
 * en wikidata-identity.ts (compartida con la trayectoria del perfil); aquí solo se aporta el
 * fetch, que lanza TransientError ante un fallo transitorio (no null → no se marca 'missing').
 */
async function wikidataClaims(e: ResolvableEntity): Promise<WikiClaims | null> {
  if (e.wikidataId) {
    const data = await wikiJson<{ claims?: WikiClaims }>(
      `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${e.wikidataId}&format=json&origin=*`,
    )
    return data?.claims ?? null
  }

  const occupation = WIKIDATA_OCCUPATION[e.sport]
  if (!occupation) return null

  const signals = { name: e.name, nationality: e.nationality, birthDate: e.birthDate, club: e.club }

  const search = await wikiJson<{ search?: Array<{ id?: string }> }>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
      e.name,
    )}&language=es&uselang=es&type=item&limit=5&format=json&origin=*`,
  )
  const ids = (search?.search ?? []).map(hit => hit.id).filter((id): id is string => Boolean(id))
  if (!ids.length) return (await rescueCandidateByClub(signals, occupation, wikiJson))?.claims ?? null

  const entities = await wikiJson<{ entities?: Record<string, { claims?: WikiClaims }> }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join(
      '|',
    )}&props=claims&format=json&origin=*`,
  )
  const candidates: Candidate[] = ids
    .map(id => ({ qid: id, claims: entities?.entities?.[id]?.claims ?? null }))
    .filter((c): c is Candidate => c.claims !== null)

  const chosen =
    selectCorroboratedCandidate(signals, occupation, candidates) ??
    (await rescueCandidateByClub(signals, occupation, wikiJson))
  return chosen?.claims ?? null
}

/** El campo Artist de Commons viene como HTML (`<a href="…">Nombre</a>`). */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

/**
 * Foto libre vía Wikidata P18 → Commons. Commons devuelve la URL directa en
 * upload.wikimedia.org (ya optimizable por next/image) junto a licencia y autor,
 * que son OBLIGATORIOS de mostrar: si no vienen, descartamos la imagen.
 */
async function wikimediaCandidate(e: ResolvableEntity): Promise<ResolvedImage | null> {
  const file = claimString(await wikidataClaims(e), 'P18')
  if (!file) return null

  const info = await wikiJson<{
    query?: {
      pages?: Record<
        string,
        {
          imageinfo?: Array<{
            url?: string
            thumburl?: string
            extmetadata?: Record<string, { value?: string }>
          }>
        }
      >
    }
  }>(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      `File:${file}`,
    )}&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=400&format=json&origin=*`,
  )
  const imageinfo = Object.values(info?.query?.pages ?? {})[0]?.imageinfo?.[0]
  const url = imageinfo?.thumburl ?? imageinfo?.url
  const license = imageinfo?.extmetadata?.LicenseShortName?.value
  if (!url || !license) return null

  const author = stripHtml(imageinfo?.extmetadata?.Artist?.value ?? '')
  return {
    url,
    source: 'wikimedia',
    license,
    attribution: `${author || 'Wikimedia Commons'} — ${license} (Wikimedia Commons)`,
  }
}

/**
 * Recorre la cascada. 'missing' solo se devuelve cuando TODAS las fuentes contestaron y
 * ninguna tenía la imagen; si algo se cayó por el camino, sale 'error' y no concluimos.
 * No escribe en base — de eso se encarga persistEntityImage.
 */
export async function resolveEntityImage(
  entity: ResolvableEntity,
  kind: ImageKind,
): Promise<ResolveOutcome> {
  try {
    const direct = [apiSportsCandidate(entity, kind), espnCandidate(entity, kind)].filter(
      (candidate): candidate is ResolvedImage => candidate !== null,
    )
    for (const candidate of direct) {
      if (await imageExists(candidate.url)) return { status: 'ok', image: candidate }
    }

    // Wikimedia solo para caras: los escudos oficiales no viven ahí de forma fiable.
    if (kind === 'headshot' && entity.type === 'player') {
      const wiki = await wikimediaCandidate(entity)
      if (wiki && (await imageExists(wiki.url))) return { status: 'ok', image: wiki }
    }

    return { status: 'missing' }
  } catch (err) {
    if (err instanceof TransientError) return { status: 'error' }
    // Un bug nuestro debe verse en los logs, no disfrazarse de "ya lo reintentaremos".
    throw err
  }
}

/**
 * Persiste el resultado en sport_entity_images. Los MISS también se guardan
 * (status='missing') a propósito: sin eso, cada pasada del cron volvería a pedir las
 * mismas 404 de los jugadores sin foto en ninguna fuente, mayoría en ligas menores.
 */
export async function persistEntityImage(
  entity: ResolvableEntity,
  kind: ImageKind,
  outcome: ResolveOutcome,
): Promise<boolean> {
  // 'error' no se guarda: sin fila, listEntitiesNeedingImage lo devolverá otra vez y el
  // próximo cron lo reintenta. Es lo que evita condenar a un jugador por un 429.
  if (outcome.status === 'error') return false

  const db = adminSupabase()
  if (!db) return false
  const image = outcome.status === 'ok' ? outcome.image : null
  const { error } = await db.from('sport_entity_images').upsert(
    {
      entity_id: entity.id,
      kind,
      url: image?.url ?? null,
      source: image?.source ?? 'none',
      license: image?.license ?? null,
      attribution: image?.attribution ?? null,
      status: image ? 'ok' : 'missing',
      checked_at: new Date().toISOString(),
    },
    { onConflict: 'entity_id,kind' },
  )
  return !error
}

/** Resuelve y guarda en un paso. */
export async function refreshEntityImage(
  entity: ResolvableEntity,
  kind: ImageKind,
): Promise<ResolveOutcome> {
  const outcome = await resolveEntityImage(entity, kind)
  await persistEntityImage(entity, kind, outcome)
  return outcome
}
