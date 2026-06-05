// Competition metadata: colors, rankings, display names
export const COMP_ACCENT: Record<string, string> = {
  'LaLiga': '#FF4500',
  'Premier': '#6C2D91',
  'Serie A': '#1B4F9C',
  'Bundesliga': '#D4002B',
  'Ligue 1': '#1B4EA8',
  'Champions': '#0B1EEA',
  'Champions L.': '#0B1EEA',
  'UCL': '#0B1EEA',
  'Europa': '#F37021',
  'Copa Rey': '#EF4444',
  'NBA': '#C8102E',
  'Fórmula 1': '#E10600',
  'F1': '#E10600',
  'UFC': '#D4AF37',
  'ATP': '#C6A100',
  'WTA': '#B83280',
  'Tenis': '#C6A100',
  'PGA Tour': '#1B6B3A',
  'Golf': '#1B6B3A',
  'World Padel Tour': '#22d3ee',
  'WPT': '#22d3ee',
  'Pádel': '#22d3ee',
  'Premier Padel': '#06b6d4',
  // Selecciones / FIFA — 'Mundial de Clubes' antes que 'Mundial' (match por substring)
  'Mundial de Clubes': '#0EA5E9',
  'Mundial': '#16A34A',
  'Amistoso': '#94A3B8',
  'Eurocopa': '#0B5CD6',
  'Copa América': '#1FA35A',
  'Libertadores': '#E07B00',
  'Gold Cup': '#B8860B',
  'FA Cup': '#C8102E',
  'MLS': '#1B458F',
  'Liga MX': '#1A8754',
  'Brasileirão': '#1C7C3F',
}

export function getCompAccent(comp: string, fallback = '#7C3AED'): string {
  for (const [key, color] of Object.entries(COMP_ACCENT)) {
    if (comp.toLowerCase().includes(key.toLowerCase())) return color
  }
  return fallback
}

// League importance for "Destacados" ranking (higher = more important).
// Escala 0-12 dejando margen para boosts (marquee +2, stage +3, live +1.5).
export const LEAGUE_IMPORTANCE: Record<string, number> = {
  'Champions': 12,
  'UCL': 12,
  'Premier': 11,
  'LaLiga': 11,
  'NBA': 11,
  // Grand Slams — máxima importancia en tenis
  'Wimbledon': 11,
  'Roland Garros': 11,
  'French Open': 11,
  'US Open': 11,
  'Australian Open': 11,
  'Grand Slam': 11,
  // Masters 1000 / WTA 1000
  'Masters 1000': 9,
  'ATP 1000': 9,
  'WTA 1000': 9,
  'Indian Wells': 9,
  'Miami Open': 9,
  'Madrid Open': 9,
  'Rome': 9,
  'Monte Carlo': 9,
  'Cincinnati': 9,
  'Canadian Open': 9,
  'Shanghai Masters': 9,
  'ATP Finals': 10,
  'WTA Finals': 10,
  'Davis Cup': 9,
  'Billie Jean King': 9,
  'Olympic': 10,
  // Club football
  'Serie A': 10,
  'Bundesliga': 10,
  'F1': 9,
  'Fórmula 1': 9,
  'UEFA': 9,
  'UFC': 8,
  'Ligue 1': 8,
  'Copa Rey': 7,
  // ATP/WTA 500 y genéricos
  'ATP 500': 7,
  'WTA 500': 7,
  'Tenis': 6,
  'ATP': 6,
  'WTA': 6,
  'World Padel Tour': 6,
  'Premier Padel': 6,
  'WPT': 6,
  'Pádel': 5,
  'Europa': 6,
  // Selecciones / FIFA — 'Mundial de Clubes' antes que 'Mundial' (match por substring)
  'Mundial de Clubes': 9,
  'Mundial': 12,
  'Amistoso': 3,
  // Resto del set amplio
  'Eurocopa': 11,
  'Copa América': 10,
  'Libertadores': 9,
  'Nations': 8,
  'Gold Cup': 7,
  'FA Cup': 7,
  'MLS': 7,
  'Liga MX': 7,
  'Brasileirão': 7,
  'Concacaf': 6,
  'Primeira': 6,
  'Eredivisie': 6,
  'Copa Italia': 6,
  'DFB Pokal': 6,
  'Copa Francia': 6,
}

export function getLeagueScore(comp: string): number {
  for (const [key, score] of Object.entries(LEAGUE_IMPORTANCE)) {
    if (comp.toLowerCase().includes(key.toLowerCase())) return score
  }
  return 4
}

// Equipos / atletas "marquee" — siempre boost en Destacados aunque la liga
// sea menor. Coincide por substring contra home/away (lowercased).
const MARQUEE_TEAMS = [
  // Fútbol — top clubes globales
  'real madrid', 'barcelona', 'atlético madrid', 'atletico madrid',
  'manchester city', 'manchester united', 'liverpool', 'arsenal', 'chelsea',
  'bayern', 'borussia dortmund', 'psg', 'paris saint',
  'juventus', 'inter', 'milan', 'napoli', 'roma',
  // NBA — franquicias top
  'lakers', 'celtics', 'warriors', 'bulls', 'heat', 'nuggets',
  'thunder', 'mavericks', 'bucks', '76ers', 'suns', 'knicks',
  // Tenis — top atletas (actualizado 2025-2026)
  'alcaraz', 'sinner', 'djokovic', 'medvedev', 'zverev', 'rune',
  'de minaur', 'fritz', 'ruud', 'musetti', 'tsitsipas', 'rublev',
  'swiatek', 'sabalenka', 'gauff', 'paolini', 'rybakina',
  'keys', 'navarro', 'pegula', 'andreeva', 'collins',
  // F1
  'verstappen', 'hamilton', 'leclerc', 'norris', 'sainz', 'alonso', 'piastri',
  // UFC marquee
  'mcgregor', 'pereira', 'topuria', 'jones', 'aspinall', 'edwards',
]

function isMarquee(name: string | null | undefined): boolean {
  if (!name) return false
  const n = name.toLowerCase()
  return MARQUEE_TEAMS.some(t => n.includes(t))
}

// Detecta fases finales en el nombre de competición o stage del evento.
function stageBoost(comp: string, stage?: string): number {
  const txt = `${comp} ${stage ?? ''}`.toLowerCase()
  if (/\bfinal\b|gran final/.test(txt)) return 4
  if (/semifinal|semis/.test(txt)) return 3
  if (/cuartos|quarterfinal|qf/.test(txt)) return 2
  if (/octavos|round of 16|r16/.test(txt)) return 1.5
  return 0
}

// Score completo usado por el modo Destacados para rankear un evento.
// Combina liga + boosts (marquee, fase, en vivo, prime time).
export function getEventHighlightScore(args: {
  comp: string
  home?: string
  away?: string | null
  stage?: string
  isoDate?: string
  isLive?: boolean
}): number {
  let score = getLeagueScore(args.comp)
  if (isMarquee(args.home) || isMarquee(args.away)) score += 2
  score += stageBoost(args.comp, args.stage)
  if (args.isLive) score += 1.5
  // Prime time 18:00–23:00 hora Madrid: +0.5 para que un Real Madrid 21h
  // gane a un partido menor a las 13h dentro de la misma liga.
  if (args.isoDate) {
    try {
      const d = new Date(args.isoDate)
      const h = parseInt(new Intl.DateTimeFormat('en', {
        timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false,
      }).format(d), 10)
      if (h >= 18 && h <= 23) score += 0.5
    } catch { /* ignore */ }
  }
  return score
}

// Sport emoji and colors — keys match event.sport labels (Spanish)
export const SPORT_EMOJI: Record<string, string> = {
  'Fútbol':      '⚽',
  'NBA':         '🏀',
  'Baloncesto':  '🏀',
  'F1':          '🏎️',
  'MotoGP':      '🏍️',
  'UFC':         '🥊',
  'MMA':         '🥊',
  'Boxeo':       '🥊',
  'Tenis':       '🎾',
  'Pádel':       '🏓',
  'Rugby':       '🏉',
  'Golf':        '⛳',
  'Béisbol':     '⚾',
  'Hockey':      '🏒',
  'Fútbol Amer': '🏈',
  // Fallbacks en inglés por si acaso
  'soccer':      '⚽',
  'basketball':  '🏀',
  'racing':      '🏎️',
  'mma':         '🥊',
  'tennis':      '🎾',
  'padel':       '🏓',
  'rugby':       '🏉',
}

export const SPORT_COLOR: Record<string, string> = {
  'Fútbol':     '#4ade80',
  'NBA':        '#f59e0b',
  'F1':         '#ef4444',
  'UFC':        '#D4AF37',
  'Tenis':      '#d97706',
  'Pádel':      '#22d3ee',
  'Rugby':      '#84cc16',
  // Fallbacks
  'soccer':     '#4ade80',
  'basketball': '#f59e0b',
  'racing':     '#ef4444',
  'mma':        '#f97316',
  'tennis':     '#d97706',
}

export function getSportColor(sport: string): string {
  return SPORT_COLOR[sport] ?? '#a78bfa'
}

// Match status labels
export const STATUS_LABELS: Record<string, string> = {
  'FT': 'Final',
  'Final': 'Final',
  'STATUS_FINAL': 'Final',
  'NS': 'No jugado',
  'STATUS_SCHEDULED': 'No jugado',
  'HT': 'Descanso',
  'INT': 'Intervalo',
  'OT': 'Prórroga',
  '2H': '2T',
  '1H': '1T',
  'RETIRED': 'Retirado',
  'LIVE': 'EN VIVO',
  'EN VIVO': 'EN VIVO',
}

// Sport detection helpers
export function isTennis(sport: string): boolean {
  return /tenis|tennis|atp|wta/i.test(sport)
}

export function isRacing(sport: string): boolean {
  return /racing|f1|fórmula|formula|motogp|moto/i.test(sport)
}

export function isCombat(sport: string): boolean {
  return /mma|ufc|boxing|boxeo/i.test(sport)
}

export function isPadel(sport: string): boolean {
  return /pádel|padel/i.test(sport)
}

export function getLiveLabel(
  status: string,
  elapsed: number | null,
  opts?: { sport?: string; homeScore?: number | null; awayScore?: number | null }
): string {
  // Estados terminales (incluye fútbol acabado en penaltis o prórroga, post-game
  // de NBA, etc.). Importante: cualquier estado que represente "ya terminó"
  // debe devolver 'Final', nunca caer al fallback de 'EN VIVO'.
  if (status === 'FT' || status === 'FINAL' || status === 'FINAL_PEN' ||
      status === 'FINAL_AET' || status === 'POST_GAME' || status === 'END_OF_REGULATION' ||
      status === 'ABANDONED' || status === 'WALKOVER' || status === 'RETIRED' ||
      status === 'CANCELED' || status === 'POSTPONED' || status === 'SUSPENDED' ||
      status === 'FORFEIT') return 'Final'
  if (status === 'NS' || status === 'STATUS_SCHEDULED' || status === 'PRE_GAME' || status === 'DELAYED') return 'Próximo'
  if (status === 'HT') return 'Descanso'
  if (status === 'INT') return 'Intervalo'

  // Tennis: ignore football-style labels — use sets played as set indicator
  if (opts?.sport && isTennis(opts.sport)) {
    const setNum = (opts.homeScore ?? 0) + (opts.awayScore ?? 0) + 1
    return `Set ${setNum}`
  }

  if (status === 'OT') return elapsed != null ? `Prórr. ${elapsed}'` : 'Prórroga'
  if (status.startsWith('Q')) return elapsed != null ? `${status} · ${elapsed}'` : status
  // 1H y 2H: solo mostramos el minuto; la mitad se infiere por el número.
  if (status === '2H' || status === '1H') return elapsed != null ? `${elapsed}'` : (status === '2H' ? '2T' : '1T')
  return elapsed != null ? `${elapsed}'` : 'EN VIVO'
}
