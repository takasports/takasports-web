// Cron horario — refresca la foto materializada `ranking_view`.
//
// ranking_view dejó de ser una vista (se recalculaba ~375ms en cada lectura,
// ~65% del tiempo de la BD) y pasó a ser una MATERIALIZED VIEW: las lecturas
// son ahora un index lookup sub-ms, pero hay que rehacer la "foto" cuando los
// datos cambian. Este cron la refresca cada hora, lo que cubre por igual la
// ingesta semanal, las ediciones del admin y los ~12 scripts de mantenimiento
// que escriben directo en ranking_entries (ingest/override además refrescan al
// instante). El REFRESH lo hace la función refresh_ranking_view() (service_role).
//
// Auth: solo Bearer CRON_SECRET o header x-cron-secret.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { apiError } from '@/lib/api-utils'

export async function GET(req: NextRequest) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'Supabase admin no configurado' }, { status: 503 })

  const { error } = await sb.rpc('refresh_ranking_view')
  if (error) return apiError('server_error', 500)

  return NextResponse.json({ ok: true, refreshed: 'ranking_view', at: new Date().toISOString() })
}
