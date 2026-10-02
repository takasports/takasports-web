// Cron de avisos de juegos. Vercel lo dispara según vercel.json:
//   ?kind=daily   → una vez al día
//   ?kind=weekly  → RETIRADO: responde 200 sin enviar nada (ver abajo)
//
// UN SOLO aviso al día. Antes el diario mandaba DOS (CrackQuiz + TakaGrid) y los
// lunes el semanal sumaba otros dos (Sopa + Mi Once): cuatro notificaciones en
// una mañana. Y en la app pesa el doble: `push_tokens` no tiene topics, así que
// cada difusión llega a TODOS los móviles con la app. Ahora el diario elige UN
// juego: el lunes, la novedad semanal (Sopa o Mi Once, alternando por semana);
// el resto de días, CrackQuiz o TakaGrid alternando por día.
//
// Reusa /api/push/send (que ya valida PUSH_BROADCAST_SECRET y maneja VAPID).
// Auth del cron: Authorization: Bearer <CRON_SECRET> o x-cron-secret.

import { NextRequest, NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { buildDaily, type PushMessage } from '@/lib/push-juegos'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const broadcastSecret = process.env.PUSH_BROADCAST_SECRET

  // CRON_SECRET es obligatorio: si no está seteado, el endpoint queda cerrado.
  // Aceptamos `Authorization: Bearer <CRON_SECRET>` (formato Vercel) o el
  // header `x-cron-secret`. El antiguo `?secret=` queda eliminado (filtra en
  // logs y referer).
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!broadcastSecret) {
    return NextResponse.json({ error: 'PUSH_BROADCAST_SECRET not set' }, { status: 503 })
  }

  const kind = url.searchParams.get('kind') ?? 'daily'
  // El semanal se ha fundido en el diario de los lunes. Se responde 200 para
  // que la entrada de vercel.json, mientras exista, no cuente como fallo.
  if (kind === 'weekly') {
    return NextResponse.json({ kind, retired: true, note: 'integrado en el aviso diario del lunes' })
  }
  if (kind !== 'daily') {
    return NextResponse.json({ error: `unknown kind=${kind}` }, { status: 400 })
  }
  const messages: PushMessage[] = [buildDaily()]

  const results: Array<{ tag: string; sent?: number; pruned?: number; error?: string }> = []
  for (const m of messages) {
    try {
      const res = await fetch(new URL('/api/push/send', url.origin), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-push-secret': broadcastSecret,
        },
        body: JSON.stringify({ ...m, topic: 'games' }),
      })
      const j = await res.json() as { sent?: number; pruned?: number; error?: string }
      results.push({ tag: m.tag, sent: j.sent, pruned: j.pruned, error: j.error })
    } catch (e) {
      results.push({ tag: m.tag, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({ kind, results })
}
