'use client'
import Image, { ImageProps } from 'next/image'
import { needsOptimization, isTrusted, toProxyUrl } from '@/lib/image-url'

// La lógica de host detection vive en src/lib/image-url.ts para que sea
// importable desde Server Components (page.tsx) también — un archivo
// 'use client' no exporta funciones usables desde server.

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
