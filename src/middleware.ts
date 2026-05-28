import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSameOrigin } from '@/lib/csrf'

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

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
