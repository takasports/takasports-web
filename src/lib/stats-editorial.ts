// Solo constantes editoriales que SIGUEN en uso post-limpieza:
// - FIFA_RANKING + UFC_P4P: fallback inicial si Supabase snapshot no responde.
//   En cuanto el cron actualice, se sobrescriben.
// - COACH_CONFIG: identidad estática (mapping name → teamId ESPN), se
//   actualiza cuando hay cambios de banquillo.
// - TENNIS_SLAMS_2026: calendario fijo anual.
// - NBA_ROOKIE_NAMES: lista del draft de la temporada en curso (actualizar cada año).
// - WC_HOSTS: anfitriones Mundial 2026 (siempre clasificados).

export interface StandingRow {
  rank: number
  name: string
  abbr: string
  value: string
  sub: string
  trend: 'up' | 'down' | 'flat'
  extra: Record<string, string>
  flag?: string
  /** ESPN team id — present on football standings so the row can deep-link to /equipo. */
  teamId?: string
  /** Club crest URL — present on football standings. */
  logo?: string
}

// Fallbacks vacíos: si el cron Supabase Y la fuente en vivo (eloratings.net,
// ufc.com) están abajo, mejor mostrar 'No disponible' honestamente que un
// snapshot viejo disfrazado de live (Jon Jones jubilado, Francia #1...).
export const FIFA_RANKING_AS_OF = ''
export const FIFA_RANKING: StandingRow[] = []
export const UFC_P4P_AS_OF = ''
export const UFC_P4P: StandingRow[] = []

// (CoachEntry/COACH_CONFIG eliminados: el bloque "Entrenadores" se quitó —
//  los nombres eran manuales y ESPN no expone el entrenador.)

// (TENNIS_SLAMS_2026 eliminado: era un calendario hardcodeado no automatizable.
//  La sección de tenis sirve solo ATP/WTA en vivo desde ESPN.)

// ─── Mundial 2026 — anfitriones (siempre clasificados) ────────────────────
export const WC_HOSTS = new Set<string>(['Estados Unidos', 'EEUU', 'USA', 'Canadá', 'Canada', 'México', 'Mexico'])
