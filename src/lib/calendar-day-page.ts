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

/**
 * Todos los días que la ruta debe generar, de más reciente a más antiguo.
 *
 * Dos fuentes: la ventana viva —hacia delante manda el feed (~45 días), hacia
 * atrás los días recientes, que pueden tener partidos aún sin archivar— y el
 * archivo completo de resultados. Hasta ahora solo existía la ventana, con un
 * tope fijo de 30 días hacia atrás, y eso tiraba casi cien días de marcadores
 * que YA estaban en `past_events`. Ahora un día pasado se sirve porque TIENE
 * partidos, no porque caiga dentro de un número redondo.
 *
 * Fuera de esta lista la ruta da 404, que es lo correcto: una página de un día
 * sin datos sería un 200 vacío, peor señal que no existir.
 */
export function servableDays(todayIso: string, archivedDays: readonly string[] = []): string[] {
  const out = new Set<string>()
  for (let n = DAY_PAGE_FUTURE; n >= -DAY_PAGE_PAST; n--) out.add(addDays(todayIso, n))
  for (const d of archivedDays) {
    // Un día archivado del futuro no tiene sentido, y uno inválido tampoco:
    // esto lo alimenta la base, así que conviene no fiarse.
    if (isValidDayParam(d) && dayOffsetFrom(d, todayIso) <= DAY_PAGE_FUTURE) out.add(d)
  }
  return [...out].sort((a, b) => b.localeCompare(a))
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

/**
 * ¿Es un día ya jugado? Ayer cuenta como presente: a esa hora la gente sigue
 * buscando «partidos de ayer» tanto como el marcador, y la página aún mezcla
 * feed y archivo.
 */
export function isPastDay(iso: string, todayIso: string): boolean {
  return dayOffsetFrom(iso, todayIso) <= -2
}

/**
 * Título SEO. El día relativo va delante porque es lo que la gente busca.
 *
 * Y va en PASADO cuando el día ya se jugó: quien busca «resultados del 22 de
 * agosto» no quiere «horarios y dónde ver», que es lo que servíamos para todo
 * el archivo. Prometer el horario de un partido de hace un mes es prometer lo
 * que el visitante ya sabe que no necesita.
 */
export function dayPageTitle(iso: string, todayIso: string): string {
  const rel = relativeDayLabel(iso, todayIso)
  const base = rel ? `${rel}, ${shortDayLabel(iso)}` : shortDayLabel(iso)
  return isPastDay(iso, todayIso)
    ? `Resultados del ${base}: todos los marcadores`
    : `Partidos de ${base}: horarios y dónde ver`
}

export function dayPageDescription(iso: string, count: number, todayIso?: string): string {
  const when = longDayLabel(iso)
  if (count === 0) return `Agenda deportiva del ${when} en TakaSports.`
  if (todayIso && isPastDay(iso, todayIso)) {
    return `Resultados de los ${count} partidos del ${when}: marcadores finales, competición y crónica. Fútbol, NBA, tenis, F1 y más.`
  }
  return `Los ${count} partidos del ${when}: horarios, canal de televisión, resultados y clasificación. Fútbol, NBA, tenis, F1 y más.`
}
