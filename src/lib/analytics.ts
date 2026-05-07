// Wrapper de GA4 — todos los eventos custom de TakaSports pasan por aquí
// GA_ID se inyecta en layout.tsx; si no está presente, las llamadas son no-ops.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

function track(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', event, params)
}

// ── Contenido ─────────────────────────────────────────────────────

export function trackArticleView(params: {
  title: string
  slug: string
  sport?: string
  category?: string
}) {
  track('article_view', params)
}

export function trackArticleShare(params: {
  title: string
  method: 'x' | 'whatsapp' | 'facebook' | 'copy'
}) {
  track('article_share', params)
}

// ── Juegos ────────────────────────────────────────────────────────

export function trackGameStart(game: 'crackquiz' | 'quiniela' | 'sopa_cracks' | 'mi_once') {
  track('game_start', { game_name: game })
}

export function trackGameComplete(params: {
  game: 'crackquiz' | 'quiniela' | 'sopa_cracks' | 'mi_once'
  score?: number
  correct?: number
  total?: number
}) {
  track('game_complete', {
    game_name: params.game,
    score: params.score,
    correct_answers: params.correct,
    total_questions: params.total,
  })
}

// ── Búsqueda ──────────────────────────────────────────────────────

export function trackSearch(query: string) {
  track('search', { search_term: query })
}

// ── Navegación ────────────────────────────────────────────────────

export function trackSportFilter(sport: string) {
  track('sport_filter', { sport_name: sport })
}
