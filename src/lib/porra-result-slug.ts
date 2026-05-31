// Codificación de resultados de La Porra en un slug URL-safe para
// /predicciones/resultado/[slug].
//
// Formato: {jornadaSlug}-h{hits}-t{total}-w{totalWon}
//   · jornadaSlug = jornada normalizada (lowercase, espacios → "-", sin
//     caracteres no-URL-safe).
//   · h, t, w = enteros ≥ 0.
//
// Ejemplos:
//   "Jornada 38" + h6/t10/w120 → "jornada-38-h6-t10-w120"
//   "Mundial · Fase de grupos · 14 jun" + h4/t6/w80
//                 → "mundial-fase-de-grupos-14-jun-h4-t6-w80"

const SLUG_RE = /^(.+?)-h(\d+)-t(\d+)-w(\d+)$/

export interface ParsedResultSlug {
  jornadaSlug: string
  hits: number
  total: number
  totalWon: number
}

/** Convierte una jornada legible en un slug URL-safe. */
export function jornadaToSlug(jornada: string): string {
  return jornada
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[·]/g, '')
    .replace(/[^a-z0-9 ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/** Reformatea el slug de jornada a algo legible para el header de la página
 *  de resultado. No es perfecto (pierde puntuación) pero es lo bastante
 *  bueno para la landing pública. */
export function formatJornadaFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/** Construye el slug final con los datos del resultado. */
export function buildResultSlug(
  jornada: string,
  hits: number,
  total: number,
  totalWon: number,
): string {
  const safe = (n: number) => Math.max(0, Math.min(9999, Math.floor(n)))
  return `${jornadaToSlug(jornada)}-h${safe(hits)}-t${safe(total)}-w${safe(totalWon)}`
}

/** Parsea un slug devuelto por el router. null si el formato no encaja. */
export function parseResultSlug(slug: string): ParsedResultSlug | null {
  const m = SLUG_RE.exec(slug)
  if (!m) return null
  const [, jornadaSlug, h, t, w] = m
  return {
    jornadaSlug,
    hits: parseInt(h, 10),
    total: parseInt(t, 10),
    totalWon: parseInt(w, 10),
  }
}
