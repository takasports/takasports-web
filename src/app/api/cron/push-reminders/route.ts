// Cron de avisos de juegos. Vercel lo dispara según vercel.json:
//   ?kind=daily   → 09:00 UTC todos los días
//   ?kind=weekly  → 08:00 UTC los lunes
//
// Reusa /api/push/send (que ya valida PUSH_BROADCAST_SECRET y maneja VAPID).
// Auth del cron: Vercel manda Authorization: Bearer <CRON_SECRET>; aceptamos
// también ?secret= para pruebas manuales.

import { NextRequest, NextResponse } from 'next/server'

interface PushMessage {
  title: string
  body: string
  url: string
  tag: string
}

const DAILY_MESSAGES: PushMessage[] = [
  { title: 'CrackQuiz de hoy 🎯', body: '10 preguntas, 20 s cada una. ¿Mantienes la racha?', url: '/crackquiz', tag: 'crackquiz' },
  { title: 'TakaGrid de hoy 🟧',  body: 'Tres clubes, tres categorías. Un intento por celda.',   url: '/takagrid',  tag: 'takagrid' },
]

const WEEKLY_MESSAGES: PushMessage[] = [
  { title: 'Nueva Sopa de Cracks 🔤', body: 'Diez nombres ocultos en el puzzle semanal.', url: '/sopa-cracks', tag: 'sopacracks' },
  { title: 'Nuevo reto Mi Once ⚽',   body: 'Arma tu once con el reto de esta semana.',  url: '/mionce',      tag: 'mionce' },
]

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const cronSecret = process.env.CRON_SECRET
  const broadcastSecret = process.env.PUSH_BROADCAST_SECRET

  // Auth: header Authorization: Bearer <secret> o ?secret=...
  const headerAuth = req.headers.get('authorization') ?? ''
  const provided = url.searchParams.get('secret') ?? headerAuth.replace(/^Bearer\s+/i, '')
  if (cronSecret && provided !== cronSecret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!broadcastSecret) {
    return NextResponse.json({ error: 'PUSH_BROADCAST_SECRET not set' }, { status: 503 })
  }

  const kind = url.searchParams.get('kind') ?? 'daily'
  const messages: PushMessage[] =
    kind === 'weekly' ? WEEKLY_MESSAGES :
    kind === 'daily'  ? DAILY_MESSAGES  :
    []

  if (messages.length === 0) {
    return NextResponse.json({ error: `unknown kind=${kind}` }, { status: 400 })
  }

  const results: Array<{ tag: string; sent?: number; pruned?: number; error?: string }> = []
  for (const m of messages) {
    try {
      const res = await fetch(new URL('/api/push/send', url.origin), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...m, topic: 'games', secret: broadcastSecret }),
      })
      const j = await res.json() as { sent?: number; pruned?: number; error?: string }
      results.push({ tag: m.tag, sent: j.sent, pruned: j.pruned, error: j.error })
    } catch (e) {
      results.push({ tag: m.tag, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({ kind, results })
}
