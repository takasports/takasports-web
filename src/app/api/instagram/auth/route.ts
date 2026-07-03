import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { generateOAuthState, buildStateCookie } from '@/lib/ig-oauth-state'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Solo un admin logueado puede INICIAR la conexión de la cuenta de Instagram.
  // Sin esto, cualquiera podía recorrer el flujo desde su propio navegador y
  // dejar SU cuenta conectada (el callback no exigía auth). tokenEnv=undefined
  // → sin token server-to-server: es un flujo manual de navegador, valida por
  // sesión Supabase + allowlist ADMIN_EMAILS.
  const admin = await isAdminRequest(req, {
    headerName: 'x-admin-token',
    tokenEnv: undefined,
  })
  if (!admin) return forbidden()

  const state = generateOAuthState()
  const params = new URLSearchParams({
    client_id:     process.env.INSTAGRAM_APP_ID!,
    redirect_uri:  process.env.INSTAGRAM_REDIRECT_URI!,
    scope:         'instagram_business_basic',
    response_type: 'code',
    state,
  })

  // Guardamos el `state` en cookie httpOnly y redirigimos a Instagram con el
  // mismo valor: el callback comprobará que coinciden (anti-CSRF).
  const secure = process.env.NODE_ENV === 'production'
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: `https://www.instagram.com/oauth/authorize?${params}`,
      'Set-Cookie': buildStateCookie(state, secure),
    },
  })
}

function forbidden() {
  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:system-ui;padding:32px;background:#09090F;color:#F8F8FF;max-width:720px;margin:auto">
      <h2 style="color:#ef4444">🔒 Acceso restringido</h2>
      <p>Conectar la cuenta de Instagram es una acción de administrador.
         Inicia sesión con tu email de admin (AuthModal en <code>/perfil</code>)
         y vuelve a abrir este enlace.</p>
    </body></html>`,
    { status: 403, headers: { 'Content-Type': 'text/html' } },
  )
}
