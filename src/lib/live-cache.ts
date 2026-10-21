// Frescura de /api/events/live (ticker «En vivo», calendario, app). Lógica pura
// con test; el route solo la aplica.
//
// Medido en producción el 21/10/2026 (J1 japonesa): el minuto llegaba a
// /api/events/live 50 s de mediana después que al scoreboard de ESPN (máx. 80 s;
// goles: 30-70 s). Cuatro capas en serie, todas de ~20 s:
//   1. Data Cache de Next sobre cada scoreboard (`revalidate: 20`). Al caducar
//      devuelve lo VIEJO y refresca por detrás → siempre una vuelta atrasado.
//   2. Caché en memoria del route (LIVE_TTL 20 s).
//   3. Borde: s-maxage=20 + stale-while-revalidate=40.
//   4. Sondeo del cliente.
//
// Qué cambia y por qué no sube el coste:
//   · Las ligas que tenían un partido EN JUEGO en la vuelta anterior piden su
//     scoreboard sin Data Cache. Las demás (la gran mayoría, ~45 ligas) siguen
//     con 20 s: un partido que empieza tarda como mucho una vuelta más en verse.
//     ESPN es gratis y cachea 1-10 s en su propia CDN.
//   · La memoria baja a 10 s. Solo evita repetir las llamadas a ESPN cuando
//     varias regiones del borde fallan a la vez; no cambia cuántas veces se
//     ejecuta la función, que lo decide el borde.
//   · Borde: s-maxage se queda en 20 s (ejecuciones idénticas) y el swr baja de
//     40 a 10 s: el que llega tras un rato sin visitas ya no recibe una respuesta
//     de hasta 60 s.

export const LIVE_MEMORY_TTL_MS = 10_000
export const IDLE_MEMORY_TTL_MS = 5 * 60_000

export function liveCacheHeaders(hasLive: boolean): Record<string, string> {
  const sMax = hasLive ? 20 : 120
  const swr  = hasLive ? 10 : 300
  const cc = `public, s-maxage=${sMax}, stale-while-revalidate=${swr}`
  return { 'Cache-Control': cc, 'CDN-Cache-Control': cc }
}

/** Opciones de fetch para el scoreboard de una liga: sin Data Cache si tenía
 *  algo en juego en la vuelta anterior; 20 s si no. */
export function scoreboardFetchInit(leagueWasLive: boolean): RequestInit & { next?: { revalidate: number } } {
  return leagueWasLive ? { cache: 'no-store' } : { next: { revalidate: 20 } }
}
