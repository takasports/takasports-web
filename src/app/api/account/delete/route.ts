// POST /api/account/delete — borra la cuenta del usuario autenticado (RGPD art. 17
// + requisito de App Store / Play Store). Irreversible.
//
// Autentica por la sesión de cookie, luego usa el cliente de servicio
// (service_role) para auth.admin.deleteUser(): la BD limpia en cascada (30 FK
// ON DELETE CASCADE) y anula la autoría de lo compartido (5 FK SET NULL: ligas,
// chat de liga, suscripciones push, eventos). Verificado: 0 FK en RESTRICT/NO
// ACTION → el borrado no se bloquea.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 })
  }

  // Freno anti-abuso: pocas peticiones por minuto por IP+usuario.
  const rl = await checkRateLimit({
    bucket: 'account_delete',
    key: `${getClientIp(req)}:${user.id}`,
    windowSeconds: 60,
    max: 5,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const admin = adminSupabase()
  if (!admin) {
    // Sin service_role no podemos borrar de auth.users — no fingir éxito.
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  }

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Cierra la sesión del lado servidor (limpia las cookies de Supabase).
  // Best-effort: la fila de auth.users ya no existe, el token queda inválido.
  try { await sb.auth.signOut() } catch { /* ya inválido */ }

  return NextResponse.json({ ok: true })
}
