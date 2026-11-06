// Reglas puras del registro de tokens de la APP sin sesión
// (/api/app/push-token). Aparte para poder probarlas sin red.

/** Raíces de tema que la app puede pedir. Lo demás se descarta en silencio. */
export const RAICES_TEMA: ReadonlySet<string> = new Set(['noticias', 'quiniela', 'predicciones', 'calendario', 'equipo', 'agenda'])
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

export const MAX_EQUIPOS = 30

/** Nombres de equipos seguidos, sin duplicados. `null` si no viene: no se tocan los que hubiera. */
export function sanearEquipos(entrada: unknown): string[] | null {
  if (entrada === undefined) return null
  if (!Array.isArray(entrada)) return []
  const out: string[] = []
  for (const t of entrada) {
    if (typeof t !== 'string') continue
    const v = t.trim().slice(0, 60)
    if (!v || out.some(x => x.toLowerCase() === v.toLowerCase())) continue
    out.push(v)
    if (out.length >= MAX_EQUIPOS) break
  }
  return out
}

/** Zona IANA del móvil, o `null` si no es válida o no viene. */
export function sanearZona(entrada: unknown): string | null {
  if (typeof entrada !== 'string' || !entrada || entrada.length > 64) return null
  try {
    new Intl.DateTimeFormat('es-ES', { timeZone: entrada })
    return entrada
  } catch {
    return null
  }
}

export function sanearPlataforma(p: unknown): 'ios' | 'android' | null {
  return p === 'ios' || p === 'android' ? p : null
}

/**
 * Fila resultante de un registro. Reglas:
 *  · El `user_id` SOLO lo pone el servidor a partir de una sesión verificada.
 *  · Un registro sin sesión NO desvincula un token que ya tenía dueño: la baja
 *    al cerrar sesión la hace la app borrando la fila (clearPushToken).
 *  · Sin `topics`, `teams` o `timezone` en la petición, se conserva lo que hubiera.
 */
export function filaRegistro(input: {
  token: string
  platform: 'ios' | 'android' | null
  temas: string[] | null
  equipos?: string[] | null
  zona?: string | null
  userId: string | null
  existente: {
    user_id: string | null; topics: string[] | null; platform: string | null
    teams?: string[] | null; timezone?: string | null
  } | null
  ahoraIso: string
}): {
  token: string; user_id: string | null; platform: string | null; topics: string[]
  teams: string[]; timezone: string | null; updated_at: string
} {
  const e = input.existente
  return {
    token: input.token,
    user_id: input.userId ?? e?.user_id ?? null,
    platform: input.platform ?? e?.platform ?? null,
    topics: input.temas ?? e?.topics ?? [],
    teams: input.equipos ?? e?.teams ?? [],
    timezone: input.zona ?? e?.timezone ?? null,
    updated_at: input.ahoraIso,
  }
}
