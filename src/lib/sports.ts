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

/**
 * Hub de deporte al que lleva un chip ("Fútbol" → "/futbol").
 *
 * Los hubs (`/futbol`, `/ufc`, `/tenis`…) tienen ranking, próximos partidos y
 * el feed del deporte, y hasta el 03/09/2026 solo se alcanzaban desde el PIE de
 * página: los chips filtraban en el sitio. Con esto el chip es la puerta de
 * entrada, que es lo que la gente espera al tocarlo.
 *
 * `allHref` es a dónde va "Todo": la home lo manda a `/`, y `/noticias` a
 * `/noticias`, para no echar a nadie de la sección en la que está.
 */
export function hubHrefForCategory(cat: string, allHref = '/'): string {
  if (cat === 'Todo') return allHref
  const slug = CATEGORY_TO_SLUG[cat]
  return slug ? `/${slug}` : allHref
}

// Lista completa (compatibilidad interna)
export const SPORT_CATEGORIES = ['Todo', ...Object.values(SLUG_TO_LABEL)]

// Acento por deporte — FUENTE ÚNICA Y PLANA de la identidad "La Señal".
// Acepta slug canónico ('futbol'), label visual en minúsculas ('fútbol', 'nba')
// y slug ESPN de los eventos ('soccer', 'formula-1', 'racing', 'mma'). Sustituye
// los mapas de color duplicados de las tarjetas para compartir (OG). Espejo del
// `accentFor` de la app (mismos valores). Default = morado de marca.
export const DEFAULT_SPORT_ACCENT = '#7C3AED'
export const SPORT_ACCENT: Record<string, string> = {
  futbol: '#34D399', 'fútbol': '#34D399', football: '#34D399', soccer: '#34D399',
  baloncesto: '#F59E0B', basketball: '#F59E0B', nba: '#F59E0B', euroliga: '#F59E0B', bcl: '#F59E0B', acb: '#F59E0B',
  formula1: '#EF4444', f1: '#EF4444', 'formula-1': '#EF4444', racing: '#EF4444',
  tenis: '#E0B33A', tennis: '#E0B33A',
  ufc: '#D4AF37', mma: '#D4AF37', boxing: '#D4AF37', boxeo: '#D4AF37',
  rugby: '#38BDF8',
  wwe: '#A855F7', wrestling: '#A855F7', 'lucha libre': '#A855F7',
  padel: '#22D3EE', 'pádel': '#22D3EE',
  golf: '#86C166',
  motogp: '#FB7185',
}

/** Acento de marca del deporte (acepta slug/label/slug ESPN). Fallback al morado. */
export function accentForSport(sport?: string | null, fallback = DEFAULT_SPORT_ACCENT): string {
  if (!sport) return fallback
  return SPORT_ACCENT[sport.toLowerCase()] ?? fallback
}

// Colores por slug — clave = slug canónico Sanity. El `accent` SALE de SPORT_ACCENT
// (fuente única) para que TODA la web use el mismo color por deporte; el `bg` es
// solo el fondo de respaldo del HeroBlock (muy oscuro, tras scrim).
export const SPORT_STYLE: Record<string, { bg: string; accent: string }> = {
  futbol:     { bg: 'linear-gradient(145deg,#0d2818,#09090F)', accent: SPORT_ACCENT.futbol },
  wwe:        { bg: 'linear-gradient(145deg,#1f0a2e,#09090F)', accent: SPORT_ACCENT.wwe },
  baloncesto: { bg: 'linear-gradient(145deg,#0f1e3d,#09090F)', accent: SPORT_ACCENT.baloncesto },
  formula1:   { bg: 'linear-gradient(145deg,#2a1010,#09090F)', accent: SPORT_ACCENT.formula1 },
  tenis:      { bg: 'linear-gradient(145deg,#1c1208,#09090F)', accent: SPORT_ACCENT.tenis },
  ufc:        { bg: 'linear-gradient(145deg,#2a1408,#09090F)', accent: SPORT_ACCENT.ufc },
  rugby:      { bg: 'linear-gradient(145deg,#0a2436,#09090F)', accent: SPORT_ACCENT.rugby },
  golf:       { bg: 'linear-gradient(145deg,#0c2416,#09090F)', accent: SPORT_ACCENT.golf },
}

// Acepta slug canónico ('futbol', 'baloncesto'…) o label visual ('Fútbol', 'NBA'…)
/**
 * El acento, listo para pintar TEXTO.
 *
 * El morado de marca (#7C3AED) da 3,48:1 sobre el fondo base: vale para un fondo
 * o un borde, pero NO llega al 4,5:1 que pide AA para texto. Los acentos de
 * deporte son claros y pasan de sobra, así que solo se corrige el morado.
 * [Bloque C de la fase 2, 04/09/2026]
 */
export function accentTexto(accent: string): string {
  return accent.toLowerCase() === '#7c3aed' ? '#A78BFA' : accent
}

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

/** SOLO para metadata de texto (título de pestaña/OG en [sport]/page.tsx), donde
 *  no existe el SVG. En UI usar SportIcon de GameIcons (tanda v3: fuera emojis). */
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
