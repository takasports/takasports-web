// POST /api/account/delete — borra la cuenta del usuario autenticado (RGPD art. 17
// + requisito de App Store / Play Store). Irreversible.
//
// Autentica por cookie (web) O por token Bearer (takasports-app vía fetch
// nativo) — usa getUserFromRequest, que acepta ambas. Luego usa el cliente de
// servicio (service_role) para auth.admin.deleteUser(): la BD limpia en cascada
// (30 FK ON DELETE CASCADE) y anula la autoría de lo compartido (5 FK SET NULL:
// ligas, chat de liga, suscripciones push, eventos). Verificado: 0 FK en
// RESTRICT/NO ACTION → el borrado no se bloquea.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getUserFromRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
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

  // Cierra la sesión de cookie del lado servidor (web). Para clientes con
  // Bearer (app) es un no-op — la app limpia su propia sesión local.
  // Best-effort: la fila de auth.users ya no existe, el token queda inválido.
  try {
    const sb = await createServerSupabaseClient()
    await sb.auth.signOut()
  } catch { /* ya inválido */ }

  return NextResponse.json({ ok: true })
}
