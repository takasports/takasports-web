import { NextRequest, NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/constants'

const INDEXNOW_KEY = '61076e72cd4e4151830368503d68e4ad'
const INDEXNOW_ENDPOINT = 'https://www.bing.com/indexnow'

// POST /api/indexnow — acepta { urls: string[] } y notifica a Bing instantáneamente.
// Llamar desde n8n o webhooks de Sanity al publicar artículos.
// Segurizado con INDEXNOW_SECRET env var para evitar abuso.
export async function POST(req: NextRequest) {
  const secret = process.env.INDEXNOW_SECRET
  if (secret) {
    const auth = req.headers.get('x-indexnow-secret')
    if (auth !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let urls: string[]
  try {
    const body = await req.json()
    urls = Array.isArray(body.urls) ? body.urls : []
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (urls.length === 0) {
    return NextResponse.json({ error: 'No URLs provided' }, { status: 400 })
  }

  // IndexNow acepta hasta 10,000 URLs por petición
  const batch = urls.slice(0, 10000)

  const payload = {
    host: new URL(SITE_URL).hostname,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: batch,
  }

  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  })

  return NextResponse.json({
    submitted: batch.length,
    bingStatus: res.status,
    ok: res.status === 200 || res.status === 202,
  }, { status: res.status === 200 || res.status === 202 ? 200 : 502 })
}

// GET /api/indexnow?url=https://... — ping rápido de una sola URL.
// Útil para invocar manualmente desde Telegram o n8n con un GET simple.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url param required' }, { status: 400 })

  const payload = {
    host: new URL(SITE_URL).hostname,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: [url],
  }

  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  })

  return NextResponse.json({
    url,
    bingStatus: res.status,
    ok: res.status === 200 || res.status === 202,
  })
}
