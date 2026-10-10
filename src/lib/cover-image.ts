import type { SanityImageSource } from '@sanity/image-url'
import { urlFor } from '@/lib/sanity'

// La app solo sabe pintar `imageUrl`. Las notas del pipeline lo traen relleno,
// pero las redactadas a mano en el Studio (reportajes) llevan la portada como
// referencia de asset (`image`, con crop/hotspot) y `imageUrl: null`: sin esto
// la app pinta un marcador sin foto.
//
// El builder aplica el crop (`rect`) y, al fijar ancho y alto, recorta a esa
// proporción centrando en el hotspot. Por defecto 1200×675 (16:9, la tarjeta de
// noticia de la app).
//
// OJO: la app añade `?w=…&fit=max` a las URLs de Sanity, y el CDN de Sanity se
// queda con el PRIMER valor de cada parámetro: el tamaño de aquí es el que manda.

export interface CoverRow {
  imageUrl?: string | null
  image?: { asset?: { _ref?: string } } | null
}

export function resolveCoverUrl(
  row: CoverRow,
  { width = 1200, height = 675 }: { width?: number; height?: number } = {},
): string | null {
  if (row.imageUrl) return row.imageUrl
  if (!row.image?.asset?._ref) return null
  try {
    return urlFor(row.image as SanityImageSource).width(width).height(height).url()
  } catch {
    return null
  }
}

/** Rellena `imageUrl` desde `image` en un listado; el resto de campos, intacto. */
export function withCoverUrls<T extends CoverRow>(rows: T[]): (T & { imageUrl: string | null })[] {
  return rows.map(row => ({ ...row, imageUrl: resolveCoverUrl(row) }))
}
