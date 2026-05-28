// POST   /api/admin/games/content   -> upsert content (draft|published)
// DELETE /api/admin/games/content   -> elimina la fila (cleanup)
// GET    /api/admin/games/content   -> lista las últimas 100 entradas
//
// Auth: cabecera `x-admin-token` debe coincidir con env GAMES_ADMIN_TOKEN.
// Escribe vía service_role (bypassea RLS) — mismo patrón que rankings.
// Pensado para uso desde:
//   · /admin/games (UI)
//   · n8n cron (publish programático)

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/admin-auth'

const GAME_IDS = ['quiniela', 'crackquiz', 'mionce', 'sopacracks', 'takagrid', 'strikerrush'] as const
type GameId = typeof GAME_IDS[number]

async function authOk(req: NextRequest): Promise<boolean> {
  return isAdminRequest(req, {
    headerName: 'x-admin-token',
    tokenEnv: process.env.GAMES_ADMIN_TOKEN,
  })
}

interface ContentBody {
  game_id: GameId
  period:  string
  payload: Record<string, unknown>
  status?: 'draft' | 'published'
}

export async function POST(req: NextRequest) {
  if (!(await authOk(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 503 })

  let body: ContentBody
  try { body = await req.json() as ContentBody }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  if (!body.game_id || !GAME_IDS.includes(body.game_id))
    return NextResponse.json({ error: 'invalid game_id' }, { status: 400 })
  if (!body.period || typeof body.period !== 'string')
    return NextResponse.json({ error: 'period required' }, { status: 400 })
  if (!body.payload || typeof body.payload !== 'object')
    return NextResponse.json({ error: 'payload required' }, { status: 400 })

  const status = body.status === 'published' ? 'published' : 'draft'

  const { data, error } = await sb.from('game_content').upsert({
    game_id: body.game_id,
    period:  body.period,
    payload: body.payload,
    status,
  }, { onConflict: 'game_id,period' }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, content: data })
}

export async function DELETE(req: NextRequest) {
  if (!(await authOk(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 503 })

  const url = new URL(req.url)
  const game   = url.searchParams.get('game')
  const period = url.searchParams.get('period')
  if (!game || !period) return NextResponse.json({ error: 'game and period required' }, { status: 400 })

  const { error } = await sb.from('game_content').delete()
    .eq('game_id', game).eq('period', period)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  if (!(await authOk(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 503 })

  const url = new URL(req.url)
  const game = url.searchParams.get('game')

  let q = sb.from('game_content')
    .select('game_id, period, status, payload, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)
  if (game) q = q.eq('game_id', game)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}
