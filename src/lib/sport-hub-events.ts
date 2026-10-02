// ── «Próximos eventos» de los hubs de deporte (/futbol, /baloncesto…) ───────
//
// El bloque leía los documentos `event` de Sanity, una fuente que ya nadie
// alimenta: /futbol decía «Sin eventos próximos» con Champions esa misma
// noche. El calendario y la portada leen ESPN (fetchEspnEvents), así que el
// hub pasa a leer lo mismo y Sanity se queda de respaldo (y para lucha libre
// y rugby, que ESPN no trae).
//
// Coste: UNA sola caché para todos los hubs (5 min). Dentro, fetchEspnEvents
// reutiliza la caché de datos de Next de cada liga, la misma que ya llenan la
// portada y el calendario; lo único que se descarga de verdad es el scoreboard
// de tenis (no cabe en la caché de datos), y así se descarga una vez cada 5
// minutos para los siete hubs en vez de una por hub.

import { unstable_cache } from 'next/cache'
import { fetchEspnEvents } from './espn'
import { getEventHighlightScore } from './competitions'
import type { SportEvent } from './types'

/** Forma que pinta SportHubHeader (la misma que traía la consulta de Sanity). */
export interface HubEvent {
  _id: string
  sport?: string
  home: string
  away?: string
  date?: string
  venue?: string
  status?: string
  stage?: string
  competition?: { name: string; slug: string }
  /** Destino del enlace. Sin él, el componente enlaza a /evento/<_id> (Sanity). */
  href?: string
}

/** Hub → valores de `SportEvent.sport` del feed de ESPN. */
export const HUB_ESPN_SPORTS: Readonly<Record<string, readonly string[]>> = {
  futbol: ['Fútbol'],
  baloncesto: ['NBA'],
  nba: ['NBA'],
  formula1: ['F1'],
  tenis: ['Tenis'],
  ufc: ['UFC'],
}

const HOUR = 3_600_000
/** Un partido empezado hace menos de esto aún puede estar en juego. */
const STARTED_GRACE = 1.75 * HOUR
/** Primero lo de los próximos 3 días; si no llega, hasta una semana. */
const NEAR_WINDOW = 72 * HOUR
const FAR_WINDOW = 7 * 24 * HOUR
export const HUB_EVENTS_MAX = 5

/**
 * Los próximos eventos de un hub, en orden cronológico.
 *
 * No son «los cinco siguientes» a secas: a las 02:00 eso serían cinco partidos
 * de Liga MX. Se eligen los mejores por la puntuación de Destacados (el mismo
 * ranking del calendario), primero entre los de los próximos tres días, y
 * luego se ordenan por hora para pintarlos.
 *
 * Sin estado «en vivo»: el feed no lo trae y el hub se regenera cada 5
 * minutos; marcarlo a ojo es lo que ya pintó «En vivo» sobre partidos
 * acabados en otra pantalla. Un partido empezado sale con su hora de inicio.
 */
export function selectHubEvents(
  events: readonly SportEvent[],
  hub: string,
  nowMs: number,
  max = HUB_EVENTS_MAX,
): HubEvent[] {
  const sports = HUB_ESPN_SPORTS[hub]
  if (!sports) return []
  const picked = events
    .filter(e => sports.includes(e.sport) && e.isoDate && !e.timeTbd && e.homeScore == null)
    .map(e => ({ e, t: Date.parse(e.isoDate!) }))
    .filter(x => Number.isFinite(x.t) && x.t >= nowMs - STARTED_GRACE && x.t <= nowMs + FAR_WINDOW)
    .map(x => ({
      ...x,
      near: x.t <= nowMs + NEAR_WINDOW ? 1 : 0,
      s: getEventHighlightScore({ comp: x.e.comp, home: x.e.home, away: x.e.away, stage: x.e.stage, isoDate: x.e.isoDate }),
    }))
    .sort((a, b) => b.near - a.near || b.s - a.s || a.t - b.t)
    .slice(0, max)
    .sort((a, b) => a.t - b.t)

  return picked.map(({ e }) => ({
    _id: e.id,
    sport: hub,
    home: e.home,
    ...(e.away ? { away: e.away } : {}),
    date: e.isoDate,
    ...(e.venue ? { venue: e.venue } : {}),
    status: 'programado',
    ...(e.stage ? { stage: e.stage } : {}),
    competition: { name: e.comp, slug: '' },
    href: e.matchRef ? `/partido/${e.matchRef}` : '/calendario',
  }))
}

/** Todos los hubs de una pasada, cacheado 5 minutos. */
const getHubEventsMap = unstable_cache(
  async (): Promise<Record<string, HubEvent[]>> => {
    const events = await fetchEspnEvents()
    const now = Date.now()
    const out: Record<string, HubEvent[]> = {}
    for (const hub of Object.keys(HUB_ESPN_SPORTS)) out[hub] = selectHubEvents(events, hub, now)
    return out
  },
  ['sport-hub-espn-events-v1'],
  { revalidate: 300 },
)

/** Próximos eventos de ESPN para un hub; [] si el hub no tiene ESPN o falla. */
export async function getHubEspnEvents(hub: string): Promise<HubEvent[]> {
  if (!HUB_ESPN_SPORTS[hub]) return []
  try {
    return (await getHubEventsMap())[hub] ?? []
  } catch {
    return []
  }
}
