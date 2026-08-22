// ─────────────────────────────────────────────────────────────────────────────
// Agrupación y etiquetado de JORNADAS para la UI (web; la app replica estas
// mismas reglas en su pantalla de Predicciones).
//
// Regla central: la semana de una Jornada la decide el SERVIDOR y viaja en
// `meta.week_key` (el lunes de esa semana, hora de Madrid); el día de cada
// partido dentro de ella viaja en `meta.date_key`. Aquí solo se agrupa y se
// pone bonito. Recalcular en cliente es la manera de que la cabecera diga
// "Jornada del 22 al 28" mientras el pleno se calcula sobre otra semana.
// ─────────────────────────────────────────────────────────────────────────────

import { toWeekKey } from '@/lib/football-ranked'
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
 * Día al que pertenece un evento, dentro de su Jornada.
 *
 * Siempre `meta.date_key` cuando existe. El respaldo calculado solo cubre el
 * archivo del Mundial 2026, que se guardó antes de que existiera este motor.
 */
export function dateKeyOf(ev: SoccerEvent): string {
  return ev.meta?.date_key ?? DATE_KEY_FMT.format(new Date(ev.event_date))
}

/** Semana (lunes, hora de Madrid) a la que pertenece un evento. Siempre
 *  `meta.week_key` cuando existe; el respaldo cubre eventos anteriores a este
 *  motor y reutiliza el mismo cálculo que usa el cron para publicar. */
export function weekKeyOf(ev: SoccerEvent): string {
  return ev.meta?.week_key ?? toWeekKey(ev.event_date)
}

/** "hoy" en la zona del sitio, para comparar contra un date_key. */
export function todayKey(now: Date = new Date()): string {
  return DATE_KEY_FMT.format(now)
}

/** Lunes de la semana actual, para comparar contra un week_key. */
export function thisWeekKey(now: Date = new Date()): string {
  return toWeekKey(now.toISOString())
}

/**
 * Etiqueta humana de un DÍA dentro de una Jornada: "Hoy", "Mañana" o
 * "sábado 22 ago". Se construye a partir del date_key (no del kickoff) para
 * que coincida exactamente con la agrupación.
 */
export function dayLabel(dateKey: string, now: Date = new Date()): string {
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

/**
 * Etiqueta humana de una JORNADA (semana): "Esta Jornada", "Próxima Jornada" o
 * "Jornada del 24 al 30 ago". El rango se calcula lunes→domingo a partir del
 * week_key, no del primer/último partido: una Jornada con solo 4 partidos
 * (una semana corta) sigue anunciando su semana completa.
 */
export function jornadaLabel(weekKey: string, now: Date = new Date()): string {
  if (weekKey === thisWeekKey(now)) return 'Esta Jornada'

  const nextMonday = new Date(now)
  const [ny, nm, nd] = thisWeekKey(now).split('-').map(Number)
  nextMonday.setTime(Date.UTC(ny, nm - 1, nd, 12) + 7 * 86_400_000)
  if (weekKey === DATE_KEY_FMT.format(nextMonday)) return 'Próxima Jornada'

  return jornadaRangeLabel(weekKey)
}

/**
 * Etiqueta ABSOLUTA de una Jornada: siempre "Jornada del 24 al 30 ago", nunca
 * "Esta Jornada".
 *
 * `jornadaLabel` es relativa al momento en que se pinta, y eso está bien
 * DENTRO de la web. Fuera de ella no: lo que se comparte por WhatsApp lo abre
 * alguien tres días después, y una tarjeta que dice "Esta Jornada" habla de
 * otra semana distinta a la del que la mandó. Peor aún, todos los usuarios
 * compartían la misma URL base (`/predicciones/resultado/esta-jornada-…`).
 *
 * Regla: relativa para pintar, absoluta para identificar y para salir fuera.
 */
export function jornadaRangeLabel(weekKey: string): string {
  const [y, m, d] = weekKey.split('-').map(Number)
  const monday = new Date(Date.UTC(y, m - 1, d, 12))
  const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6)
  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth()
  return sameMonth
    ? `Jornada del ${monday.getUTCDate()} al ${sunday.getUTCDate()} ${MONTHS_ES[sunday.getUTCMonth()]}`
    : `Jornada del ${monday.getUTCDate()} ${MONTHS_ES[monday.getUTCMonth()]} al ${sunday.getUTCDate()} ${MONTHS_ES[sunday.getUTCMonth()]}`
}

export interface DayGroup {
  dateKey: string
  label:   string
  events:  SoccerEvent[]
}

export interface Jornada {
  weekKey: string
  label:   string
  /** Todos los partidos de la semana, en orden cronológico. Es el universo del
   *  Pleno: el bonus exige haber acertado TODOS, incluidos los ya cerrados. */
  events:  SoccerEvent[]
  /** Los que aún se pueden pronosticar. Con cierre único eso es "todos" o
   *  "ninguno": lo que manda es `deadline`, no el kickoff de cada uno. */
  pending: SoccerEvent[]
  /** Los que ya se jugaron. Van a un bloque aparte, plegado: cuando la Jornada
   *  va por la mitad son la mayoría y en la lista principal solo alargan la
   *  pantalla. Lo bloqueado-pero-sin-jugar NO entra aquí: una vez cerrada, la
   *  Jornada es un marcador en vivo y esconderlo sería quitar justo lo que se
   *  viene a mirar el domingo. */
  settled: SoccerEvent[]
  /** Todo lo que aún no se ha jugado, en bloques por día para las
   *  sub-cabeceras de la UI ("sábado 22", "domingo 23"…). */
  days:    DayGroup[]
  /** El Partidazo de la Jornada (x2), si esta semana tiene uno. */
  featured: SoccerEvent | null
  /** ¿El Partidazo sigue siendo jugable? Solo entonces merece el hueco de
   *  honor a ancho completo: un Partidazo ya resuelto abriendo la sección es
   *  un cartel de algo que el usuario ya no puede hacer. */
  featuredPlayable: boolean
  /** Cuándo cierra la JORNADA ENTERA: una hora antes de su primer partido,
   *  sea cual sea. `null` si ya pasó.
   *
   *  Cerrando partido a partido, quien rellenaba el domingo por la mañana ya
   *  había visto los resultados del sábado y tenía 24 h más de alineaciones que
   *  quien lo hizo el jueves: esperar era la jugada óptima. Un cierre común deja
   *  a todos en la misma línea de salida, y da una sola cuenta atrás. */
  firstLockAt: number | null
}

/** Agrupa eventos en Jornadas (semanas), en orden cronológico. Dentro de cada
 *  Jornada, además los parte por día para las sub-cabeceras de la UI. */
export function groupIntoJornadas(events: SoccerEvent[], now: Date = new Date()): Jornada[] {
  const byWeek = new Map<string, SoccerEvent[]>()
  for (const ev of events) {
    const key = weekKeyOf(ev)
    const bucket = byWeek.get(key)
    if (bucket) bucket.push(ev)
    else byWeek.set(key, [ev])
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekKey, list]) => {
      const sorted = [...list].sort((a, b) => a.event_date.localeCompare(b.event_date))

      // La Jornada cierra ENTERA una hora antes de su primer partido. El
      // `status` por sí solo no serviría: lo mueve un cron cada media hora, así
      // que un partido puede seguir 'open' cuando la API ya rechaza picks.
      const nowMs = now.getTime()
      const deadline = sorted.length > 0
        ? new Date(sorted[0].event_date).getTime() - SOCCER_LOCK_MS
        : null
      const abierta = deadline !== null && nowMs < deadline

      const pending = abierta ? sorted.filter(e => e.status === 'open') : []
      const settled = sorted.filter(e => e.status === 'resolved')
      const porJugar = sorted.filter(e => e.status !== 'resolved')

      const byDay = new Map<string, SoccerEvent[]>()
      for (const ev of porJugar) {
        const dk = dateKeyOf(ev)
        const bucket = byDay.get(dk)
        if (bucket) bucket.push(ev)
        else byDay.set(dk, [ev])
      }
      const days: DayGroup[] = [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, dayEvents]) => ({ dateKey, label: dayLabel(dateKey, now), events: dayEvents }))



      // Una semana debería traer UN Partidazo, pero la tabla ha llegado a tener
      // varios con el mismo week_key (restos del modelo diario anterior). Ante
      // el empate manda el que la propia Jornada eligió, que es el de mayor
      // highlight_score; sin él, el primero cronológico —que era justo el
      // criterio que colaba un partido ya resuelto en el hueco de honor—.
      const flagged = sorted.filter(e => e.featured)
      const featured = flagged.length <= 1
        ? flagged[0] ?? null
        : [...flagged].sort((a, b) =>
            (Number(b.meta?.highlight_score ?? 0) - Number(a.meta?.highlight_score ?? 0)) ||
            a.event_date.localeCompare(b.event_date),
          )[0]

      return {
        weekKey,
        label:       jornadaLabel(weekKey, now),
        events:      sorted,
        pending,
        settled,
        days,
        featured,
        featuredPlayable: !!featured && abierta && featured.status === 'open',
        firstLockAt: abierta ? deadline : null,
      }
    })
}

/** Cuántos partidos de la Jornada ya tienen pick. Alimenta el "5/8" de la
 *  cabecera. Cuenta sobre TODOS los partidos de la semana, no solo los
 *  abiertos: es el mismo universo que exige el Pleno, y si el denominador
 *  encogiera al cerrarse cada partido, la Jornada parecería completa cuando en
 *  realidad se han escapado picks. */
export function jornadaProgress(jornada: Jornada, predictedIds: ReadonlySet<string>): { done: number; total: number } {
  return {
    done:  jornada.events.filter(e => predictedIds.has(e.id)).length,
    total: jornada.events.length,
  }
}

// ── Pleno de la Jornada ──────────────────────────────────────────────────────
// Espejo de la RPC award_jornada_pleno (migración 125). Se replica aquí para
// poder ANUNCIAR el premio antes de jugar —un bonus que solo se descubre al
// cobrarlo no empuja a nadie a completar la Jornada—, pero quien paga es el
// servidor: esto es cartel, no contabilidad.

/** Partidos mínimos para que una Jornada pague pleno. Por debajo, acertar no
 *  tiene mérito y el premio saldría más barato en las semanas pobres. */
export const PLENO_MIN_MATCHES = 3

/**
 * Lo que paga el Pleno según cuántos FALLOS lleves. Espejo exacto de
 * `award_jornada_pleno` (migración 131).
 *
 * Antes era todo o nada: acertar los N. Con un 55% de acierto por partido
 * —que es bueno— eso cae una vez cada doscientas jornadas, y se anunciaba en
 * la cabecera todas las semanas. Un premio que nadie gana enseña a ignorar el
 * sitio donde lo pusimos.
 *
 * Escala con el tamaño de la Jornada: una semana de 7 no debe pagar como una
 * de 9. Los escalones de 1 y 2 fallos piden un mínimo de partidos porque
 * fallar dos de cuatro no es ninguna gesta.
 */
export function plenoBonus(matches: number, misses = 0): number {
  if (matches < PLENO_MIN_MATCHES) return 0
  if (misses === 0) return matches * 3
  if (misses === 1 && matches >= 5) return matches
  if (misses === 2 && matches >= 7) return Math.floor(matches / 2)
  return 0
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
