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

/**
 * Sanea un apodo/nickname de entrada de usuario para guardar y mostrar en UI
 * pública (chat de ligas, etc.). Quita caracteres de control y los ángulos
 * `<>` (defensa en profundidad frente a inyección aunque React ya escape al
 * pintar), colapsa espacios/saltos de línea, recorta y limita a `max`.
 * Devuelve '' si no queda nada usable (el caller elige el fallback, p.ej. 'Anon').
 */
export function sanitizeNickname(raw: unknown, max = 24): string {
  const collapsed = String(raw ?? '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ') // \n, \t, etc. → un solo espacio
  let cleaned = ''
  for (const ch of collapsed) {
    const code = ch.codePointAt(0) ?? 0
    // Salta los caracteres de control no-espacio restantes (C0 < 0x20 y DEL 0x7F).
    if (code < 0x20 || code === 0x7f) continue
    cleaned += ch
  }
  return cleaned.trim().slice(0, max)
}
