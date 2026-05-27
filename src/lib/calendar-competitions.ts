/**
 * Competiciones evergreen para /calendario/[slug].
 *
 * Cada entrada produce una URL indexable que filtra el feed completo de
 * /calendario por una competición concreta. Diseñado para captar tráfico
 * de búsquedas como "calendario laliga", "fixtures premier league",
 * "calendario nba", etc.
 */

export type CompetitionSport = 'Fútbol' | 'Baloncesto' | 'NBA' | 'F1' | 'UFC' | 'Tenis' | 'Pádel'

export interface CompetitionConfig {
  slug: string
  displayName: string
  /** Para SEO copy. */
  shortName: string
  sport: CompetitionSport
  /** Match contra el campo `comp` del evento (case-insensitive, contiene). */
  matchComp?: string
  /** Match alternativo contra el campo `sport` cuando matchComp no aplica. */
  matchSport?: CompetitionSport
  description: string
  /** Etiqueta de temporada actual mostrada en H1 e itemListJsonLd. */
  seasonLabel: string
  /** Logo opcional para schema (URL absoluta). */
  logo?: string
}

export const COMPETITIONS: CompetitionConfig[] = [
  {
    slug: 'laliga',
    displayName: 'LaLiga EA Sports',
    shortName: 'LaLiga',
    sport: 'Fútbol',
    matchComp: 'LaLiga',
    description: 'Todos los partidos de la temporada de LaLiga: fechas, horarios, estadios y dónde verlos.',
    seasonLabel: '2025-2026',
  },
  {
    slug: 'champions',
    displayName: 'UEFA Champions League',
    shortName: 'Champions',
    sport: 'Fútbol',
    matchComp: 'Champions',
    description: 'Calendario completo de la UEFA Champions League: fase liga, eliminatorias y final.',
    seasonLabel: '2025-2026',
  },
  {
    slug: 'premier-league',
    displayName: 'Premier League',
    shortName: 'Premier',
    sport: 'Fútbol',
    matchComp: 'Premier',
    description: 'Calendario de la Premier League inglesa: todos los partidos de la temporada con horarios.',
    seasonLabel: '2025-2026',
  },
  {
    slug: 'serie-a',
    displayName: 'Serie A',
    shortName: 'Serie A',
    sport: 'Fútbol',
    matchComp: 'Serie A',
    description: 'Calendario de la Serie A italiana: fechas y horarios de todos los partidos.',
    seasonLabel: '2025-2026',
  },
  {
    slug: 'bundesliga',
    displayName: 'Bundesliga',
    shortName: 'Bundesliga',
    sport: 'Fútbol',
    matchComp: 'Bundesliga',
    description: 'Calendario de la Bundesliga alemana: jornadas, horarios y dónde verlas.',
    seasonLabel: '2025-2026',
  },
  {
    slug: 'ligue-1',
    displayName: 'Ligue 1',
    shortName: 'Ligue 1',
    sport: 'Fútbol',
    matchComp: 'Ligue 1',
    description: 'Calendario de la Ligue 1 francesa: todos los partidos con fecha y hora.',
    seasonLabel: '2025-2026',
  },
  {
    slug: 'europa-league',
    displayName: 'UEFA Europa League',
    shortName: 'Europa League',
    sport: 'Fútbol',
    matchComp: 'Europa',
    description: 'Calendario de la UEFA Europa League: fase liga, knockouts y final.',
    seasonLabel: '2025-2026',
  },
  {
    slug: 'nba',
    displayName: 'NBA',
    shortName: 'NBA',
    sport: 'NBA',
    matchSport: 'NBA',
    description: 'Calendario NBA: partidos de regular season y playoffs con horarios España.',
    seasonLabel: '2025-2026',
  },
  {
    slug: 'f1',
    displayName: 'Fórmula 1',
    shortName: 'F1',
    sport: 'F1',
    matchSport: 'F1',
    description: 'Calendario completo de la Fórmula 1: Grandes Premios, clasificaciones, sprints y carreras.',
    seasonLabel: '2026',
  },
  {
    slug: 'ufc',
    displayName: 'UFC',
    shortName: 'UFC',
    sport: 'UFC',
    matchSport: 'UFC',
    description: 'Calendario UFC: próximos eventos, peleas estelares y horarios.',
    seasonLabel: '2026',
  },
]

export function getCompetition(slug: string): CompetitionConfig | null {
  return COMPETITIONS.find((c) => c.slug === slug) ?? null
}

export function matchesCompetition(
  comp: CompetitionConfig,
  ev: { comp?: string | null; sport?: string | null },
): boolean {
  if (comp.matchComp) {
    const c = (ev.comp ?? '').toLowerCase()
    if (c.includes(comp.matchComp.toLowerCase())) return true
  }
  if (comp.matchSport) {
    if ((ev.sport ?? '').toLowerCase() === comp.matchSport.toLowerCase()) return true
  }
  return false
}
