// ── Frase de historial en la fila del calendario ────────────────────────────
//
// Adjunta `h2hNote` ("3 victorias seguidas del Atlético") a los eventos que lo
// merecen. Lo llaman el SSR del calendario Y /api/events/feed, así que la web y
// la app enseñan lo mismo sin duplicar lógica.
//
// POR QUÉ SOLO A ALGUNOS: fetchH2H es UNA consulta POR PAREJA. El feed trae ~700
// eventos y 449 equipos distintos; ni una consulta por partido ni un `IN()` con
// todos los nombres (≈10 KB de URL) son viables. Así que el historial se reserva
// a los partidos que el propio sistema ya marca como importantes — los que tienen
// motivo de tabla (matchStakes) — que hoy son 6 en 45 días. Además de barato,
// lee mejor: la frase no se repite en todas las filas, aparece en el partidazo.

import type { SportEvent } from './types'
import { matchStakes } from './match-stakes'
import { fetchH2H } from './past-events'
import { h2hSummary } from './h2h-summary'

/** Tope duro de consultas por render, por si una jornada trae muchos cruces top. */
const MAX_H2H_LOOKUPS = 20

/** 'espn-soccer-esp.1-706123' / matchRef 'soccer_esp.1_706123' → 'soccer/esp.1'.
 *  fetchH2H lo usa para no cruzar historial masculino y femenino. */
export function leagueSlugFromMatchRef(matchRef: string | undefined): string | undefined {
  if (!matchRef) return undefined
  const i = matchRef.indexOf('_')
  if (i <= 0) return undefined
  const rest = matchRef.slice(i + 1)
  const j = rest.lastIndexOf('_')
  if (j <= 0) return undefined
  return `${matchRef.slice(0, i)}/${rest.slice(0, j)}`
}

/** Eventos candidatos a llevar historial: cruce con motivo de tabla y dos equipos. */
export function h2hCandidates(events: SportEvent[], max = MAX_H2H_LOOKUPS): SportEvent[] {
  const out: SportEvent[] = []
  for (const e of events) {
    if (out.length >= max) break
    if (!e.away || e.isPast) continue
    if (!matchStakes(e.homeStanding, e.awayStanding)) continue
    out.push(e)
  }
  return out
}

/** Muta los eventos añadiendo `h2hNote` donde lo haya. Best-effort: si Supabase
 *  no responde, los eventos se quedan sin frase y la fila no pinta nada. */
export async function attachH2HNotes(events: SportEvent[], max = MAX_H2H_LOOKUPS): Promise<void> {
  const targets = h2hCandidates(events, max)
  if (targets.length === 0) return

  await Promise.all(
    targets.map(async e => {
      try {
        const h2h = await fetchH2H(e.home, e.away!, {
          limit: 5,
          leagueSlug: leagueSlugFromMatchRef(e.matchRef),
        })
        const note = h2hSummary(h2h, e.home, e.away!)
        if (note) e.h2hNote = note
      } catch {
        /* sin historial — la fila sigue igual de válida */
      }
    }),
  )
}
