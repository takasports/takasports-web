// Cron — push personalizado por favoritos del Índice Taka.
//
// Cada usuario que marcó ❤ en una entry recibe una notificación si esa entry
// se movió ≥1.5 puntos esta semana. Se ejecuta los lunes 09:30 (después de
// que el cron de rankings haya escrito score_prev y los nuevos scores).
//
// Auth: solo Bearer CRON_SECRET o header x-cron-secret.

import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { adminSupabase } from '@/lib/supabase-admin'

const DELTA_THRESHOLD = 1.5

function initVapid(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_EMAIL ?? 'mailto:taka@takasports.com', pub, priv)
  return true
}

export async function GET(req: NextRequest) {
  // Auth: solo Bearer CRON_SECRET o header x-cron-secret (comparación en tiempo
  // constante). El antiguo `?secret=` queda eliminado: se filtraba en logs/referer.
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!initVapid()) return NextResponse.json({ error: 'VAPID no configurado' }, { status: 503 })
  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'Supabase admin no configurado' }, { status: 503 })

  // 1) Entries que se movieron ≥ DELTA_THRESHOLD esta semana
  const { data: moved } = await sb
    .from('ranking_view')
    .select('id,name,sport,score,score_prev,trend_reason,category')
    .not('score_prev', 'is', null)
    .range(0, 4999)
  const movers = (moved ?? [])
    .map((r) => ({
      ...r,
      delta: Math.round((Number(r.score) - Number(r.score_prev)) * 10) / 10,
    }))
    .filter((r) => Math.abs(r.delta) >= DELTA_THRESHOLD)

  if (movers.length === 0) return NextResponse.json({ sent: 0, notes: 'sin movimientos relevantes' })

  // 2) Para cada mover, busca usuarios que lo tienen como favorito
  const moverIds = movers.map((m) => m.id)
  const { data: favs } = await sb
    .from('user_favorites')
    .select('user_id, entry_id')
    .in('entry_id', moverIds)

  if (!favs || favs.length === 0) return NextResponse.json({ sent: 0, notes: 'sin usuarios suscritos' })

  // 3) Resolve suscripciones push por user_id
  const userIds = [...new Set(favs.map((f) => f.user_id))]
  const { data: subs } = await sb
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)
  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0, notes: 'usuarios sin push activo' })

  // index user_id → [subs]
  const subsByUser = new Map<string, typeof subs>()
  for (const s of subs) {
    const arr = subsByUser.get(s.user_id) ?? []
    arr.push(s)
    subsByUser.set(s.user_id, arr)
  }
  const moverById = new Map(movers.map((m) => [m.id, m]))

  // 4) Envía un push por user (la primera entry que tienen como favorito y movió)
  let sent = 0, pruned = 0
  // Group favorites by user → choose the biggest delta
  const userToBestEntry = new Map<string, typeof movers[0]>()
  for (const f of favs) {
    const m = moverById.get(f.entry_id)
    if (!m) continue
    const prev = userToBestEntry.get(f.user_id)
    if (!prev || Math.abs(m.delta) > Math.abs(prev.delta)) userToBestEntry.set(f.user_id, m)
  }

  for (const [userId, m] of userToBestEntry) {
    const userSubs = subsByUser.get(userId) ?? []
    const direction = m.delta >= 0 ? '↑' : '↓'
    const sign = m.delta >= 0 ? '+' : ''
    const title = `${m.name} ${direction} ${sign}${m.delta.toFixed(1)} esta semana`
    const body = m.trend_reason ?? `Score actual: ${Number(m.score).toFixed(1)}. Ver el Índice Taka.`
    const payload = JSON.stringify({
      title, body,
      url: `/rankings/${m.id}`,
      tag: `fav-${m.id}`,
    })
    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } } as webpush.PushSubscription,
          payload,
        )
        sent++
      } catch (err: unknown) {
        const e = err as { statusCode?: number }
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          pruned++
        }
      }
    }
  }

  return NextResponse.json({
    movers: movers.length,
    favs: favs.length,
    users_notified: userToBestEntry.size,
    sent, pruned,
  })
}
