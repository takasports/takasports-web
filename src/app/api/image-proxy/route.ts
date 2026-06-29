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
//   · Límite de 25 MB de ENTRADA (se sirve siempre encogida a WebP ≤MAX_WIDTH)

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

// sharp recomprime las imágenes → necesita el runtime de Node (no Edge).
export const runtime = 'nodejs'

// Tope de ENTRADA generoso: las portadas de IA (Higgsfield→CloudFront) son PNG de
// ~9 MB. El móvil NUNCA descarga eso: sharp las encoge a un WebP de ~50-120 KB y la
// CDN cachea 24 h. El tope solo evita buffers absurdos en memoria (SSRF/DoS).
const MAX_SIZE = 25 * 1024 * 1024 // 25 MB (entrada)
const MAX_WIDTH = 1280            // ancho máximo servido (px) — evita fotos 2-3 MB en móvil
const WEBP_QUALITY = 80           // calidad WebP (nítida en tarjetas grandes a todo el ancho)

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

// User-Agents que el proxy presenta al origen. Muchos WAF de medios (sopitas,
// nginx, Cloudflare…) bloquean como "bot" cualquier UA de navegador ANTIGUO, así
// que la versión de Chrome hay que mantenerla al día o el proxy se auto-sabotea:
// su única razón de ser es parecer un navegador real. Si el primario es
// rechazado (403/401/429/451) reintentamos con Googlebot, que los medios casi
// siempre permiten para que Google indexe sus imágenes.
const PRIMARY_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
const FALLBACK_UA =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
// Estados típicos de "te he tomado por bot" → merecen un reintento con otro UA.
const BLOCKED_STATUSES = new Set([401, 403, 429, 451])

// Cabeceras que simulan un navegador navegando desde el propio dominio.
// Suficiente para saltar la mayoría de protecciones anti-hotlink simples.
function browserHeaders(imageUrl: string, ua: string = PRIMARY_UA): HeadersInit {
  const origin = (() => {
    try { return new URL(imageUrl).origin } catch { return '' }
  })()
  return {
    'User-Agent': ua,
    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Sec-Fetch-Dest': 'image',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'same-site',
    // Referer del propio dominio de la imagen — pasa la mayoría de checks
    ...(origin ? { Referer: origin + '/' } : {}),
  }
}

// Sigue redirecciones MANUALMENTE re-validando cada salto con isSafeUrl. Con
// redirect:'follow', un dominio permitido podía responder 302 → IP privada /
// metadatos cloud (169.254.169.254) y saltarse el guardia SSRF (solo miraba la
// URL inicial). Aquí cada Location pasa por isSafeUrl antes de seguirla.
async function fetchFollowingSafe(startUrl: string, ua: string = PRIMARY_UA, maxHops = 3): Promise<Response> {
  let url = startUrl
  for (let hop = 0; hop <= maxHops; hop++) {
    const res = await fetch(url, {
      headers: browserHeaders(url, ua),
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000), // 8 s timeout
    })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return res // 3xx sin Location: que lo gestione el caller
      const next = new URL(loc, url).toString() // resuelve relativos contra la URL actual
      if (!isSafeUrl(next)) throw new Error('unsafe_redirect')
      url = next
      continue
    }
    return res
  }
  throw new Error('too_many_redirects')
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
    let upstream = await fetchFollowingSafe(raw)

    // Algunos WAF rechazan el UA de navegador (lo toman por bot). Un único
    // reintento con UA de Googlebot recupera la mayoría de esos casos: los
    // medios quieren que Google indexe sus imágenes.
    if (!upstream.ok && BLOCKED_STATUSES.has(upstream.status)) {
      upstream = await fetchFollowingSafe(raw, FALLBACK_UA)
    }

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

    const buffer = Buffer.from(await upstream.arrayBuffer())
    if (buffer.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 })
    }

    // Redimensionar + recomprimir a WebP: servir una foto de 2-3 MB a tamaño
    // completo en móvil es la causa nº1 de LCP alto. SVG (vector) y GIF (posible
    // animación) se pasan sin tocar. Si sharp falla, se sirve el original.
    const reqW = Number(request.nextUrl.searchParams.get('w'))
    const maxW = Math.min(1920, Math.max(64, Number.isFinite(reqW) && reqW > 0 ? reqW : MAX_WIDTH))
    const transcodable =
      contentType.startsWith('image/') &&
      !contentType.includes('svg') &&
      !contentType.includes('gif')

    let outBuffer: Buffer = buffer
    let outType = contentType || 'image/jpeg'
    if (transcodable) {
      try {
        outBuffer = await sharp(buffer)
          .rotate() // auto-orienta según EXIF antes de redimensionar
          .resize({ width: maxW, withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer()
        outType = 'image/webp'
      } catch {
        outBuffer = buffer
        outType = contentType || 'image/jpeg'
      }
    }

    return new NextResponse(new Uint8Array(outBuffer), {
      status: 200,
      headers: {
        'Content-Type': outType,
        'Content-Length': String(outBuffer.byteLength),
        // 7 días fresh en CDN edge; stale-while-revalidate 30 días. Los bytes ya
        // descargados son válidos indefinidamente y cada URL de origen distinta es
        // una clave de caché distinta (si la foto rota, su URL cambia), así que
        // cachear más tiempo no sirve imágenes "viejas" — solo evita re-descargar
        // y re-procesar (sharp) la misma imagen. Antes 1 día.
        'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
        'CDN-Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('[image-proxy] upstream fetch failed:', err)
    return new NextResponse(null, { status: 502 })
  }
}
