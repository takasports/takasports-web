import type { SportEvent } from '@/lib/types'
import { getEventHighlightScore } from '@/lib/competitions'
import { empujonRegional } from '@/lib/region-visitante'

// Destacados de la portada: QUÉ partidos se eligen, y cuáles pueden llegar a
// elegirse.
//
// Vive aquí y no dentro de HomeContent porque lo necesitan los dos lados: el
// SERVIDOR para recortar lo que manda al navegador, y el CLIENTE para volver a
// ordenar con el huso del visitante. Una sola definición de la ventana y del
// descarte, para que el recorte del servidor no pueda dejar fuera nada que el
// cliente fuera a elegir.

// ── Home calendar picker ─────────────────────────────────────
// Filtra a una ventana de actualidad (hoy + próximas ~36h) y
// puntúa cada evento por relevancia editorial. La diversidad
// por deporte deja de ser obligatoria: si el día está cargado
// de fútbol grande, ganará fútbol; si hay un GP o un Major,
// entrará por mérito propio. Cap blando de 2 por deporte para
// evitar que la sección se monopolice un día flojo.
export const WINDOW_HOURS = 36
const MAX_PER_SPORT = 2

// `now` llega SELLADO POR EL SERVIDOR (prop `renderedAt`), no de `Date.now()`.
// La portada va con `revalidate = 300`: si cada lado mirara su propio reloj, un
// partido que cruzara el corte de "ya terminó" entre el render cacheado y la
// hidratación cambiaría los Destacados y React tiraría la portada entera por
// fallo de hidratación (#418).
// `tz` = huso del visitante, y SOLO se pasa tras hidratar. En el servidor llega
// null a propósito: el HTML es ISR y el mismo para todo el mundo (Google
// incluido), así que ordenar por región ahí rompería la caché y, peor, no
// coincidiría con el primer render del cliente (#418).
export function pickTopEvents(events: SportEvent[], now: number, n = 4, tz: string | null = null): SportEvent[] {
  const windowEnd = now + WINDOW_HOURS * 3600_000

  // 0) Deduplicar: mismo partido puede llegar dos veces (courts distintas
  //    en tenis, feeds duplicados). Clave = home+away+fecha normalizada.
  const seen = new Set<string>()
  const unique = events.filter(ev => {
    const key = `${ev.home}|${ev.away ?? ''}|${ev.isoDate?.slice(0, 13) ?? ev.date}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // 1) Ventana temporal: descartar pasados y muy lejanos
  const inWindow: { ev: SportEvent; score: number; ts: number }[] = []
  const fallback: { ev: SportEvent; score: number; ts: number }[] = []
  for (const ev of unique) {
    if (ev.isPast) continue
    const ts = ev.isoDate ? new Date(ev.isoDate).getTime() : NaN
    // Mismo ranking de Destacados que /calendario: liga top + equipos/selecciones
    // de renombre + finales/semis + prime time (escala ~0-18).
    const base = getEventHighlightScore({ comp: ev.comp, home: ev.home, away: ev.away, isoDate: ev.isoDate, tz })
      + empujonRegional(ev.comp, tz)
    if (!Number.isFinite(ts)) {
      fallback.push({ ev, score: base, ts: Number.POSITIVE_INFINITY })
      continue
    }
    if (ts < now - 2 * 3600_000) continue          // ya terminó hace rato
    let score = base
    if (ts <= windowEnd) {
      // Pequeño empujón si es hoy mismo (próximas 24h) — proporcional a la escala.
      if (ts <= now + 24 * 3600_000) score += 4
      inWindow.push({ ev, score, ts })
    } else {
      fallback.push({ ev, score: base, ts })
    }
  }

  // 2) Orden por score desc, desempate por fecha asc
  const ranked = inWindow.sort((a, b) => b.score - a.score || a.ts - b.ts)

  // 3) Selección con cap blando por deporte
  const perSport = new Map<string, number>()
  const result: SportEvent[] = []
  for (const { ev } of ranked) {
    if (result.length >= n) break
    const used = perSport.get(ev.sport) ?? 0
    if (used >= MAX_PER_SPORT) continue
    perSport.set(ev.sport, used + 1)
    result.push(ev)
  }

  // 4) Si la ventana estaba flojita, completar con lo siguiente más relevante
  if (result.length < n) {
    const pool = [
      ...ranked.filter(r => !result.includes(r.ev)),
      ...fallback.sort((a, b) => b.score - a.score || a.ts - b.ts),
    ]
    for (const { ev } of pool) {
      if (result.length >= n) break
      if (result.includes(ev)) continue
      result.push(ev)
    }
  }

  // 5) Inicio = escaparate: dejar el orden por relevancia (más destacado
  //    primero). `result` ya viene en orden de score; /calendario sí va por hora.
  return result.slice(0, n)
}


/** Cuántos partidos de FUERA de la ventana se mandan por si el día viene vacío
 *  y hay que rellenar (paso 4 de `pickTopEvents`). Con el calendario lleno no
 *  se usa ninguno; van los más próximos en el tiempo, que es el criterio que
 *  no depende del huso. */
const MAX_FUERA_DE_VENTANA = 20

/**
 * Los partidos que los Destacados PUEDEN llegar a elegir, y solo esos.
 *
 * La portada mandaba al navegador el calendario ENTERO —780 partidos, ~1 MB de
 * HTML— para pintar cuatro. Esta función hace en el servidor los pasos 0 y 1 de
 * `pickTopEvents` (deduplicar y descartar por fecha), que es justo la parte que
 * NO depende del huso del visitante, y deja el resto para el cliente.
 *
 * El orden importa: se deduplica ANTES de filtrar, igual que hace
 * `pickTopEvents`. Si se filtrara primero, un duplicado pasado podría
 * desaparecer y ascender a otro que antes se descartaba, cambiando la elección.
 */
export function candidatosDestacados(events: SportEvent[], now: number): SportEvent[] {
  const windowEnd = now + WINDOW_HOURS * 3600_000
  const dentro: SportEvent[] = []
  const fuera: { ev: SportEvent; ts: number }[] = []

  const seen = new Set<string>()
  for (const ev of events) {
    const key = `${ev.home}|${ev.away ?? ''}|${ev.isoDate?.slice(0, 13) ?? ev.date}`
    if (seen.has(key)) continue
    seen.add(key)

    if (ev.isPast) continue
    const ts = ev.isoDate ? new Date(ev.isoDate).getTime() : NaN
    if (!Number.isFinite(ts)) { fuera.push({ ev, ts: Number.POSITIVE_INFINITY }); continue }
    if (ts < now - 2 * 3600_000) continue
    if (ts <= windowEnd) dentro.push(ev)
    else fuera.push({ ev, ts })
  }

  fuera.sort((a, b) => a.ts - b.ts)
  return [...dentro, ...fuera.slice(0, MAX_FUERA_DE_VENTANA).map(f => f.ev)]
}
