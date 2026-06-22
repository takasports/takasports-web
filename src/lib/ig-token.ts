// Fuente única del token largo de Instagram.
//
// Orden de resolución:
//   1. Tabla privada `app_secrets` en Supabase (clave `ig_access_token`)
//      — la escribe el callback OAuth y la refresca el WF-10. Autónoma.
//   2. process.env.INSTAGRAM_ACCESS_TOKEN — fallback de bootstrap/local.
//
// La tabla solo es accesible con SUPABASE_SERVICE_ROLE_KEY (RLS sin
// policies), así que esto SOLO debe usarse server-side.

const SUPA   = process.env.NEXT_PUBLIC_SUPABASE_URL
const SVCKEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SECRET_KEY = 'ig_access_token'

function restHeaders() {
  return {
    apikey: SVCKEY ?? '',
    Authorization: `Bearer ${SVCKEY ?? ''}`,
    'Content-Type': 'application/json',
  }
}

export async function getIgTokenFromStore(): Promise<string | null> {
  if (!SUPA || !SVCKEY) return null
  try {
    const res = await fetch(
      `${SUPA}/rest/v1/app_secrets?key=eq.${SECRET_KEY}&select=value`,
      // Cacheable 30 min (NO no-store): el token largo vive 60 días y el WF-10
      // lo refresca cada hora, así que una lectura de hasta 30 min de antigüedad
      // sigue siendo válida. Antes con `cache:'no-store'` esta lectura forzaba a
      // /reels a renderizarse en CADA visita (no-store+MISS); con revalidate la
      // página vuelve a ser ISR cacheable. Alineado con `revalidate` de /reels.
      { headers: restHeaders(), signal: AbortSignal.timeout(5000), next: { revalidate: 1800 } },
    )
    if (!res.ok) return null
    const rows = await res.json()
    return Array.isArray(rows) && rows[0]?.value ? rows[0].value : null
  } catch {
    return null
  }
}

// Token efectivo: store primero, env como respaldo.
export async function getIgToken(): Promise<string | null> {
  return (await getIgTokenFromStore()) ?? process.env.INSTAGRAM_ACCESS_TOKEN ?? null
}

export async function saveIgToken(token: string, expiresInSec?: number): Promise<boolean> {
  if (!SUPA || !SVCKEY) return false
  const expires_at = expiresInSec
    ? new Date(Date.now() + expiresInSec * 1000).toISOString()
    : null
  try {
    const res = await fetch(`${SUPA}/rest/v1/app_secrets`, {
      method: 'POST',
      headers: { ...restHeaders(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        key: SECRET_KEY,
        value: token,
        expires_at,
        updated_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(6000),
    })
    return res.ok
  } catch {
    return false
  }
}

// Renueva el token largo (Graph permite refrescar tokens de >24h y <60d
// de antigüedad; extiende otros 60 días). No requiere login.
export async function refreshIgToken(): Promise<{ ok: boolean; detail: string }> {
  const current = await getIgToken()
  if (!current) return { ok: false, detail: 'sin token actual' }
  try {
    const url = new URL('https://graph.instagram.com/refresh_access_token')
    url.searchParams.set('grant_type', 'ig_refresh_token')
    url.searchParams.set('access_token', current)
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    if (data.error || !data.access_token) {
      return { ok: false, detail: data.error?.message ?? `HTTP ${res.status}` }
    }
    const saved = await saveIgToken(data.access_token, data.expires_in)
    return saved
      ? { ok: true, detail: `renovado, +${Math.floor((data.expires_in ?? 0) / 86400)}d` }
      : { ok: false, detail: 'renovado pero no se pudo persistir' }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'error' }
  }
}
