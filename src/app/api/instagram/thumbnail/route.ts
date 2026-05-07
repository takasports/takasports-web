// Proxy de thumbnails de Instagram CDN
// Necesario porque el CDN requiere Referer: https://www.instagram.com/

export const runtime = 'nodejs'

const ALLOWED_HOSTS = ['cdninstagram.com', 'scontent', 'fbcdn.net']

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

  const allowed = ALLOWED_HOSTS.some(h => parsed.hostname.includes(h))
  if (!allowed) return new Response('Forbidden', { status: 403 })

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer':    'https://www.instagram.com/',
        'Accept':     'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    })

    if (!res.ok) return new Response('CDN error', { status: res.status })

    const buf = await res.arrayBuffer()
    const ct  = res.headers.get('content-type') ?? 'image/jpeg'

    return new Response(buf, {
      headers: {
        'Content-Type':  ct,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    console.error('[thumbnail proxy]', err)
    return new Response('Error', { status: 500 })
  }
}
