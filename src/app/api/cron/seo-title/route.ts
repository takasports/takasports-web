// GET/POST /api/cron/seo-title
//
// Rellena el `seoTitle` de los artículos que no lo tienen. Sustituye al cron del
// Mac (`~/.taka/run-seo.sh`), que dependía de que Docker estuviera levantado para
// sacar los tokens del contenedor de n8n: si el Mac se apagaba, NINGÚN artículo
// recibía título de Google y solo se enteraba un log local.
//
// Auth idéntica al resto de crons: header `x-cron-secret` o
// `Authorization: Bearer <CRON_SECRET>` (que es lo que envía Vercel Cron).
//
// Pruebas sin escribir nada:
//   curl -H "x-cron-secret: $CRON_SECRET" 'https://.../api/cron/seo-title?dry=1'
//
// Necesita `SANITY_TOKEN` y `OPENAI_API_KEY` en el proyecto de Vercel. Si faltan
// devuelve 503 con el motivo, en vez de fallar en silencio como hacía el Mac.

import { NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { rellenarSeoTitles, LIMITE_POR_PASADA } from '@/lib/seo-title'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  if (!process.env.SANITY_TOKEN || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      ok: false,
      error: 'faltan variables',
      falta: [
        !process.env.SANITY_TOKEN ? 'SANITY_TOKEN' : null,
        !process.env.OPENAI_API_KEY ? 'OPENAI_API_KEY' : null,
      ].filter(Boolean),
      nota: 'Mientras falten, el cron del Mac sigue siendo el único que rellena seoTitle.',
    }, { status: 503 })
  }

  const url = new URL(req.url)
  const seco = url.searchParams.get('dry') === '1'
  const limRaw = Number(url.searchParams.get('limit'))
  const limite = Number.isFinite(limRaw) && limRaw > 0 ? Math.min(limRaw, 40) : LIMITE_POR_PASADA

  // `probe=1` solo tiene efecto junto a `dry=1`: sirve para comprobar que la
  // generación funciona cuando NO hay artículos pendientes (que es lo normal si
  // el cron va al día). Nunca escribe.
  const ensayoSobreExistentes = seco && url.searchParams.get('probe') === '1'

  try {
    const r = await rellenarSeoTitles({ seco, limite, ensayoSobreExistentes })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

export async function GET(req: Request) { return handle(req) }
export async function POST(req: Request) { return handle(req) }
