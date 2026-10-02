// Reglas PURAS del vigilante de datos (/api/cron/data-freshness). Viven aparte
// para poder probarlas sin Supabase, Sanity ni ESPN: el route recoge los números
// y estas funciones deciden si hay que avisar. Devuelven la línea del aviso
// (HTML de Telegram) o null si todo está bien.

/** Noticias publicadas en 7 días por debajo de las cuales se avisa. */
export const NOTICIAS_7D_MIN = 80
/** Horas sin un reel nuevo antes de avisar. */
export const REELS_MAX_HORAS = 48
/**
 * Partidos de fútbol que tuvo el MISMO día de la semana pasada para dar por
 * hecho que hoy también debería haberlos. En pleno parón de verano los
 * fines de semana bajan a 1-6 partidos (medido jun-jul 2026): por debajo de
 * este listón un 0 hoy puede ser real y no se avisa.
 */
export const FUTBOL_BASE_MIN = 5

/** Días en los que siempre hay jornada en alguna de las ~40 ligas: vie, sáb, dom, lun. */
const DIAS_JORNADA = new Set([5, 6, 0, 1])

/**
 * Calendario de hoy sin fútbol. Solo avisa si:
 *   · hoy es viernes-lunes (zona de Madrid),
 *   · el calendario público da 0 partidos de fútbol con fecha de hoy, y
 *   · el mismo día de la semana pasada hubo al menos FUTBOL_BASE_MIN.
 * El listón de la semana anterior evita el falso positivo del parón de
 * verano; el filtro de días, el de un martes sin Champions.
 * `futbolHoy === null` = no se pudo leer el calendario (también es un fallo).
 */
export function evaluarCalendarioHoy(p: {
  futbolHoy: number | null
  futbolSemanaPasada: number
  diaSemana: number // 0 = domingo … 6 = sábado
  error?: string
}): string | null {
  if (p.futbolHoy === null) {
    return `• <b>Calendario de hoy</b>: no se pudo leer /api/events/today${p.error ? ` (${p.error})` : ''} → la app y «Tu día» salen vacíos`
  }
  if (p.futbolHoy > 0) return null
  if (!DIAS_JORNADA.has(p.diaSemana)) return null
  if (p.futbolSemanaPasada < FUTBOL_BASE_MIN) return null
  return (
    `• <b>Calendario de hoy SIN fútbol</b>: 0 partidos cuando el mismo día de la semana pasada hubo ${p.futbolSemanaPasada}. ` +
    `Probable fallo de ESPN o de la caché (mira /api/events/today y los avisos [upcoming]/[espn] en los logs).`
  )
}

/** Último reel con más de REELS_MAX_HORAS (o ninguno). */
export function evaluarReels(p: { ultimoReelIso: string | null; ahoraMs: number }): string | null {
  const ms = p.ultimoReelIso ? new Date(p.ultimoReelIso).getTime() : NaN
  if (!Number.isFinite(ms)) {
    return `• <b>Reels</b>: no hay ningún reel reciente en el feed (fuentes caídas o token de Instagram caducado)`
  }
  const horas = (p.ahoraMs - ms) / 3_600_000
  if (horas <= REELS_MAX_HORAS) return null
  return `• <b>Reels</b>: el último es de hace ${Math.round(horas)} h (límite ${REELS_MAX_HORAS} h). Último: ${p.ultimoReelIso}`
}

/** Noticias publicadas en los últimos 7 días por debajo de NOTICIAS_7D_MIN. */
export function evaluarNoticiasSemana(p: { publicadas7d: number | null; error?: string }): string | null {
  if (p.publicadas7d === null) {
    return `• <b>Noticias publicadas (7 días)</b>: no se pudo contar en Sanity${p.error ? ` (${p.error})` : ''}`
  }
  if (p.publicadas7d >= NOTICIAS_7D_MIN) return null
  return (
    `• <b>Noticias publicadas (7 días)</b>: ${p.publicadas7d}, por debajo de ${NOTICIAS_7D_MIN}. ` +
    `Es la palanca nº 1 de captación: revisa el selector del pipeline y las tarjetas sin aprobar en Telegram.`
  )
}

/** Día de la semana (0 = domingo) en una zona horaria. */
export function diaSemanaEn(fecha: Date, tz: string): number {
  const corto = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(fecha)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(corto)
}
