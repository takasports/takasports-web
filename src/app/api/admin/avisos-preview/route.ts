// GET /api/admin/avisos-preview[?formato=md]
//
// Ejemplos REALES (partidos de hoy, resultados recientes, noticias de la
// semana) de cada texto de aviso push, para aprobarlos antes de encender
// AVISOS_EQUIPO_ENABLED / AVISOS_NOTICIAS_ENABLED. No envía ni escribe nada.
// Incluye además lo que haría ahora mismo el cron de equipo (simulación).
//
// Auth: Bearer <CRON_SECRET> o header x-cron-secret, como el resto de admin.

import { NextRequest, NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { construirVistaPrevia, vistaPreviaMarkdown } from '@/lib/avisos-preview'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const vista = await construirVistaPrevia()
  if (req.nextUrl.searchParams.get('formato') === 'md') {
    return new NextResponse(vistaPreviaMarkdown(vista), {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  return NextResponse.json(vista, { headers: { 'Cache-Control': 'no-store' } })
}
