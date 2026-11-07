// POST /api/quiniela/chat/report  { id, reason? }
// Reportar un mensaje del chat de ligas. Requiere sesión y ser miembro de la liga:
// el mensaje se lee con la RLS del usuario, así que a un no-miembro le da 404.
// Un usuario reporta un mensaje una sola vez (unique en la tabla). Con
// CHAT_HIDE_AT reportes distintos, el GET del chat deja de servirlo.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { getUserFromRequest, supabaseForRequest } from '@/lib/supabase-server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit({
    bucket: 'chat_report',
    key: getClientIp(req),
    windowSeconds: 3600,
    max: 30,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfter: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  let body: { id?: unknown; reason?: unknown } = {}
  try { body = await req.json() } catch { /* se valida abajo */ }
  const id = typeof body.id === 'string' ? body.id : ''
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 200) : null
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

  const { supabase: sb } = await supabaseForRequest(req)
  const { data: visible } = await sb
    .from('quiniela_league_chat')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!visible) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 })

  const { error: insertErr } = await admin
    .from('quiniela_league_chat_reports')
    .insert({ message_id: id, reporter_id: user.id, reason })
  if (insertErr) {
    if (insertErr.code === '23505') return NextResponse.json({ ok: true, alreadyReported: true })
    console.error('[chat report POST]', insertErr)
    return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
  }

  // Se recuenta en vez de sumar 1: no hay carrera posible y no hace falta una RPC.
  const { count } = await admin
    .from('quiniela_league_chat_reports')
    .select('id', { count: 'exact', head: true })
    .eq('message_id', id)
  await admin.from('quiniela_league_chat').update({ flagged_count: count ?? 1 }).eq('id', id)

  return NextResponse.json({ ok: true })
}
