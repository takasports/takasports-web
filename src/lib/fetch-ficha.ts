// Lectura de las APIs propias que alimentan las fichas (jugador, equipo, partido).
//
// Distingue «no existe» de «no se pudo leer», que antes salían igual (null):
//   - 404/400 de la API → null → la ficha responde 404.
//   - 5xx, red caída o timeout → lanza. En ISR eso deja servida la última versión
//     buena en vez de sustituirla por un 404; en una ficha nunca generada sale el
//     error.tsx con un 500, que Google reintenta sin desindexar.
// Antes un timeout de ESPN cacheaba la ficha como «no encontrada» con noindex.

import { SITE_URL } from '@/lib/constants'

export class FichaFetchError extends Error {}

export function fichaApiBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.NODE_ENV === 'production' ? SITE_URL : 'http://localhost:3000')
}

export async function fetchFicha<T>(path: string, revalidate: number): Promise<T | null> {
  const res = await fetch(`${fichaApiBase()}${path}`, { next: { revalidate } })
  if (res.status === 404 || res.status === 400) return null
  if (!res.ok) throw new FichaFetchError(`${path} → HTTP ${res.status}`)
  return (await res.json()) as T | null
}
