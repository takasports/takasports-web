// Parámetros de «Noticias relacionadas» de /partido. Puro (sin Sanity ni env)
// para poder probarlo con vitest.
//
// Antes la consulta solo buscaba el nombre de los equipos en el texto: el
// Francia–Italia sacaba el GP de Italia de F1 en Monza. Ahora se exige el
// deporte del partido y una ventana de fechas alrededor del saque.

/** Deporte del partido (ESPN, `SportKind` de /api/match) → `sport` del artículo en Sanity. */
const SPORT_TO_ARTICLE: Record<string, string> = {
  soccer: 'futbol',
  basketball: 'baloncesto',
  mma: 'ufc',
  racing: 'formula1',
  tennis: 'tenis',
  rugby: 'rugby',
}

/** Días antes y después del partido en los que una noticia cuenta como suya. */
export const MATCH_NEWS_WINDOW_DAYS = 12

export function articleSportForMatch(sport?: string | null, leagueSlug?: string | null): string | null {
  if (sport && SPORT_TO_ARTICLE[sport]) return SPORT_TO_ARTICLE[sport]
  // ESPN deja el rugby como 'other'; se reconoce por la liga.
  if (leagueSlug?.startsWith('rugby')) return 'rugby'
  return null
}

export interface MatchNewsParams {
  home: string
  away: string
  sport: string
  from: string
  to: string
  limit: number
}

/**
 * Devuelve los parámetros de `articlesByMatchQuery`, o null si no se puede
 * acotar (faltan equipos o el deporte no tiene noticias en Taka): en ese caso
 * el bloque no se pinta, igual que cuando la búsqueda no encuentra nada.
 */
export function matchNewsParams(input: {
  homeTeam?: string | null
  awayTeam?: string | null
  sport?: string | null
  leagueSlug?: string | null
  startDate?: string | null
  limit?: number
}, now: Date = new Date()): MatchNewsParams | null {
  const home = input.homeTeam?.trim().toLowerCase()
  const away = input.awayTeam?.trim().toLowerCase()
  if (!home || !away) return null
  const sport = articleSportForMatch(input.sport, input.leagueSlug)
  if (!sport) return null

  const start = input.startDate ? new Date(input.startDate) : now
  const center = Number.isNaN(start.getTime()) ? now : start
  const span = MATCH_NEWS_WINDOW_DAYS * 24 * 60 * 60 * 1000
  return {
    home: `${home}*`,
    away: `${away}*`,
    sport,
    from: new Date(center.getTime() - span).toISOString(),
    to: new Date(center.getTime() + span).toISOString(),
    limit: input.limit ?? 4,
  }
}
