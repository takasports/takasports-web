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
// La etiqueta del calendario es "Mundial" pero los mapas por país usan la
// clave "World Cup". Alias EXACTO (no substring): "Mundial de Clubes" es OTRA
// competición con otros derechos y no debe heredar este mapeo.
function canonicalComp(comp: string): string {
  return comp === 'Mundial' ? 'World Cup' : comp
}

// El `sport` llega como slug de la API (soccer, mma, racing…) pero las claves de los
// fallbacks por deporte están en español (Fútbol, UFC…), así que sin normalizar nunca
// casaban y el fallback era código muerto. Mapea el slug a una clave que EXISTE.
const SPORT_ALIAS: Record<string, string> = {
  soccer: 'Fútbol',
  football: 'Fútbol',
  futbol: 'Fútbol',
  basketball: 'Baloncesto',
  nba: 'Baloncesto',
  baloncesto: 'Baloncesto',
  tennis: 'Tenis',
  tenis: 'Tenis',
  racing: 'F1',
  formula1: 'F1',
  f1: 'F1',
  motogp: 'MotoGP',
  mma: 'UFC',
  ufc: 'UFC',
  boxing: 'UFC',
  boxeo: 'UFC',
  rugby: 'Rugby',
  padel: 'Pádel',
  pádel: 'Pádel',
}
function canonicalSport(sport?: string): string | undefined {
  if (!sport) return sport
  return SPORT_ALIAS[sport.toLowerCase()] ?? sport
}

export function getSpanishBroadcast(comp: string, sport?: string): string | undefined {
  comp = canonicalComp(comp)
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
  const sp = canonicalSport(sport)
  if (sp && sportFallbacks[sp]) return sportFallbacks[sp]

  return undefined
}

/**
 * Indica si el canal es un reparto de derechos entre varios operadores,
 * en cuyo caso no podemos garantizar cuál emite el partido concreto.
 */
export function isSplitBroadcast(broadcast: string): boolean {
  return broadcast.includes(' / ')
}

// ─── Zona horaria → país (ISO-3166-1 alpha-2) ─────────────────────────────
// Usado para mostrar el canal de TV correcto según dónde está el usuario.

export const TZ_TO_COUNTRY: Record<string, string> = {
  'Europe/Madrid':                      'ES',
  'Europe/London':                      'GB',
  'Europe/Paris':                       'FR',
  'Europe/Lisbon':                      'PT',
  'Europe/Berlin':                      'DE',
  'Europe/Rome':                        'IT',
  'Europe/Amsterdam':                   'NL',
  'Europe/Moscow':                      'RU',
  'America/New_York':                   'US',
  'America/Chicago':                    'US',
  'America/Los_Angeles':                'US',
  'America/Mexico_City':                'MX',
  'America/Bogota':                     'CO',
  'America/Lima':                       'PE',
  'America/Argentina/Buenos_Aires':     'AR',
  'America/Sao_Paulo':                  'BR',
  'America/Santiago':                   'CL',
  'Asia/Dubai':                         'AE',
  'Asia/Kolkata':                       'IN',
  'Asia/Shanghai':                      'CN',
  'Asia/Tokyo':                         'JP',
  'Asia/Seoul':                         'KR',
  'Asia/Singapore':                     'SG',
  'Australia/Sydney':                   'AU',
}

// ─── Derechos de emisión por país ──────────────────────────────────────────

const GB_BROADCAST: Record<string, string> = {
  'Premier League':         'Sky Sports / TNT Sports',
  Premier:                  'Sky Sports / TNT Sports',
  'Champions League':       'TNT Sports',
  'UEFA Champions League':  'TNT Sports',
  Champions:                'TNT Sports',
  'Europa League':          'TNT Sports',
  'Conference League':      'TNT Sports',
  'La Liga':                'Premier Sports',
  LaLiga:                   'Premier Sports',
  'LaLiga EA Sports':       'Premier Sports',
  'Serie A':                'TNT Sports',
  Bundesliga:               'Sky Sports',
  'Ligue 1':                'Sky Sports',
  'Copa del Rey':           'Premier Sports',
  'Nations League':         'Channel 4',
  'UEFA Nations League':    'Channel 4',
  'Roland Garros':          'Eurosport / ITV4',
  'French Open':            'Eurosport / ITV4',
  Wimbledon:                'BBC / Eurosport',
  'US Open':                'Amazon Prime',
  'Australian Open':        'Eurosport',
  F1:                       'Sky Sports F1',
  'Fórmula 1':              'Sky Sports F1',
  'Formula 1':              'Sky Sports F1',
  MotoGP:                   'TNT Sports',
  NBA:                      'Sky Sports / TNT Sports',
  'NBA Playoffs':           'Sky Sports / TNT Sports',
  UFC:                      'TNT Sports',
  'Six Nations':            'BBC / ITV',
  'Premiership Rugby':      'Sky Sports',
}

const FR_BROADCAST: Record<string, string> = {
  'Ligue 1':                'DAZN / Amazon Prime',
  'Champions League':       'Canal+ / beIN Sports',
  'UEFA Champions League':  'Canal+ / beIN Sports',
  Champions:                'Canal+ / beIN Sports',
  'Europa League':          'Canal+',
  'Conference League':      'Canal+',
  'Premier League':         'Canal+',
  Premier:                  'Canal+',
  'La Liga':                'beIN Sports',
  LaLiga:                   'beIN Sports',
  'Serie A':                'Canal+',
  Bundesliga:               'Canal+',
  'Nations League':         'TF1 (gratis)',
  'UEFA Nations League':    'TF1 (gratis)',
  'Roland Garros':          'France TV (gratis)',
  'French Open':            'France TV (gratis)',
  Wimbledon:                'Eurosport / beIN Sports',
  'US Open':                'Amazon Prime',
  'Australian Open':        'Eurosport',
  F1:                       'Canal+ / TF1',
  'Fórmula 1':              'Canal+ / TF1',
  'Formula 1':              'Canal+ / TF1',
  MotoGP:                   'Canal+',
  NBA:                      'beIN Sports / Canal+',
  UFC:                      'RMC Sport',
  'Top 14':                 'Canal+',
  'Champions Cup':          'Canal+',
}

const DE_BROADCAST: Record<string, string> = {
  Bundesliga:               'Sky Sport / DAZN',
  'Champions League':       'DAZN / Amazon Prime',
  'UEFA Champions League':  'DAZN / Amazon Prime',
  Champions:                'DAZN / Amazon Prime',
  'Europa League':          'RTL (gratis) / DAZN',
  'Premier League':         'Sky Sport',
  Premier:                  'Sky Sport',
  'La Liga':                'DAZN',
  LaLiga:                   'DAZN',
  'Serie A':                'DAZN',
  'Ligue 1':                'DAZN',
  'Nations League':         'RTL (gratis)',
  'UEFA Nations League':    'RTL (gratis)',
  'Roland Garros':          'Eurosport',
  'French Open':            'Eurosport',
  Wimbledon:                'Sky Sport',
  'Australian Open':        'Eurosport',
  'US Open':                'Eurosport',
  F1:                       'RTL (gratis) / Sky F1',
  'Fórmula 1':              'RTL (gratis) / Sky F1',
  'Formula 1':              'RTL (gratis) / Sky F1',
  MotoGP:                   'ServusTV (gratis) / DAZN',
  NBA:                      'DAZN / MagentaSport',
  UFC:                      'DAZN',
}

const IT_BROADCAST: Record<string, string> = {
  'Serie A':                'DAZN / Sky Sport',
  'Champions League':       'Sky Sport / Canale 5 (gratis)',
  'UEFA Champions League':  'Sky Sport / Canale 5 (gratis)',
  Champions:                'Sky Sport / Canale 5 (gratis)',
  'Europa League':          'Sky Sport / TV8 (gratis)',
  'Conference League':      'Sky Sport',
  'Premier League':         'Sky Sport',
  Premier:                  'Sky Sport',
  'La Liga':                'DAZN',
  LaLiga:                   'DAZN',
  Bundesliga:               'DAZN',
  'Roland Garros':          'Eurosport / Sky Sport',
  'French Open':            'Eurosport / Sky Sport',
  Wimbledon:                'Sky Sport',
  'Australian Open':        'Eurosport / Sky Sport',
  'US Open':                'Eurosport / Sky Sport',
  F1:                       'Sky Sport F1 / TV8 (gratis)',
  'Fórmula 1':              'Sky Sport F1 / TV8 (gratis)',
  'Formula 1':              'Sky Sport F1 / TV8 (gratis)',
  MotoGP:                   'Sky Sport MotoGP / TV8 (gratis)',
  NBA:                      'Sky Sport / DAZN',
  UFC:                      'DAZN',
}

const PT_BROADCAST: Record<string, string> = {
  'Liga Portugal':          'DAZN / Sport TV',
  'Primeira Liga':          'DAZN / Sport TV',
  'Champions League':       'Sport TV / SIC (gratis, algunos)',
  'UEFA Champions League':  'Sport TV / SIC (gratis, algunos)',
  Champions:                'Sport TV',
  'Europa League':          'Sport TV',
  'Premier League':         'Sport TV',
  Premier:                  'Sport TV',
  'La Liga':                'Sport TV',
  LaLiga:                   'Sport TV',
  'Roland Garros':          'Eurosport / Sport TV',
  'French Open':            'Eurosport / Sport TV',
  Wimbledon:                'Eurosport',
  'Australian Open':        'Eurosport',
  F1:                       'Sport TV / RTP (gratis, algunos)',
  'Fórmula 1':              'Sport TV / RTP (gratis, algunos)',
  'Formula 1':              'Sport TV / RTP (gratis, algunos)',
  MotoGP:                   'Sport TV',
  NBA:                      'DAZN / Sport TV',
  UFC:                      'Sport TV',
}

const NL_BROADCAST: Record<string, string> = {
  Eredivisie:               'Ziggo Sport',
  'Champions League':       'Ziggo Sport / RTL (gratis)',
  'UEFA Champions League':  'Ziggo Sport / RTL (gratis)',
  Champions:                'Ziggo Sport / RTL (gratis)',
  'Premier League':         'Viaplay',
  Premier:                  'Viaplay',
  'Serie A':                'Viaplay',
  Bundesliga:               'Viaplay',
  'Roland Garros':          'Eurosport',
  'French Open':            'Eurosport',
  Wimbledon:                'Eurosport',
  F1:                       'Viaplay / Ziggo Sport',
  'Fórmula 1':              'Viaplay / Ziggo Sport',
  'Formula 1':              'Viaplay / Ziggo Sport',
  MotoGP:                   'Viaplay',
  NBA:                      'DAZN',
  UFC:                      'DAZN',
}

const US_BROADCAST: Record<string, string> = {
  MLS:                      'Apple TV+',
  'Premier League':         'Peacock / NBC',
  Premier:                  'Peacock / NBC',
  'Champions League':       'Paramount+ / CBS',
  'UEFA Champions League':  'Paramount+ / CBS',
  Champions:                'Paramount+ / CBS',
  'Europa League':          'Paramount+',
  'Conference League':      'Paramount+',
  'La Liga':                'ESPN+',
  LaLiga:                   'ESPN+',
  'LaLiga EA Sports':       'ESPN+',
  'Serie A':                'Paramount+',
  Bundesliga:               'ESPN+',
  'Ligue 1':                'beIN Sports',
  'Copa del Rey':           'ESPN+',
  'World Cup':              'Fox Sports / Telemundo',
  'Copa del Mundo':         'Fox Sports / Telemundo',
  'Nations League':         'Paramount+ / CBS',
  'Roland Garros':          'Peacock / Tennis Channel',
  'French Open':            'Peacock / Tennis Channel',
  Wimbledon:                'ESPN / Tennis Channel',
  'US Open':                'ESPN / Tennis Channel',
  'Australian Open':        'ESPN / Tennis Channel',
  F1:                       'ESPN',
  'Fórmula 1':              'ESPN',
  'Formula 1':              'ESPN',
  MotoGP:                   'Peacock',
  NBA:                      'ESPN / TNT / ABC',
  'NBA Playoffs':           'ESPN / TNT / ABC',
  'NBA Finals':             'ESPN / ABC',
  UFC:                      'ESPN+',
  'In-Season Tournament':   'ESPN / TNT',
}

const MX_BROADCAST: Record<string, string> = {
  'Liga MX':                'Canal 5 / TUDN',
  'Champions League':       'HBO Max / TNT Sports',
  'UEFA Champions League':  'HBO Max / TNT Sports',
  Champions:                'HBO Max / TNT Sports',
  'Europa League':          'HBO Max',
  'Premier League':         'Sky Sports',
  Premier:                  'Sky Sports',
  'La Liga':                'Sky Sports',
  LaLiga:                   'Sky Sports',
  'Serie A':                'Sky Sports',
  Bundesliga:               'Sky Sports',
  'World Cup':              'Azteca (gratis) / TUDN',
  'Copa del Mundo':         'Azteca (gratis) / TUDN',
  'Roland Garros':          'ESPN / Sky Sports',
  'French Open':            'ESPN / Sky Sports',
  Wimbledon:                'Sky Sports',
  'US Open':                'ESPN',
  F1:                       'Fox Sports / ESPN',
  'Fórmula 1':              'Fox Sports / ESPN',
  'Formula 1':              'Fox Sports / ESPN',
  MotoGP:                   'Fox Sports',
  NBA:                      'TNT Sports / Sky',
  UFC:                      'Fox Sports',
}

const AR_BROADCAST: Record<string, string> = {
  'Champions League':       'ESPN / STAR+',
  'UEFA Champions League':  'ESPN / STAR+',
  Champions:                'ESPN / STAR+',
  'Europa League':          'ESPN / STAR+',
  'Premier League':         'ESPN / STAR+',
  Premier:                  'ESPN / STAR+',
  'La Liga':                'ESPN / STAR+',
  LaLiga:                   'ESPN / STAR+',
  'Serie A':                'ESPN / STAR+',
  Bundesliga:               'ESPN / STAR+',
  'Ligue 1':                'ESPN / STAR+',
  'Copa del Rey':           'ESPN / STAR+',
  'World Cup':              'TyC Sports / Telefe (gratis)',
  'Copa del Mundo':         'TyC Sports / Telefe (gratis)',
  'Roland Garros':          'ESPN / STAR+',
  'French Open':            'ESPN / STAR+',
  Wimbledon:                'ESPN / STAR+',
  'US Open':                'ESPN / STAR+',
  'Australian Open':        'ESPN / STAR+',
  F1:                       'ESPN / STAR+',
  'Fórmula 1':              'ESPN / STAR+',
  'Formula 1':              'ESPN / STAR+',
  MotoGP:                   'ESPN / STAR+',
  NBA:                      'ESPN / STAR+',
  UFC:                      'ESPN / STAR+',
}

const BR_BROADCAST: Record<string, string> = {
  'Champions League':       'SBT (gratis) / HBO Max / TNT',
  'UEFA Champions League':  'SBT (gratis) / HBO Max / TNT',
  Champions:                'SBT (gratis) / HBO Max / TNT',
  'Europa League':          'TNT Sports',
  'Premier League':         'ESPN / TNT Sports',
  Premier:                  'ESPN / TNT Sports',
  'La Liga':                'ESPN',
  LaLiga:                   'ESPN',
  'Serie A':                'ESPN',
  Bundesliga:               'ESPN',
  'World Cup':              'Globo (gratis) / SporTV',
  'Copa del Mundo':         'Globo (gratis) / SporTV',
  'Roland Garros':          'ESPN / SporTV',
  'French Open':            'ESPN / SporTV',
  Wimbledon:                'ESPN / SporTV',
  'US Open':                'ESPN',
  'Australian Open':        'ESPN',
  F1:                       'Globo (gratis) / BandSports',
  'Fórmula 1':              'Globo (gratis) / BandSports',
  'Formula 1':              'Globo (gratis) / BandSports',
  MotoGP:                   'SporTV',
  NBA:                      'ESPN / BandSports',
  UFC:                      'Combate / ESPN',
}

// CO, PE, CL tienen derechos similares
const LATAM_BROADCAST: Record<string, string> = {
  'Champions League':       'ESPN / STAR+',
  'UEFA Champions League':  'ESPN / STAR+',
  Champions:                'ESPN / STAR+',
  'Europa League':          'ESPN / STAR+',
  'Premier League':         'ESPN / STAR+',
  Premier:                  'ESPN / STAR+',
  'La Liga':                'ESPN / STAR+',
  LaLiga:                   'ESPN / STAR+',
  'Serie A':                'ESPN / STAR+',
  Bundesliga:               'ESPN / STAR+',
  'Copa del Rey':           'ESPN / STAR+',
  'World Cup':              'Canal RCN / Caracol (CO gratis)',
  'Roland Garros':          'ESPN / STAR+',
  'French Open':            'ESPN / STAR+',
  Wimbledon:                'ESPN / STAR+',
  'US Open':                'ESPN / STAR+',
  'Australian Open':        'ESPN / STAR+',
  F1:                       'ESPN / STAR+',
  'Fórmula 1':              'ESPN / STAR+',
  'Formula 1':              'ESPN / STAR+',
  MotoGP:                   'ESPN / STAR+',
  NBA:                      'ESPN / STAR+',
  UFC:                      'ESPN / STAR+',
}

const AU_BROADCAST: Record<string, string> = {
  'A-League':               'Paramount+',
  'Premier League':         'Optus Sport',
  Premier:                  'Optus Sport',
  'Champions League':       'Stan Sport',
  'UEFA Champions League':  'Stan Sport',
  Champions:                'Stan Sport',
  'Europa League':          'Stan Sport',
  'Conference League':      'Stan Sport',
  'La Liga':                'Stan Sport',
  LaLiga:                   'Stan Sport',
  'Serie A':                'Stan Sport',
  Bundesliga:               'Stan Sport',
  'Roland Garros':          'Nine Network / Stan',
  'French Open':            'Nine Network / Stan',
  Wimbledon:                'Nine Network (gratis) / Stan',
  'Australian Open':        'Nine Network (gratis) / Stan',
  'US Open':                'Nine Network / Stan',
  F1:                       'Fox Sports / Channel 10 (algunos gratis)',
  'Fórmula 1':              'Fox Sports / Channel 10',
  'Formula 1':              'Fox Sports / Channel 10',
  MotoGP:                   'Fox Sports',
  NBA:                      'ESPN (vía Kayo)',
  UFC:                      'ESPN (vía Kayo)',
}

// Fallback por deporte para países sin mapa específico o sin match de competición
const COUNTRY_SPORT_FALLBACKS: Record<string, Record<string, string>> = {
  ES: { Fútbol: 'DAZN', Baloncesto: 'Movistar+', Tenis: 'Eurosport', F1: 'DAZN F1', 'Lucha libre': 'DAZN', MMA: 'DAZN', Rugby: 'DAZN', MotoGP: 'DAZN', Pádel: 'DAZN' },
  GB: { Fútbol: 'Sky Sports', Baloncesto: 'Sky Sports', Tenis: 'Eurosport', F1: 'Sky Sports F1', 'Lucha libre': 'TNT Sports', MMA: 'TNT Sports', Rugby: 'Sky Sports', MotoGP: 'TNT Sports' },
  FR: { Fútbol: 'Canal+ / beIN Sports', Baloncesto: 'beIN Sports', Tenis: 'Eurosport', F1: 'Canal+', 'Lucha libre': 'RMC Sport', MMA: 'RMC Sport', Rugby: 'Canal+', MotoGP: 'Canal+' },
  DE: { Fútbol: 'DAZN / Sky', Baloncesto: 'DAZN', Tenis: 'Eurosport', F1: 'RTL / Sky F1', 'Lucha libre': 'DAZN', MMA: 'DAZN', Rugby: 'DAZN', MotoGP: 'DAZN' },
  IT: { Fútbol: 'DAZN / Sky Sport', Baloncesto: 'Sky Sport', Tenis: 'Eurosport', F1: 'Sky Sport F1 / TV8', 'Lucha libre': 'DAZN', MMA: 'DAZN', Rugby: 'DAZN', MotoGP: 'Sky Sport MotoGP' },
  PT: { Fútbol: 'Sport TV', Baloncesto: 'DAZN', Tenis: 'Eurosport', F1: 'Sport TV', 'Lucha libre': 'Sport TV', MMA: 'Sport TV', Rugby: 'Sport TV', MotoGP: 'Sport TV' },
  NL: { Fútbol: 'Viaplay / Ziggo', Baloncesto: 'DAZN', Tenis: 'Eurosport', F1: 'Viaplay', 'Lucha libre': 'DAZN', MMA: 'DAZN', Rugby: 'DAZN', MotoGP: 'Viaplay' },
  US: { Fútbol: 'ESPN+ / Peacock', Baloncesto: 'ESPN / TNT', Tenis: 'Tennis Channel / ESPN', F1: 'ESPN', 'Lucha libre': 'ESPN+', MMA: 'ESPN+', Rugby: 'NBC / Peacock', MotoGP: 'Peacock' },
  MX: { Fútbol: 'Sky / Fox Sports', Baloncesto: 'TNT Sports', Tenis: 'ESPN', F1: 'Fox Sports', 'Lucha libre': 'Fox Sports', MMA: 'Fox Sports', Rugby: 'Fox Sports', MotoGP: 'Fox Sports' },
  AR: { Fútbol: 'ESPN / STAR+', Baloncesto: 'ESPN / STAR+', Tenis: 'ESPN / STAR+', F1: 'ESPN / STAR+', 'Lucha libre': 'ESPN / STAR+', MMA: 'ESPN / STAR+', Rugby: 'ESPN / STAR+', MotoGP: 'ESPN / STAR+' },
  BR: { Fútbol: 'ESPN / SporTV', Baloncesto: 'ESPN', Tenis: 'ESPN', F1: 'Globo / SporTV', 'Lucha libre': 'Combate', MMA: 'Combate', Rugby: 'SporTV', MotoGP: 'SporTV' },
  CO: { Fútbol: 'ESPN / STAR+', Baloncesto: 'ESPN / STAR+', Tenis: 'ESPN / STAR+', F1: 'ESPN / STAR+', 'Lucha libre': 'ESPN / STAR+', MMA: 'ESPN / STAR+', Rugby: 'ESPN / STAR+', MotoGP: 'ESPN / STAR+' },
  PE: { Fútbol: 'ESPN / STAR+', Baloncesto: 'ESPN / STAR+', Tenis: 'ESPN / STAR+', F1: 'ESPN / STAR+', 'Lucha libre': 'ESPN / STAR+', MMA: 'ESPN / STAR+', Rugby: 'ESPN / STAR+', MotoGP: 'ESPN / STAR+' },
  CL: { Fútbol: 'ESPN / STAR+', Baloncesto: 'ESPN / STAR+', Tenis: 'ESPN / STAR+', F1: 'ESPN / STAR+', 'Lucha libre': 'ESPN / STAR+', MMA: 'ESPN / STAR+', Rugby: 'ESPN / STAR+', MotoGP: 'ESPN / STAR+' },
  AU: { Fútbol: 'Optus Sport / Stan', Baloncesto: 'ESPN (Kayo)', Tenis: 'Nine Network / Stan', F1: 'Fox Sports', 'Lucha libre': 'ESPN (Kayo)', MMA: 'ESPN (Kayo)', Rugby: 'Stan Sport / Nine', MotoGP: 'Fox Sports' },
}

const COUNTRY_BROADCASTS: Record<string, Record<string, string>> = {
  ES: SPAIN_BROADCAST,
  GB: GB_BROADCAST,
  FR: FR_BROADCAST,
  DE: DE_BROADCAST,
  IT: IT_BROADCAST,
  PT: PT_BROADCAST,
  NL: NL_BROADCAST,
  US: US_BROADCAST,
  MX: MX_BROADCAST,
  AR: AR_BROADCAST,
  BR: BR_BROADCAST,
  CO: LATAM_BROADCAST,
  PE: LATAM_BROADCAST,
  CL: LATAM_BROADCAST,
  AU: AU_BROADCAST,
}

function lookupInMap(map: Record<string, string>, comp: string): string | undefined {
  if (map[comp]) return map[comp]
  const lower = comp.toLowerCase()
  for (const [key, val] of Object.entries(map)) {
    if (key.toLowerCase() === lower) return val
  }
  for (const [key, val] of Object.entries(map)) {
    if (lower.includes(key.toLowerCase())) return val
  }
  return undefined
}

/**
 * Devuelve el canal de emisión para una competición/deporte según la zona
 * horaria del usuario. Cubre 15 mercados; fallback a España si el país
 * no está mapeado.
 */
export function getBroadcastForTz(comp: string, sport: string, tz: string): string | undefined {
  comp = canonicalComp(comp)
  const country = TZ_TO_COUNTRY[tz] ?? 'ES'
  const map = COUNTRY_BROADCASTS[country]
  const fallbacks = COUNTRY_SPORT_FALLBACKS[country]

  if (map) {
    const match = lookupInMap(map, comp)
    if (match) return match
  }

  // Fallback por deporte dentro del mismo país
  const sp = canonicalSport(sport)
  if (fallbacks && sp && fallbacks[sp]) return fallbacks[sp]

  // Si el país no tiene mapa, volver a España como default
  if (country !== 'ES') return lookupInMap(SPAIN_BROADCAST, comp)

  return undefined
}
