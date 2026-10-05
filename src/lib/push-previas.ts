// Aviso al móvil antes de los partidos grandes con previa publicada (05/10/2026).
//
// Una previa responde a lo que se busca antes del partido (horario y dónde verlo) y
// un aviso horas antes es lo que más devuelve gente a la web. Reglas: solo partidos
// con previa YA PUBLICADA, entre 1 h y 3 h 30 min antes, como mucho 2 avisos al día
// (los partidos de más cartel) y nunca dos veces el mismo. Va al tema `calendario`
// (avisos de partidos) por `sendPushToTopic`: navegador y app, con o sin cuenta.
// Todo lo de aquí es puro salvo lo que se importa en la ruta.

import { getEventHighlightScore } from '@/lib/competitions'
import { interesHispano } from '@/lib/previas'

export const AVISO_DESDE_MIN = 60
export const AVISO_HASTA_MIN = 210
export const MAX_AVISOS_DIA = 2
/** Solo carteles de verdad: un grande de LaLiga o Champions, un clásico latinoamericano. */
export const PUNTUACION_MINIMA_AVISO = 13

export interface PreviaPublicada {
  slug: string
  home: string
  away: string
  iso: string
  competicion?: string | null
}

export function puntuarAviso(p: PreviaPublicada): number {
  return getEventHighlightScore({ comp: p.competicion ?? '', home: p.home, away: p.away, isoDate: p.iso }) + interesHispano(p.home, p.away)
}

/** Las previas que tocan ahora, de más a menos cartel, sin las ya avisadas. */
export function previasParaAvisar(previas: PreviaPublicada[], now: number, yaAvisadas: ReadonlySet<string>): PreviaPublicada[] {
  return previas
    .filter((p) => {
      const t = Date.parse(p.iso)
      const min = (t - now) / 60000
      return Number.isFinite(t) && min >= AVISO_DESDE_MIN && min <= AVISO_HASTA_MIN && !yaAvisadas.has(p.slug)
    })
    .map((p) => ({ p, s: puntuarAviso(p) }))
    .filter((x) => x.s >= PUNTUACION_MINIMA_AVISO)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p)
}

const hora = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

/** Texto del aviso. La notificación no sabe el país de quien la recibe, así que lleva
 *  la hora de España y la de México (los dos públicos grandes) y la previa trae el
 *  resto de países. */
export function textoAviso(p: PreviaPublicada): { title: string; body: string } {
  return {
    title: `⚽ Hoy: ${p.home} - ${p.away}`,
    body: `${hora(p.iso, 'Europe/Madrid')} en España · ${hora(p.iso, 'America/Mexico_City')} en México. Dónde verlo y lo que se juega.`,
  }
}
