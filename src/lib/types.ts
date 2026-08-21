// ── Tipos centralizados de TakaSports ────────────────────────
// Fuente única de verdad para todas las interfaces compartidas.

// ── Slugs canónicos ───────────────────────────────────────────
export type SportSlug = 'futbol' | 'baloncesto' | 'formula1' | 'tenis' | 'ufc' | 'rugby' | 'wwe'
export type ArticleType = 'noticia' | 'breaking' | 'reportaje' | 'analisis' | 'cronica' | 'entrevista' | 'galeria'
export type ArticlePriority = 'hero' | 'destacado' | 'normal' | 'secundario'
export type ArticleStatus = 'borrador' | 'pendiente_aprobacion' | 'aprobado' | 'publicado' | 'archivado'
export type EventStatus = 'programado' | 'en_vivo' | 'finalizado' | 'cancelado'
export type CompetitionTier = 'mundial' | 'continental' | 'nacional' | 'copa' | 'regional'

// ── Artículos ─────────────────────────────────────────────────
export interface Article {
  _id: string
  title: string
  slug?: string
  subtitle?: string
  body?: string
  short_summary?: string
  image?: SanityImage
  sport?: SportSlug
  competition?: CompetitionRef
  type?: ArticleType
  priority?: ArticlePriority
  status?: ArticleStatus
  category?: string          // legado — usar sport + competition en adelante
  tags?: string[]
  source_name?: string
  source_url?: string
  publishedAt?: string
  author?: AuthorRef
  relatedEvent?: EventRef
}

// Versión reducida para listas / feeds
export interface ArticlePreview {
  _id: string
  title: string
  slug?: string
  short_summary?: string
  publishedAt?: string
  sport?: SportSlug
  priority?: ArticlePriority
  type?: ArticleType
  category?: string
  image?: SanityImage
}

// ── Eventos deportivos ────────────────────────────────────────
/** Posición del equipo en su liga, adjuntada al evento para dar contexto en la
 *  fila del calendario sin abrir la ficha. Sale de la clasificación de ESPN
 *  (gratis) y solo existe en ligas round-robin (TABLE_LEAGUE_SLUGS). */
export interface TeamStanding {
  rank: number
  pts: number
  /** Zona de la tabla (champions/europa/descenso…) para el "motivo" del partido. */
  zone?: string
  /** Equipos en la tabla — permite saber si un puesto es "colista" o zona baja. */
  of?: number
  /** Balance V-D ("60-22"). En deportes sin puntos (NBA) es lo que se enseña. */
  record?: string
  /** Grupo/conferencia del que sale el puesto ("Este"). Solo en ligas con varios:
   *  sin él, un "1º" del Este y otro del Oeste parecerían el mismo puesto. */
  group?: string
  /** ¿La liga tiene descenso? En la NBA ir último no es descender, así que el
   *  motivo "Duelo de descenso" no debe dispararse ahí. */
  relegation?: boolean
}

export interface SportEvent {
  id: string
  home: string
  away: string | null
  sport: string           // label visual: 'Fútbol', 'Baloncesto', 'F1'…
  comp: string
  date: string
  time: string
  accent: string
  isoDate?: string        // ISO-8601 UTC — para cálculos de fecha exactos
  venue?: string
  stage?: string
  broadcast?: string
  // Team identity
  homeLogo?: string
  awayLogo?: string
  homeAbbr?: string
  awayAbbr?: string
  homePhoto?: string      // athlete headshot/face image URL
  awayPhoto?: string
  // Ids de ESPN de los equipos → enlace del nombre a su ficha (canonicalTeamSlug).
  // Ya venían en el scoreboard y se descartaban al mapear el evento.
  // NO hay equivalente para tenis/UFC: el scoreboard de tenis no trae `athlete.id`
  // (solo guid/displayName) y, sobre todo, `sport_entities` no tiene ni un tenista,
  // así que /jugador/<tenista> daría 404. Enlazar nombres de jugador espera a que
  // el pipeline siembre esas fichas.
  homeTeamId?: string
  awayTeamId?: string
  matchRef?: string       // "{sport}_{league}_{espnId}" for detail page URL
  source?: 'espn' | 'sanity' | 'padel'
  // Scores for completed past events
  homeScore?: number | null
  awayScore?: number | null
  isPast?: boolean
  resultNote?: string     // F1/UFC pasados: ganador del evento (no hay marcador)
  // Clasificación de cada equipo (solo ligas con tabla). La adjunta
  // fetchEspnEvents en una pasada final, así la reciben web Y app (feed).
  homeStanding?: TeamStanding
  awayStanding?: TeamStanding
  /** Historial en una línea ("3 victorias seguidas del Atlético"). Solo en los
   *  cruces con motivo de tabla — ver lib/h2h-notes.ts. */
  h2hNote?: string
  /** Cómo acabó, si no fue de la forma normal: "Abandono" (STATUS_RETIRED) o
   *  "W.O." (STATUS_WALKOVER). Sin esto un abandono se anunciaba como
   *  "Final 0 – 0", que es cierto (nadie cerró un set) pero no se entiende. */
  finishNote?: string
  /** Tenis: set a set ("7-6 2-6 5-7"). En DIRECTO lo sirve /api/events/live con
   *  el set activo marcado; cuando el partido acaba desaparece de ahí, así que
   *  el propio evento lo lleva fijado desde los `linescores` del scoreboard. */
  setsStr?: string
}

// Evento desde Sanity (futuro)
export interface SanityEvent {
  _id: string
  title: string
  sport: SportSlug
  home: string
  away?: string
  date: string
  venue?: string
  status: EventStatus
  result?: string
  competition?: CompetitionRef
}

// ── Reels ─────────────────────────────────────────────────────
export interface Reel {
  _id: string
  title?: string
  instagram_url?: string
  thumbnail?: SanityImage
  sport?: SportSlug
  category?: string      // legado
  publishedAt?: string
  relatedArticle?: ArticleRef
}

// ── Competición ───────────────────────────────────────────────
export interface Competition {
  _id: string
  name: string
  slug: string
  sport: SportSlug
  tier: CompetitionTier
  logo?: SanityImage
}

// ── Autor ─────────────────────────────────────────────────────
export interface Author {
  _id: string
  name: string
  photo?: SanityImage
  bio?: string
}

// ── Referencias ligeras ───────────────────────────────────────
export interface CompetitionRef { _id: string; name: string; slug: string }
export interface AuthorRef      { _id: string; name: string; photo?: SanityImage }
export interface EventRef       { _id: string; title: string; date: string }
export interface ArticleRef     { _id: string; title: string; slug?: string }

// ── Sanity ────────────────────────────────────────────────────
export interface SanityImage {
  asset: {
    _ref: string
    _type?: string
  }
}

// ── Estilos por deporte ───────────────────────────────────────
export interface SportStyle {
  bg: string
  accent: string
}
