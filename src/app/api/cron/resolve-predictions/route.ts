// Cron lunes 10:30 — resuelve predicciones de la semana que cierra (esta).
import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { sendTelegram } from '@/lib/telegram'

export async function GET(req: NextRequest) {
  // Auth: solo Bearer CRON_SECRET o header x-cron-secret (comparación en tiempo
  // constante). El antiguo `?secret=` queda eliminado: se filtraba en logs/referer.
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'no admin' }, { status: 503 })
  const { data, error } = await sb.rpc('f_resolve_predictions')
  if (error) {
    await sendTelegram(
      `⚠️ resolve-predictions: f_resolve_predictions falló — ${String(error.message).replace(/[<>]/g, '')}`,
    )
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ resolved: data })
}
