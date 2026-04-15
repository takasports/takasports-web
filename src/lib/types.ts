// ── Tipos centralizados de TakaSports ────────────────────────
// Fuente única de verdad para todas las interfaces compartidas.
// Importar desde aquí en lugar de redefinir en cada componente.

// ── Artículos ─────────────────────────────────────────────────
export interface Article {
  _id: string
  title: string
  subtitle?: string
  body?: string
  short_summary?: string
  image?: SanityImage
  category?: string
  sport?: string
  tags?: string[]
  source_name?: string
  source_url?: string
  publishedAt?: string
}

// Versión reducida para listas / feeds (sin body completo)
export interface ArticlePreview {
  _id: string
  title: string
  short_summary?: string
  publishedAt?: string
  category?: string
  sport?: string
  image?: SanityImage
}

// ── Reels ─────────────────────────────────────────────────────
export interface Reel {
  _id: string
  instagram_url?: string
  thumbnail?: SanityImage
  category?: string
  title?: string
  publishedAt?: string
}

// ── Eventos deportivos ────────────────────────────────────────
export interface SportEvent {
  id: string
  home: string
  away: string | null
  sport: string
  comp: string
  date: string
  time: string
  accent: string
}

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
