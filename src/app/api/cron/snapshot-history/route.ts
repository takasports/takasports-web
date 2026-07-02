// Cron lunes 10:00 — graba snapshot semanal en ranking_score_history.
// Llamar después del cron de ingest (que escribe los nuevos score_auto).
//
// Auth: solo Bearer CRON_SECRET o header x-cron-secret.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { apiError } from '@/lib/api-utils'

export async function GET(req: NextRequest) {
  // Auth: solo Bearer CRON_SECRET o header x-cron-secret (comparación en tiempo
  // constante). El antiguo `?secret=` queda eliminado: se filtraba en logs/referer.
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'Supabase admin no configurado' }, { status: 503 })

  const { data, error } = await sb.rpc('f_ranking_history_snapshot')
  if (error) return apiError('server_error', 500)

  return NextResponse.json({ rows: data, week: new Date().toISOString().slice(0, 10) })
}
