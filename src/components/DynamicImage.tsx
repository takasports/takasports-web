'use client'
import Image, { ImageProps } from 'next/image'
import { useState } from 'react'
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
export default function DynamicImage({ src, onError, ...props }: ImageProps) {
  // Red de seguridad: si un host directo (optimizado o de confianza) falla al
  // cargar —hotlink block, 404 del CDN—, reintentamos una vez vía proxy, que
  // descarga con cabeceras de navegador real. La cascada de fotos por fuente
  // (api-football → ESPN → Wikimedia) se resuelve en ingesta, no aquí.
  const [failed, setFailed] = useState(false)

  if (typeof src !== 'string' || !src.startsWith('http')) {
    // Rutas relativas / StaticImageData: next/image directo
    return <Image src={src} onError={onError} {...props} />
  }

  let hostname = ''
  try {
    hostname = new URL(src).hostname
  } catch {
    return <Image src={src} unoptimized onError={onError} {...props} />
  }

  const optimized = needsOptimization(hostname)
  const trusted = isTrusted(hostname)

  if ((optimized || trusted) && !failed) {
    // 1. CDN conocido → optimizado (WebP, resize). 2. Host propio → unoptimized.
    return (
      <Image
        src={src}
        unoptimized={!optimized}
        onError={(e) => { setFailed(true); onError?.(e) }}
        {...props}
      />
    )
  }

  // Tercero desconocido, o fallback tras fallo de un host directo → proxy.
  // El proxy ya sirve con Content-Type correcto y cache 24 h; unoptimized evita
  // un doble salto de proxy.
  return <Image src={toProxyUrl(src)} unoptimized onError={onError} {...props} />
}
