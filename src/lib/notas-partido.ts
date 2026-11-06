// El partido de una nota (previa o crónica) para pintarla con la tarjeta de
// partido en vez de con la placa (maqueta 2 de noviembre, V-08).
//
// Sanity solo guarda los nombres de los equipos y la competición de las
// PREVIAS (`matchKickoff`); las crónicas traen únicamente el `matchRef`
// («soccer_esp.1_401882827»), y los escudos y el marcador viven en ESPN. No se
// hace una llamada por tarjeta: los escudos de las previas salen del calendario
// de ESPN que la portada ya tiene en memoria (y que la caché de datos de Next
// comparte con /noticias y los hubs), y el marcador y los escudos de las
// crónicas, de `past_events` en una sola consulta para todo el listado. Si para
// una nota no hay dato, no lleva `partido` y la tarjeta cae a la foto de
// siempre. Si hay partido pero no marcador, la tarjeta enseña la hora y «Final»
// antes que inventar.

import type { SportEvent } from './types'
import { getPastEventsByRefs } from './past-events'
import { fetchEspnEvents } from './espn'
import { competicionCorta } from './seo-partido'

export interface PartidoDeNota {
  matchRef: string
  home: string
  away: string
  homeLogo?: string
  awayLogo?: string
  homeAbbr?: string
  awayAbbr?: string
  /** Instante del partido (ISO-8601). Falta en alguna crónica sin fila archivada. */
  iso?: string
  /** Nombre largo de la competición («UEFA Champions League»). */
  competicion?: string
  /** El corto para el rótulo («Champions»), resuelto en el servidor por el matchRef. */
  competicionCorta?: string
  venue?: string
  homeScore?: number | null
  awayScore?: number | null
  /** 'previa' = por jugar (hora grande); 'final' = jugado (marcador o «Final»). */
  estado: 'previa' | 'final'
}

export interface NotaConPartido {
  type?: string | null
  matchRef?: string | null
  kickoffIso?: string | null
  matchHome?: string | null
  matchAway?: string | null
  matchComp?: string | null
  category?: string | null
}

// Las carreras (`racing_…`) no tienen dos lados: su previa se queda con la foto.
const ES_NOTA = (a: NotaConPartido) => (a.type === 'previa' || a.type === 'cronica') && !!a.matchRef && !/^racing_/.test(a.matchRef)

/** Primer apellido del tenista para que quepa en la tarjeta: «Carlos Alcaraz» → «Alcaraz». */
function nombreCorto(nombre: string, tenis: boolean): string {
  if (!tenis) return nombre
  const p = nombre.trim().split(/\s+/)
  return p.length > 1 ? p.slice(1).join(' ') : nombre
}

/**
 * Añade `partido` a cada previa o crónica del listado. Puro salvo las dos
 * lecturas por lotes; nunca lanza (sin datos = sin tarjeta, no sin página).
 *
 * `eventos`: el calendario de ESPN si quien llama ya lo tiene (la portada);
 * si no se pasa, se pide (cacheado 5 min en la caché de datos de Next).
 */
export async function adjuntarPartidos<T extends NotaConPartido>(
  articulos: T[],
  opciones: { eventos?: SportEvent[] } = {},
): Promise<(T & { partido?: PartidoDeNota | null })[]> {
  const notas = articulos.filter(ES_NOTA)
  if (notas.length === 0) return articulos

  const refs = notas.map((a) => a.matchRef as string)
  const hayPrevias = notas.some((a) => a.type === 'previa')

  // El archivo se mira para TODAS las notas: una previa de un partido ya
  // jugado enseña el marcador real, como su crónica.
  const [pasados, proximos] = await Promise.all([
    getPastEventsByRefs(refs).catch(() => new Map<string, SportEvent>()),
    hayPrevias
      ? (opciones.eventos ? Promise.resolve(opciones.eventos) : fetchEspnEvents().catch(() => [] as SportEvent[]))
      : Promise.resolve([] as SportEvent[]),
  ])
  const porRef = new Map<string, SportEvent>()
  for (const e of proximos) if (e.matchRef) porRef.set(e.matchRef, e)

  return articulos.map((a) => {
    if (!ES_NOTA(a)) return a
    const ref = a.matchRef as string
    const tenis = /^tennis_/.test(ref)
    const ev = porRef.get(ref)
    const pasado = pasados.get(ref)

    if (a.type === 'previa') {
      const home = a.matchHome || ev?.home
      const away = a.matchAway || ev?.away
      if (!home || !away) return { ...a, partido: null }
      // Una previa de un partido ya jugado y archivado enseña el marcador: es
      // lo que ve quien llega tarde desde Google, y la nota hermana lo dice.
      const terminado = pasado?.homeScore != null && pasado?.awayScore != null
      const partido: PartidoDeNota = {
        matchRef: ref,
        home: nombreCorto(home, tenis),
        away: nombreCorto(away, tenis),
        homeLogo: ev?.homeLogo ?? pasado?.homeLogo,
        awayLogo: ev?.awayLogo ?? pasado?.awayLogo,
        homeAbbr: ev?.homeAbbr ?? pasado?.homeAbbr,
        awayAbbr: ev?.awayAbbr ?? pasado?.awayAbbr,
        iso: a.kickoffIso ?? ev?.isoDate ?? pasado?.isoDate ?? undefined,
        competicion: a.matchComp ?? ev?.comp ?? pasado?.comp ?? a.category ?? undefined,
        competicionCorta: competicionCorta(ref, a.matchComp ?? ev?.comp ?? pasado?.comp ?? a.category) ?? undefined,
        venue: ev?.venue ?? pasado?.venue,
        homeScore: terminado ? pasado!.homeScore : undefined,
        awayScore: terminado ? pasado!.awayScore : undefined,
        estado: terminado ? 'final' : 'previa',
      }
      return { ...a, partido }
    }

    // Crónica: sin fila archivada no hay equipos → sin tarjeta.
    if (!pasado || !pasado.away) return { ...a, partido: null }
    const partido: PartidoDeNota = {
      matchRef: ref,
      home: nombreCorto(pasado.home, tenis),
      away: nombreCorto(pasado.away, tenis),
      homeLogo: pasado.homeLogo,
      awayLogo: pasado.awayLogo,
      homeAbbr: pasado.homeAbbr,
      awayAbbr: pasado.awayAbbr,
      iso: pasado.isoDate,
      competicion: pasado.comp ?? a.category ?? undefined,
      competicionCorta: competicionCorta(ref, pasado.comp ?? a.category) ?? undefined,
      venue: pasado.venue,
      homeScore: pasado.homeScore ?? null,
      awayScore: pasado.awayScore ?? null,
      estado: 'final',
    }
    return { ...a, partido }
  })
}

/** Lo que la API pública añade a cada nota de partido, plano y estable, para
 *  la app: nombres, escudos, competición y marcador («1-0» o null). Sin
 *  partido resuelto caen a lo que trae Sanity (equipos de la previa) y a null. */
export interface CamposPartidoApi {
  matchHome: string | null
  matchAway: string | null
  matchHomeLogo: string | null
  matchAwayLogo: string | null
  matchCompetition: string | null
  matchScore: string | null
}

export function camposPartidoApi(a: NotaConPartido & { partido?: PartidoDeNota | null }): CamposPartidoApi {
  const p = a.partido ?? null
  const marcador = p && p.estado === 'final' && p.homeScore != null && p.awayScore != null
    ? `${p.homeScore}-${p.awayScore}`
    : null
  return {
    matchHome: p?.home ?? a.matchHome ?? null,
    matchAway: p?.away ?? a.matchAway ?? null,
    matchHomeLogo: p?.homeLogo ?? null,
    matchAwayLogo: p?.awayLogo ?? null,
    matchCompetition: p?.competicionCorta ?? p?.competicion ?? a.matchComp ?? a.category ?? null,
    matchScore: marcador,
  }
}
