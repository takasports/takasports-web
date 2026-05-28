// POST/GET /api/cron/sync-past-results
// Llama a fetchEspnPastEvents y hace upsert en past_events.
// Pensado para ser invocado por:
//  - n8n cron diario
//  - Vercel Cron
//  - manualmente con curl + CRON_SECRET
//
// Auth: header `x-cron-secret` o `Authorization: Bearer <CRON_SECRET>` (Vercel
// Cron lo envía automático). El antiguo `?secret=` queda eliminado (filtra en
// logs y referer).

import { NextResponse } from 'next/server'
import { fetchEspnPastEvents } from '@/lib/espn'
import { upsertPastEvents, pastEventsConfigured } from '@/lib/past-events'
import { checkBearerOrHeader } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic'

async function handle(req: Request) {
  // CRON_SECRET es obligatorio: si no está seteado, el endpoint queda cerrado.
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  if (!pastEventsConfigured()) {
    return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 503 })
  }

  const events = await fetchEspnPastEvents()
  const written = await upsertPastEvents(events)

  return NextResponse.json({ ok: true, fetched: events.length, written })
}

export async function GET(req: Request)  { return handle(req) }
export async function POST(req: Request) { return handle(req) }
