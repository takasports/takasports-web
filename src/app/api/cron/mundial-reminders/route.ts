// GET /api/cron/mundial-reminders
// Cron que corre cada 30 min durante junio y julio (ver vercel.json).
//
// Lógica:
//   1. Busca ranked_events del Mundial con status=open cuyo event_date
//      cae entre +30 min y +90 min desde ahora (ventana de urgencia).
//   2. Por cada partido encontrado, obtiene los user_ids de push_subscriptions
//      que AÚN NO tienen predicción para ese partido.
//   3. Envía push individual a cada uno: "tienes ~1h para predecir".
//
// Auth: Bearer <CRON_SECRET> (igual que el resto de crons).
// Fire-and-forget: si el push falla por un endpoint muerto, se purga en bg.

import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic'

// Ventana de urgencia: partidos que empiezan entre MIN y MAX minutos desde ahora.
const WINDOW_MIN_MIN = 30
const WINDOW_MAX_MIN = 90

// Límite de users a notificar por ejecución (seguridad anti-spam / timeout Vercel)
const MAX_NOTIFY_PER_RUN = 500

interface SubRow {
  user_id:  string
  endpoint: string
  p256dh:   string
  auth:     string
}

interface EventRow {
  id:        string
  team_home: string | null
  team_away: string | null
  event_date: string
}

// VAPID lazy init
let vapidReady: boolean | null = null
function initVapid(): boolean {
  if (vapidReady !== null) return vapidReady
  const pub  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (pub && priv) {
    try {
      webpush.setVapidDetails(
        process.env.VAPID_EMAIL ?? 'mailto:taka@takasports.com',
        pub,
        priv,
      )
      vapidReady = true
    } catch {
      vapidReady = false
    }
  } else {
    vapidReady = false
  }
  return vapidReady
}

export async function GET(req: NextRequest) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  if (!initVapid()) {
    return NextResponse.json({ ok: false, error: 'vapid_not_configured' }, { status: 503 })
  }

  const admin = adminSupabase()
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'admin_unavailable' }, { status: 503 })
  }

  const now      = new Date()
  const minDate  = new Date(now.getTime() + WINDOW_MIN_MIN * 60 * 1000)
  const maxDate  = new Date(now.getTime() + WINDOW_MAX_MIN * 60 * 1000)

  // 1. Partidos que empiezan en la ventana de urgencia
  const { data: events, error: evErr } = await admin
    .from('ranked_events')
    .select('id, team_home, team_away, event_date')
    .eq('sport', 'mundial')
    .eq('status', 'open')
    .gte('event_date', minDate.toISOString())
    .lte('event_date', maxDate.toISOString())

  if (evErr) {
    return NextResponse.json({ ok: false, error: evErr.message }, { status: 500 })
  }
  if (!events || events.length === 0) {
    return NextResponse.json({ ok: true, events_found: 0, notified: 0 })
  }

  // 2. Todos los suscriptores push (topic quiniela)
  const { data: allSubs } = await admin
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .contains('topics', ['quiniela'])

  if (!allSubs || allSubs.length === 0) {
    return NextResponse.json({ ok: true, events_found: events.length, notified: 0, note: 'no_subs' })
  }

  const subsByUser = new Map<string, SubRow[]>()
  for (const s of allSubs as SubRow[]) {
    const arr = subsByUser.get(s.user_id) ?? []
    arr.push(s)
    subsByUser.set(s.user_id, arr)
  }

  let totalNotified = 0
  let totalPruned   = 0
  const toPrune: string[] = []

  for (const event of events as EventRow[]) {
    // 3. Users que YA predijeron este partido
    const { data: predicted } = await admin
      .from('ranked_predictions')
      .select('user_id')
      .eq('event_id', event.id)

    const predictedSet = new Set((predicted ?? []).map((p: { user_id: string }) => p.user_id))

    // 4. Filtrar: solo notificar los que NO han predicho
    const toNotify = [...subsByUser.entries()]
      .filter(([uid]) => !predictedSet.has(uid))
      .slice(0, MAX_NOTIFY_PER_RUN)

    if (toNotify.length === 0) continue

    const matchLabel = event.team_home && event.team_away
      ? `${event.team_home} vs ${event.team_away}`
      : 'el próximo partido'

    // Calcula minutos reales al partido
    const minsLeft = Math.round((new Date(event.event_date).getTime() - now.getTime()) / 60000)
    const timeStr  = minsLeft <= 60 ? `${minsLeft} min` : `${Math.round(minsLeft / 60)}h`

    const payload = JSON.stringify({
      title: `⏰ ${timeStr} para predecir`,
      body:  `${matchLabel} — ¡Cierra tu pick antes del pitazo!`,
      url:   '/predicciones',
      tag:   `mundial-reminder-${event.id}`,
    })

    // 5. Fan-out de push
    await Promise.allSettled(
      toNotify.flatMap(([, subs]) =>
        subs.map(async s => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as webpush.PushSubscription,
              payload,
            )
            totalNotified++
          } catch (err: unknown) {
            const e = err as { statusCode?: number }
            if (e?.statusCode === 404 || e?.statusCode === 410) {
              toPrune.push(s.endpoint)
              totalPruned++
            }
          }
        })
      )
    )
  }

  // 6. Purga de endpoints muertos (best-effort)
  if (toPrune.length > 0) {
    try {
      await admin.from('push_subscriptions').delete().in('endpoint', toPrune)
    } catch { /* swallow */ }
  }

  return NextResponse.json({
    ok:             true,
    events_found:   events.length,
    events:         (events as EventRow[]).map(e => e.id),
    notified:       totalNotified,
    pruned:         totalPruned,
    subscribers:    allSubs.length,
  })
}
