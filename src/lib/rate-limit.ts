// Rate-limit por IP basado en Supabase (`rate_limits` table) con TTL.
//
// Diseñado para endpoints públicos (newsletter, comments, push subscribe,
// reels ingest, comment reports) donde queremos limitar abuso sin montar
// infraestructura aparte (Upstash/Redis). El servicio role saltea RLS y
// hace upserts atómicos.
//
// La tabla `rate_limits` (ver migración 038) tiene la forma:
//   bucket TEXT, key TEXT, window_start TIMESTAMPTZ, count INT,
//   PRIMARY KEY (bucket, key, window_start)
//
// Modelo "fixed window": cada combinación (bucket, key, window_start) cuenta
// un counter; si supera `max`, devolvemos 429. La ventana se redondea a la
// granularidad que pase el caller (60s, 3600s, etc.). Limpia entries viejos
// con un cron (TODO) o con un trigger que purga al hacer upsert.
//
// Modo degradado: si Supabase no está configurado, hace fail-open y deja
// pasar (mejor que romper el endpoint en dev). En producción es responsabilidad
// del deploy garantizar que la tabla existe.

import { adminSupabase } from '@/lib/supabase-admin'

export interface RateLimitOptions {
  /** Nombre lógico del bucket. Ej: `newsletter_subscribe`. */
  bucket: string
  /** Identificador (normalmente IP del cliente o `${ip}:${userId}`). */
  key: string
  /** Tamaño de ventana en segundos. */
  windowSeconds: number
  /** Máximo de eventos en la ventana. */
  max: number
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterSeconds: number
}

function roundWindow(now: number, windowSeconds: number): string {
  const ts = Math.floor(now / 1000 / windowSeconds) * windowSeconds * 1000
  return new Date(ts).toISOString()
}

/**
 * Extrae la IP real del cliente respetando los headers de Vercel.
 *
 * SEGURIDAD (anti-bypass del rate-limit): NO usar el primer valor de
 * `x-forwarded-for`. Ese header es manipulable por el cliente y Vercel, cuando
 * el cliente lo envía, ANTEPONE los valores del cliente y AÑADE la IP real al
 * FINAL → tomar el primero (izquierda) deja que un atacante rote una IP falsa
 * en cada petición y evada el freno por IP. Fuentes de confianza, en orden:
 *   1. `x-real-ip` — lo fija la plataforma (Vercel) con la IP real del cliente
 *      y no es sobreescribible por el cliente.
 *   2. el ÚLTIMO valor de `x-forwarded-for` — la IP que observó el proxy de
 *      confianza (Vercel la añade al final).
 * Si no hay forma fiable, devuelve `'unknown'` (todos comparten cubo, lo cual
 * es conservador). Para tráfico honesto no cambia nada: sin spoofing, primer y
 * último valor coinciden con la IP real. Usar `${ip}:${userId}` cuando se
 * quiera evitar colisiones entre usuarios anónimos.
 */
export function getClientIp(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real

  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean)
    const last = parts[parts.length - 1]
    if (last) return last
  }
  return 'unknown'
}

export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const sb = adminSupabase()
  if (!sb) {
    // Fail-open en dev / si la DB no está configurada.
    return { ok: true, remaining: opts.max, retryAfterSeconds: 0 }
  }

  const now = Date.now()
  const windowStart = roundWindow(now, opts.windowSeconds)

  // Upsert + incremento atómico. La función SQL `rate_limit_hit` (ver
  // migración 038) hace `INSERT … ON CONFLICT DO UPDATE SET count = count + 1`
  // y devuelve el nuevo count. Si la función no existe, caemos a un patrón
  // de "leer + upsert" que es menos preciso bajo concurrencia pero suficiente.
  try {
    const { data, error } = await sb.rpc('rate_limit_hit', {
      p_bucket: opts.bucket,
      p_key: opts.key,
      p_window_start: windowStart,
    })
    if (!error && typeof data === 'number') {
      const count = data
      const ok = count <= opts.max
      const remaining = Math.max(0, opts.max - count)
      const retryAfterSeconds = ok ? 0 : opts.windowSeconds
      return { ok, remaining, retryAfterSeconds }
    }
  } catch {
    // función no existe → fallback
  }

  // Fallback (mejor que nada): lee + upsert. No es atómico y solo funciona si
  // la tabla `rate_limits` existe (migración 038). Si falla, fail-open.
  try {
    const { data: prev, error: readErr } = await sb
      .from('rate_limits')
      .select('count')
      .eq('bucket', opts.bucket)
      .eq('key', opts.key)
      .eq('window_start', windowStart)
      .maybeSingle()
    if (readErr) throw readErr

    const nextCount = (prev?.count ?? 0) + 1
    const { error: upsertErr } = await sb
      .from('rate_limits')
      .upsert(
        { bucket: opts.bucket, key: opts.key, window_start: windowStart, count: nextCount },
        { onConflict: 'bucket,key,window_start' },
      )
    if (upsertErr) throw upsertErr

    const ok = nextCount <= opts.max
    return {
      ok,
      remaining: Math.max(0, opts.max - nextCount),
      retryAfterSeconds: ok ? 0 : opts.windowSeconds,
    }
  } catch {
    // Tabla no existe o error transitorio: fail-open. La auditoría
    // hace seguimiento de cuándo aplicar la migración 038.
    return { ok: true, remaining: opts.max, retryAfterSeconds: 0 }
  }
}
