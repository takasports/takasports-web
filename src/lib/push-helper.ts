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
  /** Topic filter (default 'quiniela'). El user debe estar suscrito a este topic. */
  topic?: string
}

interface PushResult {
  sent: number
  pruned: number
  failed: number
  /** Razón si nada se envió (config, no subs, etc.) — para debug. */
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
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<PushResult> {
  if (!initVapid()) return { sent: 0, pruned: 0, failed: 0, reason: 'no_vapid' }
  if (!userId) return { sent: 0, pruned: 0, failed: 0, reason: 'no_user' }
  if (!payload?.title || !payload?.body) {
    return { sent: 0, pruned: 0, failed: 0, reason: 'no_payload' }
  }

  const admin = adminSupabase()
  if (!admin) return { sent: 0, pruned: 0, failed: 0, reason: 'no_supabase' }

  const topic = payload.topic ?? 'quiniela'
  let q = admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
  q = q.contains('topics', [topic])

  const { data: subs, error } = await q
  if (error) return { sent: 0, pruned: 0, failed: 0, reason: `query_failed: ${error.message}` }
  if (!subs || subs.length === 0) return { sent: 0, pruned: 0, failed: 0, reason: 'no_subs' }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/quiniela',
    tag: payload.tag ?? topic,
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

  // Limpieza de endpoints muertos (best-effort)
  if (toPrune.length > 0) {
    try {
      await admin.from('push_subscriptions').delete().in('endpoint', toPrune)
    } catch { /* swallow */ }
  }

  return { sent, pruned, failed }
}
