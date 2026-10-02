import type { SportEvent } from '@/lib/types'
import { DEPORTES_CON_PREVIA, PUNTUACION_MINIMA, puntuarPrevia, type CandidataPrevia } from '@/lib/previas'

// Crónicas automáticas: QUÉ partidos terminados merecen crónica.
//
// La misma vara que las previas (destacados + interés hispano, mínimo 13): un gran
// resultado es el resultado de un gran partido. El cron pasa cada 30 minutos y coge
// lo que empezó entre 2 y 8 horas antes y ya terminó: así la crónica se encarga
// poco después del pitido final. De noche, WF-08 está en silencio y la redacta a
// las 8:00 (decisión del editor, 02/10/2026).

export const CRONICA_DESDE_H = 8   // empezó hace como mucho 8 h
export const CRONICA_HASTA_H = 2   // y como poco 2 h (un partido dura ~2 h)
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
