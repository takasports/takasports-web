import { createServerClient } from '@supabase/ssr'
import { createClient, type User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* Server Component — middleware handles refresh */ }
        },
      },
    }
  )
}

/**
 * Devuelve el usuario autenticado de una NextRequest. Acepta dos formas:
 *
 *  1. `Authorization: Bearer <access_token>` — preferido cuando está
 *     presente. Lo usan clientes que no manejan cookies (takasports-app
 *     vía fetch nativo, scripts CLI, etc.).
 *  2. Cookies de Supabase SSR — fallback estándar del web.
 *
 * Devuelve `null` si no hay credencial válida o si Supabase no está
 * configurado. Los handlers que requieran auth deben tratar `null`
 * como 401. Es seguro de usar en cualquier route handler — no setea
 * cookies (idéntico al `supaForRoute` que reemplaza).
 */
export async function getUserFromRequest(req: NextRequest): Promise<User | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  // 1. Bearer token (móvil / clientes sin cookies)
  const auth = req.headers.get('authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    if (token) {
      const sb = createClient(url, key, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data } = await sb.auth.getUser()
      if (data?.user) return data.user
    }
  }

  // 2. Cookies (web SSR / route handlers)
  const sb = createServerClient(url, key, {
    cookies: {
      getAll() { return req.cookies.getAll() },
      setAll() { /* no-op */ },
    },
  })
  const { data } = await sb.auth.getUser()
  return data?.user ?? null
}
