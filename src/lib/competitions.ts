// Competition metadata: colors, rankings, display names
import { accentForSport } from '@/lib/sports'

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
  'Liga F': '#DB2777',
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
  'Liga F': 7,
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

// El Mundial de selecciones (comp === 'Mundial', origen ESPN 'soccer/fifa.world').
// Match EXACTO en minúsculas para NO confundirlo con 'Mundial de Clubes'
// (que empieza igual). Se usa para forzar que TODO partido del Mundial entre
// siempre en "Destacados", saltándose el tope del día.
export function isMundial(comp: string | null | undefined): boolean {
  return (comp ?? '').trim().toLowerCase() === 'mundial'
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

// Selecciones nacionales importantes. Los nombres llegan ya traducidos a español
// (lib/nation-names traduce "Brazil"→"Brasil"… en el origen), así que la lista va
// en español. Sirve para que sus partidos —sobre todo los amistosos de parón
// FIFA, que de base puntúan muy bajo (3)— entren en Destacados.
const MARQUEE_NATIONS = [
  'españa', 'francia', 'inglaterra', 'argentina', 'brasil', 'portugal',
  'países bajos', 'bélgica', 'italia', 'alemania', 'croacia', 'uruguay',
  'colombia', 'méxico', 'estados unidos', 'marruecos', 'japón', 'corea del sur',
  'suiza', 'dinamarca', 'senegal', 'serbia', 'polonia', 'ecuador',
  'nigeria', 'australia', 'canadá', 'ucrania',
  // Sudamérica relevante para la audiencia hispanohablante
  'chile', 'perú', 'paraguay', 'venezuela',
]

// Match EXACTO (los amistosos enfrentan país vs país, sin sufijos) para evitar
// falsos positivos con clubes cuyo nombre contenga un país (p. ej. "Real España").
function isMarqueeNation(name: string | null | undefined): boolean {
  if (!name) return false
  return MARQUEE_NATIONS.includes(name.trim().toLowerCase())
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
  // Selecciones importantes: aunque sea un amistoso (base 3), debe destacar.
  // +5 si juega una; +6 si se enfrentan dos (p. ej. Brasil vs EE. UU.). Así un
  // España–Brasil amistoso (8-9) supera a las ligas medias y a los amistosos
  // menores (3), pero sigue por debajo de Champions/Mundial/LaLiga (11-12).
  const nations = (isMarqueeNation(args.home) ? 1 : 0) + (isMarqueeNation(args.away) ? 1 : 0)
  if (nations >= 2) score += 6
  else if (nations === 1) score += 5
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

// Razón corta de "por qué es Destacado" para el badge del modo Destacados.
// Solo devuelve algo cuando hay un motivo claro (final, selección, cartelazo,
// en vivo) → no satura: la mayoría de tarjetas no llevan badge.
export function highlightReason(args: {
  comp: string
  home?: string
  away?: string | null
  stage?: string
}): string | null {
  const txt = `${args.comp} ${args.stage ?? ''}`.toLowerCase()
  if (/\bfinal\b|gran final/.test(txt)) return 'Final'
  if (/semifinal|semis/.test(txt)) return 'Semifinal'
  const nations = (isMarqueeNation(args.home) ? 1 : 0) + (isMarqueeNation(args.away) ? 1 : 0)
  if (nations >= 1) return 'Selección'
  if (isMarquee(args.home) || isMarquee(args.away)) return 'Cartelazo'
  return null
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

// Color de acento por deporte — delega en la fuente única (src/lib/sports.ts)
// para que toda la web use el mismo color por deporte. Acepta label ('Fútbol',
// 'NBA'…) y slug ESPN ('soccer','mma'…); default = morado de marca.
export function getSportColor(sport: string): string {
  return accentForSport(sport)
}

// ─── Tema por deporte (paquete gráfico de retransmisión) ───────────────────
// Cada tema da identidad a la sección /calendario al filtrar por un deporte.
// El "accent" lo consume el código (chip activo, etc.); el resto de variables
// visuales (tinte, textura SVG, glow) viven en globals.css bajo
// `.cal-root[data-sport="…"]` para que el cambio de deporte sea solo un swap de
// variables CSS (instantáneo, 0 fetch). `backdrop` se reserva para la Fase C
// (imagen IA estática lazy). Mantener sincronizado el `accent` con globals.css.
export type SportThemeKey = 'default' | 'futbol' | 'nba' | 'f1' | 'ufc' | 'tenis' | 'padel' | 'rugby' | 'wwe'

export interface SportTheme {
  /** Color de acento (hex). Debe coincidir con `--cal-accent` en globals.css. */
  accent: string
  /** Etiqueta legible del tema. */
  label: string
  /** Ruta WebP estática (fondo IA). Opcional — se cablea en la Fase C. */
  backdrop?: string
}

export const SPORT_THEME: Record<SportThemeKey, SportTheme> = {
  default: { accent: '#7C3AED', label: 'Taka',      backdrop: '/banners/signal/default.webp' },
  futbol:  { accent: '#34D399', label: 'Fútbol',    backdrop: '/banners/signal/futbol.webp' },
  nba:     { accent: '#F59E0B', label: 'NBA',       backdrop: '/banners/signal/nba.webp' },
  f1:      { accent: '#EF4444', label: 'Fórmula 1', backdrop: '/banners/signal/f1.webp' },
  ufc:     { accent: '#D4AF37', label: 'UFC',       backdrop: '/banners/signal/ufc.webp' },
  tenis:   { accent: '#E0B33A', label: 'Tenis',     backdrop: '/banners/signal/tenis.webp' },
  padel:   { accent: '#22D3EE', label: 'Pádel',     backdrop: '/banners/signal/padel.webp' },
  rugby:   { accent: '#38BDF8', label: 'Rugby',     backdrop: '/banners/signal/rugby.webp' },
  wwe:     { accent: '#A855F7', label: 'Lucha libre', backdrop: '/banners/signal/wwe.webp' },
}

// Normaliza el filtro activo de la UI ('Destacados'/'Todo'/'Fútbol'/'NBA'/…) a
// una de las claves de tema. Lo niche (Golf, Béisbol…) cae al tema marca.
export function sportThemeKey(filter: string | null | undefined): SportThemeKey {
  const f = (filter ?? '').toLowerCase()
  if (/fútbol|futbol|soccer/.test(f)) return 'futbol'
  if (/nba|baloncesto|basket|euroliga|euroleague/.test(f)) return 'nba'
  if (/f1|fórmula|formula|motogp|moto|racing/.test(f)) return 'f1'
  if (/ufc|mma|boxe|combat/.test(f)) return 'ufc'
  if (/tenis|tennis|atp|wta/.test(f)) return 'tenis'
  if (/pádel|padel/.test(f)) return 'padel'
  if (/rugby/.test(f)) return 'rugby'
  if (/lucha|wwe|wrestling|aew/.test(f)) return 'wwe'
  return 'default'
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
