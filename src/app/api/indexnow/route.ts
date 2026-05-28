import { NextRequest, NextResponse } from 'next/server'
import { pingIndexNow } from '@/lib/indexnow'
import { safeEqual } from '@/lib/auth-utils'

// Verifica x-indexnow-secret header. Falla cerrado si la env var no está definida en producción.
function checkSecret(req: NextRequest): NextResponse | null {
  const required = process.env.INDEXNOW_SECRET
  if (!required) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'endpoint not configured' }, { status: 503 })
    }
    return null // dev sin secret → permitido
  }
  const provided = req.headers.get('x-indexnow-secret') ?? ''
  if (!safeEqual(provided, required)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

// POST /api/indexnow — acepta { urls: string[] } y notifica a Bing/Yandex.
// Útil desde n8n o llamadas manuales. Para automático al publicar en Sanity,
// el webhook /api/sanity-webhook ya invoca pingIndexNow directamente.
// Requiere header x-indexnow-secret con INDEXNOW_SECRET.
export async function POST(req: NextRequest) {
  const authErr = checkSecret(req)
  if (authErr) return authErr

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
// Requiere header x-indexnow-secret con INDEXNOW_SECRET.
export async function GET(req: NextRequest) {
  const authErr = checkSecret(req)
  if (authErr) return authErr

  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url param required' }, { status: 400 })

  const result = await pingIndexNow([url])
  return NextResponse.json({ url, bingStatus: result.status, ok: result.ok })
}
