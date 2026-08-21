// ── Página de día del calendario (/calendario/dia/YYYY-MM-DD) ───────────────
//
// Lógica pura de la ruta: validar la fecha, decidir si entra en la ventana que
// servimos y construir los textos. Aparte de la página para poder testearla.
//
// POR QUÉ UNA RUTA NUEVA Y NO /calendario/[fecha]: ese segmento ya es el de
// competiciones, con `dynamicParams = false` y `generateStaticParams` cerrado a
// COMPETITIONS a propósito (un slug inventado debe dar 404 real). Meter fechas
// ahí obligaría a reabrirlo. `/calendario/dia/...` no toca nada de eso.

/** Días hacia atrás que servimos (hay resultados archivados en past_events). */
export const DAY_PAGE_PAST = 30
/** Días hacia delante (el feed de ESPN llega a ~45). */
export const DAY_PAGE_FUTURE = 45

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** ¿Es una fecha YYYY-MM-DD real? Rechaza 2026-02-31 y 2026-13-01. */
export function isValidDayParam(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** Medianoche UTC de un YYYY-MM-DD. Ojo: el mes de Date.UTC es 0-indexado. */
function utcMidnight(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Diferencia en días entre dos YYYY-MM-DD (negativa si `iso` es pasado). */
export function dayOffsetFrom(iso: string, todayIso: string): number {
  return Math.round((utcMidnight(iso) - utcMidnight(todayIso)) / 86_400_000)
}

/** ¿Servimos esta fecha? Fuera de la ventana no tenemos datos que enseñar, así
 *  que la página daría un 200 vacío — peor que un 404 para Google y para el usuario. */
export function isServableDay(iso: string, todayIso: string): boolean {
  if (!isValidDayParam(iso)) return false
  const off = dayOffsetFrom(iso, todayIso)
  return off >= -DAY_PAGE_PAST && off <= DAY_PAGE_FUTURE
}

/** "2026-08-21" → "viernes, 21 de agosto de 2026". */
export function longDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${wd}, ${d} de ${MONTHS[m - 1]} de ${y}`
}

/** "2026-08-21" → "21 de agosto" (para títulos, sin repetir el año). */
export function shortDayLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} de ${MONTHS[m - 1]}`
}

/** Etiqueta relativa cuando la hay: Hoy / Ayer / Mañana; si no, null. */
export function relativeDayLabel(iso: string, todayIso: string): string | null {
  const off = dayOffsetFrom(iso, todayIso)
  return off === 0 ? 'Hoy' : off === -1 ? 'Ayer' : off === 1 ? 'Mañana' : null
}

/** Suma días a un YYYY-MM-DD (UTC, sin sustos de horario de verano). */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** Título SEO. El día relativo va delante porque es lo que la gente busca. */
export function dayPageTitle(iso: string, todayIso: string): string {
  const rel = relativeDayLabel(iso, todayIso)
  const base = rel ? `${rel}, ${shortDayLabel(iso)}` : shortDayLabel(iso)
  return `Partidos de ${base}: horarios y dónde ver`
}

export function dayPageDescription(iso: string, count: number): string {
  const when = longDayLabel(iso)
  if (count === 0) return `Agenda deportiva del ${when} en TakaSports.`
  return `Los ${count} partidos del ${when}: horarios, canal de televisión, resultados y clasificación. Fútbol, NBA, tenis, F1 y más.`
}
