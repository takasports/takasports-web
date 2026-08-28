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
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { apiError } from '@/lib/api-utils'
import { sendPushToUser } from '@/lib/push-helper'

export const dynamic = 'force-dynamic'

// Ventana de urgencia: partidos que empiezan entre MIN y MAX minutos desde ahora.
const WINDOW_MIN_MIN = 30
const WINDOW_MAX_MIN = 90

// Límite de users a notificar por ejecución (seguridad anti-spam / timeout Vercel)
const MAX_NOTIFY_PER_RUN = 500

interface EventRow {
  id:        string
  team_home: string | null
  team_away: string | null
  event_date: string
}

export async function GET(req: NextRequest) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
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
    return apiError('server_error', 500, { ok: false })
  }
  if (!events || events.length === 0) {
    return NextResponse.json({ ok: true, events_found: 0, notified: 0 })
  }

  // 2. Candidatos: quien tiene push de navegador con topic 'quiniela' MÁS quien
  // tiene la app instalada. Antes solo se miraba push_subscriptions, así que el
  // recordatorio de predecir —la notificación más útil de la app— no salía nunca
  // del navegador. push_tokens no tiene topics: la app trae un único interruptor
  // de notificaciones, y quien lo activó pidió justo esto. [José Tomás, 28/08/2026]
  const [{ data: webSubs }, { data: appTokens }] = await Promise.all([
    admin.from('push_subscriptions').select('user_id').contains('topics', ['quiniela']),
    admin.from('push_tokens').select('user_id'),
  ])
  const candidatos = [...new Set(
    [...(webSubs ?? []), ...(appTokens ?? [])].map((r) => r.user_id as string),
  )]

  if (candidatos.length === 0) {
    return NextResponse.json({ ok: true, events_found: events.length, notified: 0, note: 'no_subs' })
  }

  let totalNotified = 0
  let totalApp      = 0
  let totalPruned   = 0

  for (const event of events as EventRow[]) {
    // 3. Users que YA predijeron este partido
    const { data: predicted } = await admin
      .from('ranked_predictions')
      .select('user_id')
      .eq('event_id', event.id)

    const predictedSet = new Set((predicted ?? []).map((p: { user_id: string }) => p.user_id))

    // 4. Filtrar: solo notificar los que NO han predicho
    const toNotify = candidatos
      .filter((uid) => !predictedSet.has(uid))
      .slice(0, MAX_NOTIFY_PER_RUN)

    if (toNotify.length === 0) continue

    const matchLabel = event.team_home && event.team_away
      ? `${event.team_home} vs ${event.team_away}`
      : 'el próximo partido'

    // Calcula minutos reales al partido
    const minsLeft = Math.round((new Date(event.event_date).getTime() - now.getTime()) / 60000)
    const timeStr  = minsLeft <= 60 ? `${minsLeft} min` : `${Math.round(minsLeft / 60)}h`

    // 5. Fan-out de push. sendPushToUser reparte a navegador y app, y purga por
    // su cuenta los endpoints y tokens muertos.
    const enviados = await Promise.allSettled(
      toNotify.map((uid) => sendPushToUser(uid, {
        title: `⏰ ${timeStr} para predecir`,
        body:  `${matchLabel} — ¡Cierra tu pick antes del pitazo!`,
        url:   '/predicciones',
        tag:   `mundial-reminder-${event.id}`,
        topic: 'quiniela',
      })),
    )
    for (const r of enviados) {
      if (r.status !== 'fulfilled') continue
      totalNotified += r.value.web.sent
      totalApp      += r.value.app.sent
      totalPruned   += r.value.pruned
    }
  }

  return NextResponse.json({
    ok:             true,
    events_found:   events.length,
    events:         (events as EventRow[]).map(e => e.id),
    notified:       totalNotified,
    notified_app:   totalApp,
    pruned:         totalPruned,
    subscribers:    candidatos.length,
  })
}
