// Renueva el token largo de Instagram sin login y lo persiste en Supabase.
// Llamable a mano o por cron (Graph permite refrescar tokens de 24h-60d).

import { refreshIgToken } from '@/lib/ig-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const r = await refreshIgToken()
  return Response.json(r, { status: r.ok ? 200 : 502 })
}
