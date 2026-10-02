// Foto de los directos para el render del servidor del calendario.
//
// Para qué: la tira «En vivo ahora» del calendario solo existía tras la
// consulta del cliente a /api/events/live, y al aparecer empujaba la lista
// ~300 px (CLS 0,25-0,33 medido en móvil, 02/10/2026). Con esta foto el HTML
// ya trae la tira y el sondeo del cliente solo la corrige si algo cambió.
//
// Coste: se pide al MISMO endpoint que sondean los navegadores (cacheado en
// el borde 20 s), con la caché de datos de Next a 300 s — igual que el
// `revalidate` de la página. Un valor menor bajaría la revalidación de la
// página entera a ese número (en Next la ruta toma el mínimo de sus fetch).
// Tope de 2,5 s: si no llega, la página sale como antes, sin tira.

import { SITE_URL } from './constants'
import type { RawLiveFixture } from '@/components/calendar-live'

function apiBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.NODE_ENV === 'production' ? SITE_URL : 'http://localhost:3000')
}

export async function fetchLiveSnapshot(): Promise<RawLiveFixture[]> {
  try {
    const res = await fetch(`${apiBase()}/api/events/live`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2_500),
    })
    if (!res.ok) return []
    const data: unknown = await res.json()
    return Array.isArray(data) ? (data as RawLiveFixture[]).slice(0, 200) : []
  } catch {
    return []
  }
}
