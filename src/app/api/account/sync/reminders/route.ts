// /api/account/sync/reminders — sincroniza los recordatorios de eventos entre el
// navegador (localStorage `ts_reminders` + `ts_reminders_data`) y la cuenta
// (tabla reminders). POST sube los recordatorios que manda el cliente
// (merge invitado→cuenta) y devuelve la lista fusionada; DELETE quita uno.
//
// Mismo candado que el resto de /api/account: autentica por cookie; sin sesión
// 401. Escribe con service_role (la RLS de reminders solo permite SELECT desde
// cliente), siempre filtrando por el user.id autenticado.
//
// OJO: la tabla `reminders` (recordatorios del usuario) es distinta de
// `match_reminders` (registro de push notifications, que gestiona /api/push/*).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const MAX_UPLOAD = 200

async function authed(req: NextRequest) {
  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return { error: NextResponse.json({ error: 'no_session' }, { status: 401 }) }
  const rl = await checkRateLimit({
    bucket: 'sync_reminders',
    key: `${getClientIp(req)}:${user.id}`,
    windowSeconds: 60,
    max: 60,
  })
  if (!rl.ok) {
    return { error: NextResponse.json(
      { error: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    ) }
  }
  const admin = adminSupabase()
  if (!admin) return { error: NextResponse.json({ error: 'service_unavailable' }, { status: 503 }) }
  return { user, admin }
}

export async function POST(req: NextRequest) {
  const a = await authed(req)
  if (a.error) return a.error
  const { user, admin } = a

  // 1) Subir los recordatorios que trae el cliente (merge aditivo).
  const body = await req.json().catch(() => null)
  const incoming: unknown[] = Array.isArray(body?.items) ? body.items : []
  const nowIso = new Date().toISOString()
  const rows = incoming
    .filter((it): it is { event_id: string; event_data: unknown } =>
      !!it && typeof (it as { event_id?: unknown }).event_id === 'string'
      && (it as { event_id: string }).event_id.length > 0
      && typeof (it as { event_data?: unknown }).event_data === 'object'
      && (it as { event_data?: unknown }).event_data !== null)
    .slice(0, MAX_UPLOAD)
    .map((it) => ({
      user_id:    user.id,
      event_id:   it.event_id,
      event_data: it.event_data,
      created_at: nowIso,
    }))

  if (rows.length > 0) {
    await admin.from('reminders').upsert(rows, { onConflict: 'user_id,event_id' })
  }

  // 2) Devolver la lista fusionada del usuario.
  const { data } = await admin
    .from('reminders')
    .select('event_id,event_data')
    .eq('user_id', user.id)

  const items = (data ?? []).map((r) => ({ event_id: r.event_id as string, event_data: r.event_data }))
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(req: NextRequest) {
  const a = await authed(req)
  if (a.error) return a.error
  const { user, admin } = a

  const body = await req.json().catch(() => null)
  const eventId = typeof body?.event_id === 'string' ? body.event_id : null
  if (!eventId) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  await admin.from('reminders').delete().eq('user_id', user.id).eq('event_id', eventId)
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
