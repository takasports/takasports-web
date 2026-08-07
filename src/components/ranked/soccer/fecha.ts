// ─────────────────────────────────────────────────────────────────────────────
// Agrupación y etiquetado de FECHAS para la UI (web; la app replica estas
// mismas reglas en su pantalla de Predicciones).
//
// Regla central: el día de una Fecha lo decide el SERVIDOR y viaja en
// `meta.date_key`. Aquí solo se agrupa y se pone bonito. Recalcular el día en
// cliente es la manera de que la cabecera diga "sábado 22" mientras el pleno de
// la Fecha se calcula sobre el domingo 23.
// ─────────────────────────────────────────────────────────────────────────────

import { SOURCE_TZ } from '@/lib/timezone'
import { SOCCER_LOCK_MS, type SoccerEvent } from './types'

const DAYS_ES   = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const DATE_KEY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: SOURCE_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
})
const TIME_FMT = new Intl.DateTimeFormat('es-ES', {
  timeZone: SOURCE_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
})

/** Hora del kickoff en la zona del sitio ("21:00"). */
export function timeLabel(isoDate: string): string {
  return TIME_FMT.format(new Date(isoDate))
}

/**
 * Día de la Fecha a la que pertenece un evento.
 *
 * Siempre `meta.date_key` cuando existe. El respaldo calculado solo cubre el
 * archivo del Mundial 2026, que se guardó antes de que existieran las Fechas.
 */
export function dateKeyOf(ev: SoccerEvent): string {
  return ev.meta?.date_key ?? DATE_KEY_FMT.format(new Date(ev.event_date))
}

/** "hoy" en la zona del sitio, para comparar contra un date_key. */
export function todayKey(now: Date = new Date()): string {
  return DATE_KEY_FMT.format(now)
}

/**
 * Etiqueta humana de una Fecha: "Hoy", "Mañana" o "sábado 22 ago".
 * Se construye a partir del date_key (no del kickoff) para que coincida
 * exactamente con la agrupación.
 */
export function fechaLabel(dateKey: string, now: Date = new Date()): string {
  const today = todayKey(now)
  if (dateKey === today) return 'Hoy'

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (dateKey === DATE_KEY_FMT.format(tomorrow)) return 'Mañana'

  // Se interpreta a mediodía UTC para que el desfase horario no mueva el día.
  const [y, m, d] = dateKey.split('-').map(Number)
  const at = new Date(Date.UTC(y, m - 1, d, 12))
  return `${DAYS_ES[at.getUTCDay()]} ${d} ${MONTHS_ES[m - 1]}`
}

export interface Fecha {
  dateKey: string
  label:   string
  events:  SoccerEvent[]
  /** El Partido del Día (x2), si esta Fecha tiene uno. */
  featured: SoccerEvent | null
  /** Momento en que se cierra el primer partido del día: es el deadline real
   *  que le importa al usuario ("te quedan 2 h para la Fecha"). */
  firstLockAt: number | null
}

/** Agrupa eventos en Fechas, en orden cronológico. */
export function groupIntoFechas(events: SoccerEvent[], now: Date = new Date()): Fecha[] {
  const byKey = new Map<string, SoccerEvent[]>()
  for (const ev of events) {
    const key = dateKeyOf(ev)
    const bucket = byKey.get(key)
    if (bucket) bucket.push(ev)
    else byKey.set(key, [ev])
  }

  return [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, list]) => {
      const sorted = [...list].sort((a, b) => a.event_date.localeCompare(b.event_date))
      const locks = sorted
        .map(e => new Date(e.event_date).getTime() - SOCCER_LOCK_MS)
        .filter(t => t > now.getTime())
      return {
        dateKey,
        label:       fechaLabel(dateKey, now),
        events:      sorted,
        featured:    sorted.find(e => e.featured) ?? null,
        firstLockAt: locks.length > 0 ? Math.min(...locks) : null,
      }
    })
}

/** Cuántos partidos de la Fecha ya tienen pick. Alimenta el "3/5" de la cabecera. */
export function fechaProgress(fecha: Fecha, predictedIds: ReadonlySet<string>): { done: number; total: number } {
  return {
    done:  fecha.events.filter(e => predictedIds.has(e.id)).length,
    total: fecha.events.length,
  }
}

// ── Pleno de la Fecha ────────────────────────────────────────────────────────
// Espejo de la RPC award_fecha_pleno (migración 124). Se replica aquí para
// poder ANUNCIAR el premio antes de jugar —un bonus que solo se descubre al
// cobrarlo no empuja a nadie a completar la Fecha—, pero quien paga es el
// servidor: esto es cartel, no contabilidad.

/** Partidos mínimos para que una Fecha pague pleno. Por debajo, acertar no
 *  tiene mérito y el premio saldría más barato en los días pobres. */
export const PLENO_MIN_MATCHES = 3

/** Puntos de pleno de una Fecha, o 0 si es demasiado pequeña para pagarlo. */
export function plenoBonus(matches: number): number {
  return matches >= PLENO_MIN_MATCHES ? matches * 2 : 0
}

/** Cuenta atrás corta: "2h 14m", "45m", "1d 3h". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0m'
  const mins  = Math.floor(ms / 60_000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (days  > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${mins % 60}m`
  return `${mins}m`
}
