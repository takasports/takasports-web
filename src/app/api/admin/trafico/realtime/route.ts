// GET /api/admin/trafico/realtime[?p=app]
// Tiempo real de GA4 (usuarios activos ahora, por ubicación y pantalla) para el
// bloque "en vivo" de /admin/trafico. Sin `?p=app` → propiedad WEB ("Deportes");
// con `?p=app` → propiedad APP ("taka-eef70"). Se refresca solo cada ~25s.
// Protegido: sesión Supabase + allowlist ADMIN_EMAILS.

import { NextResponse, type NextRequest } from 'next/server'
import { isAdminUser } from '@/lib/admin-auth'
import { getGa4Realtime, getAppGa4Realtime } from '@/lib/traffic'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const isApp = req.nextUrl.searchParams.get('p') === 'app'
  const rt = isApp ? await getAppGa4Realtime() : await getGa4Realtime()
  return NextResponse.json(rt, { headers: { 'cache-control': 'no-store' } })
}
