// ─────────────────────────────────────────────────────────────────
// Envío por TEMA a navegadores Y a la app.
//
// `sendPushToUser` manda a una persona; esto manda a todo el que pidió un tema
// (p. ej. `noticias:futbol`), tenga o no cuenta. Hasta ahora el único envío por
// tema era /api/push/send, que filtra los navegadores por tema pero manda a
// TODOS los móviles, porque `push_tokens` no tenía temas (migración 136).
// Aquí la app solo recibe si su token lleva ese tema: un móvil que no ha
// pedido noticias de fútbol no las recibe.
//
// No lanza: los fallos se devuelven contados, y los destinos muertos (404/410
// en navegador, DeviceNotRegistered en Expo) se purgan.
// ─────────────────────────────────────────────────────────────────

import webpush from 'web-push'
import { adminSupabase } from './supabase-admin'
import { initVapid } from './push-helper'
import { sendExpoPush } from './expo-push'

export interface TopicPayload {
  title: string
  body: string
  url: string
  tag?: string
}

interface Parcial { sent: number; pruned: number; failed: number; reason?: string }

export interface TopicResult {
  topic: string
  web: Parcial
  app: Parcial
}

const VACIO: Parcial = { sent: 0, pruned: 0, failed: 0 }

type Admin = NonNullable<ReturnType<typeof adminSupabase>>

/** Cuántos navegadores y móviles recibirían un envío a este tema (sin enviar). */
export async function audienciaDeTema(topic: string): Promise<{ web: number; app: number } | null> {
  const admin = adminSupabase()
  if (!admin) return null
  const [w, a] = await Promise.all([
    admin.from('push_subscriptions').select('endpoint', { count: 'exact', head: true }).contains('topics', [topic]),
    admin.from('push_tokens').select('token', { count: 'exact', head: true }).contains('topics', [topic]),
  ])
  // Si la columna `topics` de push_tokens aún no existe (migración 136 sin
  // aplicar), la consulta falla: la app cuenta 0, no tumba el cálculo.
  return { web: w.count ?? 0, app: a.error ? 0 : (a.count ?? 0) }
}

export async function sendPushToTopic(topic: string, payload: TopicPayload): Promise<TopicResult> {
  const admin = adminSupabase()
  if (!admin) return { topic, web: { ...VACIO, reason: 'no_supabase' }, app: { ...VACIO, reason: 'no_supabase' } }
  if (!topic || !payload?.title || !payload?.body) {
    return { topic, web: { ...VACIO, reason: 'no_payload' }, app: { ...VACIO, reason: 'no_payload' } }
  }
  const tag = payload.tag ?? topic
  const [web, app] = await Promise.all([
    enviarWeb(admin, topic, { ...payload, tag }),
    enviarApp(admin, topic, { ...payload, tag }),
  ])
  return { topic, web, app }
}

async function enviarWeb(admin: Admin, topic: string, p: TopicPayload & { tag: string }): Promise<Parcial> {
  if (!initVapid()) return { ...VACIO, reason: 'no_vapid' }
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .contains('topics', [topic])
  if (error) return { ...VACIO, reason: `query_failed: ${error.message}` }
  if (!subs || subs.length === 0) return { ...VACIO, reason: 'no_subs' }

  const body = JSON.stringify({ title: p.title, body: p.body, url: p.url, tag: p.tag })
  let sent = 0, failed = 0
  const muertos: string[] = []
  await Promise.allSettled(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as webpush.PushSubscription,
        body,
      )
      sent += 1
    } catch (err: unknown) {
      const code = (err as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) muertos.push(s.endpoint as string)
      else failed += 1
    }
  }))
  if (muertos.length > 0) {
    try { await admin.from('push_subscriptions').delete().in('endpoint', muertos) } catch { /* swallow */ }
  }
  return { sent, pruned: muertos.length, failed }
}

async function enviarApp(admin: Admin, topic: string, p: TopicPayload & { tag: string }): Promise<Parcial> {
  const { data: filas, error } = await admin
    .from('push_tokens')
    .select('token')
    .contains('topics', [topic])
  if (error) return { ...VACIO, reason: `query_failed: ${error.message}` }
  const tokens = (filas ?? []).map((f) => (f as { token: string }).token)
  if (tokens.length === 0) return { ...VACIO, reason: 'no_tokens' }

  const r = await sendExpoPush(tokens, { title: p.title, body: p.body, data: { url: p.url }, tag: p.tag })
  if (r.dead.length > 0) {
    try { await admin.from('push_tokens').delete().in('token', r.dead) } catch { /* swallow */ }
  }
  return { sent: r.sent, pruned: r.dead.length, failed: r.failed, reason: r.reason }
}
