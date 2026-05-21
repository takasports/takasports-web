import { NextRequest, NextResponse } from 'next/server'
import { pingIndexNow } from '@/lib/indexnow'

// POST /api/indexnow — acepta { urls: string[] } y notifica a Bing/Yandex.
// Útil desde n8n o llamadas manuales. Para automático al publicar en Sanity,
// el webhook /api/sanity-webhook ya invoca pingIndexNow directamente.
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

  const result = await pingIndexNow(urls)
  return NextResponse.json(
    { submitted: result.submitted, bingStatus: result.status, ok: result.ok },
    { status: result.ok ? 200 : 502 },
  )
}

// GET /api/indexnow?url=https://... — ping rápido de una sola URL.
// Útil para invocar manualmente desde Telegram o n8n con un GET simple.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url param required' }, { status: 400 })

  const result = await pingIndexNow([url])
  return NextResponse.json({ url, bingStatus: result.status, ok: result.ok })
}
