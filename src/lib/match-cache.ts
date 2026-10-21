// Frescura de la caché de borde de /api/match/[ref] según el ESTADO del partido
// y la HORA del saque. Lógica pura (con test) para que el route solo la aplique.
//
// Lo que se midió en producción el 21/10/2026 (J1 japonesa, 10 partidos en
// juego, muestreo cada 10 s durante 25 min con el borde siempre caliente): los
// goles llegaban a /api/match ~40 s después que al summary de ESPN y el minuto
// 40 s de mediana (máx. 90 s), y el borde servía respuestas de hasta 30 s con
// la mitad marcadas STALE. A eso el cliente suma su sondeo de 20 s. Las capas:
//   1. El summary de ESPN pasaba por el Data Cache de Next (`revalidate: 15`).
//      Ese caché, cuando caduca, devuelve lo VIEJO y refresca por detrás: cada
//      vez que el borde pedía una respuesta nueva, la función la construía con
//      el summary de la vez anterior (15-30 s de retraso fijo). Eso ya no está:
//      el summary se pide sin Data Cache (ver espnJson en el route).
//   2. `s-maxage=15, stale-while-revalidate=60`: con el swr de 60, quien llega a
//      una ficha sin visitas recientes recibe una respuesta de hasta 75 s y solo
//      la SIGUIENTE petición trae la buena. En directo el swr baja a 5 s.
//   3. El sondeo del cliente (20 s en web y app) — no se toca aquí.
//
// Lo que NO cambia es el número de veces que se ejecuta la función: el borde
// sigue colapsando a todos los que miran el mismo partido en una sola ejecución
// por ventana de s-maxage y región. Por eso s-maxage se queda en 15 s en directo:
// bajarlo a 10 s sería un 50 % más de ejecuciones por partido seguido.
//
// Antes del saque, en cambio, sí se gana: un partido PROGRAMADO tenía 5 min de
// caché (+20 min de swr) hasta el mismo pitido inicial, así que el paso a «en
// vivo» y las alineaciones (ESPN las publica ~1 h antes) llegaban hasta 5 min
// tarde. Ahora: 2 min en las 2 h previas y caché de directo desde 10 min antes.
// Terminado: 1 h, como siempre (es lo que más visitas de bots recibe).

export interface MatchCachePolicy {
  sMaxAge: number
  swr: number
}

// Estados terminales. STATUS_END_OF_REGULATION NO está a propósito: en una copa
// es el «final del tiempo reglamentario» antes de la prórroga, y con 1 h de caché
// la prórroga no se habría visto. Tratado como directo, que es lo seguro.
export const MATCH_FINAL_STATUSES = new Set([
  'STATUS_FULL_TIME', 'STATUS_FINAL', 'STATUS_FINAL_PEN', 'STATUS_FINAL_AET',
  'STATUS_POST_GAME',
  'STATUS_CANCELED', 'STATUS_ABANDONED', 'STATUS_FORFEIT', 'STATUS_WALKOVER', 'STATUS_RETIRED',
])
export const MATCH_UPCOMING_STATUSES = new Set(['STATUS_SCHEDULED', 'STATUS_PRE_GAME'])

export const LIVE_POLICY: MatchCachePolicy        = { sMaxAge: 15,   swr: 5 }
export const PREMATCH_POLICY: MatchCachePolicy    = { sMaxAge: 120,  swr: 60 }
export const UPCOMING_POLICY: MatchCachePolicy    = { sMaxAge: 300,  swr: 1200 }
export const FINAL_POLICY: MatchCachePolicy       = { sMaxAge: 3600, swr: 14_400 }

const MIN = 60_000
const HOUR = 60 * MIN

export function matchCachePolicy(
  status: string | undefined,
  startDate: string | undefined,
  now: number = Date.now(),
): MatchCachePolicy {
  const s = status ?? ''
  const start = startDate ? Date.parse(startDate) : NaN
  const hasStart = !Number.isNaN(start)

  if (MATCH_FINAL_STATUSES.has(s)) return FINAL_POLICY

  if (MATCH_UPCOMING_STATUSES.has(s)) {
    if (!hasStart) return UPCOMING_POLICY
    const toKickoff = start - now
    // Desde 10 min antes del saque (y si el saque ya pasó pero ESPN aún no ha
    // cambiado el estado: retrasos, o su propio desfase) → como en directo, para
    // que el paso a «en vivo» se vea al momento.
    if (toKickoff <= 10 * MIN) return LIVE_POLICY
    if (toKickoff <= 2 * HOUR) return PREMATCH_POLICY
    return UPCOMING_POLICY
  }

  // En juego, descanso, prórroga, penaltis o estado desconocido → directo. Nunca
  // se sobre-cachea un partido que podría estar en juego.
  return LIVE_POLICY
}

export function matchCacheHeaders(policy: MatchCachePolicy): Record<string, string> {
  const cc = `public, s-maxage=${policy.sMaxAge}, stale-while-revalidate=${policy.swr}`
  return { 'Cache-Control': cc, 'CDN-Cache-Control': cc }
}
