// Cron pre-kickoff: dispara push a todos los suscriptores cuando faltan
// menos de NOTIFY_WINDOW_MIN minutos para el primer partido de la jornada
// y el usuario aún no ha enviado picks.
//
// USO (cron de Vercel/Supabase/Upstash):
//   curl -X POST https://takasportsmedia.com/api/quiniela/notify \
//     -H "Authorization: Bearer $CRON_SECRET"
//
// Idempotente dentro de la misma ventana gracias al cache (ts).

import { NextRequest, NextResponse } from 'next/server'
import type { QuinielaData } from '../route'

const NOTIFY_WINDOW_MIN = 60   // notifica entre T-NOTIFY_WINDOW_MIN y T-15
const NOTIFY_FLOOR_MIN  = 15   // mínimo a kickoff para no spammear in-progress

// Cache simple para evitar reenvíos en la misma ventana
let lastSentForJornada: string | null = null
let lastSentTs = 0

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const origin = new URL(req.url).origin
  const dataRes = await fetch(`${origin}/api/quiniela`, { cache: 'no-store' })
  if (!dataRes.ok) return NextResponse.json({ error: 'no jornada' }, { status: 503 })
  const data = await dataRes.json() as QuinielaData
  if (!data.matches?.length) return NextResponse.json({ ok: true, reason: 'no matches' })

  // Primer partido por kickoff
  const sorted = [...data.matches].sort((a, b) => a.isoDate.localeCompare(b.isoDate))
  const first = sorted[0]
  const minsToKickoff = (new Date(first.isoDate).getTime() - Date.now()) / 60_000
  if (minsToKickoff < NOTIFY_FLOOR_MIN || minsToKickoff > NOTIFY_WINDOW_MIN) {
    return NextResponse.json({ ok: true, reason: `outside window (${Math.round(minsToKickoff)}min)` })
  }

  // No reenviar si ya enviamos para esta jornada en la última hora
  if (lastSentForJornada === data.jornada && Date.now() - lastSentTs < 60 * 60_000) {
    return NextResponse.json({ ok: true, reason: 'already sent' })
  }

  const broadcastSecret = process.env.PUSH_BROADCAST_SECRET
  const sendRes = await fetch(`${origin}/api/push/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: '⚽ Quiniela cierra pronto',
      body: `${first.home} vs ${first.away} en ${Math.round(minsToKickoff)} min — ¡envía tus picks!`,
      url: '/quiniela',
      tag: 'quiniela-reminder',
      topic: 'quiniela',
      secret: broadcastSecret,
    }),
  })
  const sendJson = await sendRes.json().catch(() => ({}))
  lastSentForJornada = data.jornada
  lastSentTs = Date.now()
  return NextResponse.json({ ok: true, jornada: data.jornada, ...sendJson })
}
