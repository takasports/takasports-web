// Convención oficial de deportes — slugs canónicos alineados con Sanity:
// - `sport` en Sanity = slug: 'futbol', 'wwe', 'baloncesto', 'formula1', 'tenis', 'ufc', 'rugby'
// - Labels visuales: 'Fútbol', 'WWE', 'Baloncesto', 'F1', 'Tenis', 'UFC', 'Rugby'

// Slug → label visual (fuente de verdad)
export const SLUG_TO_LABEL: Record<string, string> = {
  futbol:     'Fútbol',
  wwe:        'WWE',
  formula1:   'F1',
  baloncesto: 'Baloncesto',
  tenis:      'Tenis',
  ufc:        'UFC',
  rugby:      'Rugby',
  // Alias de wrestling detectado en captions de Instagram
  wrestling:  'WWE',
  // Competiciones específicas de baloncesto no-NBA
  nba:        'NBA',
  bcl:        'BCL',
  euroliga:   'Euroliga',
  acb:        'ACB',
}

// Label visual → slug (inverso, para filtros y URLs)
// Override manual para que el slug canónico gane sobre aliases (wrestling → wwe)
export const CATEGORY_TO_SLUG: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(SLUG_TO_LABEL).map(([slug, label]) => [label, slug])
  ),
  'WWE': 'wwe',
}

// Categorías principales del filtro global (Home / Noticias)
export const HOME_SPORT_CATEGORIES = ['Todo', 'Fútbol', 'WWE', 'F1', 'Baloncesto', 'Tenis', 'UFC']

// Categorías extra para el dropdown "Más"
export const MORE_SPORT_CATEGORIES = ['Rugby']

// Lista completa (compatibilidad interna)
export const SPORT_CATEGORIES = ['Todo', ...Object.values(SLUG_TO_LABEL)]

// Colores por slug — clave = slug canónico Sanity
export const SPORT_STYLE: Record<string, { bg: string; accent: string }> = {
  futbol:     { bg: 'linear-gradient(145deg,#0d2818,#09090F)', accent: '#22c55e' },
  wwe:        { bg: 'linear-gradient(145deg,#2a0808,#09090F)', accent: '#facc15' },
  baloncesto: { bg: 'linear-gradient(145deg,#0f1e3d,#09090F)', accent: '#f59e0b' },
  formula1:   { bg: 'linear-gradient(145deg,#2a1010,#09090F)', accent: '#ef4444' },
  tenis:      { bg: 'linear-gradient(145deg,#1c1208,#09090F)', accent: '#d97706' },
  ufc:        { bg: 'linear-gradient(145deg,#2a1408,#09090F)', accent: '#f97316' },
  rugby:      { bg: 'linear-gradient(145deg,#1a0f38,#09090F)', accent: '#a78bfa' },
}

// Acepta slug canónico ('futbol', 'baloncesto'…) o label visual ('Fútbol', 'NBA'…)
export function getSportStyle(sport?: string, category?: string) {
  const raw = sport ?? category ?? ''
  const slug = raw.toLowerCase()
  if (SPORT_STYLE[slug]) return SPORT_STYLE[slug]
  const fromLabel = CATEGORY_TO_SLUG[raw]
  if (fromLabel && SPORT_STYLE[fromLabel]) return SPORT_STYLE[fromLabel]
  return { bg: 'linear-gradient(145deg,#1a1a2e,#09090F)', accent: '#7C3AED' }
}

// Label para mostrar — normaliza slug o label a su forma canónica.
// La categoría puede dar más detalle que el deporte (ej: 'bcl' en vez de 'baloncesto' → 'BCL' en vez de 'NBA').
export function getSportLabel(sport?: string, category?: string): string {
  if (category) {
    const catLabel = SLUG_TO_LABEL[category.toLowerCase()]
    if (catLabel) return catLabel
  }
  const raw = sport ?? category ?? ''
  return SLUG_TO_LABEL[raw.toLowerCase()] ?? raw
}

// Emoji por label visual — fuente única de verdad
export const SPORT_EMOJI: Record<string, string> = {
  Fútbol:     '⚽',
  NBA:        '🏀',
  Baloncesto: '🏀',
  F1:         '🏎️',
  Tenis:      '🎾',
  UFC:        '🥊',
  Rugby:      '🏉',
  WWE:        '🎭',
}

export function getSportEmoji(sport: string): string {
  return SPORT_EMOJI[sport] ?? SPORT_EMOJI[SLUG_TO_LABEL[sport.toLowerCase()]] ?? '🏆'
}

// Tabs de navegación superior
export const SPORT_TABS = [
  { label: 'Todos',  slug: '',           href: '/' },
  { label: 'Fútbol', slug: 'futbol',     href: '/?sport=futbol' },
  { label: 'WWE',    slug: 'wwe',        href: '/?sport=wwe' },
  { label: 'UFC',    slug: 'ufc',        href: '/?sport=ufc' },
  { label: 'Baloncesto', slug: 'baloncesto', href: '/?sport=baloncesto' },
  { label: 'F1',     slug: 'formula1',   href: '/?sport=formula1' },
  { label: 'Tenis',  slug: 'tenis',      href: '/?sport=tenis' },
  { label: 'Rugby',  slug: 'rugby',      href: '/?sport=rugby' },
]
