// ─────────────────────────────────────────────────────────────────
// creator-research.ts — el agente que investiga a un creador
//
// Le das un nombre y cualquier identificador (un handle de Instagram, de
// TikTok, de YouTube, o nada más que el nombre) y devuelve una ficha completa
// con su puntuación ya calculada, lista para revisar antes de publicarla.
//
// ── DE DÓNDE SALE CADA COSA ──────────────────────────────────────
//   Wikidata   → identidad, país y los perfiles OFICIALES de todas sus redes.
//                Es la pieza clave: la propiedad cuelga de la persona, no del
//                nombre, así que es lo único que distingue al periodista real
//                del okupa que registró su nombre de usuario. Ya nos pasó:
//                @manololama tiene 1 seguidor y 0 publicaciones.
//   YouTube    → suscriptores (audiencia) y engagement de los últimos vídeos
//                (relevancia), con la API oficial.
//   TikTok     → seguidores. Su HTML trae `followerCount` en claro, así que
//                basta un fetch — comprobado contra perfiles conocidos.
//   Instagram  → NO se puede desde el servidor. Devuelve una cáscara de JS y su
//                endpoint interno pide sesión. Va a la cola (migración 119) y
//                lo resuelve el Mac con Playwright.
//
// NO escribe en la base de datos. Investigar y publicar son dos pasos: el
// segundo lo decide una persona.
//
// ── ESPEJO DE SQL ────────────────────────────────────────────────
// Las tres conversiones de dato a nota (seguidores, actividad, relevancia)
// replican lo que hacen en producción `f_creator_followers_score`,
// `f_creator_actividad_score` y scripts/ingest-creator-relevance.mjs. Si allí
// cambian los tramos, hay que cambiarlos aquí: la ficha que el panel enseña
// antes de publicar tiene que dar el mismo número que dará el pipeline.
// ─────────────────────────────────────────────────────────────────

import { CREATOR_WEIGHTS, weightedBase } from '@/lib/rankings'

const UA_NAVEGADOR =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const UA_TAKA = 'TakaSports/1.0 (https://www.takasportsmedia.com; contactotakasports@gmail.com)'

export type Red = 'instagram' | 'twitter' | 'tiktok' | 'youtube' | 'twitch'
export type Handles = Partial<Record<Red, string>>

export interface FichaInvestigada {
  nombre: string
  handles: Handles
  pais: string | null
  descripcion: string | null
  wikidata: string | null
  metricas: {
    yt_subscribers: number
    tiktok_known: number
    instagram_known: number
    twitter_known: number
    twitch_known: number
    videos_last_30d: number | null
  }
  factores: { audiencia: number; crecimiento: number; relevancia: number }
  score: number
  imagen: string | null
  /** Qué se pudo averiguar y qué no, para que el panel lo enseñe sin adornos. */
  fuentes: { paso: string; estado: 'ok' | 'sin-dato' | 'error'; detalle: string }[]
  /** Perfiles que hay que resolver en el Mac (hoy solo Instagram). */
  pendientes: { red: Red; handle: string; motivo: string }[]
  /** Canales que podrían ser suyos cuando el nombre no basta para decidirlo. */
  sugerenciasYouTube: SugerenciaCanal[]
}

// ── Utilidades ───────────────────────────────────────────────────

export const limpiaHandle = (h: string | null | undefined): string =>
  String(h ?? '')
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/\/$/, '')
    .split(/[/?]/)[0]

const norm = (s: string): string =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Cuota de YouTube agotada durante esta investigación.
 *
 * Importa distinguirlo de «no hay dato»: sin búsquedas, la relevancia cae al
 * valor neutro y no salen canales sugeridos, así que la ficha SALE IGUAL pero
 * con una nota que no significa nada. Callarlo sería enseñar un número
 * inventado con cara de medido.
 */
let cuotaAgotada = false

async function json<T = unknown>(url: string, ua = UA_TAKA): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': ua, Accept: 'application/json' } })
    if (r.ok) return (await r.json()) as T
    if ((r.status === 403 || r.status === 429) && url.includes('googleapis.com/youtube')) cuotaAgotada = true
    return null
  } catch {
    return null
  }
}

// ── Conversión de dato a nota ────────────────────────────────────
// Espejo de f_creator_followers_score. Los tramos no son lineales a propósito:
// entre 100.000 y 200.000 seguidores hay una diferencia real de alcance, entre
// 10 y 15 millones ya casi ninguna.
const TRAMOS_SEGUIDORES: [number, number][] = [
  [20_000_000, 95], [15_000_000, 92], [10_000_000, 88], [5_000_000, 83],
  [2_000_000, 77], [1_000_000, 71], [500_000, 65], [200_000, 59],
  [100_000, 53], [50_000, 47], [20_000, 40],
]
export function notaAudiencia(seguidoresEfectivos: number): number {
  for (const [minimo, nota] of TRAMOS_SEGUIDORES) if (seguidoresEfectivos >= minimo) return nota
  return 33
}

// Pesos por plataforma (migración 114): un suscriptor de YouTube vale más que
// un seguidor de Twitter porque cuesta más y se convierte mejor en audiencia.
const PESO_PLATAFORMA = { yt: 1.0, twitch: 0.9, tiktok: 0.6, instagram: 0.6, twitter: 0.4 }
export function seguidoresEfectivos(m: FichaInvestigada['metricas']): number {
  return Math.round(
    m.yt_subscribers * PESO_PLATAFORMA.yt +
      m.twitch_known * PESO_PLATAFORMA.twitch +
      m.twitter_known * PESO_PLATAFORMA.twitter +
      m.tiktok_known * PESO_PLATAFORMA.tiktok +
      m.instagram_known * PESO_PLATAFORMA.instagram,
  )
}

// Espejo de f_creator_actividad_score.
export function notaCrecimiento(videos30d: number | null): number {
  if (videos30d === null) return 65
  if (videos30d >= 12) return 95
  if (videos30d >= 8) return 85
  if (videos30d >= 4) return 75
  if (videos30d >= 2) return 60
  if (videos30d >= 1) return 50
  return 30
}

// Espejo de ingest-creator-relevance.mjs: mediana de visitas de los 10 últimos
// vídeos dividida entre suscriptores. Mide si su gente le VE, no si le sigue.
const PIVOTE_RELEVANCIA = 0.05
const RELEVANCIA_NEUTRA = 55
const MIN_SUBS_RELEVANCIA = 5000
export function notaRelevancia(medianaVisitas: number, subs: number): number {
  if (subs < MIN_SUBS_RELEVANCIA || !(medianaVisitas > 0)) return RELEVANCIA_NEUTRA
  const ratio = medianaVisitas / subs
  const s = 72 + 20 * Math.log10(ratio / PIVOTE_RELEVANCIA)
  return Math.round(Math.min(88, Math.max(45, s)) * 10) / 10
}

function mediana(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b)
  if (!s.length) return 0
  const n = s.length
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

// ── Wikidata ─────────────────────────────────────────────────────

const PROP_RED: Record<string, Red> = { P2003: 'instagram', P2002: 'twitter', P7085: 'tiktok' }

// Ocupaciones compatibles con un ranking de contenido deportivo.
const OCUPACIONES_OK = new Set([
  'Q1930187', 'Q13590141', 'Q2722764', 'Q947873', 'Q17125263', 'Q245068',
  'Q3286043', 'Q10798782', 'Q15265344', 'Q1607826', 'Q937857', 'Q628099',
  'Q10833314', 'Q10871364', 'Q11774891',
])
const DESC_OK =
  /periodist|presentador|comentarist|locutor|youtuber|streamer|tertulian|narrador|reporter|broadcast|journalist|commentator|creador de contenido|influencer/i

interface EntidadWikidata {
  id: string
  desc: string
  enlaces: number
  claims: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>
}

export async function buscaEnWikidata(nombre: string): Promise<EntidadWikidata | null> {
  const candidatos: string[] = []
  for (const lang of ['es', 'en']) {
    const j = await json<{ search?: { id: string }[] }>(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=${lang}&uselang=${lang}&type=item&limit=7&search=${encodeURIComponent(nombre)}`,
    )
    for (const s of j?.search ?? []) if (!candidatos.includes(s.id)) candidatos.push(s.id)
  }
  if (!candidatos.length) return null

  const j = await json<{ entities?: Record<string, Record<string, unknown>> }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&ids=${candidatos.join('|')}&props=claims|descriptions|labels|sitelinks`,
  )
  const ents = j?.entities ?? {}

  let mejor: EntidadWikidata | null = null
  for (const id of candidatos) {
    const e = ents[id] as
      | { missing?: unknown; descriptions?: Record<string, { value: string }>; claims?: EntidadWikidata['claims']; sitelinks?: Record<string, unknown> }
      | undefined
    if (!e || e.missing !== undefined) continue
    const desc = e.descriptions?.es?.value ?? e.descriptions?.en?.value ?? ''
    const ocupaciones = (e.claims?.P106 ?? []).map(
      (c) => (c.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id,
    )
    if (!ocupaciones.some((o) => o && OCUPACIONES_OK.has(o)) && !DESC_OK.test(desc)) continue
    // Desempate por notoriedad: más enlaces a Wikipedia = la persona conocida,
    // no el homónimo con una ficha de tres líneas.
    const enlaces = Object.keys(e.sitelinks ?? {}).length
    if (!mejor || enlaces > mejor.enlaces) mejor = { id, desc, enlaces, claims: e.claims ?? {} }
  }
  return mejor
}

const valorClaim = (claims: EntidadWikidata['claims'], prop: string): string | null => {
  const v = claims?.[prop]?.[0]?.mainsnak?.datavalue?.value
  return typeof v === 'string' ? v : null
}

// ── YouTube ──────────────────────────────────────────────────────

interface DatosYouTube {
  canalId: string
  titulo: string
  subs: number
  medianaVisitas: number
  videos30d: number | null
  avatar: string | null
}

/** Canal que se parece al nombre pero no lo bastante para anclarlo solo. */
export interface SugerenciaCanal {
  canalId: string
  titulo: string
  subs: number
}

async function resuelveCanal(
  clave: string,
  key: string,
): Promise<{ canalId: string | null; candidatos: string[] }> {
  const limpio = limpiaHandle(clave)
  if (/^UC[\w-]{20,}$/.test(limpio)) return { canalId: limpio, candidatos: [] }
  const porHandle = await json<{ items?: { id: string }[] }>(
    `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(limpio)}&key=${key}`,
  )
  if (porHandle?.items?.[0]?.id) return { canalId: porHandle.items[0].id, candidatos: [] }

  const buscado = await json<{ items?: { snippet?: { channelId?: string; title?: string } }[] }>(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=5&q=${encodeURIComponent(clave)}&key=${key}`,
  )
  const items = buscado?.items ?? []
  // Una búsqueda por nombre SIEMPRE devuelve algo, así que se exige que el
  // título del canal se parezca de verdad al nombre buscado.
  const objetivo = norm(clave)
  for (const it of items) {
    const t = norm(it.snippet?.title ?? '')
    if (t && (t.includes(objetivo) || objetivo.includes(t))) {
      return { canalId: it.snippet?.channelId ?? null, candidatos: [] }
    }
  }
  // Ninguno se parece lo bastante — que no significa que no esté. Muchos
  // creadores publican bajo el nombre de su programa: el canal de Gerard Romero
  // se llama «Jijantes FC». Se devuelven como sugerencias para que las mire una
  // persona, en vez de anclar a ciegas o decir que no hay nada.
  return { canalId: null, candidatos: items.map(i => i.snippet?.channelId).filter(Boolean) as string[] }
}

/** Título y suscriptores de unos cuantos canales, para enseñarlos como opción. */
export async function detalleCanales(ids: string[], key: string): Promise<SugerenciaCanal[]> {
  if (!ids.length) return []
  const j = await json<{ items?: { id: string; snippet?: { title?: string }; statistics?: { subscriberCount?: string } }[] }>(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${ids.join(',')}&key=${key}`,
  )
  return (j?.items ?? [])
    .map(c => ({ canalId: c.id, titulo: c.snippet?.title ?? '', subs: Number(c.statistics?.subscriberCount ?? 0) }))
    .sort((a, b) => b.subs - a.subs)
}

export async function investigaYouTube(
  clave: string,
  key: string,
): Promise<{ datos: DatosYouTube | null; sugerencias: SugerenciaCanal[] }> {
  const { canalId, candidatos } = await resuelveCanal(clave, key)
  if (!canalId) return { datos: null, sugerencias: await detalleCanales(candidatos.slice(0, 5), key) }

  const ch = await json<{
    items?: { id: string; snippet?: { title?: string; thumbnails?: Record<string, { url: string }> }; statistics?: { subscriberCount?: string } }[]
  }>(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${canalId}&key=${key}`)
  const c = ch?.items?.[0]
  if (!c) return { datos: null, sugerencias: [] }
  const subs = Number(c.statistics?.subscriberCount ?? 0)

  // Últimos 10 vídeos: mediana de visitas (relevancia) y cuántos son del último
  // mes (crecimiento).
  const busq = await json<{ items?: { id?: { videoId?: string }; snippet?: { publishedAt?: string } }[] }>(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${canalId}&order=date&type=video&maxResults=10&key=${key}`,
  )
  const ids = (busq?.items ?? []).map((i) => i.id?.videoId).filter(Boolean) as string[]
  const hace30 = Date.now() - 30 * 24 * 3600 * 1000
  const videos30d = (busq?.items ?? []).filter(
    (i) => i.snippet?.publishedAt && new Date(i.snippet.publishedAt).getTime() >= hace30,
  ).length

  let medianaVisitas = 0
  if (ids.length) {
    const vids = await json<{ items?: { statistics?: { viewCount?: string } }[] }>(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(',')}&key=${key}`,
    )
    medianaVisitas = mediana((vids?.items ?? []).map((v) => Number(v.statistics?.viewCount ?? 0)).filter((n) => n > 0))
  }

  const thumbs = c.snippet?.thumbnails ?? {}
  return {
    datos: {
      canalId,
      titulo: c.snippet?.title ?? '',
      subs,
      medianaVisitas,
      // Si no hubo búsqueda de vídeos no es que publique cero: es que no lo sabemos.
      videos30d: ids.length ? videos30d : null,
      avatar: thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? null,
    },
    sugerencias: [],
  }
}

// ── TikTok ───────────────────────────────────────────────────────
// Su HTML trae `"followerCount":N` en claro. No hace falta navegador, al
// contrario que Instagram.
export async function investigaTikTok(handle: string): Promise<number | null> {
  const h = limpiaHandle(handle)
  if (!h) return null
  try {
    const r = await fetch(`https://www.tiktok.com/@${h}`, { headers: { 'User-Agent': UA_NAVEGADOR } })
    if (!r.ok) return null
    const html = await r.text()
    const m = html.match(/"followerCount":(\d+)/)
    return m ? Number(m[1]) : null
  } catch {
    return null
  }
}

// ── El agente ────────────────────────────────────────────────────

export interface EncargoInvestigacion {
  nombre: string
  instagram?: string
  tiktok?: string
  youtube?: string
  twitter?: string
  twitch?: string
}

export async function investigaCreador(
  encargo: EncargoInvestigacion,
  ytKey: string | undefined,
): Promise<FichaInvestigada> {
  cuotaAgotada = false
  const fuentes: FichaInvestigada['fuentes'] = []
  const handles: Handles = {}
  for (const red of ['instagram', 'tiktok', 'youtube', 'twitter', 'twitch'] as Red[]) {
    const v = limpiaHandle(encargo[red as keyof EncargoInvestigacion] as string | undefined)
    if (v) handles[red] = v
  }

  // 1. Wikidata: identidad y perfiles oficiales.
  let pais: string | null = null
  let descripcion: string | null = null
  let wikidata: string | null = null
  const ent = await buscaEnWikidata(encargo.nombre)
  if (ent) {
    wikidata = ent.id
    descripcion = ent.desc || null
    const paisQid = (ent.claims?.P27?.[0]?.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id ?? null
    pais = paisQid ? await etiquetaPais(paisQid) : null
    const corregidos: string[] = []
    for (const [prop, red] of Object.entries(PROP_RED)) {
      const oficial = valorClaim(ent.claims, prop)
      if (!oficial) continue
      const actual = handles[red]
      // Wikidata manda sobre lo que nos hayan dicho: es la única fuente que ata
      // el perfil a la PERSONA y no al nombre de usuario.
      if (!actual) { handles[red] = oficial; corregidos.push(`${red} @${oficial}`) }
      else if (norm(actual) !== norm(oficial)) { handles[red] = oficial; corregidos.push(`${red} @${actual} → @${oficial}`) }
    }
    fuentes.push({
      paso: 'Wikidata',
      estado: 'ok',
      detalle: `${ent.id}${descripcion ? ` · ${descripcion}` : ''}${corregidos.length ? ` · perfiles: ${corregidos.join(', ')}` : ''}`,
    })
  } else {
    fuentes.push({
      paso: 'Wikidata',
      estado: 'sin-dato',
      detalle: 'sin ficha — no se pueden corroborar sus perfiles, revísalos a ojo',
    })
  }

  // 2. YouTube: audiencia y relevancia.
  const metricas: FichaInvestigada['metricas'] = {
    yt_subscribers: 0, tiktok_known: 0, instagram_known: 0,
    twitter_known: 0, twitch_known: 0, videos_last_30d: null,
  }
  let imagen: string | null = null
  let relevancia = RELEVANCIA_NEUTRA
  let sugerenciasYouTube: SugerenciaCanal[] = []
  const claveYT = handles.youtube || encargo.nombre
  if (!ytKey) {
    fuentes.push({ paso: 'YouTube', estado: 'error', detalle: 'falta YOUTUBE_API_KEY en el entorno' })
  } else {
    const { datos: yt, sugerencias } = await investigaYouTube(claveYT, ytKey)
    sugerenciasYouTube = sugerencias
    if (yt) {
      handles.youtube = yt.canalId
      metricas.yt_subscribers = yt.subs
      metricas.videos_last_30d = yt.videos30d
      imagen = yt.avatar
      relevancia = notaRelevancia(yt.medianaVisitas, yt.subs)
      const aviso = yt.subs < 1000 ? ' ⚠️ canal muy pequeño: puede no ser suyo' : ''
      fuentes.push({
        paso: 'YouTube',
        estado: 'ok',
        detalle: `«${yt.titulo}» · ${yt.subs.toLocaleString('es-ES')} suscriptores · mediana ${Math.round(yt.medianaVisitas).toLocaleString('es-ES')} visitas${aviso}`,
      })
    } else {
      fuentes.push({
        paso: 'YouTube',
        estado: cuotaAgotada ? 'error' : 'sin-dato',
        detalle: sugerencias.length
          ? `ningún canal se llama como él — hay ${sugerencias.length} candidato(s) abajo, elige tú`
          : 'no se encontró canal',
      })
    }
    if (cuotaAgotada) {
      fuentes.push({
        paso: 'Cuota',
        estado: 'error',
        detalle:
          'la cuota diaria de la API de YouTube está agotada — la relevancia queda en su valor neutro (55) y no es un dato medido. Repite la investigación mañana antes de publicar.',
      })
    }
  }

  // 3. TikTok.
  if (handles.tiktok) {
    const seg = await investigaTikTok(handles.tiktok)
    if (seg) {
      metricas.tiktok_known = seg
      fuentes.push({ paso: 'TikTok', estado: 'ok', detalle: `${seg.toLocaleString('es-ES')} seguidores` })
    } else {
      fuentes.push({ paso: 'TikTok', estado: 'sin-dato', detalle: `@${handles.tiktok} no devolvió cifra` })
    }
  }

  // 4. Instagram: a la cola del Mac.
  const pendientes: FichaInvestigada['pendientes'] = []
  if (handles.instagram) {
    pendientes.push({
      red: 'instagram',
      handle: handles.instagram,
      motivo: 'Instagram sirve una cáscara de JavaScript; hace falta un navegador y no corre en Vercel',
    })
    fuentes.push({
      paso: 'Instagram',
      estado: 'sin-dato',
      detalle: `@${handles.instagram} — encargado al Mac, la ficha se completará sola`,
    })
  }

  const audiencia = notaAudiencia(seguidoresEfectivos(metricas))
  const crecimiento = notaCrecimiento(metricas.videos_last_30d)
  const factores = { audiencia, crecimiento, relevancia }
  const score =
    Math.round(
      Math.max(0, Math.min(100,
        weightedBase(
          { mediatico: audiencia, rendimiento: crecimiento, narrativa: relevancia, contexto: 0 },
          CREATOR_WEIGHTS,
        ),
      )) * 10,
    ) / 10

  return {
    nombre: encargo.nombre, handles, pais, descripcion, wikidata,
    metricas, factores, score, imagen, fuentes, pendientes, sugerenciasYouTube,
  }
}

// Etiqueta en español del país de nacionalidad (P27).
async function etiquetaPais(qid: string): Promise<string | null> {
  const j = await json<{ entities?: Record<string, { labels?: Record<string, { value: string }> }> }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&ids=${qid}&props=labels&languages=es`,
  )
  return j?.entities?.[qid]?.labels?.es?.value ?? null
}
