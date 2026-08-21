// ── Qué parte del calendario viaja en el primer byte ────────────────────────
//
// Medido en producción el 21/08/2026: `/calendario` manda **1,43 MB de HTML**
// (120 KB comprimidos) para enseñar nueve partidos. Los 718 eventos del feed
// viajan DOS veces —una pintados en el DOM y otra serializados en el payload
// RSC, que es el 42% del documento— porque `CalendarioContent` es un componente
// cliente y recibe la lista entera como prop.
//
// El reparto: los días cercanos van en el HTML (que es lo que el lector ve y lo
// que Google indexa) y el resto lo pide el cliente al montar, a `/api/events/feed`,
// que ya está cacheado 300 s en el borde. Con 8 días: 234 eventos y 144 KB en
// vez de 718 y 462 KB.
//
// ⚠️ La ventana se aplica SOLO a lo que viene de ESPN. Lo curado a mano (Sanity)
// y el pádel NO están en ese endpoint, así que si se quedaran fuera de la
// ventana desaparecerían del calendario para siempre. Son 2 eventos de 718 —
// mandarlos todos no pesa nada y hace el recorte demostrablemente sin pérdidas.

export interface WindowedEvent {
  id: string
  isoDate?: string
  source?: 'espn' | 'sanity' | 'padel'
}

/** Días (contando hoy) que se renderizan en el servidor. */
export const INITIAL_WINDOW_DAYS = 8

/** Último día incluido, en formato YYYY-MM-DD. */
export function windowEndDay(todayIso: string, days = INITIAL_WINDOW_DAYS): string {
  const [y, m, d] = todayIso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))          // ojo: el mes de Date.UTC es 0-based
  t.setUTCDate(t.getUTCDate() + Math.max(0, days - 1))
  return t.toISOString().slice(0, 10)
}

/**
 * Parte los eventos en los que se pintan en el servidor y los que pedirá el
 * cliente. Un evento sin fecha legible se queda en el primer grupo: no se puede
 * ubicar en la ventana y perderlo sería peor que mandarlo.
 */
export function splitInitialWindow<T extends WindowedEvent>(
  events: readonly T[],
  todayIso: string,
  days = INITIAL_WINDOW_DAYS,
): { initial: T[]; deferred: T[] } {
  const fin = windowEndDay(todayIso, days)
  const initial: T[] = []
  const deferred: T[] = []
  for (const e of events) {
    const dia = e.isoDate?.slice(0, 10)
    const dentro = !dia || dia <= fin
    // Lo que no es de ESPN viaja SIEMPRE: el feed que pide el cliente no lo trae.
    if (dentro || (e.source && e.source !== 'espn')) initial.push(e)
    else deferred.push(e)
  }
  return { initial, deferred }
}

/**
 * Funde lo que ya había con lo que llega del feed. Lo que YA está manda: trae
 * el trabajo del servidor que el feed no repite (la forma reciente se pasa
 * aparte, pero un evento de Sanity con datos curados sí se perdería).
 */
export function mergeFeedEvents<T extends WindowedEvent>(actuales: readonly T[], entrantes: readonly T[]): T[] {
  const vistos = new Set(actuales.map(e => e.id))
  const out = actuales.slice()
  for (const e of entrantes) {
    if (vistos.has(e.id)) continue
    vistos.add(e.id)
    out.push(e)
  }
  return out
}
