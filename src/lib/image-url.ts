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
  'upload.wikimedia.org', // fotos libres Wikimedia (fallback de la cascada de fotos)
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
