// Reglas puras del registro de tokens de la APP sin sesión
// (/api/app/push-token). Aparte para poder probarlas sin red.

/** Raíces de tema que la app puede pedir. Lo demás se descarta en silencio. */
export const RAICES_TEMA: ReadonlySet<string> = new Set(['noticias', 'quiniela', 'predicciones', 'calendario', 'equipo'])
export const MAX_TEMAS = 10

/** `noticias`, `noticias:futbol`… en minúsculas, sin duplicados, como mucho 10. */
export function sanearTemas(entrada: unknown): string[] | null {
  if (entrada === undefined) return null // no viene → no se tocan los que hubiera
  if (!Array.isArray(entrada)) return []
  const out: string[] = []
  for (const t of entrada) {
    if (typeof t !== 'string') continue
    const v = t.trim().toLowerCase()
    if (!/^[a-z0-9]+(:[a-z0-9_-]{1,30})?$/.test(v)) continue
    if (!RAICES_TEMA.has(v.split(':')[0])) continue
    if (!out.includes(v)) out.push(v)
    if (out.length >= MAX_TEMAS) break
  }
  return out
}

export function sanearPlataforma(p: unknown): 'ios' | 'android' | null {
  return p === 'ios' || p === 'android' ? p : null
}

/**
 * Fila resultante de un registro. Reglas:
 *  · El `user_id` SOLO lo pone el servidor a partir de una sesión verificada.
 *  · Un registro sin sesión NO desvincula un token que ya tenía dueño: la baja
 *    al cerrar sesión la hace la app borrando la fila (clearPushToken).
 *  · Sin `topics` en la petición, se conservan los que hubiera.
 */
export function filaRegistro(input: {
  token: string
  platform: 'ios' | 'android' | null
  temas: string[] | null
  userId: string | null
  existente: { user_id: string | null; topics: string[] | null; platform: string | null } | null
  ahoraIso: string
}): { token: string; user_id: string | null; platform: string | null; topics: string[]; updated_at: string } {
  const e = input.existente
  return {
    token: input.token,
    user_id: input.userId ?? e?.user_id ?? null,
    platform: input.platform ?? e?.platform ?? null,
    topics: input.temas ?? e?.topics ?? [],
    updated_at: input.ahoraIso,
  }
}
