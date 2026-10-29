// GET /api/cron/agenda-noche
//
// «Mañana, viernes 30: 21 partidos · Villarreal–Espanyol 21:00 (DAZN) · …».
// Para los navegadores suscritos al tema `agenda` desde la página de cada día
// (AgendaNocheCta). Lógica en lib/agenda-noche y lib/agenda-noche-run.
//
// Corre cada hora en punto y solo avisa a quien en su zona son las 22:00, así
// que cada lector lo recibe a SU hora. Idempotente: el día avisado queda en
// `push_subscriptions.agenda_sent_for` (migración 138).
//
// ENCENDIDO por defecto (visto bueno del editor, 29/10/2026). Para apagarlo de
// urgencia: AGENDA_NOCHE_ENABLED=false en Vercel y redesplegar; entonces
// calcula y devuelve los textos sin enviar ni escribir nada.
//
// Auth: Bearer <CRON_SECRET> (Vercel) o header x-cron-secret.

import { NextRequest, NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { agendaNocheEnabled } from '@/lib/feature-flags'
import { enviarAgendaNoche } from '@/lib/agenda-noche-run'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  // Vista previa: `?ahora=2026-10-29T21:00:00Z[&zona=America/Mexico_City]`
  // calcula lo que saldría a esa hora con los partidos reales (para esa zona
  // aunque nadie de ella esté suscrito), SIN enviar ni escribir nada.
  const forzada = req.nextUrl.searchParams.get('ahora')
  const ahora = forzada ? new Date(forzada) : undefined
  if (ahora && Number.isNaN(ahora.getTime())) {
    return NextResponse.json({ ok: false, error: 'ahora inválida' }, { status: 400 })
  }
  const enviar = !ahora && agendaNocheEnabled()
  const zonaPrevia = ahora ? (req.nextUrl.searchParams.get('zona') ?? 'Europe/Madrid') : undefined
  const informe = await enviarAgendaNoche({ enviar, ahora, zonaPrevia })
  return NextResponse.json({
    ok: !informe.aviso,
    modo: enviar ? 'envio' : ahora ? 'vista previa (no se envía nada)' : 'simulacion (AGENDA_NOCHE_ENABLED=false: no se envía nada)',
    ...informe,
  })
}
