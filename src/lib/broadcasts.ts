/**
 * Derechos de emisión en España por competición.
 * La API de ESPN devuelve canales del mercado US (NBC, ESPN+, Peacock, etc.)
 * que son irrelevantes para el usuario español. Este mapa los sobreescribe.
 *
 * Fuente: temporada 2024-25
 */

const SPAIN_BROADCAST: Record<string, string> = {
  // ── Fútbol – ligas domésticas ───────────────────────────────────────────
  LaLiga:             'DAZN',
  'La Liga':          'DAZN',
  Premier:            'DAZN',
  'Premier League':   'DAZN',
  'Serie A':          'DAZN',
  Bundesliga:         'DAZN',
  'Ligue 1':          'DAZN',
  'Liga Portugal':    'DAZN',
  Eredivisie:         'DAZN',
  'Copa del Rey':     'DAZN',
  Supercopa:          'DAZN',
  'Segunda División': 'DAZN',
  'La Liga 2':        'DAZN',

  // ── Fútbol – UEFA ───────────────────────────────────────────────────────
  'Champions League':       'Movistar+',
  'UEFA Champions League':  'Movistar+',
  'Europa League':          'Movistar+',
  'UEFA Europa League':     'Movistar+',
  'Conference League':      'DAZN',
  'UEFA Conference League': 'DAZN',

  // ── Selecciones ─────────────────────────────────────────────────────────
  'Nations League':   'DAZN',
  Eliminatorias:      'RTVE',
  'Eurocopa':         'RTVE',

  // ── Baloncesto ──────────────────────────────────────────────────────────
  NBA:             'Movistar+',
  'NBA Playoffs':  'Movistar+',
  'NBA Finals':    'Movistar+',
  EuroLeague:      'DAZN',
  ACB:             'Movistar+',

  // ── Tenis ───────────────────────────────────────────────────────────────
  'Roland Garros':    'Eurosport',
  'French Open':      'Eurosport',
  Wimbledon:          'Eurosport',
  'Australian Open':  'Eurosport',
  'US Open':          'Eurosport',
  ATP:                'Movistar+',
  WTA:                'Movistar+',
  'Davis Cup':        'DAZN',

  // ── Fórmula 1 ───────────────────────────────────────────────────────────
  'Fórmula 1': 'DAZN F1',
  'Formula 1': 'DAZN F1',
  F1:          'DAZN F1',
  MotoGP:      'DAZN',

  // ── UFC / Artes marciales ────────────────────────────────────────────────
  UFC:          'DAZN',
  'UFC Fight Night': 'DAZN',
  'Boxeo':      'DAZN',
  WWE:          'DAZN',

  // ── Pádel ───────────────────────────────────────────────────────────────
  'Premier Padel':    'Movistar+',
  'World Padel Tour': 'DAZN',
  WPT:                'DAZN',
}

/**
 * Devuelve el canal de emisión en España para una competición dada.
 * La búsqueda es case-insensitive y también intenta match parcial
 * (ej. "Roland Garros Masters" → "Eurosport").
 */
export function getSpanishBroadcast(comp: string, sport?: string): string | undefined {
  // 1. Exact match
  if (SPAIN_BROADCAST[comp]) return SPAIN_BROADCAST[comp]

  // 2. Case-insensitive exact
  const lower = comp.toLowerCase()
  for (const [key, val] of Object.entries(SPAIN_BROADCAST)) {
    if (key.toLowerCase() === lower) return val
  }

  // 3. Substring: comp contains key (e.g. "Roland Garros Masters 1000")
  for (const [key, val] of Object.entries(SPAIN_BROADCAST)) {
    if (lower.includes(key.toLowerCase())) return val
  }

  // 4. Sport fallback
  if (sport) {
    const sportFallbacks: Record<string, string> = {
      'Fútbol':     'DAZN',
      'NBA':        'Movistar+',
      'Tenis':      'Eurosport',
      'F1':         'DAZN F1',
      'UFC':        'DAZN',
      'Rugby':      'DAZN',
      'Baloncesto': 'DAZN',
    }
    if (sportFallbacks[sport]) return sportFallbacks[sport]
  }

  return undefined
}
