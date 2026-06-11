// Convención oficial de deportes — slugs canónicos alineados con Sanity:
// - `sport` en Sanity = slug: 'futbol', 'wwe', 'baloncesto', 'formula1', 'tenis', 'ufc', 'rugby'
// - Labels visuales: 'Fútbol', 'Lucha libre', 'Baloncesto', 'F1', 'Tenis', 'MMA', 'Rugby'

// Slug → label visual (fuente de verdad)
export const SLUG_TO_LABEL: Record<string, string> = {
  futbol:     'Fútbol',
  wwe:        'Lucha libre',
  formula1:   'F1',
  baloncesto: 'Baloncesto',
  tenis:      'Tenis',
  ufc:        'MMA',
  rugby:      'Rugby',
  // Alias de wrestling detectado en captions de Instagram
  wrestling:  'Lucha libre',
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
  'Lucha libre': 'wwe',
}

// Categorías principales del filtro global (Home / Noticias)
export const HOME_SPORT_CATEGORIES = ['Todo', 'Fútbol', 'Lucha libre', 'F1', 'Baloncesto', 'Tenis', 'MMA', 'Rugby']

// Categorías extra para el dropdown "Más" (vacío: ya no se muestra)
export const MORE_SPORT_CATEGORIES: string[] = []

// Lista completa (compatibilidad interna)
export const SPORT_CATEGORIES = ['Todo', ...Object.values(SLUG_TO_LABEL)]

// Colores por slug — clave = slug canónico Sanity.
// Los `accent` están alineados a la paleta única "La Señal" (--sport-accent en
// globals.css) para que TODA la web use el mismo color por deporte; el `bg` es
// solo el fondo de respaldo del HeroBlock (muy oscuro, tras scrim).
export const SPORT_STYLE: Record<string, { bg: string; accent: string }> = {
  futbol:     { bg: 'linear-gradient(145deg,#0d2818,#09090F)', accent: '#34D399' },
  wwe:        { bg: 'linear-gradient(145deg,#1f0a2e,#09090F)', accent: '#A855F7' },
  baloncesto: { bg: 'linear-gradient(145deg,#0f1e3d,#09090F)', accent: '#F59E0B' },
  formula1:   { bg: 'linear-gradient(145deg,#2a1010,#09090F)', accent: '#EF4444' },
  tenis:      { bg: 'linear-gradient(145deg,#1c1208,#09090F)', accent: '#E0B33A' },
  ufc:        { bg: 'linear-gradient(145deg,#2a1408,#09090F)', accent: '#D4AF37' },
  rugby:      { bg: 'linear-gradient(145deg,#0a2436,#09090F)', accent: '#38BDF8' },
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
  Fútbol:        '⚽',
  NBA:           '🏀',
  Baloncesto:    '🏀',
  F1:            '🏎️',
  Tenis:         '🎾',
  MMA:           '🥊',
  Rugby:         '🏉',
  'Lucha libre': '🎭',
}

export function getSportEmoji(sport: string): string {
  return SPORT_EMOJI[sport] ?? SPORT_EMOJI[SLUG_TO_LABEL[sport.toLowerCase()]] ?? '🏆'
}

// Tabs de navegación superior
export const SPORT_TABS = [
  { label: 'Todos',  slug: '',           href: '/' },
  { label: 'Fútbol', slug: 'futbol',     href: '/?sport=futbol' },
  { label: 'Lucha libre', slug: 'wwe',   href: '/?sport=wwe' },
  { label: 'MMA',    slug: 'ufc',        href: '/?sport=ufc' },
  { label: 'Baloncesto', slug: 'baloncesto', href: '/?sport=baloncesto' },
  { label: 'F1',     slug: 'formula1',   href: '/?sport=formula1' },
  { label: 'Tenis',  slug: 'tenis',      href: '/?sport=tenis' },
  { label: 'Rugby',  slug: 'rugby',      href: '/?sport=rugby' },
]
