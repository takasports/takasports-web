// Lista centralizada de deportes — agregar aquí para que se propague a CategoriesFilter
export const SPORT_CATEGORIES = [
  'Todo',
  'Fútbol',
  'UFC',
  'NBA',
  'F1',
  'Tenis',
  'Rugby',
  'Básquet',
]

// Mapeo display → URL slug (para persistencia de filtros en URL)
export const CATEGORY_TO_SLUG: Record<string, string> = {
  'Fútbol':  'futbol',
  'UFC':     'ufc',
  'NBA':     'nba',
  'F1':      'f1',
  'Tenis':   'tenis',
  'Rugby':   'rugby',
  'Básquet': 'basquet',
}

// Colores y gradientes por deporte — para placeholders sin imagen
export const SPORT_STYLE: Record<string, { bg: string; accent: string }> = {
  'Fútbol':  { bg: 'linear-gradient(145deg,#0d2818,#09090F)', accent: '#22c55e' },
  'UFC':     { bg: 'linear-gradient(145deg,#2a1010,#09090F)', accent: '#ef4444' },
  'NBA':     { bg: 'linear-gradient(145deg,#0f1e3d,#09090F)', accent: '#f59e0b' },
  'F1':      { bg: 'linear-gradient(145deg,#2a1010,#09090F)', accent: '#ef4444' },
  'Tenis':   { bg: 'linear-gradient(145deg,#0d2012,#09090F)', accent: '#84cc16' },
  'Rugby':   { bg: 'linear-gradient(145deg,#1a0f38,#09090F)', accent: '#a78bfa' },
  'Básquet': { bg: 'linear-gradient(145deg,#271500,#09090F)', accent: '#f97316' },
}

export function getSportStyle(sport?: string, category?: string) {
  const key = sport ?? category ?? ''
  return SPORT_STYLE[key] ?? { bg: 'linear-gradient(145deg,#1a1a2e,#09090F)', accent: '#7C3AED' }
}

// Tabs de navegación superior (usadas en la barra de nav del header, no como segunda fila)
export const SPORT_TABS = [
  { label: 'Todos',    slug: '',         href: '/' },
  { label: 'Fútbol',  slug: 'futbol',   href: '/?sport=futbol' },
  { label: 'UFC',     slug: 'ufc',      href: '/?sport=ufc' },
  { label: 'NBA',     slug: 'nba',      href: '/?sport=nba' },
  { label: 'F1',      slug: 'f1',       href: '/?sport=f1' },
  { label: 'Tenis',   slug: 'tenis',    href: '/?sport=tenis' },
  { label: 'Rugby',   slug: 'rugby',    href: '/?sport=rugby' },
]
