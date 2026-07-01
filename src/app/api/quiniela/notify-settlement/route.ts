// Cron post-liquidación: dispara push genérico a todos los suscriptores
// del topic 'quiniela' cuando detecta que se acaba de liquidar una jornada.
// El mensaje NO incluye datos personales — la personalización ("+120 pts ·
// 6/10 aciertos") la hace el PorraSettlementToast cuando el user vuelve.
//
// USO (cron Vercel / Supabase / Upstash):
//   curl -X POST https://takasportsmedia.com/api/quiniela/notify-settlement \
//     -H "Authorization: Bearer $CRON_SECRET"
//
// Idempotente: cache módulo-level con la última jornada notificada.
// Si el módulo se recicla, evitamos doble-envío usando una ventana de
// detección estrecha (últimas LOOKBACK horas) — no notifica de nuevo
// liquidaciones viejas.

import { NextRequest, NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { adminSupabase } from '@/lib/supabase-admin'

const LOOKBACK_HOURS = 6
const RESEND_GUARD_MS = 24 * 3_600_000

let lastNotifiedJornada: string | null = null
let lastNotifiedTs = 0

interface SettledRow {
  jornada: string
  picks: {
    settled?: boolean
    settledAt?: string
  } | null
}

export async function POST(req: NextRequest) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const admin = adminSupabase()
  if (!admin) {
    return NextResponse.json({ error: 'admin client unavailable' }, { status: 503 })
  }

  // Buscamos jornadas con AL MENOS una liquidación reciente. Limit 128
  // para cubrir jornadas grandes con muchos users.
  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 3_600_000).toISOString()

  // No podemos filtrar por settled/settledAt dentro del JSONB con .eq()
  // sin sintaxis especial; pedimos lote y filtramos client-side. Es OK
  // porque solo corre por cron cada N minutos.
  const { data: rows, error } = await admin
    .from('quiniela_picks')
    .select('jornada, picks')
    .limit(256)
  if (error) {
    return NextResponse.json({ error: 'query failed', detail: error.message }, { status: 503 })
  }

  const recentlySettled = (rows as SettledRow[] | null ?? []).filter((r) => {
    if (r.picks?.settled !== true) return false
    const at = r.picks?.settledAt
    return typeof at === 'string' && at >= cutoff
  })

  if (recentlySettled.length === 0) {
    return NextResponse.json({ ok: true, reason: 'no recent settlement' })
  }

  // Jornada más reciente: ordenamos por settledAt DESC y tomamos la primera.
  recentlySettled.sort((a, b) =>
    (b.picks?.settledAt ?? '').localeCompare(a.picks?.settledAt ?? ''),
  )
  const targetJornada = recentlySettled[0].jornada

  // Guard: misma jornada dentro de las últimas 24h → no re-enviar.
  if (
    lastNotifiedJornada === targetJornada &&
    Date.now() - lastNotifiedTs < RESEND_GUARD_MS
  ) {
    return NextResponse.json({
      ok: true, reason: 'already notified', jornada: targetJornada,
    })
  }

  // Cuántos users se liquidaron en esa jornada (telemetría). quiniela_picks tiene
  // una fila por (user, jornada), así que el nº de filas de esta jornada = nº de
  // users. (Antes se mapeaba a r.jornada → Set de tamaño 1, y un Set ni serializa.)
  const liquidatedUsers = recentlySettled.filter((r) => r.jornada === targetJornada).length

  // Broadcast — el mensaje es deliberadamente neutro. Quien hizo picks
  // verá su resultado real en el toast; quien no, ve un recordatorio
  // suave y CTA a /predicciones para la próxima.
  const origin = new URL(req.url).origin
  const broadcastSecret = process.env.PUSH_BROADCAST_SECRET
  const sendRes = await fetch(`${origin}/api/push/send`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(broadcastSecret ? { 'x-push-secret': broadcastSecret } : {}),
    },
    body: JSON.stringify({
      title: '✅ Tu Porra se ha liquidado',
      body: `${targetJornada} cerrada — entra a ver tu resultado.`,
      url: '/predicciones',
      tag: 'porra-settlement',
      topic: 'quiniela',
    }),
  })
  const sendJson = await sendRes.json().catch(() => ({}))

  lastNotifiedJornada = targetJornada
  lastNotifiedTs = Date.now()

  return NextResponse.json({
    ok: true,
    jornada: targetJornada,
    liquidatedUsers,
    ...sendJson,
  })
}
