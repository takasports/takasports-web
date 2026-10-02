// Proxy de thumbnails de Instagram CDN
// Necesario porque el CDN requiere Referer: https://www.instagram.com/
//
// Dos formas de pedirlo:
//   ?url=<URL firmada del CDN>  → la de siempre. Caduca con el `oe` de la firma.
//   ?sc=<código corto del reel> → NO caduca: pide a Instagram una firma nueva
//                                  (instagram.com/p/<código>/media/), sin token.
//                                  Es la reserva cuando la copia en Storage falta.

import { igHostAllowed as hostAllowed, fetchThumbByShortcode, SC_RE } from '@/lib/ig-media'

export const runtime = 'nodejs'

const ERR_CACHE = { 'Cache-Control': 'public, max-age=0, s-maxage=30' }

async function byShortcode(sc: string): Promise<Response> {
  if (!SC_RE.test(sc)) return new Response('Invalid sc', { status: 400 })
  const img = await fetchThumbByShortcode(sc)
  if (!img) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300' } })
  // Los BYTES no caducan (lo que caduca es la firma de la URL de Instagram), así
  // que el CDN puede guardarlos días. Un día fresco + una semana de respaldo.
  return new Response(img.body, {
    headers: {
      'Content-Type': img.contentType,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sc = searchParams.get('sc')
  if (sc) return byShortcode(sc)

  const url = searchParams.get('url')

  if (!url) return new Response('Missing url', { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return new Response('Invalid url', { status: 400 })
  }

  if (!hostAllowed(parsed.hostname)) return new Response('Forbidden', { status: 403 })

  async function fetchImage() {
    return fetch(url!, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer':    'https://www.instagram.com/',
        'Accept':     'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    })
  }

  try {
    let res = await fetchImage()
    // Instagram limita por IP: al cargar el home se piden ~16 thumbnails de la
    // misma IP de Vercel y rechaza varias (403/429). Reintento una vez con una
    // pausa breve para esquivar el burst.
    if ((res.status === 403 || res.status === 429)) {
      await new Promise(r => setTimeout(r, 350))
      res = await fetchImage()
    }

    if (!res.ok) {
      // No cacheamos el error en el CDN (cache corto) para que se reintente pronto.
      return new Response('CDN error', {
        status: res.status,
        headers: ERR_CACHE,
      })
    }

    const buf = await res.arrayBuffer()
    const ct  = res.headers.get('content-type') ?? 'image/jpeg'

    // s-maxage hace que el CDN de Vercel cachee la imagen (antes solo cacheaba
    // el navegador → cada visita re-golpeaba a Instagram y disparaba el
    // rate-limit). Las URLs de IG cambian con cada refresco de reels.json, así
    // que cachear por-URL una semana es seguro y elimina los thumbnails en blanco.
    return new Response(buf, {
      headers: {
        'Content-Type':  ct,
        'Cache-Control': 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=604800',
      },
    })
  } catch (err) {
    console.error('[thumbnail proxy]', err)
    return new Response('Error', { status: 500, headers: ERR_CACHE })
  }
}
