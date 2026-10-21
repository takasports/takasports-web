// URL de las etiquetas: slug ASCII en vez del texto crudo.
//
// Hasta el 21/10/2026 la URL llevaba la etiqueta tal cual (`/tag/real%20madrid`,
// `/tag/fútbol`), y eso traía tres problemas:
//   · Variantes duplicadas: «fútbol», «futbol» y «Fútbol» eran tres páginas con
//     tres listas de artículos distintas compitiendo por la misma búsqueda.
//   · `%20` y caracteres no Latin-1 en la URL: con ISR la cabecera de caché
//     reventaba con 500 (`/tag/luka modrić`), lo que obligó a renderizarlas sin
//     caché en cada visita.
//   · Eran las únicas URLs del sitio que no seguían el formato de las fichas.
// Ahora todas las variantes de una etiqueta comparten slug y página; las URLs
// viejas redirigen con 308 desde la propia página.
//
// Puro y sin dependencias de entorno, para poder probarlo.

import { toNameSlug } from './entity-slug'

/** «Real Madrid» → «real-madrid»; «Fútbol» → «futbol». '' si no queda nada. */
export function tagSlug(tag: string): string {
  return toNameSlug(tag)
}

/** Ruta pública de una etiqueta, o null si su texto no da para un slug. */
export function tagHref(tag: string): string | null {
  const slug = tagSlug(tag)
  return slug ? `/tag/${slug}` : null
}

export interface GrupoTag {
  slug: string
  /** Cómo se escribe al mostrarla: la variante más usada. */
  etiqueta: string
  /** Todas las grafías que caen en este slug, para buscar los artículos. */
  variantes: string[]
  /** Apariciones sumando todas las variantes. */
  articulos: number
}

/**
 * Agrupa la lista plana de etiquetas (una entrada por artículo y etiqueta) por
 * slug. La grafía que se muestra es la más repetida; a igualdad, la que lleva
 * más letras no ASCII («fútbol» antes que «futbol»: suele ser la bien escrita).
 */
export function agruparTags(planas: readonly unknown[]): Map<string, GrupoTag> {
  const porSlug = new Map<string, Map<string, number>>()
  for (const raw of planas) {
    if (typeof raw !== 'string') continue
    const tag = raw.trim()
    if (!tag) continue
    const slug = tagSlug(tag)
    if (!slug) continue
    const grafias = porSlug.get(slug) ?? new Map<string, number>()
    grafias.set(tag, (grafias.get(tag) ?? 0) + 1)
    porSlug.set(slug, grafias)
  }

  const noAscii = (s: string) => [...s].filter(c => c.charCodeAt(0) > 127).length
  const grupos = new Map<string, GrupoTag>()
  for (const [slug, grafias] of porSlug) {
    const ordenadas = [...grafias.entries()].sort(
      ([a, na], [b, nb]) => nb - na || noAscii(b) - noAscii(a) || a.localeCompare(b),
    )
    grupos.set(slug, {
      slug,
      etiqueta: ordenadas[0][0],
      variantes: ordenadas.map(([t]) => t),
      articulos: ordenadas.reduce((n, [, c]) => n + c, 0),
    })
  }
  return grupos
}

/**
 * Del parámetro de la URL a la etiqueta. La URL buena es el slug
 * (`/tag/real-madrid`); cualquier otra grafía que caiga en el mismo slug —la
 * URL vieja con el texto crudo, `/tag/Real%20Madrid`, `/tag/fútbol`— pide
 * redirección a esa. null: la etiqueta no existe (o la URL no se puede leer:
 * `decodeURIComponent` lanza con un `%` suelto).
 */
export function resolverTagParam(
  param: string,
  index: Readonly<Record<string, GrupoTag>>,
): { grupo: GrupoTag; redirigir: boolean } | null {
  let decoded: string
  try { decoded = decodeURIComponent(param) } catch { return null }
  const slug = tagSlug(decoded)
  if (!slug) return null
  const grupo = index[slug]
  return grupo ? { grupo, redirigir: decoded !== slug } : null
}
