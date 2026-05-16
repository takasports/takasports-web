// Solo constantes editoriales que SIGUEN en uso post-limpieza:
// - FIFA_RANKING + UFC_P4P: fallback inicial si Supabase snapshot no responde.
//   En cuanto el cron actualice, se sobrescriben.
// - COACH_CONFIG: identidad estática (mapping name → teamId ESPN), se
//   actualiza cuando hay cambios de banquillo.
// - TENNIS_SLAMS_2026: calendario fijo anual.
// - NBA_ROOKIE_NAMES: lista del draft de la temporada en curso (actualizar cada año).
// - WC_HOSTS: anfitriones Mundial 2026 (siempre clasificados).

export interface StandingRow {
  rank: number
  name: string
  abbr: string
  value: string
  sub: string
  trend: 'up' | 'down' | 'flat'
  extra: Record<string, string>
  flag?: string
}

// Fallbacks vacíos: si el cron Supabase Y la fuente en vivo (eloratings.net,
// ufc.com) están abajo, mejor mostrar 'No disponible' honestamente que un
// snapshot viejo disfrazado de live (Jon Jones jubilado, Francia #1...).
export const FIFA_RANKING_AS_OF = ''
export const FIFA_RANKING: StandingRow[] = []
export const UFC_P4P_AS_OF = ''
export const UFC_P4P: StandingRow[] = []

export interface CoachEntry {
  name: string
  team: string
  flag: string
  league: 'esp.1' | 'eng.1' | 'ger.1' | 'fra.1' | 'ita.1'
  teamId: string
}

export const COACH_CONFIG: CoachEntry[] = [
  { name: 'Hansi Flick',     team: 'FC Barcelona',  flag: '🇩🇪', league: 'esp.1', teamId: '83'   },
  { name: 'Vincent Kompany', team: 'Bayern Munich', flag: '🇧🇪', league: 'ger.1', teamId: '132'  },
  { name: 'Luis Enrique',    team: 'PSG',           flag: '🇪🇸', league: 'fra.1', teamId: '160'  },
  { name: 'Pep Guardiola',   team: 'Man City',      flag: '🇪🇸', league: 'eng.1', teamId: '382'  },
  { name: 'Mikel Arteta',    team: 'Arsenal',       flag: '🇪🇸', league: 'eng.1', teamId: '359'  },
  { name: 'Diego Simeone',   team: 'Atlético',      flag: '🇦🇷', league: 'esp.1', teamId: '1068' },
  { name: 'Arne Slot',       team: 'Liverpool',     flag: '🇳🇱', league: 'eng.1', teamId: '364'  },
]

// ─── Tenis · calendario Grand Slams 2026 ──────────────────────────────────
export const TENNIS_SLAMS_2026: StandingRow[] = [
  { rank: 1, name: 'Australian Open · Melbourne', abbr: '🇦🇺', value: '19 ene – 1 feb', sub: 'Pista dura',       trend: 'flat', extra: {} },
  { rank: 2, name: 'Roland Garros · París',        abbr: '🇫🇷', value: '24 may – 7 jun', sub: 'Tierra batida',    trend: 'up',   extra: {} },
  { rank: 3, name: 'Wimbledon · Londres',          abbr: '🇬🇧', value: '29 jun – 12 jul', sub: 'Hierba',          trend: 'flat', extra: {} },
  { rank: 4, name: 'US Open · Nueva York',         abbr: '🇺🇸', value: '24 ago – 6 sep', sub: 'Pista dura',       trend: 'flat', extra: {} },
]

// ─── Mundial 2026 — anfitriones (siempre clasificados) ────────────────────
export const WC_HOSTS = new Set<string>(['Estados Unidos', 'EEUU', 'USA', 'Canadá', 'Canada', 'México', 'Mexico'])
