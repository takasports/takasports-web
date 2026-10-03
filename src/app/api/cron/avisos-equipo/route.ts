// GET /api/cron/avisos-equipo
//
// «Hoy juega tu Atlético · 21:00 vs Barcelona · LaLiga · DAZN» y, al acabar,
// «¡Gana tu Atlético! Atlético Madrid 2-1 Barcelona». Para quien tiene el
// equipo en favoritos (`team:<nombre>`, web o app). Lógica en lib/avisos-equipo.
//
// APAGADO por defecto: sin AVISOS_EQUIPO_ENABLED=true calcula lo que enviaría y
// lo devuelve en el JSON, sin enviar ni escribir nada. Es la forma de revisar
// los textos con partidos reales antes de encenderlo.
//
// Pensado para correr cada 15 min (la ventana del aviso del día es de 3 h a
// 15 min antes del saque, así que ninguna pasada se lo salta). Idempotente: el
// registro `avisos_equipo_log` (migración 136) garantiza un aviso por usuario y
// día, y un resultado por usuario y partido, aunque el cron se repita.
//
// Auth: Bearer <CRON_SECRET> (Vercel) o header x-cron-secret.

import { NextRequest, NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { avisosEquipoEnabled } from '@/lib/feature-flags'
import { calcularAvisosEquipo } from '@/lib/avisos-equipo-run'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const enviar = avisosEquipoEnabled()
  const informe = await calcularAvisosEquipo({ enviar })
  return NextResponse.json({
    ok: !informe.aviso || !enviar,
    modo: enviar ? 'envio' : 'simulacion (AVISOS_EQUIPO_ENABLED apagado: no se envía nada)',
    ...informe,
  })
}
