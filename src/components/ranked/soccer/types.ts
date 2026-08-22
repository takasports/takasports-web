// ─────────────────────────────────────────────────────────────────────────────
// Tipos compartidos de la UI de fútbol del Ranked (Fechas + Mundial archivado).
//
// Espejo EXACTO de lo que devuelve /api/ranked/events. Si añades un campo aquí,
// añádelo también en `RankedEventMeta` de takasports-app (src/services/quiniela.ts):
// los tipos locales de cada pantalla han tirado campos en silencio más de una vez
// —así es como la ficha de partido de la app dejó de enlazar—.
// ─────────────────────────────────────────────────────────────────────────────

import { SPORT_ACCENT } from '@/lib/sports'

export type SoccerPick = '1' | 'X' | '2'

/** `meta` de un evento de fútbol. Lo escribe el cron sync-football. */
export interface SoccerEventMeta {
  /** Día del kickoff (YYYY-MM-DD, hora de Madrid). Lo calcula el SERVIDOR.
   *  Los clientes agrupan por este valor y NO lo recalculan: si cliente y
   *  servidor discreparan por zona horaria, un partido aparecería bajo una
   *  sub-cabecera de día distinta. */
  date_key?: string
  /** Lunes de la semana de la Jornada (YYYY-MM-DD, hora de Madrid). Es la
   *  unidad real de selección y de Pleno — dos partidos con el mismo
   *  week_key compiten por el mismo cupo y pagan el mismo premio. */
  week_key?: string
  espn_id?: string
  league_slug?: string
  home_logo?: string | null
  away_logo?: string | null
  home_abbr?: string | null
  away_abbr?: string | null
  stage?: string | null
  venue?: string | null
  /** Puntuación de destacado con la que entró en la Fecha (auditoría). */
  highlight_score?: number
  // Campos del archivo del Mundial 2026, que comparte tabla.
  group?: string
  city?: string
  matchday?: number | null
  [k: string]: unknown
}

export interface SoccerEvent {
  id:          string
  sport:       string
  competition: string
  event_date:  string
  team_home:   string | null
  team_away:   string | null
  featured:    boolean
  status:      'open' | 'closed' | 'resolved'
  result:      { winner: SoccerPick; home_score?: number; away_score?: number } | null
  meta?:       SoccerEventMeta
}

/** Marcador parcial en vivo (fuente ESPN). */
export interface LiveScore {
  home:  number | null
  away:  number | null
  clock: string | null
}

export interface PredictionRow {
  event_id:   string
  prediction: {
    pick: SoccerPick
    /** Marcador exacto opcional. NO es un extra sobre la tendencia: la
     *  SUSTITUYE. Ver SOCCER_POINTS. */
    exactScore?: { home: number; away: number }
    /** Este partido es el ×2 de ESTE usuario. Uno por Jornada. */
    captain?: boolean
  }
  points_awarded: number | null
  is_correct:     boolean | null
}

export type PredMap = Record<string, PredictionRow>

/** Paleta del producto que monta estos componentes: oro para el archivo del
 *  Mundial, verde para Ranked Fútbol. Solo cambia el acento; la estructura, los
 *  estados y las reglas son las mismas. */
export interface SoccerTheme {
  accent:     string
  accentDim:  string
  accentDeep: string
  cardBg:     string
  cardBgFeat: string
}

/**
 * Tema de Ranked Fútbol.
 *
 * El acento sale del motor de deportes (`SPORT_ACCENT.futbol`), no de un hex a
 * mano: es lo que hace que la sección respire igual que rankings, estadísticas
 * y los hubs de deporte. Antes usaba `#4ADE80` —el verde del DIRECTO del
 * calendario, deliberadamente fuera de este motor—, con lo que el mismo color
 * significaba dos cosas: "esto es fútbol" y "esto está en vivo".
 */
export const FOOTBALL_THEME: SoccerTheme = {
  accent:     SPORT_ACCENT.futbol,
  accentDim:  '#10B981',
  accentDeep: '#065F46',
  cardBg:     'linear-gradient(145deg, #121A16 0%, #0C1310 100%)',
  cardBgFeat: 'linear-gradient(145deg, #0F2018 0%, #081410 100%)',
}

// ── Constantes de reglas (espejo del servidor) ───────────────────────────────

/** Los picks se cierran 60 min antes del kickoff. Lo IMPONE la API
 *  (/api/ranked/predictions); aquí solo se refleja para que la UI no ofrezca
 *  un botón que el servidor va a rechazar. */
export const SOCCER_LOCK_MS = 60 * 60 * 1000

/**
 * Lo que paga cada jugada. Espejo EXACTO de `score_ranked_prediction`
 * (migraciones 128 y 131) — si cambias los números allí, cámbialos aquí: son
 * los que la tarjeta le promete al usuario ANTES de jugar.
 *
 * El marcador exacto no suma sobre la tendencia, la REEMPLAZA: en el partido
 * donde lo pongas, o clavas los goles o ese partido vale cero, aunque hubieras
 * acertado quién ganaba. Cambias 3 puntos probables por 12 improbables.
 *
 * Fallar un exacto NO tumba el Pleno: `is_correct` sigue midiendo solo la
 * tendencia, así que el partido puntúa 0 pero cuenta como acertado para el
 * bonus de Jornada completa. Sin ese consuelo la apuesta no sería jugable.
 *
 * El ×2 es del JUGADOR, no del partido. Lo puso la casa hasta la migración
 * 131, pero como el Partidazo es el mismo para todos, aquel multiplicador
 * escalaba a todo el mundo por igual y no distinguía a nadie. `event.featured`
 * sigue marcando el partido de la semana; ya no multiplica.
 */
export const SOCCER_POINTS = {
  /** Tendencia (1·X·2) acertada. */
  TENDENCY:          3,
  /** Marcador exacto clavado. Sustituye a TENDENCY, no se suma. */
  EXACT:            12,
  /** Tu capitán dobla lo que pague esa jugada. Uno por Jornada. */
  CAPTAIN_MULTIPLIER: 2,
} as const

/** Lo que paga una jugada, ya con el ×2 del capitán si es el elegido. Una sola
 *  función para que ninguna tarjeta se invente un número distinto del que
 *  reparte el servidor. */
export function soccerPayout(captain: boolean, exact: boolean): number {
  const base = exact ? SOCCER_POINTS.EXACT : SOCCER_POINTS.TENDENCY
  return captain ? base * SOCCER_POINTS.CAPTAIN_MULTIPLIER : base
}
