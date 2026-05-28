// Autenticación de páginas /admin/* — server-side.
//
// Reemplaza el patrón anterior `?token=$RANKINGS_ADMIN_TOKEN` (token expuesto
// en URL, historial, Referer, logs de Vercel) por una validación basada en la
// sesión Supabase + allowlist de emails en la env `ADMIN_EMAILS` (CSV).
//
// Uso típico:
//   export default async function AdminPage() {
//     await requireAdmin()       // redirige si no es admin
//     // ... contenido ...
//   }
//
// La variable `ADMIN_EMAILS` se compara case-insensitive contra el email del
// usuario autenticado. Si no está seteada en producción, todas las páginas
// /admin/* quedan cerradas (falla cerrada por defecto).

import { redirect } from 'next/navigation'
import { createServerSupabaseClient, getUserFromRequest } from '@/lib/supabase-server'
import { checkHeaderSecret } from '@/lib/auth-utils'
import type { NextRequest } from 'next/server'

function parseAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return new Set(
    raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  )
}

/**
 * Comprueba si el usuario actual (por sesión Supabase) está en la allowlist
 * de admins. No redirige — útil cuando una API o componente quiere comportarse
 * distinto sin abandonar la página.
 */
export async function isAdminUser(): Promise<boolean> {
  const allowed = parseAdminEmails()
  if (allowed.size === 0) return false
  const sb = await createServerSupabaseClient()
  const { data } = await sb.auth.getUser()
  const email = data.user?.email?.toLowerCase()
  return Boolean(email && allowed.has(email))
}

/**
 * Versión que redirige si el usuario no es admin. Usar al principio de
 * cualquier `page.tsx` bajo `/admin/`. Manda al login con `?next=` para volver
 * tras autenticar, o a `/?admin=unauthorized` si la sesión existe pero el
 * email no está en la allowlist.
 */
export async function requireAdmin(currentPath: string): Promise<void> {
  const allowed = parseAdminEmails()
  if (allowed.size === 0) {
    // En producción jamás debería ocurrir; en dev sirve de aviso.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[requireAdmin] ADMIN_EMAILS no está configurado')
    }
    redirect('/?admin=unconfigured')
  }
  const sb = await createServerSupabaseClient()
  const { data } = await sb.auth.getUser()
  const email = data.user?.email?.toLowerCase()
  if (!email) {
    // No hay login dedicado en el sitio — la auth se hace vía AuthModal en
    // /perfil. Mandamos allí con `next` para volver tras autenticar.
    redirect(`/perfil?next=${encodeURIComponent(currentPath)}`)
  }
  if (!allowed.has(email)) {
    redirect('/?admin=unauthorized')
  }
}

/**
 * Versión para route handlers (`/api/...`). Devuelve `true` si:
 *   1. La request trae header secreto `headerName` que coincide con la env
 *      `tokenEnv` (uso de cron/n8n con token compartido), O
 *   2. La sesión Supabase está activa y el email del usuario está en
 *      `ADMIN_EMAILS` (uso desde el panel /admin de un humano logueado).
 *
 * Devuelve `false` si ninguna de las dos vías valida. Es la sustituta de los
 * antiguos `token === expected` directos en cada endpoint admin: permite que
 * el panel UI funcione sin pasar el token estático en URL.
 */
export async function isAdminRequest(
  req: NextRequest,
  opts: { headerName: string; tokenEnv: string | undefined },
): Promise<boolean> {
  // 1. Token compartido (cron/n8n/scripts)
  if (checkHeaderSecret(req.headers.get(opts.headerName), opts.tokenEnv)) {
    return true
  }
  // 2. Sesión Supabase del panel admin
  const allowed = parseAdminEmails()
  if (allowed.size === 0) return false
  const user = await getUserFromRequest(req)
  const email = user?.email?.toLowerCase()
  return Boolean(email && allowed.has(email))
}

