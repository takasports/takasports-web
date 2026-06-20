// Utilidades compartidas para las rutas de API.
//
// Objetivo: una sola forma de error ({ error: <code> }) y un parseo de cuerpo
// JSON que NUNCA tira un 500 ni filtra el texto crudo de la excepción al
// cliente cuando llega un body malformado.

import { NextResponse } from 'next/server'

export type ApiErrorBody = { error: string }

/**
 * Respuesta de error canónica: { error: <code> } con el status dado.
 * `code` es una etiqueta estable y segura (p.ej. 'invalid_json', 'server_error'),
 * nunca el mensaje de una excepción. `extra` permite añadir campos auxiliares
 * (p.ej. retryAfter) manteniendo la clave `error`.
 */
export function apiError(
  code: string,
  status = 400,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(extra ? { error: code, ...extra } : { error: code }, { status })
}

/**
 * Lee y parsea el cuerpo JSON de una petición de forma segura.
 *
 * - Si el cuerpo NO es JSON válido (o falta), devuelve { error: NextResponse }
 *   con un 400 { error: 'invalid_json' } — nunca un 500 ni el texto de la
 *   excepción.
 * - Si es válido, devuelve { data } tipado como T.
 *
 * Uso:
 *   const parsed = await readJson<MiBody>(req)
 *   if ('error' in parsed) return parsed.error
 *   const body = parsed.data
 */
export async function readJson<T = unknown>(
  req: Request,
): Promise<{ data: T } | { error: NextResponse }> {
  try {
    return { data: (await req.json()) as T }
  } catch {
    return { error: apiError('invalid_json', 400) }
  }
}
