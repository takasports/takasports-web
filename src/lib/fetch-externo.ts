/**
 * Llamadas de servidor a APIs de terceros (ESPN y similares) con dos garantías
 * que el `fetch` a pelo no da:
 *
 *  1. Límite de tiempo. Sin él, una conexión colgada retiene la función hasta
 *     su máximo (hubo peticiones de 300 s en los registros de sep-2026).
 *  2. Que el fallo DEJE RASTRO. Los llamantes devuelven `[]`/`null` cuando la
 *     fuente falla —es lo correcto para la página—, pero lo hacían en silencio:
 *     cuando ESPN mató el rango de fechas el 15/09/2026 se cayeron calendario,
 *     archivo y quiniela sin una sola línea en los logs.
 *
 * Contrato: NUNCA lanza. Devuelve `null` si hay error de red, se agota el
 * tiempo o la respuesta no es 2xx (y, en la variante JSON, si el cuerpo no se
 * puede leer), y deja un `console.warn` con la URL sin secretos, el estado y
 * la duración. El llamante sigue decidiendo qué devolver (`[]`, `null`...).
 *
 * Las opciones de caché de Next (`next: { revalidate }`, `cache`) pasan tal cual.
 */

export const TIMEOUT_EXTERNO_MS = 8_000

export interface OpcionesExterno {
  /** Tope en milisegundos. Por defecto 8 s. */
  timeoutMs?: number
  /** Prefijo del aviso en los logs, p. ej. 'upcoming' → "[upcoming] …". */
  etiqueta?: string
}

// Parámetros cuyo valor nunca debe acabar en un log.
const PARAM_SECRETO = /(key|token|secret|signature|sig|password|pass|auth|credential)/i

/** URL apta para log: sin valores de parámetros sensibles ni usuario/clave. */
export function urlParaLog(url: string): string {
  try {
    const u = new URL(url)
    u.username = ''
    u.password = ''
    for (const k of [...u.searchParams.keys()]) {
      if (PARAM_SECRETO.test(k)) u.searchParams.set(k, '***')
    }
    return u.toString().replace(/%2A%2A%2A/g, '***')
  } catch {
    // No es una URL absoluta: se queda solo la parte anterior a la query.
    return url.split('?')[0]
  }
}

function combinarSenales(propia: AbortSignal | null | undefined, timeoutMs: number): AbortSignal {
  const tope = AbortSignal.timeout(timeoutMs)
  if (!propia) return tope
  return AbortSignal.any([propia, tope])
}

function aviso(etiqueta: string, url: string, detalle: string, inicio: number) {
  const ms = Date.now() - inicio
  console.warn(`[${etiqueta}] fallo externo ${urlParaLog(url)} → ${detalle} (${ms} ms)`)
}

function describirError(err: unknown, timeoutMs: number): string {
  const name = (err as { name?: string } | null)?.name
  if (name === 'TimeoutError') return `timeout ${timeoutMs} ms`
  if (name === 'AbortError') return 'abortado'
  const msg = err instanceof Error ? err.message : String(err)
  return `error de red: ${msg}`
}

/**
 * `fetch` con tope de tiempo y aviso en log. Devuelve la respuesta solo si es
 * 2xx; en cualquier otro caso, `null`.
 */
export async function fetchExterno(
  url: string,
  init: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {},
  opciones: OpcionesExterno = {},
): Promise<Response | null> {
  const timeoutMs = opciones.timeoutMs ?? TIMEOUT_EXTERNO_MS
  const etiqueta = opciones.etiqueta ?? 'fetch-externo'
  const inicio = Date.now()
  try {
    const res = await fetch(url, { ...init, signal: combinarSenales(init.signal, timeoutMs) })
    if (!res.ok) {
      aviso(etiqueta, url, `HTTP ${res.status}`, inicio)
      return null
    }
    return res
  } catch (err) {
    aviso(etiqueta, url, describirError(err, timeoutMs), inicio)
    return null
  }
}

/**
 * Igual que `fetchExterno`, pero devuelve el JSON ya leído (o `null`). La
 * lectura del cuerpo cae bajo el mismo tope de tiempo que la petición.
 */
export async function fetchJsonExterno<T = unknown>(
  url: string,
  init: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {},
  opciones: OpcionesExterno = {},
): Promise<T | null> {
  const inicio = Date.now()
  const res = await fetchExterno(url, init, opciones)
  if (!res) return null
  try {
    return (await res.json()) as T
  } catch (err) {
    const timeoutMs = opciones.timeoutMs ?? TIMEOUT_EXTERNO_MS
    const name = (err as { name?: string } | null)?.name
    const detalle = name === 'TimeoutError' || name === 'AbortError'
      ? describirError(err, timeoutMs)
      : 'JSON ilegible'
    aviso(opciones.etiqueta ?? 'fetch-externo', url, detalle, inicio)
    return null
  }
}
