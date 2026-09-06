// GET /api/cron/warm-events
//
// Mantiene CALIENTE la caché de los endpoints de eventos que consume la app.
//
// POR QUÉ EXISTE. El calendario de la app salía vacío en el móvil. La causa no
// era la app: `/api/events/feed` tarda ~21 s cuando la caché está fría (pide a
// ESPN el rango de 21 días y cruza tres tablas de Supabase), y el calendario se
// rinde a los 15 s y degrada a lista vacía. Con unas 3 visitas/hora hay huecos
// de sobra —toda la noche— para que la caché caduque y le toque esperar al
// primero que abra la app por la mañana.
//
// La ventana de `stale-while-revalidate` del feed ya evita que nadie ESPERE.
// Esto es la otra mitad: pedirlo cada 10 minutos para que lo que se sirve nunca
// sea viejo. Sin este cron, quien abra la app tras una noche sin visitas vería
// el calendario al instante, sí, pero con datos de horas antes.
//
// Es una petición HTTP a la URL pública a propósito: lo que hay que rellenar es
// la caché del CDN, que es la que ven los usuarios, no la caché de datos de la
// función.

import { NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Lo que pide el calendario de la app al abrirse. */
const RUTAS = ['/api/events/feed', '/api/events/live', '/api/events/today', '/api/events/upcoming']

function baseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL
  if (env) return env.replace(/\/$/, '')
  // En Vercel `VERCEL_URL` es el dominio del despliegue; sin él, el propio host.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return new URL(req.url).origin
}

export async function GET(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  }

  const base = baseUrl(req)
  const resultados = await Promise.all(
    RUTAS.map(async (ruta) => {
      const t0 = Date.now()
      try {
        const res = await fetch(`${base}${ruta}`, {
          headers: { 'user-agent': 'taka-warm-events' },
          cache: 'no-store',
          signal: AbortSignal.timeout(55_000),
        })
        return {
          ruta,
          estado: res.status,
          ms: Date.now() - t0,
          // Delata si el CDN sirvió de caché o si tocó recalcular.
          cache: res.headers.get('x-vercel-cache') ?? null,
        }
      } catch (e) {
        return { ruta, estado: 0, ms: Date.now() - t0, error: (e as Error).message }
      }
    }),
  )

  const fallos = resultados.filter((r) => r.estado !== 200)
  return NextResponse.json(
    { ok: fallos.length === 0, resultados },
    { status: fallos.length === RUTAS.length ? 503 : 200 },
  )
}
