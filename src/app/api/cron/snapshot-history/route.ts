// Cron lunes 10:00 — graba snapshot semanal en ranking_score_history.
// Llamar después del cron de ingest (que escribe los nuevos score_auto).
//
// Auth: Bearer CRON_SECRET, header x-cron-secret, o ?secret= para pruebas.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'

export async function GET(req: NextRequest) {
  const secretParam = new URL(req.url).searchParams.get('secret')
  const okSecret = !!process.env.CRON_SECRET &&
    (secretParam === process.env.CRON_SECRET ||
     checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET))
  if (!okSecret) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'Supabase admin no configurado' }, { status: 503 })

  const { data, error } = await sb.rpc('f_ranking_history_snapshot')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rows: data, week: new Date().toISOString().slice(0, 10) })
}
