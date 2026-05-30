import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSameOrigin } from '@/lib/csrf'

// Reglas de cache para rutas públicas de contenido.
// Necesarias porque el root layout llama await headers() para leer el nonce CSP,
// lo que marca toda la app como dinámica → Next emite por defecto
// `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`,
// catastrófico para SEO (Googlebot deja de mantener URLs indexadas) y para
// Vercel CDN (x-vercel-cache: MISS en cada request).
//
// El header de next.config.ts no funciona porque Next sobrescribe a nivel de
// runtime. Middleware sí puede modificar el header de respuesta.
type CacheRule = { pattern: RegExp; cache: string }
const CONTENT_CACHE = 'public, s-maxage=600, stale-while-revalidate=86400'
const FAST_CACHE    = 'public, s-maxage=120, stale-while-revalidate=3600'
const SLOW_CACHE    = 'public, s-maxage=3600, stale-while-revalidate=86400'
const CACHE_RULES: CacheRule[] = [
  { pattern: /^\/noticias(\/|$)/,     cache: CONTENT_CACHE },
  { pattern: /^\/tag\//,              cache: CONTENT_CACHE },
  { pattern: /^\/equipo\//,           cache: CONTENT_CACHE },
  { pattern: /^\/jugador\//,          cache: CONTENT_CACHE },
  { pattern: /^\/evento\//,           cache: CONTENT_CACHE },
  { pattern: /^\/rankings(\/|$)/,     cache: CONTENT_CACHE },
  { pattern: /^\/reels$/,             cache: CONTENT_CACHE },
  { pattern: /^\/partido\//,          cache: FAST_CACHE },
  { pattern: /^\/calendario(\/|$)/,   cache: FAST_CACHE },
  { pattern: /^\/estadisticas(\/|$)/, cache: FAST_CACHE },
  { pattern: /^\/liga\//,             cache: FAST_CACHE },
  { pattern: /^\/glosario(\/|$)/,     cache: SLOW_CACHE },
  { pattern: /^\/autor\//,            cache: SLOW_CACHE },
  { pattern: /^\/sobre$/,             cache: SLOW_CACHE },
  { pattern: /^\/politica-editorial$/, cache: SLOW_CACHE },
  { pattern: /^\/privacidad$/,        cache: SLOW_CACHE },
  { pattern: /^\/terminos$/,          cache: SLOW_CACHE },
  { pattern: /^\/(futbol|baloncesto|f1|motogp|tenis|ufc|mundial)$/, cache: CONTENT_CACHE },
  { pattern: /^\/$/,                  cache: CONTENT_CACHE },
]

function getCacheControl(pathname: string): string | null {
  for (const r of CACHE_RULES) if (r.pattern.test(pathname)) return r.cache
  return null
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ── Caso rápido: rutas públicas de contenido ─────────────────────────────
  // Solo necesitan override del Cache-Control. Sin Supabase, sin CSP nonce.
  // Coste mínimo en Function Invocations: ~5ms de CPU, sin I/O externa.
  const cache = getCacheControl(pathname)
  if (cache && !pathname.startsWith('/api/')) {
    const res = NextResponse.next()
    res.headers.set('Cache-Control', cache)
    return res
  }

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

// Allowlist:
//
// (A) Rutas autenticadas / API → ejecutan toda la lógica (CSRF, Supabase, CSP nonce).
//
// (B) Rutas públicas de contenido → solo el shortcut de Cache-Control al inicio.
//     Necesario porque Next emite `no-store` por defecto cuando el root layout
//     llama await headers(), lo que hace que Googlebot deindexe URLs y Vercel
//     CDN nunca cachee. El middleware sobrescribe el header tras el render.
//     Coste: ~150k Function Invocations/mes para ~1k visitas/día (dentro del
//     free tier de Vercel con holgura).
export const config = {
  matcher: [
    // (A) Páginas autenticadas
    '/perfil/:path*',
    '/admin/:path*',
    '/archivo',
    '/quiniela/:path*',
    // (A) Endpoints API con dependencia de sesión Supabase
    '/api/auth/:path*',
    '/api/articles/:path*',
    '/api/reels/:path*',
    '/api/search/:path*',
    '/api/push/:path*',
    '/api/rankings/:path*',
    '/api/games/:path*',
    '/api/quiniela/:path*',
    // (B) Rutas públicas de contenido — solo Cache-Control override
    '/',
    '/noticias/:path*',
    '/tag/:path*',
    '/equipo/:path*',
    '/jugador/:path*',
    '/evento/:path*',
    '/rankings/:path*',
    '/reels',
    '/partido/:path*',
    '/calendario/:path*',
    '/estadisticas/:path*',
    '/liga/:path*',
    '/glosario/:path*',
    '/autor/:path*',
    '/sobre',
    '/politica-editorial',
    '/privacidad',
    '/terminos',
    '/futbol',
    '/baloncesto',
    '/f1',
    '/motogp',
    '/tenis',
    '/ufc',
    '/mundial',
  ],
}
