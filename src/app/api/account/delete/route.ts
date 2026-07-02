// POST /api/account/delete — borra la cuenta del usuario autenticado (RGPD art. 17
// + requisito de App Store / Play Store). Irreversible.
//
// Autentica por cookie (web) O por token Bearer (takasports-app vía fetch
// nativo) — usa getUserFromRequest, que acepta ambas. Luego usa el cliente de
// servicio (service_role) para auth.admin.deleteUser(): la BD limpia en cascada
// (32 FK ON DELETE CASCADE — incl. suscripciones push y chat de liga desde la
// migración 076) y anula la autoría de lo compartido (3 FK SET NULL: ligas
// quiniela, ligas ranked, eventos de juego). Verificado: 0 FK en RESTRICT/NO
// ACTION → el borrado no se bloquea.
//
// Además, dos tablas NO están conectadas a la cuenta por FK y por tanto la
// cascada NO las toca; las limpiamos aquí a mano (best-effort, derecho de
// supresión RGPD art. 17):
//   · newsletter_subscribers — el email del usuario (si estaba suscrito).
//   · rate_limits — la(s) fila(s) cuya `key` incluye su user.id (temporal).

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getUserFromRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { apiError } from '@/lib/api-utils'

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
    return apiError('server_error', 500)
  }

  // Supresión de datos NO cubiertos por la cascada de FK (ver cabecera).
  // Best-effort: la cuenta ya está borrada; si algo de esto falla, lo
  // registramos pero NO devolvemos error (no fingir que el borrado falló).
  if (user.email) {
    try {
      await admin
        .from('newsletter_subscribers')
        .delete()
        .eq('email', user.email.toLowerCase())
    } catch (e) {
      console.error('[account/delete] newsletter cleanup', e)
    }
  }
  try {
    // La key del rate-limit es `${ip}:${user.id}` en varios buckets
    // (account_delete, account_export, sync_*). Borramos todas las del usuario.
    await admin.from('rate_limits').delete().like('key', `%:${user.id}`)
  } catch (e) {
    console.error('[account/delete] rate_limits cleanup', e)
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
