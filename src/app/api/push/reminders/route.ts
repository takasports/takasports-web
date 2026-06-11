// Fase G·1 — Registro de recordatorios de partido del calendario.
// El cliente, al activar la campana, primero se suscribe a push
// (/api/push/subscribe, topic 'calendario') y luego registra aquí el partido.
// Escribimos con service role (adminSupabase) → la tabla match_reminders está
// cerrada a anónimos por RLS; solo esta ruta y el cron la tocan.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

interface ReminderInput {
  endpoint: string
  matchRef: string
  kickoffIso: string
  home: string
  away?: string | null
  comp?: string | null
  url?: string | null
}

export async function POST(req: NextRequest) {
  // Rate-limit por IP: hasta 60 altas/hora (un usuario puede marcar varios
  // partidos, pero no miles).
  const rl = await checkRateLimit({
    bucket: 'match_reminder',
    key: getClientIp(req),
    windowSeconds: 3600,
    max: 60,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfter: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  try {
    const b = await req.json() as ReminderInput
    if (!b?.endpoint || !b?.matchRef || !b?.kickoffIso || !b?.home) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 })
    }
    // No registrar recordatorios para fechas pasadas o absurdamente lejanas.
    const t = Date.parse(b.kickoffIso)
    if (!Number.isFinite(t) || t < Date.now() - 60_000 || t > Date.now() + 60 * 24 * 60 * 60_000) {
      return NextResponse.json({ error: 'bad_kickoff' }, { status: 400 })
    }

    const sb = adminSupabase()
    if (!sb) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

    // La suscripción debe existir (el cliente la crea antes). Evita reminders
    // huérfanos sin claves a las que enviar.
    const { data: sub } = await sb
      .from('push_subscriptions')
      .select('endpoint')
      .eq('endpoint', b.endpoint)
      .maybeSingle()
    if (!sub) return NextResponse.json({ error: 'no_subscription' }, { status: 409 })

    const { error } = await sb.from('match_reminders').upsert({
      endpoint: b.endpoint,
      match_ref: b.matchRef,
      kickoff_iso: new Date(t).toISOString(),
      home: b.home,
      away: b.away ?? null,
      comp: b.comp ?? null,
      url: b.url ?? null,
      notified: false,
    }, { onConflict: 'endpoint,match_ref' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint, matchRef } = await req.json() as { endpoint?: string; matchRef?: string }
    if (!endpoint || !matchRef) return NextResponse.json({ error: 'invalid' }, { status: 400 })
    const sb = adminSupabase()
    if (!sb) return NextResponse.json({ error: 'not_configured' }, { status: 503 })
    await sb.from('match_reminders').delete().eq('endpoint', endpoint).eq('match_ref', matchRef)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}
