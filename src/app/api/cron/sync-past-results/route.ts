// POST/GET /api/cron/sync-past-results
// Llama a fetchEspnPastEvents y hace upsert en past_events.
// Pensado para ser invocado por:
//  - n8n cron diario
//  - Vercel Cron
//  - manualmente con curl + CRON_SECRET
//
// Auth: header `x-cron-secret` o query `?secret=` debe coincidir con env CRON_SECRET.

import { NextResponse } from 'next/server'
import { fetchEspnPastEvents } from '@/lib/espn'
import { upsertPastEvents, pastEventsConfigured } from '@/lib/past-events'

export const dynamic = 'force-dynamic'

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const url = new URL(req.url)
    const provided = req.headers.get('x-cron-secret') ?? url.searchParams.get('secret')
    if (provided !== secret) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
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
