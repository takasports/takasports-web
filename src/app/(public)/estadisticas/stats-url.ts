// Direcciones de /estadisticas: path por deporte + sección/género en query.
// Extraído del monolito EstadisticasClient.

// Construye la dirección de path de estadísticas: /estadisticas/<slug> (la F1 usa
// el slug 'f1' aunque su id interno sea 'formula1'; 'resumen' = portada sin slug).
// Sección y género van como query porque NO son landings SEO.
export const SLUG_BY_SPORT_ID: Record<string, string> = { formula1: 'f1' }
export function buildStatsUrl(id: string, section?: string, genderF?: boolean): string {
  const slug = id === 'resumen' ? '' : (SLUG_BY_SPORT_ID[id] ?? id)
  const base = slug ? `/estadisticas/${slug}` : '/estadisticas'
  const qs = new URLSearchParams()
  if (section) qs.set('section', section)
  if (genderF) qs.set('gender', 'f')
  const q = qs.toString()
  return q ? `${base}?${q}` : base
}

// Lee deporte/sección/género desde la URL actual (camino inverso de buildStatsUrl).
// Sirve de respaldo del popstate cuando la entrada del historial no trae estado.
export function parseStatsLocation(): { sportId: string; sectionId?: string; gender: 'm' | 'f' } {
  if (typeof window === 'undefined') return { sportId: 'resumen', gender: 'm' }
  const m = window.location.pathname.match(/\/estadisticas\/([^/?#]+)/)
  const slug = m?.[1]
  const sportId = slug
    ? (Object.keys(SLUG_BY_SPORT_ID).find(k => SLUG_BY_SPORT_ID[k] === slug) ?? slug)
    : 'resumen'
  const params = new URLSearchParams(window.location.search)
  return {
    sportId,
    sectionId: params.get('section') ?? undefined,
    gender: params.get('gender') === 'f' ? 'f' : 'm',
  }
}

