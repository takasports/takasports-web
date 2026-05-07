import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'

interface PushSubscriptionInput {
  endpoint: string
  keys: { p256dh: string; auth: string }
  topics?: string[]
}

// Fallback in-memory cuando Supabase no está disponible (dev local sin tablas)
const memSubs = new Map<string, { endpoint: string; keys: { p256dh: string; auth: string }; topics: string[] }>()

export async function POST(req: NextRequest) {
  try {
    const sub = await req.json() as PushSubscriptionInput
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return NextResponse.json({ error: 'invalid subscription' }, { status: 400 })
    }
    const topics = Array.isArray(sub.topics) && sub.topics.length
      ? sub.topics.filter(t => typeof t === 'string').slice(0, 10)
      : ['quiniela']

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const sb = await createServerSupabaseClient()
      const { data: { user } } = await sb.auth.getUser()
      const { error } = await sb.from('push_subscriptions').upsert({
        endpoint: sub.endpoint,
        user_id: user?.id ?? null,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        topics,
      }, { onConflict: 'endpoint' })
      if (error) {
        // Si la tabla no existe aún, fallback memoria con warning
        memSubs.set(sub.endpoint, { endpoint: sub.endpoint, keys: sub.keys, topics })
        return NextResponse.json({ ok: true, persisted: false, warning: error.message })
      }
      return NextResponse.json({ ok: true, persisted: true })
    }

    memSubs.set(sub.endpoint, { endpoint: sub.endpoint, keys: sub.keys, topics })
    return NextResponse.json({ ok: true, persisted: false })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json()
    if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const sb = await createServerSupabaseClient()
      await sb.from('push_subscriptions').delete().eq('endpoint', endpoint)
    }
    memSubs.delete(endpoint)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}

// Lectura usada por /api/push/send. Devuelve subscripciones (filtradas por topic opcional).
export async function getSubscriptions(topic?: string): Promise<Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>> {
  // Preferimos service role para listar sin RLS
  const admin = adminSupabase()
  if (admin) {
    let q = admin.from('push_subscriptions').select('endpoint, p256dh, auth, topics')
    if (topic) q = q.contains('topics', [topic])
    const { data, error } = await q
    if (!error && data) {
      return data.map(r => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }))
    }
  }
  return [...memSubs.values()]
    .filter(s => !topic || s.topics.includes(topic))
    .map(s => ({ endpoint: s.endpoint, keys: s.keys }))
}
