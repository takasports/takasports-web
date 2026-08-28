import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { getSubscriptions } from '../subscribe/route'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkHeaderSecret } from '@/lib/auth-utils'
import { sendExpoPush } from '@/lib/expo-push'

// Lazy init — evita crash en build si las env vars VAPID no están configuradas
function initVapid() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (pub && priv) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL ?? 'mailto:taka@takasports.com',
      pub,
      priv,
    )
    return true
  }
  return false
}

interface SendBody {
  title: string
  body: string
  url?: string
  tag?: string
  topic?: string  // filtra suscripciones por topic (default 'quiniela')
}

export async function POST(req: NextRequest) {
  // PUSH_BROADCAST_SECRET es obligatorio — sin él el endpoint queda cerrado.
  // El secreto debe viajar en el header `x-push-secret`, NUNCA en el body
  // (los bodies suelen quedar registrados en logs de proxies / observabilidad).
  const required = process.env.PUSH_BROADCAST_SECRET
  if (!required) {
    return NextResponse.json({ error: 'Push broadcast not configured' }, { status: 503 })
  }
  if (!checkHeaderSecret(req.headers.get('x-push-secret'), required)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Sin VAPID no hay push de navegador, pero el de la app sigue funcionando: el
  // 503 de antes tumbaba el endpoint entero. Solo se corta si no hay ninguno.
  const vapidOk = initVapid()
  try {
    const { title, body, url, tag, topic = 'quiniela' } = await req.json() as SendBody

    if (!title || !body) {
      return NextResponse.json({ error: 'title and body required' }, { status: 400 })
    }

    const destino = url ?? '/predicciones'
    const subs = vapidOk ? await getSubscriptions(topic) : []
    const admin = adminSupabase()

    // Difusión a la app. push_tokens no tiene topics —la app trae un único
    // interruptor de notificaciones—, así que este broadcast va a todos los
    // dispositivos registrados. [José Tomás, 28/08/2026]
    const { data: tokenRows } = admin
      ? await admin.from('push_tokens').select('token')
      : { data: null }
    const appTokens = (tokenRows ?? []).map((r) => r.token as string)
    const appEnvio = appTokens.length > 0
      ? await sendExpoPush(appTokens, { title, body, data: { url: destino } })
      : { sent: 0, dead: [] as string[] }
    if (admin && appEnvio.dead.length > 0) {
      await admin.from('push_tokens').delete().in('token', appEnvio.dead)
    }

    if (subs.length === 0 && appTokens.length === 0) {
      return NextResponse.json({ sent: 0, sent_app: 0 })
    }

    const payload = JSON.stringify({
      title, body,
      url: destino,
      tag: tag ?? topic,
    })

    let sent = 0
    let pruned = 0
    const results = await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(sub as webpush.PushSubscription, payload)
          sent++
        } catch (err: unknown) {
          // 404/410 = endpoint inválido, lo limpiamos
          const e = err as { statusCode?: number }
          if ((e?.statusCode === 404 || e?.statusCode === 410) && admin) {
            await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
            pruned++
          }
        }
      })
    )
    void results
    return NextResponse.json({
      sent,
      sent_app: appEnvio.sent,
      pruned: pruned + appEnvio.dead.length,
      total: subs.length + appTokens.length,
    })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
