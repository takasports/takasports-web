// POST /api/sanity-webhook
// Recibe notificaciones de Sanity cuando se publica/actualiza contenido
// y fuerza la revalidación on-demand de las rutas afectadas.
//
// Configuración en Sanity Dashboard:
//   https://www.sanity.io/manage/personal/project/43g1qwh9/api/webhooks
//   → New webhook
//   → URL: https://www.takasportsmedia.com/api/sanity-webhook
//   → Trigger on: create, update, delete
//   → Filter: _type == "article" || _type == "reel" || _type == "event"
//   → Secret: valor de SANITY_WEBHOOK_SECRET en .env.local
//   → HTTP method: POST
//
// Variable de entorno requerida (opcional pero recomendada):
//   SANITY_WEBHOOK_SECRET=<openssl rand -base64 32>

import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { pingIndexNow, pathsToUrls } from '@/lib/indexnow'

export const dynamic = 'force-dynamic'

// Rutas que se revalidan en cada publicación de contenido
const CONTENT_PATHS = [
  '/',
  '/noticias',
  '/futbol',
  '/baloncesto',
  '/formula1',
  '/tenis',
  '/ufc',
  '/rugby',
  '/wwe',
] as const

// Mapeo tipo Sanity → rutas adicionales específicas
const TYPE_EXTRA_PATHS: Record<string, string[]> = {
  reel:  ['/'],
  event: ['/calendario'],
}

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const hmac = createHmac('sha256', secret)
  hmac.update(body)
  const expected = 'sha256=' + hmac.digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  const secret = process.env.SANITY_WEBHOOK_SECRET

  // En producción exigimos el secret. Si no está configurado, devolvemos 503
  // en lugar de aceptar payloads sin firmar (lo contrario es un open relay
  // para forzar revalidaciones y pings de IndexNow).
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { ok: false, error: 'webhook_misconfigured' },
        { status: 503 },
      )
    }
    console.warn('[sanity-webhook] SANITY_WEBHOOK_SECRET not set (dev only)')
  }

  // Leer body como texto para verificar firma HMAC
  const rawBody = await req.text()

  if (secret) {
    const signature = req.headers.get('sanity-webhook-signature')
    if (!verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 })
    }
  }

  // Parsear payload
  let payload: { _type?: string; slug?: { current?: string }; status?: string } = {}
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const docType = payload._type ?? 'unknown'
  const slug    = payload.slug?.current
  const status  = payload.status

  const revalidated: string[] = []

  // Revalidar rutas comunes de contenido
  for (const path of CONTENT_PATHS) {
    revalidatePath(path)
    revalidated.push(path)
  }

  // Rutas específicas del tipo de documento
  const extras = TYPE_EXTRA_PATHS[docType] ?? []
  for (const path of extras) {
    if (!revalidated.includes(path)) {
      revalidatePath(path)
      revalidated.push(path)
    }
  }

  // Revalidar el artículo concreto si tenemos slug
  if (slug && (docType === 'article')) {
    const articlePath = `/noticias/${slug}`
    revalidatePath(articlePath)
    revalidated.push(articlePath)
  }

  console.log(`[sanity-webhook] revalidated ${revalidated.length} paths for ${docType}${slug ? ` (${slug})` : ''} status=${status ?? '?'}`)

  // Ping IndexNow (Bing/Yandex) — solo en publicaciones reales de artículos
  // con slug, para no inundar el endpoint con sobreescrituras intermedias o
  // cambios en reels/events que no son páginas indexables por sí solas.
  let indexnow: { submitted: number; status: number; ok: boolean } | null = null
  if (docType === 'article' && slug && status !== 'borrador' && status !== 'draft') {
    const urls = pathsToUrls([`/noticias/${slug}`, '/noticias', '/'])
    indexnow = await pingIndexNow(urls)
    console.log(`[sanity-webhook] indexnow submitted=${indexnow.submitted} status=${indexnow.status} ok=${indexnow.ok}`)
  }

  return NextResponse.json({
    ok: true,
    revalidated,
    docType,
    slug: slug ?? null,
    indexnow,
    ts: new Date().toISOString(),
  })
}

// Sanity puede hacer GET para verificar que el endpoint existe
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'sanity-webhook' })
}
