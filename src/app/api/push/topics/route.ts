// POST /api/push/topics — los temas de UNA suscripción de navegador.
//
//   { endpoint }                → { topics }
//   { endpoint, quitar: 'agenda' } → quita ese tema y devuelve los que quedan.
//                                   Si no queda ninguno, borra la suscripción
//                                   ({ borrada: true }) y el cliente se da de
//                                   baja también en el navegador.
//
// Existe porque un navegador tiene una sola suscripción y varias ofertas
// (noticias, calendario, aviso de cada noche): «quitar el aviso de la noche» no
// puede darle de baja de todo, y la oferta necesita saber si SU tema está
// activo, no solo si el navegador está suscrito a algo.
//
// El endpoint es el secreto de la suscripción, como en DELETE /api/push/subscribe.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { readJson } from '@/lib/api-utils'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit({ bucket: 'push_topics', key: getClientIp(req), windowSeconds: 3600, max: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const parsed = await readJson<{ endpoint?: string; quitar?: string }>(req)
  if ('error' in parsed) return parsed.error
  const { endpoint, quitar } = parsed.data
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 })
  }
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ topics: [] })

  const { data } = await admin.from('push_subscriptions').select('topics').eq('endpoint', endpoint).maybeSingle()
  const topics = Array.isArray(data?.topics) ? (data.topics as string[]) : []
  if (typeof quitar !== 'string' || !topics.includes(quitar)) return NextResponse.json({ topics })

  const quedan = topics.filter(t => t !== quitar)
  if (quedan.length === 0) {
    await admin.from('push_subscriptions').delete().eq('endpoint', endpoint)
    return NextResponse.json({ topics: [], borrada: true })
  }
  await admin.from('push_subscriptions').update({ topics: quedan }).eq('endpoint', endpoint)
  return NextResponse.json({ topics: quedan })
}
