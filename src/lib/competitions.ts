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
}

export function getCompAccent(comp: string, fallback = '#7C3AED'): string {
  for (const [key, color] of Object.entries(COMP_ACCENT)) {
    if (comp.toLowerCase().includes(key.toLowerCase())) return color
  }
  return fallback
}

// League importance for "Destacados" ranking (higher = more important)
export const LEAGUE_IMPORTANCE: Record<string, number> = {
  'Champions': 10,
  'UCL': 10,
  'Premier': 9,
  'LaLiga': 9,
  'NBA': 9,
  'Serie A': 8,
  'Bundesliga': 8,
  'F1': 8,
  'Fórmula 1': 8,
  'UEFA': 8,
  'UFC': 7,
  'Ligue 1': 7,
  'Copa Rey': 6,
  'Tenis': 6,
  'ATP': 6,
  'WTA': 6,
  'World Padel Tour': 6,
  'Premier Padel': 6,
  'WPT': 6,
  'Pádel': 5,
  'Europa': 5,
}

export function getLeagueScore(comp: string): number {
  for (const [key, score] of Object.entries(LEAGUE_IMPORTANCE)) {
    if (comp.toLowerCase().includes(key.toLowerCase())) return score
  }
  return 4
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
  if (status === 'FT' || status === 'FINAL') return 'Final'
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
