/**
 * Rótulos de búsqueda de las fichas de /rankings/[id].
 *
 * Medido en Search Console (90 días hasta el 3/9/2026): el **91% de las
 * impresiones** de `/rankings/` viene de consultas del tipo «<tenista> ranking»
 * —«cameron norrie ranking», «denis shapovalov ranking actual»—, en posiciones
 * 5-10 y con un CTR del 0,14%. Ocho mil quinientas impresiones al trimestre
 * para doce clics.
 *
 * La causa no era la posición: era el rótulo. Servíamos
 * `«Denis Shapovalov · Ranking Taka 70.4»`, o sea una nota sobre 100 de un
 * índice propio que el buscador no conoce, cuando lo que se busca es el puesto
 * ATP. Y ese dato **ya lo teníamos**: viene en `subtitle` («ATP #48 · Tenis»)
 * desde la ingesta, se pinta en la ficha y se tiraba al escribir el título.
 *
 * De ahí que este módulo exista aparte de `rankings-ui.ts`: es lógica de
 * copy pura sobre el `subtitle`, testeable sin tocar React ni la BD.
 */

import type { RankingEntry } from './rankings'

export interface OfficialRank {
  /** Organismo tal cual lo escribe la ingesta: ATP, WTA… */
  org: string
  /** Puesto en ese ranking oficial. */
  num: number
}

/**
 * Extrae «ATP #48» de un subtitle como «ATP #48 · Tenis».
 *
 * El patrón se deja general (2-5 mayúsculas + #número al principio) en vez de
 * una lista cerrada ATP/WTA: si mañana la ingesta empieza a escribir «FIFA #3»
 * o «UFC #7», el título mejora solo. Se exige que vaya al INICIO para no
 * confundirlo con un dato incrustado a media frase.
 *
 * Ojo: `subtitle` llega a veces como la cadena literal "null" desde la vista
 * (hay filas de creadores así), y como `undefined` en las entradas estáticas.
 */
export function parseOfficialRank(subtitle?: string | null): OfficialRank | null {
  if (!subtitle || subtitle === 'null') return null
  const m = /^([A-Z]{2,5})\s*#(\d{1,4})\b/.exec(subtitle.trim())
  if (!m) return null
  const num = Number(m[2])
  if (!Number.isFinite(num) || num < 1) return null
  return { org: m[1], num }
}

/** `subtitle` utilizable, o null si es basura ("null", vacío). */
export function cleanSubtitle(subtitle?: string | null): string | null {
  if (!subtitle || subtitle === 'null') return null
  const s = subtitle.trim()
  return s.length > 0 ? s : null
}

const BRAND = 'TakaSports'

/**
 * Etiqueta de reserva cuando el subtitle no sirve como rótulo.
 *
 * Hace falta porque `subtitle` no tiene una forma única: en deportistas y clubes
 * es una etiqueta («LaLiga · España»), pero en creadores y periodistas es una
 * BIOGRAFÍA de hasta 110 caracteres («51 años en el periodismo. Director de
 * Planeta Fútbol (Win Sports). El decano de Colombia.»). Metida en el título
 * daba rótulos de 125 caracteres que Google corta a la mitad.
 */
const CATEGORY_LABEL: Record<string, string> = {
  periodistas: 'Periodista deportivo',
  creadores: 'Creador de contenido',
  creadores_wwe: 'Creador de contenido',
}

/** Longitud a partir de la cual un subtitle deja de ser etiqueta y es prosa. */
const MAX_LABEL = 46

/**
 * El subtitle, solo si vale como rótulo: corto y sin frases. Si no, la etiqueta
 * de su categoría. Puede devolver null (entrada sin nada aprovechable).
 */
export function labelSubtitle(subtitle?: string | null, category?: string): string | null {
  const sub = cleanSubtitle(subtitle)
  const looksLikeLabel = sub !== null && sub.length <= MAX_LABEL && !/\.\s/.test(sub)
  if (looksLikeLabel) return sub
  return (category && CATEGORY_LABEL[category]) || null
}

/**
 * Título de la ficha.
 *
 * Con ranking oficial, el número va delante de todo lo demás: es lo que se
 * buscó y es lo que Google resalta en negrita. El Índice Taka baja a la
 * descripción — sigue siendo el producto, pero no es el gancho de entrada.
 */
export function entryTitle(entry: Pick<RankingEntry, 'name' | 'subtitle' | 'category'>): string {
  const official = parseOfficialRank(entry.subtitle)
  if (official) {
    return `${entry.name} · ${official.org} #${official.num} — ranking y forma | ${BRAND}`
  }
  const label = labelSubtitle(entry.subtitle, entry.category)
  return label ? `${entry.name} · ${label} | ${BRAND}` : `${entry.name} | ${BRAND}`
}

/**
 * Descripción de la ficha.
 *
 * Con ranking oficial se escribe una frase que confirma el dato buscado (para
 * que el fragmento del resultado lo repita) y luego enumera lo que la ficha
 * añade y las otras fuentes no: forma, evolución y nota Taka. Sin él se
 * mantiene el `insight` editorial, que es mejor que cualquier plantilla.
 */
export function entryDescription(
  entry: Pick<RankingEntry, 'name' | 'subtitle' | 'insight'>,
  score: number,
): string {
  const nota = score.toFixed(1).replace('.', ',')
  const official = parseOfficialRank(entry.subtitle)
  if (official) {
    return `${entry.name} es el número ${official.num} del ranking ${official.org}. ` +
      `Forma reciente, evolución semanal y su nota en el Índice Taka: ${nota}/100.`
  }
  if (entry.insight) return entry.insight
  // Aquí sí cabe el subtitle entero (la descripción admite ~155 caracteres),
  // pero las biografías de creadores ya acaban en punto: sin recortarlo salía
  // «…El decano de Colombia.. Ranking Taka 74,2/100.».
  const sub = cleanSubtitle(entry.subtitle)?.replace(/\.+$/, '')
  return sub
    ? `${sub}. Ranking Taka ${nota}/100.`
    : `${entry.name} en el Ranking Taka: ${nota}/100.`
}
