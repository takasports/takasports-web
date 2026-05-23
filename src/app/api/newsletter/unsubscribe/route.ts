// GET /api/newsletter/unsubscribe?token=XXX
// Marca unsubscribed_at del email codificado en el token. Idempotente:
// si ya estaba dado de baja, devolvemos ok igualmente.
//
// Acepta GET (para que el link del email funcione con un solo click)
// y POST (para llamadas desde nuestra propia página /newsletter/baja).
//
// El token se genera con signUnsubscribeToken(email) en lib/newsletter-token.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { verifyUnsubscribeToken } from '@/lib/newsletter-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handleUnsubscribe(token: string | null) {
  const email = verifyUnsubscribeToken(token)
  if (!email) {
    return { status: 400, body: { ok: false, error: 'invalid_token' } }
  }

  const supa = adminSupabase()
  if (!supa) {
    return { status: 503, body: { ok: false, error: 'unavailable' } }
  }

  const { error } = await supa
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('email', email)
    .is('unsubscribed_at', null)

  if (error) {
    console.error('[unsubscribe]', error)
    return { status: 500, body: { ok: false, error: 'persist_failed' } }
  }

  // Si no había fila, el update no afecta nada y no devuelve error. Es
  // intencional: damos respuesta amistosa siempre que el token sea válido.
  return { status: 200, body: { ok: true, email } }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const result = await handleUnsubscribe(token)
  return NextResponse.json(result.body, { status: result.status })
}

export async function POST(req: NextRequest) {
  let body: { token?: unknown } = {}
  try { body = await req.json() } catch { /* ok, leemos también del query */ }
  const tokenFromBody = typeof body.token === 'string' ? body.token : null
  const tokenFromQuery = req.nextUrl.searchParams.get('token')
  const result = await handleUnsubscribe(tokenFromBody || tokenFromQuery)
  return NextResponse.json(result.body, { status: result.status })
}
