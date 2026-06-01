'use client'
import Image, { ImageProps } from 'next/image'

// CDNs que funcionan directamente con next/image sin problemas de hotlink.
// Para estos dominios usamos la optimización nativa de Next.js → WebP +
// responsive sizing automático.
//
// supabase.co movido aquí en F3.2 (jun 2026): las imágenes de artículos
// guardadas en Supabase Storage promedian 200-500 KiB sin optimizar. Con
// next/image bajan a 30-80 KiB en WebP → ahorro ~516 KiB por LCP image
// según PSI. Trade-off: cada transformación única cuenta hacia el límite
// de Vercel Image Optimization (5k/mes free tier). Tráfico actual ≈ 3k.
const OPTIMIZED_HOSTS = [
  'cdn.sanity.io',
  'cdninstagram.com',
  'fbcdn.net',
  'api-sports.io',
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

function needsOptimization(hostname: string): boolean {
  return hostMatches(hostname, OPTIMIZED_HOSTS)
}

function isTrusted(hostname: string): boolean {
  return hostMatches(hostname, TRUSTED_HOSTS)
}

/**
 * Convierte una URL externa de tercero en una URL de nuestro proxy.
 * El proxy descarga con cabeceras de navegador real → bypassa hotlink blocking.
 * Cache 24 h en Vercel CDN → 1 descarga por URL al día máximo.
 */
function toProxyUrl(src: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(src)}`
}

/**
 * Drop-in replacement for next/image con tres modos:
 *
 * 1. CDN conocido (Sanity, Instagram…)  → next/image con optimización
 * 2. Host de confianza (Supabase, own)   → next/image unoptimized
 * 3. Tercero desconocido (marca, clarin…)→ proxy /api/image-proxy
 *    El proxy sirve desde nuestro dominio, evitando hotlink blocks.
 */
export default function DynamicImage({ src, ...props }: ImageProps) {
  if (typeof src !== 'string' || !src.startsWith('http')) {
    // Rutas relativas / StaticImageData: next/image directo
    return <Image src={src} {...props} />
  }

  let hostname = ''
  try {
    hostname = new URL(src).hostname
  } catch {
    return <Image src={src} unoptimized {...props} />
  }

  if (needsOptimization(hostname)) {
    // CDN conocido: next/image optimiza directamente (WebP, resize…)
    return <Image src={src} {...props} />
  }

  if (isTrusted(hostname)) {
    // Host propio/Supabase: unoptimized para no pasar por _next/image
    return <Image src={src} unoptimized {...props} />
  }

  // Tercero desconocido → proxy para bypasear hotlink blocking.
  // El proxy ya sirve la imagen con Content-Type correcto y cache 24 h,
  // así que marcamos unoptimized para no añadir un doble salto de proxy.
  return <Image src={toProxyUrl(src)} unoptimized {...props} />
}
