// ─────────────────────────────────────────────────────────────────────────────
// Tipos compartidos de la UI de fútbol del Ranked (Fechas + Mundial archivado).
//
// Espejo EXACTO de lo que devuelve /api/ranked/events. Si añades un campo aquí,
// añádelo también en `RankedEventMeta` de takasports-app (src/services/quiniela.ts):
// los tipos locales de cada pantalla han tirado campos en silencio más de una vez
// —así es como la ficha de partido de la app dejó de enlazar—.
// ─────────────────────────────────────────────────────────────────────────────

export type SoccerPick = '1' | 'X' | '2'

/** `meta` de un evento de fútbol. Lo escribe el cron sync-football. */
export interface SoccerEventMeta {
  /** Día de la Fecha (YYYY-MM-DD, hora de Madrid). Lo calcula el SERVIDOR.
   *  Los clientes agrupan por este valor y NO lo recalculan: si cliente y
   *  servidor discreparan por zona horaria, un partido aparecería bajo una
   *  cabecera distinta de la Fecha con la que se puntúa. */
  date_key?: string
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
    /** Marcador exacto opcional: +3 pts (+6 si el partido es el destacado)
     *  cuando coincide con el resultado real Y la tendencia es correcta. */
    exactScore?: { home: number; away: number }
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

export const FOOTBALL_THEME: SoccerTheme = {
  accent:     '#4ADE80',
  accentDim:  '#22C55E',
  accentDeep: '#166534',
  cardBg:     'linear-gradient(145deg, #121A16 0%, #0C1310 100%)',
  cardBgFeat: 'linear-gradient(145deg, #0F2018 0%, #081410 100%)',
}

// ── Constantes de reglas (espejo del servidor) ───────────────────────────────

/** Los picks se cierran 60 min antes del kickoff. Lo IMPONE la API
 *  (/api/ranked/predictions); aquí solo se refleja para que la UI no ofrezca
 *  un botón que el servidor va a rechazar. */
export const SOCCER_LOCK_MS = 60 * 60 * 1000

/** Máximo de marcadores exactos activos por usuario (validado server-side). */
export const MAX_ACTIVE_EXACT = 5
