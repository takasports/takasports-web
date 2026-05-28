import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSameOrigin } from '@/lib/csrf'
import { randomBytes } from 'crypto'

export async function middleware(request: NextRequest) {
  // CSRF guard: para métodos mutables sobre rutas autenticadas, exigimos
  // mismo origen. Se aplica antes del refresh de sesión para que un ataque
  // CSRF ni siquiera llegue al endpoint. Las APIs de auth/callback de OAuth
  // tienen su propio mecanismo (PKCE/state) y quedan fuera del matcher.
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'csrf_origin_mismatch' },
      { status: 403 },
    )
  }

  // ── CSP Nonce por request ──────────────────────────────────────────────
  // Generamos un nonce aleatorio por cada request en las rutas cubiertas por
  // el matcher (páginas autenticadas + API routes). El nonce se inyecta en:
  //   1. Header `x-nonce` de la request → layout.tsx lo lee para pasar a
  //      <script> inline y a ConsentBanner.
  //   2. CSP response header → reemplaza 'unsafe-inline' en script-src.
  //
  // NOTA: Las rutas públicas (home, noticias, etc.) NO pasan por este
  // middleware — siguen usando el CSP estático de next.config.ts con
  // 'unsafe-inline'. El trade-off es aceptable: las rutas sensibles
  // (quiniela, perfil, admin) tienen nonce; las páginas de contenido no.
  const nonce = randomBytes(16).toString('base64')

  const isDev = process.env.NODE_ENV !== 'production'
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://www.googletagmanager.com https://www.clarity.ms`
    : `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com https://www.clarity.ms`

  const cspHeader = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.sanity.io https://cdn.sanity.io https://site.api.espn.com https://v3.football.api-sports.io https://v2.nba.api-sports.io https://v1.formula-1.api-sports.io https://v1.tennis.api-sports.io https://v1.mma.api-sports.io https://v1.rugby.api-sports.io https://api.the-odds-api.com https://graph.instagram.com https://api.instagram.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://*.clarity.ms",
    "worker-src 'self'",
    "frame-src https://www.instagram.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  // Pasar nonce al request para que layout.tsx lo lea vía headers()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    res.headers.set('Content-Security-Policy', cspHeader)
    return res
  }

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // Refresh session — do not remove
  await supabase.auth.getUser()

  // Añadir CSP con nonce a la respuesta de las rutas cubiertas por este middleware.
  supabaseResponse.headers.set('Content-Security-Policy', cspHeader)

  return supabaseResponse
}

// Allowlist: el middleware solo corre en rutas que dependen de la sesión
// de Supabase (refresh del cookie). Todo lo público (home, noticias, partidos,
// sitemaps, OG images, /api/events/*, crons, etc.) queda fuera para no gastar
// Function Invocations + Fluid CPU en cada request.
export const config = {
  matcher: [
    // Páginas autenticadas
    '/perfil/:path*',
    '/admin/:path*',
    '/archivo',
    '/quiniela/:path*',
    // Endpoints API con dependencia de sesión Supabase
    '/api/auth/:path*',
    '/api/articles/:path*',
    '/api/reels/:path*',
    '/api/search/:path*',
    '/api/push/:path*',
    '/api/rankings/:path*',
    '/api/games/:path*',
    '/api/quiniela/:path*',
  ],
}
