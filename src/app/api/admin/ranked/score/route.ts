// POST /api/admin/ranked/score
// Resuelve un partido y acredita puntos a los usuarios que acertaron.
// Protegido por CRON_SECRET (mismo mecanismo que los crons).
//
// Body:
//   { event_id: string, winner: '1'|'X'|'2', home_score?: number, away_score?: number }
//
// Uso desde Supabase SQL Editor o curl:
//   curl -X POST https://takasportsmedia.com/api/admin/ranked/score \
//     -H "x-cron-secret: <SECRET>" \
//     -H "content-type: application/json" \
//     -d '{"event_id":"wc26-espn-123","winner":"1","home_score":2,"away_score":0}'

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic'

interface ScoreBody {
  event_id:    string
  winner:      '1' | 'X' | '2'
  home_score?: number
  away_score?: number
}

export async function POST(req: NextRequest) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 503 })
  }

  let body: ScoreBody
  try {
    body = await req.json() as ScoreBody
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  if (!body?.event_id || !['1', 'X', '2'].includes(body.winner)) {
    return NextResponse.json({ ok: false, error: 'invalid_body — need event_id and winner (1|X|2)' }, { status: 400 })
  }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'admin_client_unavailable' }, { status: 503 })

  // Verificar que el evento existe y no está ya resuelto
  const { data: event } = await admin
    .from('ranked_events')
    .select('id, status, team_home, team_away')
    .eq('id', body.event_id)
    .single()

  if (!event) {
    return NextResponse.json({ ok: false, error: 'event_not_found' }, { status: 404 })
  }
  if ((event as { status: string }).status === 'resolved') {
    return NextResponse.json({ ok: false, error: 'event_already_resolved' }, { status: 409 })
  }

  // Llamar a la función SQL que hace todo el scoring
  const { data: credited, error } = await admin.rpc('score_ranked_prediction', {
    p_event_id:   body.event_id,
    p_winner:     body.winner,
    p_home_score: body.home_score ?? null,
    p_away_score: body.away_score ?? null,
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok:      true,
    event_id: body.event_id,
    winner:  body.winner,
    credited_count: credited,
  })
}

// GET — útil para listar partidos pendientes de resolver
export async function GET(req: NextRequest) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'admin_client_unavailable' }, { status: 503 })
  const sport = new URL(req.url).searchParams.get('sport') ?? 'mundial'

  const { data, error } = await admin
    .from('ranked_events')
    .select('id, team_home, team_away, event_date, status, featured, meta')
    .eq('sport', sport)
    .in('status', ['open', 'closed'])
    .order('event_date', { ascending: true })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, events: data ?? [] })
}
