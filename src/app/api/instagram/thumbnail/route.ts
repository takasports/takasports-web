// Proxy de thumbnails de Instagram CDN
// Necesario porque el CDN requiere Referer: https://www.instagram.com/

export const runtime = 'nodejs'

// Dominios base del CDN de Instagram/Meta. Validamos por SUFIJO EXACTO de
// dominio (no `includes`): antes `includes('scontent')` dejaba pasar hosts como
// `scontent.evil.com` (SSRF). Solo se admiten estos dominios (no IPs).
const ALLOWED_HOSTS = ['cdninstagram.com', 'fbcdn.net']

function hostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return ALLOWED_HOSTS.some((base) => h === base || h.endsWith('.' + base))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
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
        headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30' },
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
    return new Response('Error', { status: 500, headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30' } })
  }
}
