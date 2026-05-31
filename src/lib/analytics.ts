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

// ── Estadísticas ──────────────────────────────────────────────────

export function trackStatsBlockOpen(params: {
  block_id: string
  sport?: string
  section?: string
}) {
  track('stats_block_open', params)
}

export function trackStatsGroupOpen(params: {
  group_id: string
  sport?: string
}) {
  track('stats_group_open', params)
}

// ── La Porra ─────────────────────────────────────────────────────
// Eventos de los surfaces de captación: header pill, home hero, widget
// inline en artículos, toast post-jornada. Permiten comparar qué surface
// convierte mejor y dimensionar la inversión visual en cada uno.

export type PorraSurface =
  | 'header_pill'
  | 'mobile_drawer'
  | 'home_hero'
  | 'article_widget'
  | 'settlement_toast'

export type PorraUserState =
  | 'guest'
  | 'authed_no_picks'
  | 'authed_picked'
  | 'authed_settled'

/** Click en cualquier CTA que lleve a /predicciones. `surface` identifica
 * la procedencia para poder embudar después. */
export function trackPorraCtaClick(params: {
  surface: PorraSurface
  state?: PorraUserState
  jornada?: string | null
  /** Pick preseleccionado en el widget (solo para article_widget). */
  pick?: '1' | 'X' | '2'
}) {
  track('porra_cta_click', params)
}

/** El widget inline matcheó el partido del artículo y se mostró. Nos
 * permite calcular tasa de matching (% de previas que activan widget). */
export function trackPorraWidgetMatched(params: {
  home: string
  away: string
  comp: string
  jornada?: string | null
}) {
  track('porra_widget_matched', params)
}

/** Usuario seleccionó un pronóstico DENTRO del widget inline. Mide intención. */
export function trackPorraWidgetPick(params: {
  home: string
  away: string
  pick: '1' | 'X' | '2'
}) {
  track('porra_widget_pick', params)
}

/** Toast post-jornada apareció (no necesariamente clickeado). */
export function trackPorraSettlementShown(params: {
  jornada: string
  correct: number
  total: number
  totalWon: number
}) {
  track('porra_settlement_shown', params)
}
