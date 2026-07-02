// Fase G·1 — Cron de recordatorios de partido del calendario.
// Cada ~10 min (vercel.json): busca recordatorios cuyo kickoff cae en los
// próximos ~15 min y aún no se han avisado, manda el push y los marca.
// Funciona con la web cerrada (es lo que la campana NO lograba con setTimeout).
//
// Auth: Vercel manda Authorization: Bearer <CRON_SECRET>; aceptamos también el
// header x-cron-secret para pruebas manuales.

import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { adminSupabase } from '@/lib/supabase-admin'
import { apiError } from '@/lib/api-utils'

function initVapid(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_EMAIL ?? 'mailto:taka@takasports.com', pub, priv)
  return true
}

export async function GET(req: NextRequest) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!initVapid()) return NextResponse.json({ error: 'VAPID no configurado' }, { status: 503 })
  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'Supabase admin no configurado' }, { status: 503 })

  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  // Ventana de 20 min (antes 15): el cron pasó de cada 10 a cada 15 min, así que
  // ensanchamos la ventana para que ningún recordatorio caiga entre dos pasadas.
  // Cada aviso salta entre 5 y 20 min antes del inicio del partido.
  const windowEnd = new Date(now + 20 * 60_000).toISOString()

  // 1) Recordatorios a punto de empezar y aún sin avisar.
  const { data: due, error: dueErr } = await sb
    .from('match_reminders')
    .select('endpoint, match_ref, kickoff_iso, home, away, comp, url')
    .eq('notified', false)
    .gte('kickoff_iso', nowIso)
    .lte('kickoff_iso', windowEnd)
    .limit(500)
  if (dueErr) return apiError('server_error', 500)

  let sent = 0, pruned = 0, failed = 0
  if (due && due.length > 0) {
    // 2) Claves de las suscripciones implicadas.
    const endpoints = [...new Set(due.map(r => r.endpoint))]
    const { data: subs } = await sb
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('endpoint', endpoints)
    const keyByEndpoint = new Map((subs ?? []).map(s => [s.endpoint, s]))

    // 3) Enviar uno por recordatorio.
    for (const r of due) {
      const k = keyByEndpoint.get(r.endpoint)
      if (!k?.p256dh || !k?.auth) continue
      const mins = Math.max(1, Math.round((Date.parse(r.kickoff_iso) - now) / 60_000))
      const title = `🔔 ${r.home}${r.away ? ` vs ${r.away}` : ''}`
      const body = `Empieza en ~${mins} min${r.comp ? ` · ${r.comp}` : ''}`
      const payload = JSON.stringify({
        title, body,
        url: r.url ?? '/calendario',
        tag: `match-${r.match_ref}`,
      })
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: k.p256dh, auth: k.auth } } as webpush.PushSubscription,
          payload,
        )
        await sb.from('match_reminders').update({ notified: true }).eq('endpoint', r.endpoint).eq('match_ref', r.match_ref)
        sent++
      } catch (err: unknown) {
        const e = err as { statusCode?: number }
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          // Endpoint muerto → borra la suscripción (cascade limpia sus reminders).
          await sb.from('push_subscriptions').delete().eq('endpoint', r.endpoint)
          pruned++
        } else {
          failed++
        }
      }
    }
  }

  // 4) Limpieza: recordatorios cuyo partido ya pasó hace > 3 h.
  const cutoff = new Date(now - 3 * 60 * 60_000).toISOString()
  await sb.from('match_reminders').delete().lt('kickoff_iso', cutoff)

  return NextResponse.json({ due: due?.length ?? 0, sent, pruned, failed })
}
