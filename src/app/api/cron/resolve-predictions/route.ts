// Cron lunes 10:30 — resuelve predicciones de la semana que cierra (esta).
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
  if (!sb) return NextResponse.json({ error: 'no admin' }, { status: 503 })
  const { data, error } = await sb.rpc('f_resolve_predictions')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resolved: data })
}
