// Proxy de videos de Instagram CDN — con soporte de Range requests para seeking
// El CDN de Instagram requiere Referer: https://www.instagram.com/

export const runtime = 'nodejs'

const ALLOWED_HOSTS = ['cdninstagram.com', 'scontent', 'fbcdn.net']

const IG_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer':    'https://www.instagram.com/',
  'Origin':     'https://www.instagram.com',
  'Accept':     '*/*',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) return new Response('Missing url', { status: 400 })

  let parsed: URL
  try { parsed = new URL(url) } catch { return new Response('Invalid url', { status: 400 }) }

  if (!ALLOWED_HOSTS.some(h => parsed.hostname.includes(h))) {
    return new Response('Forbidden', { status: 403 })
  }

  // Pasar el header Range del cliente al CDN (necesario para seeking)
  const rangeHeader = request.headers.get('range')
  const upstream: HeadersInit = { ...IG_HEADERS }
  if (rangeHeader) (upstream as Record<string, string>)['Range'] = rangeHeader

  try {
    const res = await fetch(url, { headers: upstream })

    if (!res.ok && res.status !== 206) {
      return new Response('CDN error', { status: res.status })
    }

    const headers: Record<string, string> = {
      'Content-Type':  res.headers.get('content-type')  ?? 'video/mp4',
      'Cache-Control': 'public, max-age=3600',
      'Accept-Ranges': 'bytes',
    }

    const cl = res.headers.get('content-length')
    if (cl) headers['Content-Length'] = cl

    const cr = res.headers.get('content-range')
    if (cr) headers['Content-Range'] = cr

    return new Response(res.body, {
      status:  res.status, // 200 o 206 Partial Content
      headers,
    })
  } catch (err) {
    console.error('[video proxy]', err)
    return new Response('Error', { status: 500 })
  }
}
