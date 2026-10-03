// POST/DELETE /api/app/push-token
//
// Registro del token de push de la APP (Expo) SIN necesidad de sesión, con sus
// temas (`noticias:futbol`…). Hasta ahora la app solo guardaba el token con la
// sesión iniciada y escribiendo ella misma en `push_tokens` (la RLS exige
// auth.uid() = user_id), así que quien usa la app sin cuenta —la mayoría— no
// podía recibir ningún aviso, ni siquiera los de noticias que no son personales.
//
//   POST   { token, platform?: 'ios'|'android', topics?: string[] }
//          → { ok, topics, vinculado }
//   DELETE { token } → { ok }
//
// · Escribe con service role. La política de la tabla no cambia.
// · `user_id` SOLO sale de un `Authorization: Bearer <access_token>` válido de
//   Supabase. Nunca de cookies (esta ruta está fuera del middleware y de su
//   guardia CSRF a propósito: la app no manda Origin) ni del cuerpo.
// · Límite de peticiones por IP, como /api/push/subscribe.
// · El token es el secreto: quien lo tiene puede cambiar sus temas o darlo de
//   baja, igual que el endpoint de una suscripción web.
//
// ⚠️ Cuando la app lo adopte, debe registrar SIEMPRE por aquí (con el Bearer si
// hay sesión) y dejar de hacer el upsert directo a `push_tokens`: si existe una
// fila sin dueño para su token, el upsert directo con sesión choca con la RLS
// (la fila existente no cumple auth.uid() = user_id) y falla.
//
// Nada de esto cambia `sendPushToUser`: sigue mandando a los tokens del usuario
// sin mirar temas. Los temas solo los usa el envío por tema (lib/push-topic).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { apiError, readJson } from '@/lib/api-utils'
import { captureException } from '@/lib/monitoring'
import { isExpoToken } from '@/lib/expo-push'
import { filaRegistro, sanearPlataforma, sanearTemas } from '@/lib/app-push-token'

export const dynamic = 'force-dynamic'

async function limitar(req: NextRequest): Promise<NextResponse | null> {
  const rl = await checkRateLimit({
    bucket: 'app_push_token',
    key: getClientIp(req),
    windowSeconds: 3600,
    max: 20,
  })
  if (rl.ok) return null
  return NextResponse.json(
    { error: 'rate_limited', retryAfter: rl.retryAfterSeconds },
    { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
  )
}

/** Usuario del Bearer, `null` sin cabecera, `'invalido'` si la trae y no vale. */
async function usuarioBearer(req: NextRequest): Promise<string | null | 'invalido'> {
  const auth = req.headers.get('authorization')
  if (!auth?.toLowerCase().startsWith('bearer ')) return null
  const token = auth.slice(7).trim()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!token || !url || !key) return 'invalido'
  const sb = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data } = await sb.auth.getUser().catch(() => ({ data: { user: null } }))
  return data?.user?.id ?? 'invalido'
}

export async function POST(req: NextRequest) {
  const limitado = await limitar(req)
  if (limitado) return limitado

  const parsed = await readJson<{ token?: unknown; platform?: unknown; topics?: unknown }>(req)
  if ('error' in parsed) return parsed.error
  const { token, platform, topics } = parsed.data ?? {}
  if (typeof token !== 'string' || !isExpoToken(token)) return apiError('invalid_token', 400)

  const admin = adminSupabase()
  if (!admin) return apiError('not_configured', 503)

  try {
    const usuario = await usuarioBearer(req)
    if (usuario === 'invalido') return apiError('invalid_session', 401)

    const limpio = token.trim()
    const { data: existente } = await admin
      .from('push_tokens')
      .select('user_id, topics, platform')
      .eq('token', limpio)
      .maybeSingle()

    const fila = filaRegistro({
      token: limpio,
      platform: sanearPlataforma(platform),
      temas: sanearTemas(topics),
      userId: usuario,
      existente: existente ?? null,
      ahoraIso: new Date().toISOString(),
    })
    const { error } = await admin.from('push_tokens').upsert(fila, { onConflict: 'token' })
    if (error) {
      captureException(error, { route: 'app/push-token' })
      return apiError('server_error', 500)
    }
    return NextResponse.json({ ok: true, topics: fila.topics, vinculado: !!fila.user_id })
  } catch (e) {
    captureException(e, { route: 'app/push-token' })
    return apiError('server_error', 500)
  }
}

export async function DELETE(req: NextRequest) {
  const limitado = await limitar(req)
  if (limitado) return limitado
  const parsed = await readJson<{ token?: unknown }>(req)
  if ('error' in parsed) return parsed.error
  const { token } = parsed.data ?? {}
  if (typeof token !== 'string' || !isExpoToken(token)) return apiError('invalid_token', 400)
  const admin = adminSupabase()
  if (!admin) return apiError('not_configured', 503)
  try {
    await admin.from('push_tokens').delete().eq('token', token.trim())
    return NextResponse.json({ ok: true })
  } catch (e) {
    captureException(e, { route: 'app/push-token' })
    return apiError('server_error', 500)
  }
}
