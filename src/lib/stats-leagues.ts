// Shared league configuration for /api/stats/* routes.
// Single source of truth for the top-5 European leagues. Update here only.

export interface SoccerLeague {
  /** ESPN league id (e.g. esp.1) used as block id and ESPN slug suffix. */
  id: string
  label: string
  espnSlug: string
  apiSportsId: number
  blockId: string
}

export const SOCCER_LEAGUES: SoccerLeague[] = [
  { id: 'esp.1', label: 'LaLiga',          espnSlug: 'soccer/esp.1', apiSportsId: 140, blockId: 'tabla-laliga' },
  { id: 'eng.1', label: 'Premier League',  espnSlug: 'soccer/eng.1', apiSportsId: 39,  blockId: 'tabla-premier' },
  { id: 'ita.1', label: 'Serie A',         espnSlug: 'soccer/ita.1', apiSportsId: 135, blockId: 'tabla-serie-a' },
  { id: 'ger.1', label: 'Bundesliga',      espnSlug: 'soccer/ger.1', apiSportsId: 78,  blockId: 'tabla-bundesliga' },
  { id: 'fra.1', label: 'Ligue 1',         espnSlug: 'soccer/fra.1', apiSportsId: 61,  blockId: 'tabla-ligue1' },
]

export const EUROPEAN_CUPS = [
  { id: 'tabla-ucl',  label: 'Champions League', espnSlug: 'soccer/uefa.champions'  },
  { id: 'tabla-uel',  label: 'Europa League',    espnSlug: 'soccer/uefa.europa'     },
  { id: 'tabla-uecl', label: 'Conference League',espnSlug: 'soccer/uefa.conference' },
] as const
