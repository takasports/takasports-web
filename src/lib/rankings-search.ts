// Helpers para buscar entries en cualquier ranking del proyecto.
// Centraliza el acceso a TODAS las exportaciones de rankings.ts para que
// /rankings/comparar y /rankings/[id] puedan resolver un id sin saber en
// qué scope concreto vive.

import {
  RANKING_JUGADORES, RANKING_JUGADORES_SUB21,
  RANKING_JUGADORES_LATAM, RANKING_JUGADORES_CONCACAF,
  RANKING_CLUBES, RANKING_JUGADORAS, RANKING_CLUBES_FEMENINO,
  RANKING_LUCHADORAS_UFC, RANKING_ENTRENADORES,
  RANKING_CREADORES, RANKING_PERIODISTAS, RANKING_CREADORES_WWE,
  type RankingEntry,
} from './rankings'

const ALL_SOURCES: { source: string; entries: RankingEntry[] }[] = [
  { source: 'jugadores',         entries: RANKING_JUGADORES },
  { source: 'jugadoras',         entries: RANKING_JUGADORAS },
  { source: 'sub21',             entries: RANKING_JUGADORES_SUB21 },
  { source: 'latam',             entries: RANKING_JUGADORES_LATAM },
  { source: 'concacaf',          entries: RANKING_JUGADORES_CONCACAF },
  { source: 'clubes',            entries: RANKING_CLUBES },
  { source: 'clubes_femenino',   entries: RANKING_CLUBES_FEMENINO },
  { source: 'ufc_femenino',      entries: RANKING_LUCHADORAS_UFC },
  { source: 'entrenadores',      entries: RANKING_ENTRENADORES },
  { source: 'creadores',         entries: RANKING_CREADORES },
  { source: 'periodistas',       entries: RANKING_PERIODISTAS },
  { source: 'creadores_wwe',     entries: RANKING_CREADORES_WWE },
]

/**
 * Devuelve todas las entries únicas (deduplicadas por id) ordenadas por
 * score descendente. Útil para selectores globales.
 */
export function getAllRankingEntries(): RankingEntry[] {
  const seen = new Map<string, RankingEntry>()
  for (const { entries } of ALL_SOURCES) {
    for (const entry of entries) {
      if (!seen.has(entry.id)) seen.set(entry.id, entry)
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.score - a.score)
}

/** Resuelve una entry por id buscando en todas las exportaciones. */
export function findEntryById(id: string): RankingEntry | undefined {
  if (!id) return undefined
  for (const { entries } of ALL_SOURCES) {
    const hit = entries.find(e => e.id === id)
    if (hit) return hit
  }
  return undefined
}

/**
 * Lista las "fuentes" en las que aparece un id (para mostrar en /rankings/[id]
 * la lista de "Apariciones en otros rankings").
 */
export function getEntrySources(id: string): string[] {
  return ALL_SOURCES.filter(({ entries }) => entries.some(e => e.id === id))
    .map(({ source }) => source)
}
