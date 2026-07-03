// Cron — push personalizado por favoritos del Índice Taka.
//
// Cada usuario que marcó ❤ en una entry recibe una notificación si esa entry
// se movió ≥1.5 puntos esta semana. Se ejecuta los lunes 10:10 UTC (vercel.json).
// Depende de que el ingest semanal EXTERNO (launchd del Mac) haya escrito antes
// score_prev y los nuevos scores — NO de un cron de Vercel. La idempotencia
// (tabla favorites_push_log) evita doble aviso si se re-dispara la misma semana.
//
// Auth: solo Bearer CRON_SECRET o header x-cron-secret.

import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { adminSupabase } from '@/lib/supabase-admin'
import { apiError } from '@/lib/api-utils'
import { isoWeek } from '@/lib/quiniela'

const DELTA_THRESHOLD = 1.5

type RankRow = {
  id: string
  name: string
  sport: string | null
  score: number | string | null
  score_prev: number | string | null
  trend_reason: string | null
  category: string | null
}

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

  // 1) Entries que se movieron ≥ DELTA_THRESHOLD esta semana.
  // Paginamos de 1000 en 1000 (ordenado por id, clave estable) porque el Índice
  // puede superar las 5000 filas: el `.range(0, 4999)` anterior perdía en
  // silencio los movers a partir de la fila 5000. Tope de seguridad 100k filas.
  const PAGE = 1000
  const movers: Array<RankRow & { delta: number }> = []
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data, error } = await sb
      .from('ranking_view')
      .select('id,name,sport,score,score_prev,trend_reason,category')
      .not('score_prev', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return apiError('server_error', 500)
    const rows = (data ?? []) as RankRow[]
    for (const r of rows) {
      const delta = Math.round((Number(r.score) - Number(r.score_prev)) * 10) / 10
      if (Math.abs(delta) >= DELTA_THRESHOLD) movers.push({ ...r, delta })
    }
    if (rows.length < PAGE) break
  }

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

  // Idempotencia: reclama (user, semana) ANTES de enviar. `insert ... on conflict
  // do nothing` + .select() devuelve SOLO los recién insertados → enviamos solo a
  // esos. Un reintento del cron en la misma semana no reclama a nadie → 0 envíos
  // (at-most-once: mejor no avisar que duplicar). Purga semanas viejas (>60 días).
  const week = isoWeek(new Date())
  await sb.from('favorites_push_log').delete().lt('notified_at', new Date(Date.now() - 60 * 86_400_000).toISOString())
  const candidateIds = [...userToBestEntry.keys()]
  const claimed = new Set<string>()
  if (candidateIds.length > 0) {
    const { data: claimedRows, error: claimErr } = await sb
      .from('favorites_push_log')
      .upsert(candidateIds.map((user_id) => ({ user_id, week })), { onConflict: 'user_id,week', ignoreDuplicates: true })
      .select('user_id')
    if (claimErr) return apiError('server_error', 500)
    for (const r of claimedRows ?? []) claimed.add(r.user_id as string)
  }

  for (const [userId, m] of userToBestEntry) {
    if (!claimed.has(userId)) continue   // ya avisado esta semana → no reenviar
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
    users_notified: claimed.size,
    skipped_already_notified: userToBestEntry.size - claimed.size,
    sent, pruned,
  })
}
