// ── Los deportes de /estadisticas, en un sitio sin JSX ──────────────────────
//
// Vivían dentro de StatsView.tsx, que es un componente: la ruta de API no podía
// leerlos sin arrastrarse React entero. El resultado fue que `SPORT_KEYS` (el
// shard del payload) mantenía su propia lista de slugs a mano y se desincronizó:
// tenía 'nba' donde la URL dice 'baloncesto', así que el shard de esa landing
// caía en `if (!keys) return data` y devolvía el payload ENTERO. Silencioso —
// 72 KB de más y un comentario prometiendo un 80% de reducción que ahí nunca
// ocurría (medido el 21/08/2026).
//
// Aquí está la lista ÚNICA. Quien necesite cubrirla entera lo comprueba contra
// `SportSlug` y, si falta uno, no compila.

export interface SportMeta { label: string; description: string }

/** Slug de la URL → etiqueta y descripción. Es lo que ve Google. */
export const SPORT_META = {
  futbol:     { label: 'Fútbol',      description: 'LaLiga, Premier, Bundesliga, Serie A, Ligue 1 y UEFA en vivo.' },
  baloncesto: { label: 'NBA',         description: 'Conferencias, anotadores, MVP/DPOY/ROY race y playoffs en vivo.' },
  f1:         { label: 'Fórmula 1',   description: 'Pilotos, constructores, sprints, poles y calendario 2026 en vivo.' },
  tenis:      { label: 'Tenis',       description: 'Rankings ATP/WTA y calendario Grand Slams 2026.' },
  motogp:     { label: 'MotoGP',      description: 'Mundial de pilotos y constructores temporada 2026.' },
  ufc:        { label: 'UFC',         description: 'Pound for Pound y campeones por división actualizados.' },
  mundial:    { label: 'Mundial 2026',description: 'Grupos, clasificados, anfitriones y goleadores del Mundial.' },
} as const satisfies Record<string, SportMeta>

/** Los slugs válidos, derivados del propio SPORT_META. */
export type SportSlug = keyof typeof SPORT_META

/** Lectura por un slug que viene de la URL y puede no existir. */
export function getSportMeta(slug: string): SportMeta | undefined {
  return (SPORT_META as Record<string, SportMeta>)[slug]
}

/**
 * Comprueba EN COMPILACIÓN que un mapa cubre todos los deportes.
 *
 * Se usa así, y si falta uno el error nombra cuál:
 *
 *     const _ = assertCubreDeportes<keyof typeof SPORT_KEYS>()
 */
export type FaltanDeportes<Cubiertos extends string> = Exclude<SportSlug, Cubiertos>
