// POST /api/games/events — recibe un batch de eventos de telemetría.
//
// Body: { events: [{ game_id, event_type, period?, meta?, anon_id? }, ...] }
//
// Insert directo a la tabla game_events. Si hay sesión, user_id se
// resuelve server-side; si no, se guarda solo anon_id. La política RLS
// "ge_insert_any" permite insertar siempre que user_id sea null o
// coincida con auth.uid().
//
// Idempotente desde el punto de vista del cliente: si el batch falla,
// reintenta. El servidor no deduplica (los eventos pueden repetirse;
// las vistas usan count distinct cuando importa).

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const GAME_IDS    = ['quiniela','crackquiz','mionce','sopacracks','takagrid','strikerrush'] as const
const EVENT_TYPES = ['started','completed','abandoned','shared','leaderboard_view'] as const
const MAX_BATCH   = 50

interface EventIn {
  game_id:    string
  event_type: string
  period?:    string
  meta?:      Record<string, unknown>
  anon_id?:   string
}

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function POST(req: NextRequest) {
  if (!hasSupabaseEnv()) return NextResponse.json({ accepted: 0, reason: 'unconfigured' })

  let body: { events?: EventIn[] }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const events = Array.isArray(body?.events) ? body.events : []
  if (events.length === 0)       return NextResponse.json({ accepted: 0 })
  if (events.length > MAX_BATCH) return NextResponse.json({ error: 'batch too large' }, { status: 400 })

  // Validación defensiva sin tirar el batch entero por una fila mala.
  const clean = events.filter(e =>
    GAME_IDS.includes(e.game_id as typeof GAME_IDS[number]) &&
    EVENT_TYPES.includes(e.event_type as typeof EVENT_TYPES[number])
  )
  if (clean.length === 0) return NextResponse.json({ accepted: 0 })

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()

  const rows = clean.map(e => ({
    user_id:    user?.id ?? null,
    game_id:    e.game_id,
    event_type: e.event_type,
    period:     e.period ?? null,
    meta:       e.meta ?? {},
    anon_id:    e.anon_id ?? null,
  }))

  const { error } = await sb.from('game_events').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accepted: rows.length })
}
