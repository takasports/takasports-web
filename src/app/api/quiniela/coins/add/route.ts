// POST /api/quiniela/coins/add
// Wrapper server-side para add_coins. Mueve la llamada del browser a servidor
// para que solo nuestro código pueda acreditar coins (no usuarios via REST API directo).
// Requiere sesión activa.

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Rate limit: 30 acreditaciones/hora por IP. Defiende contra bucles de retry.
  const rl = await checkRateLimit({
    bucket: 'coins_add',
    key: getClientIp(req),
    windowSeconds: 3600,
    max: 30,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfter: rl.retryAfterSeconds },
      { status: 429 },
    )
  }

  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let body: { amount?: unknown; reason?: unknown; context?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }) }

  const amount  = typeof body.amount  === 'number' ? body.amount  : null
  const reason  = typeof body.reason  === 'string' ? body.reason  : null
  const context = body.context && typeof body.context === 'object' ? body.context : {}

  if (amount === null || reason === null) {
    return NextResponse.json({ error: 'amount and reason required' }, { status: 400 })
  }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const { data, error } = await admin.rpc('add_coins', {
    p_amount:  amount,
    p_reason:  reason,
    p_context: context,
    p_user_id: user.id,
  })

  if (error) {
    if (error.message.includes('out of range')) {
      return NextResponse.json({ error: 'amount_out_of_range' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, credited: data })
}
