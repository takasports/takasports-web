import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSameOrigin } from '@/lib/csrf'

// Este middleware cubre SOLO rutas autenticadas + API (ver `config.matcher`):
// aplica el guard CSRF, refresca la sesión de Supabase e inyecta el nonce CSP.
//
// Las rutas públicas de contenido (home, noticias, jugador, calendario,
// rankings, hubs de deporte, …) NO pasan por aquí: son ISR (cada página exporta
// su `revalidate`) y Next emite su propio Cache-Control cacheable de forma
// nativa, así que el CDN las sirve sin invocar ni la función ni el middleware.
//
// HISTÓRICO: el root layout llamaba `await headers()` para leer el nonce CSP, lo
// que marcaba TODA la app como dinámica → Next emitía `no-store` y el middleware
// tenía que reescribir el Cache-Control en cada request de contenido. El refactor
// F3.1 eliminó esa llamada; desde entonces ese atajo era redundante y solo
// generaba Edge Middleware Invocations facturables en cada pageview (la Edge
// Middleware corre ANTES de la caché → se factura incluso en cache HIT), así que
// se retiró junto con las rutas de contenido del matcher.

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
  // crypto.randomUUID() está disponible en el Edge Runtime de Vercel.
  // randomBytes() de Node.js NO lo está → MIDDLEWARE_INVOCATION_FAILED.
  const nonce = crypto.randomUUID().replace(/-/g, '')

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

// Allowlist: SOLO rutas autenticadas + API (mutables por cookie o con sesión
// Supabase). Ejecutan CSRF + refresh de sesión + nonce CSP. Las rutas públicas
// de contenido se sirven por CDN (ISR) sin pasar por este middleware.
export const config = {
  matcher: [
    // Páginas autenticadas
    '/perfil/:path*',
    '/admin/:path*',
    '/archivo',
    '/quiniela/:path*',
    // Endpoints API con dependencia de sesión Supabase / mutables por cookie.
    // El guard CSRF (isSameOrigin) solo bloquea POST/PUT/PATCH/DELETE de origen
    // ajeno; GET y peticiones con Bearer/secret quedan exentas, así que la app
    // móvil y los crons no se ven afectados.
    '/api/auth/:path*',
    // /api/articles y /api/search NO se incluyen: son GET-only públicas (sin
    // POST mutable, sin leer sesión aquí) y ya emiten su propio Cache-Control →
    // pasar por el middleware solo gastaba Edge Middleware Inv. /api/reels SÍ se
    // queda: /api/reels/ingest es POST mutable y necesita el guard CSRF.
    '/api/reels/:path*',
    '/api/push/:path*',
    '/api/rankings/:path*',
    '/api/games/:path*',
    '/api/quiniela/:path*',
    '/api/ranked/:path*',
    '/api/comments/:path*',
    '/api/cosmetics/:path*',
    '/api/account/:path*',
    '/api/mionce/:path*',
    '/api/album/:path*',
    '/api/newsletter/:path*',
  ],
}
