// ─────────────────────────────────────────────────────────────────────────────
// Vocabulario de deportes del Ranked — un solo punto de traducción.
//
// Conviven dos vocabularios y no se pueden unificar de golpe:
//
//   · UI y analítica hablan de 'futbol' — es lo que usan las pestañas de
//     PrediccionesHub, RankedLeaderboard y el icono RankedCategoryIcon.
//   · La base de datos habla de 'football' — la columna `sport` de ranked_events
//     tiene un CHECK que solo admite 'football' | 'ufc' | 'mundial'.
//
// Si cada endpoint tradujera por su cuenta, bastaría con que uno se olvidara
// para que los puntos de fútbol se escribieran bajo un `sport` que ninguna
// pestaña consulta: el usuario acertaría y su marcador no subiría en ningún
// sitio. Toda entrada de deporte desde el cliente pasa por aquí.
// ─────────────────────────────────────────────────────────────────────────────

/** Valores válidos de la columna `sport` (ranked_events y point_transactions). */
export type RankedSportDb = 'football' | 'ufc' | 'mundial'

/** Alias aceptados desde el cliente → valor canónico en base de datos. */
const ALIASES: Record<string, RankedSportDb> = {
  futbol:   'football',
  fútbol:   'football',
  football: 'football',
  soccer:   'football',
  ufc:      'ufc',
  mma:      'ufc',
  mundial:  'mundial',
}

/**
 * Normaliza el `?sport=` de una petición al vocabulario de base de datos.
 *
 * Devuelve `null` para 'global' y para cualquier valor desconocido: los
 * consumidores tratan `null` como "sin filtro de deporte", que es justo lo que
 * espera `get_ranked_leaderboard(p_sport)` para la pestaña Liga Total.
 */
export function normalizeRankedSport(raw: string | null | undefined): RankedSportDb | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase()
  if (key === 'global' || key === 'all') return null
  return ALIASES[key] ?? null
}
