// Cache compartido de PorraStatus para todos los surfaces (CTA, Hero,
// Widget, Toast). Evita:
//   · 4 copias del mismo readCache/writeCache/STORAGE_KEY en cada
//     componente (riesgo de versionado descoordinado).
//   · Stampede al cargar la home: hasta 3 componentes hacen fetch a
//     /api/quiniela/status casi simultáneamente. Aquí deduplicamos
//     con una promesa in-flight: el primero pide, los demás esperan.
//
// Versionamos la clave de sessionStorage para invalidar caches viejas
// sin tocar al user (bump cuando la shape de PorraStatus cambie).

import type { PorraStatus } from '@/components/PorraCTA'

const STORAGE_KEY = 'porra:status:v2' // v1 → v2: shape extendida (F1-T)
const TTL_MS = 60_000

interface CachedStatus { data: PorraStatus; ts: number }

export function readPorraCache(): PorraStatus | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedStatus
    if (Date.now() - parsed.ts > TTL_MS) return null
    return parsed.data
  } catch { return null }
}

export function writePorraCache(data: PorraStatus): void {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ data, ts: Date.now() })) }
  catch { /* quota / SSR */ }
}

// ── Dedup de fetches in-flight ────────────────────────────────────
// Si varios componentes piden /api/quiniela/status en paralelo, solo
// hacemos UNA request HTTP. Los demás esperan la misma promesa.
let inflight: Promise<PorraStatus | null> | null = null

/** Obtiene PorraStatus: primero cache válido, luego red. Dedupea
 *  fetches concurrentes con una sola promesa compartida. */
export async function fetchPorraStatus(): Promise<PorraStatus | null> {
  // Cache hit válido → resolvemos sincrónicamente (vía Promise.resolve).
  const cached = readPorraCache()
  if (cached) return cached

  // Hay un fetch ya en vuelo → no abrimos otro, esperamos al que existe.
  if (inflight) return inflight

  // Primer fetch: lo guardamos en `inflight` para que los siguientes
  // callers lo esperen. Lo limpiamos al finalizar (éxito o error).
  inflight = (async () => {
    try {
      const r = await fetch('/api/quiniela/status', { cache: 'no-store' })
      if (!r.ok) return null
      const data = (await r.json()) as PorraStatus
      writePorraCache(data)
      return data
    } catch {
      return null
    } finally {
      inflight = null
    }
  })()

  return inflight
}
