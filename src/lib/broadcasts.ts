/**
 * Derechos de emisión en España — temporada 2024-25.
 *
 * Criterio:
 *  · Canal único   → derechos exclusivos para esa competición en España.
 *  · "A / B"       → derechos compartidos; no podemos saber a qué canal
 *                    corresponde un partido concreto sin una API de pago.
 *
 * La API de ESPN devuelve canales del mercado US (ESPN+, NBC, Peacock…),
 * irrelevantes para usuarios españoles. Este mapa los sustituye.
 */

const SPAIN_BROADCAST: Record<string, string> = {

  // ── Fútbol · Ligas nacionales ────────────────────────────────────────────
  //   LaLiga: DAZN (~4-5 partidos/semana) + M+ LaLiga (~1-2).  No es posible
  //   determinar canal exacto sin consultar el cuadro semanal de LaLiga.
  LaLiga:              'DAZN / Movistar+',
  'La Liga':           'DAZN / Movistar+',
  'LaLiga EA Sports':  'DAZN / Movistar+',
  'Segunda División':  'DAZN',
  'La Liga 2':         'DAZN',

  //   Premier, Serie A, Bundesliga, Ligue 1 → DAZN exclusivo en España
  Premier:             'DAZN',
  'Premier League':    'DAZN',
  'Serie A':           'DAZN',
  Bundesliga:          'DAZN',
  'Ligue 1':           'DAZN',
  'Liga Portugal':     'DAZN',
  Eredivisie:          'DAZN',
  'Primeira Liga':     'DAZN',
  'Scottish Prem':     'DAZN',

  //   Copa del Rey: DAZN (mayoría) + RTVE (algunos partidos en abierto)
  'Copa del Rey':      'DAZN / TVE',
  //   Supercopa: RTVE en abierto
  Supercopa:           'RTVE',
  'Supercopa de España': 'RTVE',

  // ── Fútbol · UEFA ────────────────────────────────────────────────────────
  //   Champions, Europa, Conference y Supercopa europea → Movistar+ exclusivo
  //   (acuerdo 2024-27). Nations League → DAZN.
  Champions:                'Movistar+',
  'Champions League':       'Movistar+',
  'UEFA Champions League':  'Movistar+',
  'UCL':                    'Movistar+',
  Europa:                   'Movistar+',
  'Europa League':          'Movistar+',
  'UEFA Europa League':     'Movistar+',
  Conference:               'Movistar+',
  'Conference League':      'Movistar+',
  'UEFA Conference League': 'Movistar+',
  'Super Cup':              'Movistar+',
  'UEFA Super Cup':         'Movistar+',
  'Supercopa de Europa':    'Movistar+',
  Nations:                  'DAZN',
  'UEFA Nations League':    'DAZN',
  'Nations League':         'DAZN',

  // ── Fútbol · Selecciones ─────────────────────────────────────────────────
  Eliminatorias:       'RTVE',
  'World Cup':         'RTVE',
  'Copa del Mundo':    'RTVE',
  Eurocopa:            'RTVE',
  'Euro 2024':         'RTVE',

  // ── Baloncesto ───────────────────────────────────────────────────────────
  NBA:             'Movistar+',
  'NBA Playoffs':  'Movistar+',
  'NBA Finals':    'Movistar+',
  'In-Season Tournament': 'Movistar+',
  EuroLeague:      'DAZN',
  'Eurocup':       'DAZN',
  ACB:             'Movistar+',
  'Liga ACB':      'Movistar+',

  // ── Tenis ────────────────────────────────────────────────────────────────
  //   Grand Slams → Eurosport (retransmisiones principales en España)
  'Roland Garros':    'Eurosport',
  'French Open':      'Eurosport',
  Wimbledon:          'Eurosport',
  'Australian Open':  'Eurosport',
  'US Open':          'Eurosport',
  //   Masters 1000 y resto del circuito → Movistar+ (derechos ATP/WTA globales)
  ATP:                'Movistar+',
  WTA:                'Movistar+',
  'ATP Tour':         'Movistar+',
  'WTA Tour':         'Movistar+',
  'Davis Cup':        'DAZN',
  'Copa Davis':       'DAZN',
  'Billie Jean King': 'DAZN',

  // ── Motor ────────────────────────────────────────────────────────────────
  'Fórmula 1':  'DAZN F1',
  'Formula 1':  'DAZN F1',
  F1:           'DAZN F1',
  MotoGP:       'DAZN',
  'Moto2':      'DAZN',
  'Moto3':      'DAZN',
  WSBK:         'DAZN',
  WRC:          'DAZN',

  // ── UFC / Combate ────────────────────────────────────────────────────────
  UFC:               'DAZN',
  'UFC Fight Night': 'DAZN',
  Boxeo:             'DAZN',
  WWE:               'DAZN',
  'WWE Raw':         'DAZN',
  'WWE SmackDown':   'DAZN',

  // ── Pádel ────────────────────────────────────────────────────────────────
  'Premier Padel':    'Movistar+',
  'World Padel Tour': 'DAZN',
  WPT:                'DAZN',

  // ── Rugby ────────────────────────────────────────────────────────────────
  'Six Nations':      'DAZN',
  'Top 14':           'DAZN',
  'Premiership Rugby': 'DAZN',
  'United Rugby':     'DAZN',
  'Champions Cup':    'DAZN',
}

// ─── API pública ──────────────────────────────────────────────────────────

/**
 * Devuelve el canal (o canales) de emisión en España para una competición.
 *
 * Estrategia de búsqueda:
 *  1. Exacto                       → "LaLiga" → "DAZN / Movistar+"
 *  2. Case-insensitive exacto      → "laliga" → idem
 *  3. La clave está contenida en comp (substring)
 *     → "Roland Garros Masters 1000" → "Eurosport"
 *  4. Fallback por deporte
 */
export function getSpanishBroadcast(comp: string, sport?: string): string | undefined {
  // 1. Exact match
  if (SPAIN_BROADCAST[comp]) return SPAIN_BROADCAST[comp]

  // 2. Case-insensitive exact
  const lower = comp.toLowerCase()
  for (const [key, val] of Object.entries(SPAIN_BROADCAST)) {
    if (key.toLowerCase() === lower) return val
  }

  // 3. Key is substring of comp name
  for (const [key, val] of Object.entries(SPAIN_BROADCAST)) {
    if (lower.includes(key.toLowerCase())) return val
  }

  // 4. Sport-level fallback
  const sportFallbacks: Record<string, string> = {
    Fútbol:      'DAZN',
    NBA:         'Movistar+',
    Tenis:       'Eurosport',
    F1:          'DAZN F1',
    UFC:         'DAZN',
    Rugby:       'DAZN',
    Baloncesto:  'DAZN',
    MotoGP:      'DAZN',
    Pádel:       'DAZN',
  }
  if (sport && sportFallbacks[sport]) return sportFallbacks[sport]

  return undefined
}

/**
 * Indica si el canal es un reparto de derechos entre varios operadores,
 * en cuyo caso no podemos garantizar cuál emite el partido concreto.
 */
export function isSplitBroadcast(broadcast: string): boolean {
  return broadcast.includes(' / ')
}
