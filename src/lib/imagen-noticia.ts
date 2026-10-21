// Imagen principal de una noticia para Google (Discover, Top Stories) y redes.
//
// Google toma la imagen representativa de `og:image` o de la `image` del
// NewsArticle, pide que coincidan, que mida al menos 1200 px de ancho y que no
// sea un logo ni un gráfico cargado de texto. Hasta el 21/10/2026:
//   · `og:image` era siempre la tarjeta generada (titular en grande + foto).
//   · La `image` del NewsArticle, cuando la foto no venía de Sanity (casi
//     siempre), era la URL del medio de origen tal cual: tamaño desconocido y
//     a merced de su anti-hotlink.
// Ahora las dos apuntan a la FOTO, servida por nuestro proxy a 1200 px de ancho
// en JPEG; la tarjeta con texto queda para X (`twitter:image`). Las placas de
// previas y crónicas (/api/og/…) no tienen foto detrás: se quedan como están.
//
// Puro, para poder probarlo.

/** Ancho que pide Google para la imagen grande de Discover. */
export const ANCHO_DISCOVER = 1200

export interface ImagenPrincipal {
  url: string
  /** Tarjeta generada por nosotros (previa, crónica, columna), no una foto. */
  esPlaca: boolean
}

function absoluta(url: string, siteUrl: string): string {
  return url.startsWith('/') ? `${siteUrl}${url}` : url
}

/**
 * De la `imageUrl` guardada en Sanity a la URL que se da a Google y a las redes.
 * null si no hay imagen o no es una URL utilizable.
 */
export function imagenPrincipal(imageUrl: string | null | undefined, siteUrl: string): ImagenPrincipal | null {
  const raw = imageUrl?.trim()
  if (!raw) return null
  const url = absoluta(raw, siteUrl)
  let host: string
  try { host = new URL(url).hostname } catch { return null }

  if (/\/api\/og\//.test(url)) return { url, esPlaca: true }
  // Ya en nuestro dominio o en el CDN de Sanity: se sirve tal cual.
  const propio = (() => { try { return new URL(siteUrl).hostname } catch { return '' } })()
  if (host === propio || host === 'cdn.sanity.io') return { url, esPlaca: false }

  // Foto de un medio de terceros: por el proxy, a 1200 px y en JPEG (WebP no lo
  // leen todos los clientes que pintan la vista previa de un enlace).
  return {
    url: `${siteUrl}/api/image-proxy?url=${encodeURIComponent(url)}&w=${ANCHO_DISCOVER}&f=jpeg`,
    esPlaca: false,
  }
}
