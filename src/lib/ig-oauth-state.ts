// CSRF del OAuth de Instagram (conectar la cuenta que nutre los reels).
//
// El flujo original NO llevaba parámetro `state`: el callback aceptaba un
// `code` de cualquiera y sobrescribía el token guardado en Supabase. Eso abría
// dos ataques:
//   1. CSRF clásico: forzar en el navegador del admin un callback con un
//      `code` ajeno → se guardaría el token de OTRA cuenta de Instagram y los
//      reels pasarían a tirar de ella.
//   2. Auto-servicio: cualquiera recorriendo el flujo entero desde su propio
//      navegador dejaba SU cuenta conectada (el callback no exigía auth).
//
// Cierre: (a) solo un admin puede INICIAR el flujo (gate en /auth), y al
// iniciarlo se emite un `state` aleatorio guardado en cookie httpOnly; (b) el
// /callback exige que el `state` que devuelve Instagram COINCIDA con el de la
// cookie (comparación en tiempo constante). Sin cookie válida no hay canje.
//
// Estas funciones son PURAS (sin I/O) para poder testarlas; las rutas solo
// orquestan cookies + redirección.

import { randomBytes, timingSafeEqual } from 'node:crypto'

export const IG_STATE_COOKIE = 'ig_oauth_state'
export const IG_STATE_MAX_AGE = 600 // 10 min: margen de sobra para dar permiso

/** Token opaco de 32 bytes en hex (64 chars). */
export function generateOAuthState(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Compara el `state` de la cookie con el que devuelve Instagram, en tiempo
 * constante. Falso si alguno falta, si difieren en longitud o si no coinciden.
 */
export function stateMatches(
  cookieState: string | null | undefined,
  queryState: string | null | undefined,
): boolean {
  if (!cookieState || !queryState) return false
  const a = Buffer.from(cookieState)
  const b = Buffer.from(queryState)
  if (a.length !== b.length) return false // timingSafeEqual exige misma longitud
  return timingSafeEqual(a, b)
}

/** Serializa el `Set-Cookie` que fija el `state` (single-use, httpOnly, Lax). */
export function buildStateCookie(state: string, secure: boolean): string {
  return serializeCookie(state, IG_STATE_MAX_AGE, secure)
}

/** Serializa el `Set-Cookie` que BORRA el `state` (Max-Age=0). */
export function buildClearStateCookie(secure: boolean): string {
  return serializeCookie('', 0, secure)
}

function serializeCookie(value: string, maxAge: number, secure: boolean): string {
  // Path acotado a las rutas de Instagram; SameSite=Lax es OBLIGATORIO para que
  // la cookie viaje en la redirección top-level de vuelta desde instagram.com
  // (Strict la omitiría → el `state` nunca casaría y se rompería la conexión
  // legítima). Al ser httpOnly, ningún script del navegador puede leerla.
  const parts = [
    `${IG_STATE_COOKIE}=${value}`,
    'Path=/api/instagram',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

/** Lee el valor de una cookie del header `Cookie` crudo (sin dependencias). */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) {
      return part.slice(eq + 1).trim()
    }
  }
  return null
}
