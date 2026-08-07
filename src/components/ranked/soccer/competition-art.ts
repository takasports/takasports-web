// ─────────────────────────────────────────────────────────────────────────────
// Arte de competición para las tarjetas de una Fecha.
//
// El repo ya tiene ilustraciones cinematográficas por torneo en /public/banners
// (LaLiga, Premier, Champions, Serie A, Bundesliga, Ligue 1, Mundial): fondos
// oscuros con el lado izquierdo despejado, hechos justo para sobreponer texto.
// Las usaba solo el calendario; Predicciones las ignoraba y pintaba tarjetas
// planas. Aquí se reaprovechan tal cual — cero coste y cero KB nuevos, porque
// son las mismas imágenes que el usuario ya se descarga en /calendario.
//
// El emparejado se delega en `matchesCompetition`, que es la misma regla que
// usa el calendario: así "Premier" no se cuela en un torneo de pádel y no hay
// una segunda tabla de nombres que se pueda desincronizar.
// ─────────────────────────────────────────────────────────────────────────────

import { COMPETITIONS, matchesCompetition } from '@/lib/calendar-competitions'
import { getCompAccent } from '@/lib/competitions'

/** Ruta del arte de una competición de fútbol, o null si no tiene. */
export function competitionArt(competition: string | null | undefined): string | null {
  if (!competition) return null
  const found = COMPETITIONS.find(c =>
    c.sport === 'Fútbol' && matchesCompetition(c, { comp: competition, sport: 'Fútbol' }),
  )
  // Solo el arte a medida por torneo. Los fondos genéricos de deporte
  // (/banners/signal/*) ya visten la página entera: repetirlos dentro de cada
  // tarjeta sería ruido, no identidad.
  const banner = found?.banner
  return banner && !banner.includes('/signal/') ? banner : null
}

/** Color de la competición, para la muesca diagonal y la etiqueta. */
export function competitionAccent(competition: string, fallback: string): string {
  return getCompAccent(competition, fallback)
}
