import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { getSubscriptions } from '../subscribe/route'
import { adminSupabase } from '@/lib/supabase-admin'

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
  // Opcional: token compartido para crons/jobs externos
  secret?: string
}

export async function POST(req: NextRequest) {
  if (!initVapid()) {
    return NextResponse.json({ error: 'Push notifications not configured' }, { status: 503 })
  }
  try {
    const { title, body, url, tag, topic = 'quiniela', secret } = await req.json() as SendBody

    // PUSH_BROADCAST_SECRET es obligatorio — sin él el endpoint queda abierto
    const required = process.env.PUSH_BROADCAST_SECRET
    if (!required) {
      return NextResponse.json({ error: 'Push broadcast not configured' }, { status: 503 })
    }
    if (secret !== required) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    if (!title || !body) {
      return NextResponse.json({ error: 'title and body required' }, { status: 400 })
    }

    const subs = await getSubscriptions(topic)
    if (subs.length === 0) return NextResponse.json({ sent: 0 })

    const payload = JSON.stringify({
      title, body,
      url: url ?? '/quiniela',
      tag: tag ?? topic,
    })

    const admin = adminSupabase()
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
    return NextResponse.json({ sent, pruned, total: subs.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
