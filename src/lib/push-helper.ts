// ─────────────────────────────────────────────────────────────────
// Helper server-side para enviar push notifications a UN usuario
// específico (no broadcast). Útil para eventos personales:
//   · Quiniela settle → "Ganaste 250🪙"
//   · Goleador resuelto → "Tu jugador marcó · +100🪙"
//   · Booster aplicado, badge desbloqueado, etc.
//
// Patrón: fire-and-forget desde endpoints. La llamada NO bloquea el
// response — si el push falla por endpoint inválido, lo limpiamos en
// background. Si web-push o VAPID no están configurados, el helper
// devuelve { sent: 0 } sin error (modo dev sin push).
//
// Idempotencia: cada caller decide. Este helper NO previene envíos
// duplicados — el endpoint que llama debe asegurarse (ej. flag
// `settled` en quiniela_picks previene re-credit + re-push).
// ─────────────────────────────────────────────────────────────────

import webpush from 'web-push'
import { adminSupabase } from './supabase-admin'
import { sendExpoPush } from './expo-push'

interface SubRow {
  endpoint: string
  p256dh: string
  auth: string
}

interface PushPayload {
  title: string
  body: string
  /** URL a abrir al tocar el push. Default: '/quiniela'. */
  url?: string
  /** Tag de notificación — pushes con mismo tag se reemplazan en el dispositivo. */
  tag?: string
  /** Topic filter (default 'quiniela'). El user debe estar suscrito a este topic.
   *  `null` = NO filtrar: llega a todas sus suscripciones. Lo usan los avisos que
   *  el usuario ya pidió explícitamente marcando un favorito. */
  topic?: string | null
}

interface PushResult {
  /** Entregas totales: navegador + app. */
  sent: number
  pruned: number
  failed: number
  /** Desglose por destino, para saber por dónde llegó (y por dónde no). */
  web: { sent: number; pruned: number; failed: number; reason?: string }
  app: { sent: number; pruned: number; failed: number; reason?: string }
  /** Razón si nada se envió por NINGÚN lado — para debug. */
  reason?: string
}

// VAPID lazy init — evita crash en build si las env vars no están.
let vapidInitialized: boolean | null = null
function initVapid(): boolean {
  if (vapidInitialized !== null) return vapidInitialized
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (pub && priv) {
    try {
      webpush.setVapidDetails(
        process.env.VAPID_EMAIL ?? 'mailto:taka@takasports.com',
        pub,
        priv,
      )
      vapidInitialized = true
    } catch {
      vapidInitialized = false
    }
  } else {
    vapidInitialized = false
  }
  return vapidInitialized
}

/**
 * Envía push notification a TODOS los devices del usuario indicado.
 * Devuelve cuántos se entregaron, cuántos fueron purgados (endpoint
 * inválido, 404/410), cuántos fallaron por otra razón.
 *
 * Fire-and-forget: el caller usualmente hace `void sendPushToUser(...)`
 * para no bloquear el response del endpoint.
 */
const VACIO = { sent: 0, pruned: 0, failed: 0 }

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<PushResult> {
  const nada = (reason: string): PushResult => ({
    ...VACIO, reason, web: { ...VACIO, reason }, app: { ...VACIO, reason },
  })
  if (!userId) return nada('no_user')
  if (!payload?.title || !payload?.body) return nada('no_payload')

  const admin = adminSupabase()
  if (!admin) return nada('no_supabase')

  const topic = payload.topic === null ? null : (payload.topic ?? 'quiniela')
  // '/quiniela' está retirada (301 a /predicciones) desde hace tiempo: como
  // destino por defecto mandaba a un redirect, y en la app a una ruta que no
  // existe.
  const url = payload.url ?? '/predicciones'
  const tag = payload.tag ?? topic ?? 'taka'

  // Los dos destinos van en paralelo y son independientes: que el navegador no
  // esté configurado (sin VAPID) no puede dejar a la app sin su aviso, que es
  // exactamente lo que pasaba hasta ahora —el helper se rendía en la primera
  // línea si faltaba VAPID. [José Tomás, 28/08/2026]
  const [web, app] = await Promise.all([
    enviarWeb(admin, userId, topic, { ...payload, url, tag }),
    enviarApp(admin, userId, { title: payload.title, body: payload.body, url, tag }),
  ])

  return {
    sent: web.sent + app.sent,
    pruned: web.pruned + app.pruned,
    failed: web.failed + app.failed,
    web,
    app,
    ...(web.sent + app.sent === 0 ? { reason: `web:${web.reason ?? 'ok'} app:${app.reason ?? 'ok'}` } : {}),
  }
}

type Admin = NonNullable<ReturnType<typeof adminSupabase>>

/** Navegadores suscritos a ese topic (Web Push / VAPID). */
async function enviarWeb(
  admin: Admin,
  userId: string,
  topic: string | null,
  payload: PushPayload & { url: string; tag: string },
): Promise<PushResult['web']> {
  if (!initVapid()) return { ...VACIO, reason: 'no_vapid' }

  let consulta = admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (topic !== null) consulta = consulta.contains('topics', [topic])
  const { data: subs, error } = await consulta

  if (error) return { ...VACIO, reason: `query_failed: ${error.message}` }
  if (!subs || subs.length === 0) return { ...VACIO, reason: 'no_subs' }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
  })

  let sent = 0
  let pruned = 0
  let failed = 0
  const toPrune: string[] = []

  await Promise.allSettled(
    (subs as SubRow[]).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as webpush.PushSubscription,
          body,
        )
        sent += 1
      } catch (err: unknown) {
        const e = err as { statusCode?: number }
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          // Endpoint muerto — purgar en background
          toPrune.push(s.endpoint)
          pruned += 1
        } else {
          failed += 1
        }
      }
    }),
  )

  if (toPrune.length > 0) {
    try {
      await admin.from('push_subscriptions').delete().in('endpoint', toPrune)
    } catch { /* swallow */ }
  }

  return { sent, pruned, failed }
}

/**
 * Dispositivos con la app (Expo). NO filtra por topic: `push_tokens` no tiene
 * esa columna y la app ofrece un único interruptor de notificaciones en
 * Ajustes, no preferencias por tema. Si algún día la app las tiene, este es el
 * sitio donde filtrar.
 */
async function enviarApp(
  admin: Admin,
  userId: string,
  msg: { title: string; body: string; url: string; tag: string },
): Promise<PushResult['app']> {
  const { data: filas, error } = await admin
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId)

  if (error) return { ...VACIO, reason: `query_failed: ${error.message}` }
  const tokens = (filas ?? []).map((f) => (f as { token: string }).token)
  if (tokens.length === 0) return { ...VACIO, reason: 'no_tokens' }

  const r = await sendExpoPush(tokens, {
    title: msg.title,
    body: msg.body,
    data: { url: msg.url },
    tag: msg.tag,
  })

  // Token muerto (app desinstalada, permiso revocado): fuera de la tabla, o se
  // reintenta en cada envío para siempre.
  if (r.dead.length > 0) {
    try {
      await admin.from('push_tokens').delete().in('token', r.dead)
    } catch { /* swallow */ }
  }

  return { sent: r.sent, pruned: r.dead.length, failed: r.failed, reason: r.reason }
}
