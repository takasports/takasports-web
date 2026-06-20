// CSRF guard ligero por validación de `Origin`.
//
// Los endpoints autenticados por cookie Supabase (comentarios, quiniela,
// push/subscribe, etc.) son vulnerables a CSRF si un sitio tercero puede
// emitir un POST contra ellos llevando la cookie del usuario. Como TakaSports
// no expone API pública cross-origin, exigimos que `Origin` (o, en su defecto,
// `Referer`) apunte a NEXT_PUBLIC_SITE_URL en métodos mutables.
//
// Uso típico en un route handler:
//
//   if (!isSameOrigin(req)) {
//     return NextResponse.json({ error: 'csrf' }, { status: 403 })
//   }
//
// Notas:
//   · GET/HEAD/OPTIONS están exentos: no son state-changing y los navegadores
//     los emiten cross-origin sin cookies en muchos contextos (preflight,
//     sub-recursos). Solo POST/PUT/PATCH/DELETE deben validar.
//   · Las apps nativas (takasports-app, atajos iOS) no envían `Origin` con
//     fetch nativo. Si presentan `Authorization: Bearer`, se les considera
//     seguras (no usan cookies → no hay CSRF).
//   · `NEXT_PUBLIC_SITE_URL` debe ser la URL canónica (con `https://www.`)
//     en producción. En dev se aceptan localhost:* automáticamente.

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const u = new URL(value)
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

function isLocalhost(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(origin)
}

// Headers de auth server-to-server (n8n, scripts, crons externos). Si la
// request los lleva, no usa cookies de navegador → no hay riesgo CSRF.
const SERVER_AUTH_HEADERS = [
  'x-admin-token',
  'x-admin-secret',
  'x-cron-secret',
  'x-push-secret',
  'x-reels-secret',
] as const

export function isSameOrigin(req: Request): boolean {
  const method = req.method.toUpperCase()
  if (!MUTATING_METHODS.has(method)) return true

  // Las apps móviles/CLI suelen pasar Bearer token; no usan cookies → sin CSRF.
  const auth = req.headers.get('authorization') ?? ''
  if (auth.toLowerCase().startsWith('bearer ')) return true

  // Llamadas server-to-server con header secreto compartido (n8n, crons, etc.)
  for (const h of SERVER_AUTH_HEADERS) {
    if (req.headers.get(h)) return true
  }

  const expected = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL)
  const origin = normalizeOrigin(req.headers.get('origin'))
  const referer = normalizeOrigin(req.headers.get('referer'))
  const candidate = origin ?? referer
  if (!candidate) {
    // Sin Origin ni Referer: el navegador no debería emitir POST autenticado
    // así. Lo rechazamos salvo en dev (donde a veces se llama con curl).
    return process.env.NODE_ENV !== 'production'
  }

  // Same-origin REAL: si el host del Origin/Referer coincide con el Host de la
  // petición, es el MISMO sitio. No depende de NEXT_PUBLIC_SITE_URL (que puede
  // no estar configurada en el entorno → si no, rechazaría peticiones legítimas
  // del propio sitio). El navegador fija el Host según la URL destino; un sitio
  // atacante no puede falsearlo, así que esto sigue bloqueando el CSRF real.
  const reqHost = req.headers.get('host')
  let candidateHost: string | null = null
  try { candidateHost = new URL(candidate).host } catch { /* candidate ya viene normalizado */ }
  if (reqHost && candidateHost && candidateHost === reqHost) return true

  if (expected && candidate === expected) return true
  if (process.env.NODE_ENV !== 'production' && isLocalhost(candidate)) return true
  return false
}
