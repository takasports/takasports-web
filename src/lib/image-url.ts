import { espnAt } from './espn-image'

// Helper server-safe para resolver la URL FINAL que el navegador descargará
// para una imagen src. Usado por:
//   - DynamicImage.tsx (client) para decidir si pasa por proxy
//   - page.tsx (server) para emitir <link rel="preload"> que apunte a la
//     MISMA URL que el <img> final, evitando dobles descargas (F3.7).
//
// Vive en lib/ porque archivos con 'use client' no exportan funciones
// usables desde Server Components en Next 16.

// CDNs que funcionan directamente con next/image sin problemas de hotlink.
// Para estos dominios usamos la optimización nativa de Next.js → WebP +
// responsive sizing automático.
const OPTIMIZED_HOSTS = [
  'cdn.sanity.io',
  'cdninstagram.com',
  'fbcdn.net',
  'api-sports.io',
  'espncdn.com',          // headshots/escudos ESPN → next/image en vez del proxy
  // Cubre upload.wikimedia.org (Commons) y thumb.wikimedia.org, que es donde la
  // API pageimages sirve los thumbnails de infobox — la fuente de identidad más
  // fuerte de la cascada de fotos de WF-08. Antes solo estaba `upload`, así que
  // los thumbs caían al proxy y se servían sin optimizar.
  'wikimedia.org',
  'cloudfront.net',
  'twimg.com',
  'pbs.twimg.com',
  'supabase.co',
]

// Dominios propios/de confianza que se sirven directamente sin proxy.
const TRUSTED_HOSTS = [
  'takasportsmedia.com',
  'vercel.app',
  'localhost',
]

function hostMatches(hostname: string, list: string[]): boolean {
  return list.some(h => hostname === h || hostname.endsWith(`.${h}`))
}

export function needsOptimization(hostname: string): boolean {
  return hostMatches(hostname, OPTIMIZED_HOSTS)
}

export function isTrusted(hostname: string): boolean {
  return hostMatches(hostname, TRUSTED_HOSTS)
}

/**
 * Convierte una URL externa de tercero en una URL de nuestro proxy.
 * El proxy descarga con cabeceras de navegador real → bypassa hotlink blocking.
 * Cache 24 h en Vercel CDN → 1 descarga por URL al día máximo.
 */
export function toProxyUrl(src: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(src)}`
}

/**
 * Loader de next/image para las imágenes que van por nuestro proxy.
 *
 * Por qué existe (03/09/2026): la rama del proxy de `DynamicImage` marcaba
 * `unoptimized`, y Next DESCARTA `srcSet` **y** `sizes` cuando ve esa prop
 * (`get-img-props.js`). O sea que todos los `sizes` escritos con cuidado en
 * portada, feed y hero eran código muerto: salía un único `src` sin `w`, y el
 * proxy sin `w` sirve a `MAX_WIDTH`. Medido en producción: `/noticias` en un
 * móvil de 390 px descargaba fotos de 1280 px para huecos de 174 px, 11,2 MB
 * en 153 imágenes.
 *
 * Con un loader propio, Next vuelve a generar el srcSet —y a respetar los
 * `sizes`— pero apuntando a `/api/image-proxy`, así que NO pasa por
 * `/_next/image` y no se paga ni una transformación de Vercel.
 */
export function proxyLoader({ src, width }: { src: string; width: number }): string {
  return `${src}&w=${width}`
}

/**
 * URL de una imagen PEQUEÑA (escudo, cara, miniatura) al ancho en que se va a
 * ver, para los sitios que pintan un `<img>` suelto en vez de `next/image`.
 *
 * ESPN va por su propio redimensionador (gratis, sin gastar CPU nuestra) y el
 * resto por el proxy con `w`. Sin esto, un escudo de 500 px (~237 KB) se
 * descargaba entero para pintarlo a 18.
 *
 * `width` debe ser el ancho FÍSICO deseado: pásale el doble del CSS si quieres
 * que se vea nítido en pantallas @2x.
 */
export function smallImage(src: string | null | undefined, width: number): string | undefined {
  if (!src) return undefined
  if (!src.startsWith('http')) return src
  if (src.includes('a.espncdn.com')) return espnAt(src, width)
  return `${toProxyUrl(src)}&w=${Math.round(width)}`
}

/**
 * Resuelve la URL FINAL que el navegador descargará para una imagen src.
 * Sirve para preloads `<link rel="preload">` que deben apuntar a la misma URL
 * que el `<img>` real, no a la URL original.
 *
 * Devuelve `null` si src no es una URL http válida (no preload necesario).
 */
export function resolveImageUrl(src: string | null | undefined): string | null {
  if (!src || !src.startsWith('http')) return null
  let hostname = ''
  try { hostname = new URL(src).hostname } catch { return null }
  // OPTIMIZED y TRUSTED: el browser descarga la URL original directamente.
  if (needsOptimization(hostname) || isTrusted(hostname)) return src
  // Tercero desconocido: el `<img>` carga via proxy → preload debe apuntar allí.
  return toProxyUrl(src)
}
