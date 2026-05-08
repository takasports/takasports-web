// ── Tipos centralizados de TakaSports ────────────────────────
// Fuente única de verdad para todas las interfaces compartidas.

// ── Slugs canónicos ───────────────────────────────────────────
export type SportSlug = 'futbol' | 'baloncesto' | 'formula1' | 'tenis' | 'ufc' | 'rugby' | 'wwe'
export type ArticleType = 'noticia' | 'breaking' | 'analisis' | 'cronica' | 'entrevista' | 'galeria'
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
  matchRef?: string       // "{sport}_{league}_{espnId}" for detail page URL
  source?: 'espn' | 'sanity' | 'padel'
  // Scores for completed past events
  homeScore?: number | null
  awayScore?: number | null
  isPast?: boolean
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
