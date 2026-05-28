// POST /api/newsletter/subscribe
// Acepta { email, consent } y persiste en newsletter_subscribers.
// Opt-in simple con consentimiento explícito (UI exige checkbox).
// IP se hashea con SHA256 — NO se guarda en claro (RGPD).

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { createHash } from 'crypto'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function hashIp(req: NextRequest): string | null {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  if (!ip) return null
  return createHash('sha256').update(ip).digest('hex').slice(0, 32)
}

export async function POST(req: NextRequest) {
  // Rate-limit: 5 suscripciones/hora por IP. Defiende de bots que prueban
  // emails desechables en bucle (también frente a spam de bounces).
  const rl = await checkRateLimit({
    bucket: 'newsletter_subscribe',
    key: getClientIp(req),
    windowSeconds: 3600,
    max: 5,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfter: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  let body: { email?: unknown; consent?: unknown; source?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const consent = body.consent === true
  const source = typeof body.source === 'string' && body.source.length <= 32 ? body.source : 'web'

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
  }
  if (!consent) {
    return NextResponse.json({ ok: false, error: 'consent_required' }, { status: 400 })
  }

  const supa = adminSupabase()
  if (!supa) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 })
  }

  const userAgent = req.headers.get('user-agent')?.slice(0, 200) ?? null
  const ipHash = hashIp(req)

  const { error } = await supa
    .from('newsletter_subscribers')
    .insert({
      email,
      source,
      user_agent: userAgent,
      ip_hash: ipHash,
    })

  if (error) {
    // 23505 = unique violation (duplicado). Respondemos amistosamente.
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, alreadySubscribed: true })
    }
    console.error('[newsletter] insert error', error)
    return NextResponse.json({ ok: false, error: 'persist_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
