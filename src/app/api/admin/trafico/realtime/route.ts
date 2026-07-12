// GET /api/admin/trafico/realtime
// Devuelve el tiempo real de GA4 (usuarios activos ahora, por ubicación y página)
// para que el bloque "en vivo" de /admin/trafico se refresque solo cada ~25s.
// Protegido: sesión Supabase + allowlist ADMIN_EMAILS (mismo candado que la página).

import { NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/admin-auth'
import { getGa4Realtime } from '@/lib/traffic'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const rt = await getGa4Realtime()
  return NextResponse.json(rt, { headers: { 'cache-control': 'no-store' } })
}
