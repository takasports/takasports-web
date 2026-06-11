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
  /** Logo opcional para schema/OG (URL absoluta). */
  logo?: string
  /** Banner decorativo (fondo abstracto generado con IA) para la cabecera.
   *  Ruta local servida desde /public (WebP ligero). */
  banner?: string
  /** Escudo/logo oficial de la competición (URL) para superponer sobre el
   *  banner de cabecera — uso editorial/informativo. */
  crest?: string
  /** Slug ESPN (p.ej. 'soccer/esp.1') para enriquecer la página con
   *  clasificación + máximos goleadores. Solo ligas de fútbol con datos. */
  espnSlug?: string
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
    banner: '/banners/laliga.webp',
    crest: 'https://a.espncdn.com/i/leaguelogos/soccer/500-dark/15.png',
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
  {
    slug: 'copa-del-rey',
    displayName: 'Copa del Rey',
    shortName: 'Copa Rey',
    sport: 'Fútbol',
    matchComp: 'Copa Rey',
    description: 'Calendario de la Copa del Rey: rondas, horarios y dónde ver los partidos de la competición del KO del fútbol español.',
    seasonLabel: '2025-2026',
  },
  {
    slug: 'motogp',
    displayName: 'MotoGP',
    shortName: 'MotoGP',
    sport: 'F1',
    matchComp: 'MotoGP',
    description: 'Calendario MotoGP: todos los Grandes Premios de la temporada con fechas, circuitos y horarios.',
    seasonLabel: '2026',
  },
  {
    slug: 'euroleague',
    displayName: 'EuroLiga de Baloncesto',
    shortName: 'EuroLiga',
    sport: 'Baloncesto',
    matchComp: 'Euroleague',
    description: 'Calendario de la EuroLiga: partidos de la fase regular, playoffs y Final Four con horarios y canales.',
    seasonLabel: '2025-2026',
  },
  {
    slug: 'copa-america',
    displayName: 'Copa América',
    shortName: 'Copa América',
    sport: 'Fútbol',
    matchComp: 'Copa América',
    description: 'Calendario de la Copa América: partidos de grupos, cuartos, semis y final con horarios.',
    seasonLabel: '2026',
  },
  {
    slug: 'nations-league',
    displayName: 'UEFA Nations League',
    shortName: 'Nations League',
    sport: 'Fútbol',
    matchComp: 'Nations League',
    description: 'Calendario de la UEFA Nations League: partidos de la fase de grupos y eliminatorias de la competición de selecciones europeas.',
    seasonLabel: '2025-2026',
  },
]

// Logos oficiales (CDN ESPN, uso editorial) por slug. Alimentan el rail "Por
// competición" de la principal y la cabecera de cada página de competición.
// Se inyectan en `crest` al cargar el módulo (sin pisar los ya definidos).
const CREST_BY_SLUG: Record<string, string> = {
  laliga:         'https://a.espncdn.com/i/leaguelogos/soccer/500-dark/15.png',
  champions:      'https://a.espncdn.com/i/leaguelogos/soccer/500-dark/2.png',
  'premier-league':'https://a.espncdn.com/i/leaguelogos/soccer/500-dark/23.png',
  'serie-a':      'https://a.espncdn.com/i/leaguelogos/soccer/500-dark/12.png',
  bundesliga:     'https://a.espncdn.com/i/leaguelogos/soccer/500-dark/10.png',
  'ligue-1':      'https://a.espncdn.com/i/leaguelogos/soccer/500-dark/9.png',
  'europa-league':'https://a.espncdn.com/i/leaguelogos/soccer/500-dark/2310.png',
  'copa-del-rey': 'https://a.espncdn.com/i/leaguelogos/soccer/500-dark/80.png',
  'copa-america': 'https://a.espncdn.com/i/leaguelogos/soccer/500-dark/83.png',
  'nations-league':'https://a.espncdn.com/i/leaguelogos/soccer/500-dark/2395.png',
  nba:            'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500-dark/nba.png&w=500&h=500&transparent=true',
  f1:             'https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/f1.png&w=500&h=500&transparent=true',
  ufc:            'https://a.espncdn.com/i/teamlogos/leagues/500/ufc.png',
}
for (const c of COMPETITIONS) {
  if (!c.crest && CREST_BY_SLUG[c.slug]) c.crest = CREST_BY_SLUG[c.slug]
}

// Slug ESPN por competición → habilita clasificación + máximos goleadores en la
// página de competición. Solo ligas de fútbol (la tabla solo aparece para las de
// TABLE_LEAGUE_SLUGS; los goleadores se intentan y degradan si no hay datos).
const ESPN_SLUG_BY_SLUG: Record<string, string> = {
  laliga:          'soccer/esp.1',
  champions:       'soccer/uefa.champions',
  'premier-league':'soccer/eng.1',
  'serie-a':       'soccer/ita.1',
  bundesliga:      'soccer/ger.1',
  'ligue-1':       'soccer/fra.1',
  'europa-league': 'soccer/uefa.europa',
  'copa-del-rey':  'soccer/esp.copa_del_rey',
}
for (const c of COMPETITIONS) {
  if (!c.espnSlug && ESPN_SLUG_BY_SLUG[c.slug]) c.espnSlug = ESPN_SLUG_BY_SLUG[c.slug]
}

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
