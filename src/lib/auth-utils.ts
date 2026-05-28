// Utilidades de autenticación compartidas por endpoints admin/cron/ingest.
// Centralizamos la comparación de tokens para usar `timingSafeEqual` y evitar
// que vuelva a colarse un `===` ingenuo en otra ruta.

import { timingSafeEqual } from 'crypto'

/**
 * Compara dos strings en tiempo constante.
 * Devuelve `false` si alguno es vacío/null/undefined o si difieren en longitud.
 * Seguro frente a timing attacks sobre los secretos.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * Valida un header secreto contra una variable de entorno.
 * Si la env no está seteada devuelve `false` (no permite acceso "abierto" por
 * descuido). Útil para `x-admin-token`, `x-cron-secret`, `x-push-secret`, etc.
 */
export function checkHeaderSecret(
  headerValue: string | null | undefined,
  envValue: string | undefined,
): boolean {
  if (!envValue) return false
  return safeEqual(headerValue, envValue)
}

/**
 * Variante que acepta también `Authorization: Bearer <token>` además del header
 * crudo. Útil para crons de Vercel (que mandan Authorization) y para llamadas
 * manuales con curl.
 */
export function checkBearerOrHeader(
  req: { headers: { get: (k: string) => string | null } },
  headerName: string,
  envValue: string | undefined,
): boolean {
  if (!envValue) return false
  const direct = req.headers.get(headerName)
  if (direct && safeEqual(direct, envValue)) return true
  const auth = req.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ')) {
    return safeEqual(auth.slice(7).trim(), envValue)
  }
  return false
}
