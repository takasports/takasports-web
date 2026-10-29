// ── Aviso de cada noche: «los partidos de mañana» ───────────────────────────
//
// Lo ofrece la página de cada día del calendario (AgendaNocheCta) y lo envía
// /api/cron/agenda-noche a las 22:00 de CADA lector. Aquí va la parte pura:
// si a un suscriptor le toca ya, qué día es «mañana» para él y el texto del
// aviso. Sin red ni base de datos, para poder probarlo con partidos fijos.
//
// La zona horaria importa dos veces: decide cuándo se envía (las 22:00 de
// Ciudad de México no son las de Madrid) y en qué hora se escriben los
// partidos. Un mexicano que recibe «Villarreal–Espanyol 21:00» con la hora de
// España llega siete horas tarde.

import { SOURCE_TZ } from '@/lib/timezone'
import { addDays, DAY_STAR_MIN_SCORE, pickDayStars, type DayStar } from '@/lib/calendar-day-page'
import { partesEnZona, zonaValida } from '@/lib/avisos-equipo'
import type { SportEvent } from '@/lib/types'

export const AGENDA_TOPIC = 'agenda'
/** Hora local del envío. Decidida con el editor el 29/10/2026. */
export const AGENDA_HORA = 22
/** Partidos que se nombran en el aviso; el resto va como «y N más». */
export const AGENDA_ESTRELLAS = 3

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/**
 * El día («mañana» en su zona) del que hay que avisar a este suscriptor ahora,
 * o null si no es su hora o ya se le avisó de ese día. El cron corre cada hora
 * en punto; como la condición es «ser las 22 y no haber avisado de mañana»,
 * una pasada que se retrase unos minutos no duplica ni se salta el aviso.
 */
export function diaQueToca(ahora: Date, tz: string | null | undefined, yaAvisado: string | null): string | null {
  const zona = zonaValida(tz)
  const { dia, hora } = partesEnZona(ahora, zona)
  if (hora !== AGENDA_HORA) return null
  const manana = addDays(dia, 1)
  return yaAvisado === manana ? null : manana
}

/**
 * Días del calendario (que va en hora de España) que cubren el día local `dia`
 * de esa zona. Al oeste de Madrid un día local acaba más tarde y pisa el día
 * siguiente de España; al este, el anterior. Se cargan los tres candidatos y
 * construirAviso filtra por la fecha local exacta de cada partido.
 */
export function diasFuente(dia: string, tz: string | null | undefined): string[] {
  return zonaValida(tz) === SOURCE_TZ ? [dia] : [addDays(dia, -1), dia, addDays(dia, 1)]
}

function horaEn(iso: string, tz: string): string {
  const { hora, minuto } = partesEnZona(new Date(iso), tz)
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
}

/** «Villarreal–Espanyol 21:00 (DAZN)»: la hora suelta, el canal entre paréntesis. */
function etiqueta(s: DayStar): string {
  const nombre = `${s.home}–${s.away}${s.femenino ? ' femenino' : ''}`
  return `${nombre}${s.time ? ` ${s.time}` : ''}${s.channel ? ` (${s.channel})` : ''}`
}

export interface AvisoAgenda {
  title: string
  body: string
  url: string
}

/**
 * El aviso de una noche para una zona, o null si mañana no hay nada que
 * merezca despertar el móvil (ningún partido por encima del listón de
 * destacados). Usa el mismo ranking que la descripción de Google y la tarjeta
 * de compartir del día.
 */
export function construirAviso(
  events: readonly SportEvent[],
  dia: string,
  tz: string | null | undefined,
  score: (e: SportEvent) => number,
  canal: (e: SportEvent) => string | undefined,
): AvisoAgenda | null {
  const zona = zonaValida(tz)
  // Solo lo que se juega ese día EN SU ZONA, con la hora también en su zona,
  // y sin repetir el mismo partido llegado de dos días de origen.
  const vistos = new Set<string>()
  const delDia: SportEvent[] = []
  for (const e of events) {
    if (!e.isoDate || vistos.has(e.id) || partesEnZona(new Date(e.isoDate), zona).dia !== dia) continue
    vistos.add(e.id)
    delDia.push(e.timeTbd ? e : { ...e, time: horaEn(e.isoDate, zona) })
  }
  const estrellas = pickDayStars(delDia, score, canal, AGENDA_ESTRELLAS, DAY_STAR_MIN_SCORE)
  if (estrellas.length === 0) return null

  const [y, m, d] = dia.split('-').map(Number)
  const diaSemana = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const total = delDia.length
  const resto = total - estrellas.length
  return {
    title: `Mañana, ${diaSemana} ${d}: ${total} ${total === 1 ? 'partido' : 'partidos'}`,
    body: estrellas.map(etiqueta).join(' · ') + (resto > 0 ? ` · y ${resto} más` : ''),
    url: `/calendario/dia/${dia}`,
  }
}
