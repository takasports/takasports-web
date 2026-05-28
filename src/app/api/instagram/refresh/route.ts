// Renueva el token largo de Instagram sin login y lo persiste en Supabase.
// Llamable a mano o por cron (Graph permite refrescar tokens de 24h-60d).
// Protegido con CRON_SECRET via Authorization: Bearer o x-cron-secret.

import { NextRequest } from 'next/server'
import { refreshIgToken } from '@/lib/ig-token'
import { checkBearerOrHeader } from '@/lib/auth-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Fail-cerrado: si CRON_SECRET está configurado, exigirlo.
  // En dev sin CRON_SECRET se permite pasar para facilitar pruebas locales.
  const secret = process.env.CRON_SECRET
  if (secret && !checkBearerOrHeader(req, 'x-cron-secret', secret)) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const r = await refreshIgToken()
  return Response.json(r, { status: r.ok ? 200 : 502 })
}
