// GET /api/cron/football-reminders
//
// Aviso de cierre de la Jornada. Corre cada 30 min (ver vercel.json).
//
// ── Uno por DÍA DE PARTIDOS, no uno por partido ────────────────────────────
// El equivalente del Mundial notifica cada partido sin pronosticar por
// separado. Allí colaba: eran pocos partidos al día y el torneo duraba un mes.
// Aquí eso dispararía una avalancha a la misma persona — la vía rápida a que
// desactive los avisos, o desinstale.
//
// El agrupado es por `meta.date_key` (DÍA), no por Jornada: una Jornada semanal
// reparte sus 7-9 partidos en varios días, así que se manda un aviso por cada
// día que tenga partidos (p. ej. sábado y domingo), con el Partidazo como
// gancho y cuántos picks faltan de ESE día. Es deliberado: un único aviso el
// lunes para una Jornada que se juega el fin de semana llegaría demasiado
// pronto para ser útil.
//
// Ventana 30-60 min antes del primer cierre del día: con el cron cada 30 min
// las ventanas se embaldosan sin solaparse, así que cada día recibe su aviso
// exactamente una vez. Es deliberado preferir perder un aviso (si una pasada
// del cron falla) a mandarlo dos veces.
//
// Auth: Bearer <CRON_SECRET>, como el resto de crons.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { apiError } from '@/lib/api-utils'
import { RANKED_FOOTBALL_SPORT } from '@/lib/football-ranked'
import { sendPushToUser } from '@/lib/push-helper'
import { SOCCER_LOCK_MS } from '@/components/ranked/soccer/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Ventana, en minutos antes del CIERRE de picks del primer partido del día. */
const WINDOW_MIN_MIN = 30
const WINDOW_MAX_MIN = 60

const MAX_NOTIFY_PER_RUN = 500

interface EventRow {
  id: string
  team_home: string | null
  team_away: string | null
  event_date: string
  featured: boolean
  meta: { date_key?: string } | null
}

export async function GET(req: NextRequest) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'admin_unavailable' }, { status: 503 })

  const now = Date.now()

  // Partidos abiertos de los próximos dos días: de ahí sacamos la Jornada cuyo
  // primer cierre cae en la ventana.
  const { data: rows, error } = await admin
    .from('ranked_events')
    .select('id, team_home, team_away, event_date, featured, meta')
    .eq('sport', RANKED_FOOTBALL_SPORT)
    .eq('status', 'open')
    .gte('event_date', new Date(now).toISOString())
    .lte('event_date', new Date(now + 48 * 3_600_000).toISOString())
    .order('event_date', { ascending: true })

  if (error) return apiError('server_error', 500, { ok: false })
  if (!rows || rows.length === 0) return NextResponse.json({ ok: true, fecha: null, notified: 0 })

  // Agrupar por día usando el date_key del servidor (nunca recalculándolo).
  const byDay = new Map<string, EventRow[]>()
  for (const r of rows as EventRow[]) {
    const key = r.meta?.date_key
    if (!key) continue
    const bucket = byDay.get(key)
    if (bucket) bucket.push(r)
    else byDay.set(key, [r])
  }

  // La Jornada cuyo PRIMER cierre entra en la ventana. El primer cierre es el
  // momento a partir del cual ya no se puede completar la Jornada entera, que es
  // justo lo que queremos avisar.
  let target: { dateKey: string; events: EventRow[]; lockAt: number } | null = null
  for (const [dateKey, events] of byDay) {
    const lockAt = Math.min(...events.map(e => Date.parse(e.event_date) - SOCCER_LOCK_MS))
    const minsToLock = (lockAt - now) / 60_000
    if (minsToLock >= WINDOW_MIN_MIN && minsToLock < WINDOW_MAX_MIN) {
      target = { dateKey, events, lockAt }
      break
    }
  }
  if (!target) return NextResponse.json({ ok: true, fecha: null, notified: 0 })

  // Candidatos: push de navegador con topic 'quiniela' MÁS quien tiene la app.
  // `push_tokens` no tiene topics —la app trae un único interruptor—, y este es
  // justo el aviso que ese interruptor promete. [José Tomás, 28/08/2026]
  const [{ data: webSubs }, { data: appTokens }] = await Promise.all([
    admin.from('push_subscriptions').select('user_id').contains('topics', ['quiniela']),
    admin.from('push_tokens').select('user_id'),
  ])
  const candidatos = [...new Set(
    [...(webSubs ?? []), ...(appTokens ?? [])].map((r) => r.user_id as string),
  )]

  if (candidatos.length === 0) {
    return NextResponse.json({ ok: true, fecha: target.dateKey, notified: 0, note: 'no_subs' })
  }

  // Cuántos partidos de la Jornada lleva pronosticados cada usuario. Solo se
  // avisa a quien NO la tiene completa: recordarle la Jornada a quien ya la
  // cerró es ruido puro.
  const eventIds = target.events.map(e => e.id)
  const { data: preds } = await admin
    .from('ranked_predictions')
    .select('user_id, event_id')
    .in('event_id', eventIds)

  const doneByUser = new Map<string, number>()
  for (const p of (preds ?? []) as { user_id: string }[]) {
    doneByUser.set(p.user_id, (doneByUser.get(p.user_id) ?? 0) + 1)
  }

  const total = target.events.length
  const toNotify = candidatos
    .filter((uid) => (doneByUser.get(uid) ?? 0) < total)
    .slice(0, MAX_NOTIFY_PER_RUN)

  if (toNotify.length === 0) {
    return NextResponse.json({ ok: true, fecha: target.dateKey, notified: 0, note: 'todos_al_dia' })
  }

  const star = target.events.find(e => e.featured) ?? target.events[0]
  const starLabel = star.team_home && star.team_away
    ? `${star.team_home} - ${star.team_away}`
    : 'el Partidazo'
  const mins = Math.max(1, Math.round((target.lockAt - now) / 60_000))

  let notified = 0
  let notifiedApp = 0
  let pruned = 0

  // sendPushToUser reparte a navegador y app y purga lo muerto por su cuenta.
  const enviados = await Promise.allSettled(
    toNotify.map((uid) => {
      const left = total - (doneByUser.get(uid) ?? 0)
      return sendPushToUser(uid, {
        title: `⏰ La Jornada cierra en ${mins} min`,
        body: `⭐ ${starLabel} · te ${left === 1 ? 'falta 1 pick' : `faltan ${left} picks`}`,
        url: '/predicciones',
        // Un tag por Jornada: si algo llegara repetido, el navegador reemplaza
        // en vez de apilar notificaciones.
        tag: `fecha-${target!.dateKey}`,
        topic: 'quiniela',
      })
    }),
  )
  for (const r of enviados) {
    if (r.status !== 'fulfilled') continue
    notified    += r.value.web.sent
    notifiedApp += r.value.app.sent
    pruned      += r.value.pruned
  }

  return NextResponse.json({
    ok: true,
    fecha: target.dateKey,
    matches: total,
    notified,
    notified_app: notifiedApp,
    pruned,
    subscribers: candidatos.length,
  })
}
