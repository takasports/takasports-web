// POST /api/ranked/ufc-waitlist — registra un email para la lista de espera de Ranked UFC.
//
// Sin autenticación requerida (registro abierto).
// Idempotente: si el email ya existe devuelve 200 igualmente.
// Best-effort: si la tabla no existe, también devuelve 200 (no bloqueamos).

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  let email: string
  try {
    const body = await req.json() as { email?: unknown }
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 })
  }

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  try {
    const admin = adminSupabase()
    if (admin) {
      // Si la tabla no existe, el error se silencia (best-effort)
      await admin.from('ufc_waitlist').upsert({ email }, { onConflict: 'email', ignoreDuplicates: true })
    }
  } catch { /* best-effort — no bloqueamos */ }

  return NextResponse.json({ ok: true })
}
