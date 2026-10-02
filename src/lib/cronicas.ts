import type { SportEvent } from '@/lib/types'
import { DEPORTES_CON_PREVIA, PUNTUACION_MINIMA, puntuarPrevia, type CandidataPrevia } from '@/lib/previas'

// Crónicas automáticas: QUÉ partidos terminados merecen crónica.
//
// La misma vara que las previas (destacados + interés hispano, mínimo 13): un gran
// resultado es el resultado de un gran partido. El cron pasa cada 15 minutos y coge
// lo que ESPN ya da por terminado (empezó hace al menos 1 h 45 min): la crónica se
// encarga 10-25 minutos después del pitido final, «no tan después» (editor,
// 02/10/2026). La caché de resultados de ESPN es de 5 minutos. De noche, WF-08 está en silencio y la redacta a
// las 8:00 (decisión del editor, 02/10/2026).

export const CRONICA_DESDE_H = 8   // empezó hace como mucho 8 h
export const CRONICA_HASTA_H = 1.75 // y como poco 1 h 45 min: lo que manda es que ESPN lo dé por terminado
export const MAX_CRONICAS_POR_DIA = 4

export function candidatasCronica(
  events: SportEvent[],
  now: number,
  yaHechas: ReadonlySet<string> = new Set(),
): CandidataPrevia[] {
  const desde = now - CRONICA_DESDE_H * 3600_000
  const hasta = now - CRONICA_HASTA_H * 3600_000
  const vistos = new Set<string>()
  const out: CandidataPrevia[] = []
  for (const ev of events) {
    const sport = DEPORTES_CON_PREVIA[ev.sport]
    if (!sport || !ev.matchRef || !ev.away || !ev.isoDate) continue
    // Terminado de verdad: marcado como pasado y con marcador.
    if (!ev.isPast || ev.homeScore == null || ev.awayScore == null) continue
    if (yaHechas.has(ev.matchRef) || vistos.has(ev.matchRef)) continue
    const ts = new Date(ev.isoDate).getTime()
    if (!Number.isFinite(ts) || ts < desde || ts > hasta) continue
    vistos.add(ev.matchRef)
    const puntuacion = puntuarPrevia(ev)
    if (puntuacion < PUNTUACION_MINIMA) continue
    out.push({ ev, sport, puntuacion })
  }
  return out.sort((a, b) => b.puntuacion - a.puntuacion)
}
