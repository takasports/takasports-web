import { NextResponse } from 'next/server'
import { type EmailOtpType, type SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { awardBadges } from '@/lib/badge-awards'
import { WELCOME_BADGE_IDS } from '@/lib/badges'

// Rutas internas válidas a las que el callback puede redirigir tras un login
// correcto. 'next' SOLO puede ser una de estas (o /perfil por defecto): esto
// evita open-redirect y, sobre todo, impide cualquier inyección en el
// window.location.replace de successPage(), porque el valor que se refleja es
// SIEMPRE una constante nuestra, nunca texto que venga del enlace.
const ALLOWED_NEXT = new Set(['/perfil', '/auth/reset-password', '/quiniela', '/predicciones', '/mundial'])

function sanitizeNext(raw: string | null): string {
  return raw && ALLOWED_NEXT.has(raw) ? raw : '/perfil'
}

/**
 * Tras una verificación con éxito (vía ?code= de OAuth o vía token_hash/type de
 * los enlaces de email), asegura el perfil del usuario y le da el badge de
 * bienvenida si es nuevo. Compartido por ambas ramas para que no diverjan.
 */
async function ensureProfileAndWelcome(supabase: SupabaseClient): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Nombre de display: proveedor OAuth → email prefix como fallback
  const providerName = (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | undefined
  const emailPrefix   = user.email?.split('@')[0] ?? null
  const displayName   = providerName ?? emailPrefix

  // Detectar si es usuario nuevo (perfil no existe todavía)
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('id', user.id)
  const isNew = count === 0

  await supabase.from('profiles').upsert({
    id:           user.id,
    display_name: displayName,
    avatar_url:   user.user_metadata?.avatar_url ?? null,
    timezone:     'Europe/Madrid',
  }, { onConflict: 'id', ignoreDuplicates: true })

  // Badge de bienvenida aleatorio para nuevos usuarios
  if (isNew) {
    const welcomeId = WELCOME_BADGE_IDS[Math.floor(Math.random() * WELCOME_BADGE_IDS.length)]
    await awardBadges(supabase, user.id, [welcomeId])
  }
}

// Redirección de éxito por 302 (cabecera Location, NO un <script> inline). Así
// funciona aunque la CSP del sitio bloquee scripts sin nonce, y elimina de raíz
// cualquier vector de inyección. La cookie de sesión que escribió verifyOtp/
// exchangeCodeForSession viaja igual en la respuesta de redirección. safeNext es
// siempre una ruta interna de ALLOWED_NEXT (o derivada del type), de modo que
// new URL(safeNext, origin) nunca puede apuntar fuera de nuestro dominio.
function successRedirect(origin: string, safeNext: string): NextResponse {
  return NextResponse.redirect(new URL(safeNext, origin))
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code      = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type') as EmailOtpType | null
  const error     = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/perfil?auth_error=${encodeURIComponent(error)}`)
  }

  // Rama 1 — token_hash/type: enlaces de email (confirmar cuenta, enlace mágico,
  // recuperar contraseña). NO usa el code_verifier PKCE del navegador, así que
  // funciona al abrir el enlace en CUALQUIER navegador/dispositivo, incógnito
  // incluido. Es la que arregla el "callback_failed" entre dispositivos.
  if (tokenHash && type) {
    // El tipo solo puede ser de los que envían nuestras plantillas de email.
    if (type !== 'email' && type !== 'recovery') {
      return NextResponse.redirect(`${origin}/perfil?auth_error=verify_failed`)
    }
    // El destino se DERIVA del tipo (no se confía en ?next= del enlace).
    const safeNext = type === 'recovery' ? '/auth/reset-password' : '/perfil'

    const supabase = await createServerSupabaseClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!verifyError) {
      await ensureProfileAndWelcome(supabase)
      return successRedirect(origin, safeNext)
    }
    // Enlace caducado o ya usado (token de un solo uso) → aviso claro.
    return NextResponse.redirect(`${origin}/perfil?auth_error=verify_failed`)
  }

  // Rama 2 — ?code= (OAuth de Google / PKCE en el mismo navegador). Sin cambios
  // de comportamiento: Google siempre termina en el navegador que lo inició.
  if (code) {
    const safeNext = sanitizeNext(searchParams.get('next'))
    const supabase = await createServerSupabaseClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError) {
      await ensureProfileAndWelcome(supabase)
      return successRedirect(origin, safeNext)
    }
  }

  return NextResponse.redirect(`${origin}/perfil?auth_error=callback_failed`)
}
