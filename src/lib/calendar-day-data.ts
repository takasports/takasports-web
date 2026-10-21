// ── Datos de una página de día del calendario ───────────────────────────────
//
// Carga de los partidos de UN día (feed vivo + archivo) y su selección de
// partidos estrella. Vivía dentro de /calendario/dia/[fecha]/page.tsx; sale aquí
// porque ahora la usa también su tarjeta de compartir (opengraph-image), y las
// dos tienen que contar EXACTAMENTE los mismos partidos y elegir las mismas
// estrellas que la descripción de Google.

import { cache } from 'react'
import { fetchEspnEvents } from '@/lib/espn'
import { fetchPadelEvents } from '@/lib/padel'
import { sanityClient, eventsQuery } from '@/lib/sanity'
import { normalizeEvent } from '@/lib/events'
import { searchPastEvents, getArchivedDayEvents } from '@/lib/past-events'
import { attachH2HNotes } from '@/lib/h2h-notes'
import { conTope } from '@/lib/enriquecer-con-tope'
import { getBroadcastForTz } from '@/lib/broadcasts'
import { SOURCE_TZ } from '@/lib/timezone'
import { isoToLocalDate } from '@/lib/calendar'
import { getEventHighlightScore } from '@/lib/competitions'
import type { SportEvent } from '@/lib/types'
import { addDays, DAY_PAGE_FUTURE, DAY_STAR_MIN_SCORE, isPastDay, pickDayStars, type DayStar } from '@/lib/calendar-day-page'

/** Hoy en la zona base del producto (Europe/Madrid), igual que el calendario. */
export function todayIso(): string {
  return isoToLocalDate(new Date().toISOString(), SOURCE_TZ)
}

/** Eventos de ese día (futuros del feed + resultados archivados). Memoizado por
 *  request para que generateMetadata y la página no dupliquen los fetch. */
export const loadDay = cache(async (fecha: string): Promise<SportEvent[]> => {
  // Un día ya jugado se resuelve ENTERO con el archivo: el feed de ESPN solo
  // trae la ventana viva, así que pedírselo para el 12 de mayo es tráfico y
  // espera a cambio de nada. Importa porque el archivo pasó de 30 días a ~130
  // y cada uno se prerenderiza en el build: el scoreboard de tenis pesa 2,4 MB
  // y no cabe en la caché de datos de Next (lo avisa el propio build), o sea
  // que sería una descarga íntegra por página.
  const archiveOnly = isPastDay(fecha, todayIso())

  const [espnRes, sanityRes, padelRes, pastRes] = await Promise.allSettled([
    // Tantos días de feed como días de ruta generamos. Iban por su cuenta: la
    // ruta servía 45 días y el feed traía 21, así que 22 páginas que existían,
    // se prerenderizaban y se anunciaban salían VACÍAS teniendo ESPN 711
    // partidos para ellas. Atados al mismo número, no pueden volver a
    // separarse. La ventana ancha se pide solo aquí: ver DIAS_VISTA_POR_DEFECTO.
    archiveOnly ? Promise.resolve([]) : fetchEspnEvents({ diasVista: DAY_PAGE_FUTURE }),
    archiveOnly ? Promise.resolve([]) : sanityClient.fetch(eventsQuery),
    archiveOnly ? Promise.resolve([]) : fetchPadelEvents(),
    // Un día cerrado se lee por la vía cacheada 24 h: su contenido ya no cambia
    // y la ruta revalida cada 5 minutos, que para el archivo serían consultas a
    // Supabase a cambio de nada. `to` es exclusivo → [fecha, fecha+1).
    archiveOnly
      ? getArchivedDayEvents(fecha).then(events => ({ events, nextCursor: null }))
      : searchPastEvents({ from: fecha, to: addDays(fecha, 1), limit: 200 }),
  ])
  const espn = espnRes.status === 'fulfilled' ? espnRes.value : []
  const padel = padelRes.status === 'fulfilled' ? padelRes.value : []
  const sanity = sanityRes.status === 'fulfilled' && Array.isArray(sanityRes.value)
    ? sanityRes.value.map(normalizeEvent)
    : []
  const past = pastRes.status === 'fulfilled' ? (pastRes.value?.events ?? []) : []

  const sameDay = (e: SportEvent) => e.isoDate && isoToLocalDate(e.isoDate, SOURCE_TZ) === fecha

  // El archivado manda sobre el feed (trae marcador); dedup por id y por pareja.
  const out: SportEvent[] = []
  const seenIds = new Set<string>()
  const seenPairs = new Set<string>()
  const pairKey = (e: SportEvent) =>
    `${(e.sport ?? '').toLowerCase()}|${[e.home, e.away ?? ''].map(s => s.toLowerCase().trim()).sort().join('~')}`

  for (const e of [...past, ...sanity, ...espn, ...padel].filter(sameDay)) {
    if (seenIds.has(e.id)) continue
    if (e.away) {
      const k = pairKey(e)
      if (seenPairs.has(k)) continue
      seenPairs.add(k)
    }
    seenIds.add(e.id)
    out.push(e)
  }
  out.sort((a, b) => (a.isoDate ?? '').localeCompare(b.isoDate ?? ''))
  // Con tope: adorno de Supabase, no puede congelar el día entero.
  await conTope('h2h', attachH2HNotes(out))
  return out
})

/** Canal que pinta la fila del día para un partido (el mismo en todas partes). */
export function dayChannel(e: SportEvent): string | undefined {
  return getBroadcastForTz(e.comp ?? '', e.sport ?? '', SOURCE_TZ) ?? e.broadcast
}

/**
 * Partidos estrella del día con el MISMO ranking que Destacados y el mismo canal
 * que pinta la fila. La descripción pide 2 con listón; la tarjeta, 3 sin él.
 */
export function dayStars(events: readonly SportEvent[], n = 2, minScore = DAY_STAR_MIN_SCORE): DayStar[] {
  return pickDayStars(
    events,
    e => getEventHighlightScore({ comp: e.comp, home: e.home, away: e.away, stage: e.stage, isoDate: e.isoDate }),
    dayChannel,
    n,
    minScore,
  )
}
