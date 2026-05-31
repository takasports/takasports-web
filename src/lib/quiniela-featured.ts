// Helper compartido: enriquece un array de MatchResult marcando con
// `featured=true` el partido destacado de la jornada activa.
//
// El partido featured es el que getQuinielaData() devuelve con
// `isFeatured=true`. Al marcarlo en el result, scorePick aplicará el
// bonus x2 sobre puntos y coins cuando el user lo acierte.
//
// IMPORTANTE: este helper debe llamarse desde TODOS los caminos de
// scoring (cliente settle vía /api/quiniela/score Y cron batch vía
// /api/cron/settle-quiniela). Si uno se olvida, los users de ese
// camino no cobran el x2 — bug T silencioso.
//
// Pure side-effect sobre el array recibido. Devuelve el mismo array
// por conveniencia para encadenar.

import { getQuinielaData } from '@/app/api/quiniela/route'
import { nameMatch, type MatchResult } from './quiniela'

export async function enrichResultsWithFeatured(
  results: MatchResult[],
): Promise<MatchResult[]> {
  if (results.length === 0) return results
  try {
    const data = await getQuinielaData()
    const featured = data.matches?.find((m) => m.isFeatured)
    if (!featured) return results
    for (const r of results) {
      if (nameMatch(r.home, featured.home) && nameMatch(r.away, featured.away)) {
        r.featured = true
        break
      }
    }
  } catch {
    // Sin jornada activa o getQuinielaData fallido → no aplica x2.
    // Degrada silencioso (mejor no aplicar que romper la liquidación).
  }
  return results
}
