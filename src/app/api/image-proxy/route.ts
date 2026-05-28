// Proxy de imágenes para evitar hotlink blocking de medios de terceros.
//
// El pipeline editorial guarda la URL original de la imagen (marca, clarin,
// AS, mmafighting, motorsport…). Esos dominios rechazan peticiones que no
// parecen venir de un navegador real o que tienen un Referer externo.
//
// Este endpoint:
//   · Descarga la imagen en el servidor con cabeceras de navegador real
//   · La sirve desde nuestro dominio (sin problema de CORS/hotlink)
//   · Cache 24 h en Vercel Edge CDN → 1 sola descarga por URL al día
//
// Seguridad anti-SSRF:
//   · Solo permite http/https
//   · Bloquea IPs privadas / localhost / servicios de metadatos cloud
//   · Solo acepta respuestas de tipo image/*
//   · Límite de 8 MB por imagen

import { NextRequest, NextResponse } from 'next/server'

const MAX_SIZE = 8 * 1024 * 1024 // 8 MB

// Bloques CIDR de IPs que NUNCA deben ser accesibles desde el proxy (SSRF).
const PRIVATE_RANGES = [
  /^127\./,                // loopback
  /^10\./,                 // RFC1918
  /^192\.168\./,           // RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC1918
  /^169\.254\./,           // link-local / metadata AWS · GCP
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT
  /^::1$/,                 // IPv6 loopback
  /^fc00:/,                // IPv6 privada
  /^fe80:/,                // IPv6 link-local
]

function isPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.local')) return true
  return PRIVATE_RANGES.some(re => re.test(hostname))
}

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (isPrivateHost(u.hostname)) return false
    return true
  } catch {
    return false
  }
}

// Cabeceras que simulan un navegador navegando desde el propio dominio.
// Suficiente para saltar la mayoría de protecciones anti-hotlink simples.
function browserHeaders(imageUrl: string): HeadersInit {
  const origin = (() => {
    try { return new URL(imageUrl).origin } catch { return '' }
  })()
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Sec-Fetch-Dest': 'image',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'same-site',
    // Referer del propio dominio de la imagen — pasa la mayoría de checks
    ...(origin ? { Referer: origin + '/' } : {}),
  }
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url')
  if (!raw) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  if (!isSafeUrl(raw)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 })
  }

  try {
    const upstream = await fetch(raw, {
      headers: browserHeaders(raw),
      redirect: 'follow',
      signal: AbortSignal.timeout(8_000), // 8 s timeout
    })

    if (!upstream.ok) {
      // No retransmitir el cuerpo del error del upstream — solo el status
      return new NextResponse(null, { status: upstream.status })
    }

    const contentType = upstream.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
      return NextResponse.json({ error: 'Not an image' }, { status: 415 })
    }

    // Rechazar antes de leer si el upstream ya declara un tamaño excesivo
    const declaredLength = Number(upstream.headers.get('content-length') ?? 0)
    if (declaredLength > MAX_SIZE) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 })
    }

    const buffer = await upstream.arrayBuffer()
    if (buffer.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 })
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Content-Length': String(buffer.byteLength),
        // 24 h fresh en CDN edge; stale-while-revalidate 7 días.
        // Una misma URL de imagen no se descarga más de 1 vez al día.
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        'CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('[image-proxy] upstream fetch failed:', err)
    return new NextResponse(null, { status: 502 })
  }
}
