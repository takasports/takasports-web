// Webhook de alta rápida de reels — pensado para un Atajo de iOS.
//
// El usuario publica el reel a mano en Instagram (como siempre), pulsa
// Compartir → atajo "Taka", y este endpoint crea el reel en Sanity.
// NO toca Instagram: solo guarda el link público que tú envías. Cero
// conexión a la cuenta, cero riesgo de baneo.
//
// Uso desde el atajo (POST JSON o GET con query):
//   POST /api/reels/ingest
//   { "secret": "...", "url": "https://www.instagram.com/reel/XXXX/",
//     "title": "opcional", "sport": "futbol|ufc|wwe|..." }
//
// Env requeridas (en Vercel):
//   REELS_INGEST_SECRET     secreto compartido con el atajo
//   SANITY_WRITE_TOKEN      token de escritura de Sanity (Editor)
//   NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET

import { createClient } from '@sanity/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SPORTS = ['futbol', 'baloncesto', 'formula1', 'tenis', 'ufc', 'wwe', 'rugby']

function extractCode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/i)
  return m ? m[1] : null
}

function slugify(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

async function handle(params: {
  secret?: string; url?: string; title?: string; sport?: string
}) {
  const SECRET = process.env.REELS_INGEST_SECRET
  if (!SECRET || params.secret !== SECRET) {
    return Response.json({ ok: false, error: 'no autorizado' }, { status: 401 })
  }

  const url = (params.url ?? '').trim()
  const code = url && extractCode(url)
  if (!code) {
    return Response.json({ ok: false, error: 'URL de reel no válida' }, { status: 400 })
  }

  const token = process.env.SANITY_WRITE_TOKEN
  if (!token) {
    return Response.json({ ok: false, error: 'falta SANITY_WRITE_TOKEN' }, { status: 500 })
  }

  const cleanUrl = `https://www.instagram.com/reel/${code}/`
  const title = (params.title ?? '').trim() || `Reel ${code.slice(0, 8)}`
  const sport = params.sport && SPORTS.includes(params.sport) ? params.sport : undefined

  const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
    apiVersion: '2024-01-01',
    token,
    useCdn: false,
  })

  const _id = `reel-${code.slice(0, 12)}`
  try {
    await client.createOrReplace({
      _id,
      _type: 'reel',
      title,
      ...(sport ? { sport } : {}),
      instagram_url: cleanUrl,
      slug: { _type: 'slug', current: slugify(title) || _id },
      publishedAt: new Date().toISOString(),
    })
    return Response.json({ ok: true, id: _id, url: cleanUrl, sport: sport ?? null })
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : 'error Sanity' },
      { status: 502 },
    )
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  return handle(body)
}

// GET para que el atajo pueda usar una sola URL si se prefiere.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  return handle({
    secret: q.get('secret') ?? undefined,
    url:    q.get('url') ?? undefined,
    title:  q.get('title') ?? undefined,
    sport:  q.get('sport') ?? undefined,
  })
}
