// Proxy de imágenes para evitar hotlink blocking de medios de terceros.
//
// El pipeline editorial guarda la URL original de la imagen (marca, clarin,
// AS, mmafighting, motorsport…). Esos dominios rechazan peticiones que no
// parecen venir de un navegador real o que tienen un Referer externo.
//
// Este endpoint:
//   · Descarga la imagen en el servidor con cabeceras de navegador real
//   · La sirve desde nuestro dominio (sin problema de CORS/hotlink)
//   · Cache 7 días en Vercel Edge CDN → 1 sola descarga por URL
//
// Seguridad anti-SSRF (ver lib/image-proxy-ssrf.ts):
//   · Solo http/https, sin nombres internos
//   · Resuelve el nombre por DNS y exige que TODAS las IPs sean públicas
//   · Conecta contra la IP FIJADA (anti DNS-rebinding), re-validando cada salto
//   · Solo acepta respuestas de tipo image/*
//   · Límite de 25 MB de ENTRADA (se sirve siempre encogida a WebP ≤MAX_WIDTH)

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { isSafeUrl, safeImageFetch, type ProxyResponse } from '@/lib/image-proxy-ssrf'

// sharp recomprime las imágenes → necesita el runtime de Node (no Edge).
export const runtime = 'nodejs'

// Tope de ENTRADA generoso: las portadas de IA (Higgsfield→CloudFront) son PNG de
// ~9 MB. El móvil NUNCA descarga eso: sharp las encoge a un WebP de ~50-120 KB y la
// CDN cachea. El tope solo evita buffers absurdos en memoria (SSRF/DoS).
const MAX_SIZE = 25 * 1024 * 1024 // 25 MB (entrada)
const MAX_WIDTH = 1280            // ancho máximo servido (px) — evita fotos 2-3 MB en móvil
const WEBP_QUALITY = 80           // calidad WebP (nítida en tarjetas grandes a todo el ancho)
const TIMEOUT_MS = 8_000
const MAX_HOPS = 3

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
function browserHeaders(imageUrl: string, ua: string = PRIMARY_UA): Record<string, string> {
  const origin = (() => {
    try { return new URL(imageUrl).origin } catch { return '' }
  })()
  return {
    'User-Agent': ua,
    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    // Pedimos identidad: node:http no descomprime, y las imágenes ya vienen
    // comprimidas — evita recibir gzip que sharp no podría leer.
    'Accept-Encoding': 'identity',
    'Sec-Fetch-Dest': 'image',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'same-site',
    // Referer del propio dominio de la imagen — pasa la mayoría de checks
    ...(origin ? { Referer: origin + '/' } : {}),
  }
}

// Rate-limit en memoria por IP: defensa básica para que el proxy no se use como
// CDN/transcodificador abierto de imágenes de todo internet. LIMITACIÓN: en
// serverless (Vercel) el contador es POR-INSTANCIA, así que un abusador con IPs
// rotativas o mucha concurrencia lo evade; frena el abuso oportunista de una sola
// IP sin coste ni latencia (no toca Supabase, que en un endpoint que sirve
// decenas de imágenes por página degradaría todo el sitio). El blindaje completo
// (firmar las URLs con HMAC) NO cabe aquí: el helper que las genera (image-url.ts)
// es compartido con el cliente, donde un secret se filtraría. Requiere rediseño.
const RL_WINDOW_MS = 60_000
const RL_MAX = 500 // holgado: una página carga ~40-70 imágenes de terceros
const rlHits = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(req: NextRequest): boolean {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  const now = Date.now()
  const cur = rlHits.get(ip)
  if (!cur || now > cur.resetAt) {
    rlHits.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS })
    // Poda oportunista de entradas caducadas para que el Map no crezca sin fin.
    if (rlHits.size > 5000) {
      for (const [k, v] of rlHits) if (now > v.resetAt) rlHits.delete(k)
    }
    return false
  }
  cur.count++
  return cur.count > RL_MAX
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url')
  if (!raw) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  if (isRateLimited(request)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  if (!isSafeUrl(raw)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 })
  }

  try {
    let upstream: ProxyResponse
    try {
      upstream = await safeImageFetch(raw, (u) => browserHeaders(u, PRIMARY_UA), {
        maxHops: MAX_HOPS,
        maxSize: MAX_SIZE,
        timeoutMs: TIMEOUT_MS,
      })
    } catch (err) {
      // Un fallo de seguridad (IP privada / redirect inseguro) NO reintenta.
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'blocked_private_ip' || msg === 'unsafe_url' || msg === 'unsafe_redirect') {
        return NextResponse.json({ error: 'URL not allowed' }, { status: 403 })
      }
      if (msg === 'too_large') {
        return NextResponse.json({ error: 'Image too large' }, { status: 413 })
      }
      throw err
    }

    // Algunos WAF rechazan el UA de navegador (lo toman por bot). Un único
    // reintento con UA de Googlebot recupera la mayoría de esos casos.
    const ok = (r: ProxyResponse) => r.status >= 200 && r.status < 300
    if (!ok(upstream) && BLOCKED_STATUSES.has(upstream.status)) {
      upstream = await safeImageFetch(raw, (u) => browserHeaders(u, FALLBACK_UA), {
        maxHops: MAX_HOPS,
        maxSize: MAX_SIZE,
        timeoutMs: TIMEOUT_MS,
      })
    }

    if (!ok(upstream)) {
      // No retransmitir el cuerpo del error del upstream — solo el status
      return new NextResponse(null, { status: upstream.status || 502 })
    }

    const contentType = upstream.headers['content-type'] ?? ''
    if (!contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
      return NextResponse.json({ error: 'Not an image' }, { status: 415 })
    }

    const buffer = upstream.body
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
        // y re-procesar (sharp) la misma imagen.
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
