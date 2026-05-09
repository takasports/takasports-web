// Editorial snapshots for blocks without a public API.
// Update these objects + bump `asOf` when the underlying source publishes.
// A future cron (n8n) can replace these inlines with reads from Supabase
// Storage; the route only depends on the exported shape.

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

export const FIFA_RANKING_AS_OF = '2026-04'
export const FIFA_RANKING: StandingRow[] = [
  { rank: 1,  name: 'Francia',      abbr: 'FRA', value: '1877', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'up',   extra: { Pts: '1877.32' } },
  { rank: 2,  name: 'España',       abbr: 'ESP', value: '1876', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'down', extra: { Pts: '1876.40' } },
  { rank: 3,  name: 'Argentina',    abbr: 'ARG', value: '1875', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'down', extra: { Pts: '1874.82' } },
  { rank: 4,  name: 'Inglaterra',   abbr: 'ENG', value: '1826', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'flat', extra: { Pts: '1825.97' } },
  { rank: 5,  name: 'Portugal',     abbr: 'POR', value: '1764', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'up',   extra: { Pts: '1763.83' } },
  { rank: 6,  name: 'Brasil',       abbr: 'BRA', value: '1761', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'down', extra: { Pts: '1761.16' } },
  { rank: 7,  name: 'Países Bajos', abbr: 'NED', value: '1758', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'flat', extra: { Pts: '1757.87' } },
  { rank: 8,  name: 'Marruecos',    abbr: 'MAR', value: '1757', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'up',   extra: { Pts: '1756.80' } },
  { rank: 9,  name: 'Bélgica',      abbr: 'BEL', value: '1735', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'down', extra: { Pts: '1734.72' } },
  { rank: 10, name: 'Alemania',     abbr: 'GER', value: '1730', sub: `Snapshot ${FIFA_RANKING_AS_OF}`, trend: 'up',   extra: { Pts: '1730.37' } },
]

export const UFC_P4P_AS_OF = 'May-2026'
export const UFC_P4P: StandingRow[] = [
  { rank: 1,  name: 'Islam Makhachev',   abbr: 'LW',  value: '—', sub: `Ref. ${UFC_P4P_AS_OF}`, trend: 'flat', extra: { División: 'Ligero',      Estado: 'Campeón' } },
  { rank: 2,  name: 'Jon Jones',         abbr: 'HW',  value: '—', sub: `Ref. ${UFC_P4P_AS_OF}`, trend: 'flat', extra: { División: 'Pesado',       Estado: 'Campeón' } },
  { rank: 3,  name: 'Ilia Topuria',      abbr: 'FW',  value: '—', sub: `Ref. ${UFC_P4P_AS_OF}`, trend: 'up',   extra: { División: 'Pluma',        Estado: 'Campeón' } },
  { rank: 4,  name: 'Dricus du Plessis', abbr: 'MW',  value: '—', sub: `Ref. ${UFC_P4P_AS_OF}`, trend: 'flat', extra: { División: 'Medio',         Estado: 'Campeón' } },
  { rank: 5,  name: 'Alex Pereira',      abbr: 'LHW', value: '—', sub: `Ref. ${UFC_P4P_AS_OF}`, trend: 'down', extra: { División: 'Semi-pesado',   Estado: 'Ex-campeón' } },
  { rank: 6,  name: 'Merab Dvalishvili', abbr: 'BW',  value: '—', sub: `Ref. ${UFC_P4P_AS_OF}`, trend: 'up',   extra: { División: 'Gallo',         Estado: 'Campeón' } },
  { rank: 7,  name: 'Belal Muhammad',    abbr: 'WW',  value: '—', sub: `Ref. ${UFC_P4P_AS_OF}`, trend: 'up',   extra: { División: 'Wélter',        Estado: 'Campeón' } },
  { rank: 8,  name: 'Tom Aspinall',      abbr: 'HW',  value: '—', sub: `Ref. ${UFC_P4P_AS_OF}`, trend: 'flat', extra: { División: 'Pesado (Int.)', Estado: 'Campeón Int.' } },
  { rank: 9,  name: 'Alexandre Pantoja', abbr: 'FLW', value: '—', sub: `Ref. ${UFC_P4P_AS_OF}`, trend: 'flat', extra: { División: 'Mosca',         Estado: 'Campeón' } },
  { rank: 10, name: 'Charles Oliveira',  abbr: 'LW',  value: '—', sub: `Ref. ${UFC_P4P_AS_OF}`, trend: 'up',   extra: { División: 'Ligero',        Estado: 'Contendiente' } },
]

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

// ─── MotoGP ────────────────────────────────────────────────────────────────
export const MOTOGP_AS_OF = '2026-04 · R5 Jerez'
export const MOTOGP_RIDERS: StandingRow[] = [
  { rank: 1, name: 'Marc Márquez',     abbr: 'Ducati Lenovo',     value: '171', sub: 'Temp. 2026', flag: '🇪🇸', trend: 'up',   extra: { Vic: '4', Podios: '5' } },
  { rank: 2, name: 'Pecco Bagnaia',    abbr: 'Ducati Lenovo',     value: '120', sub: 'Temp. 2026', flag: '🇮🇹', trend: 'flat', extra: { Vic: '1', Podios: '3' } },
  { rank: 3, name: 'Álex Márquez',     abbr: 'Gresini Ducati',    value: '108', sub: 'Temp. 2026', flag: '🇪🇸', trend: 'up',   extra: { Vic: '0', Podios: '4' } },
  { rank: 4, name: 'Jorge Martín',     abbr: 'Aprilia Racing',    value: '79',  sub: 'Temp. 2026', flag: '🇪🇸', trend: 'up',   extra: { Vic: '0', Podios: '2' } },
  { rank: 5, name: 'Pedro Acosta',     abbr: 'KTM Factory',       value: '72',  sub: 'Temp. 2026', flag: '🇪🇸', trend: 'up',   extra: { Vic: '0', Podios: '2' } },
  { rank: 6, name: 'Marco Bezzecchi',  abbr: 'Aprilia Racing',    value: '64',  sub: 'Temp. 2026', flag: '🇮🇹', trend: 'flat', extra: { Vic: '0', Podios: '1' } },
  { rank: 7, name: 'Fabio Quartararo', abbr: 'Yamaha Factory',    value: '48',  sub: 'Temp. 2026', flag: '🇫🇷', trend: 'flat', extra: { Vic: '0', Podios: '0' } },
]
export const MOTOGP_CONSTRUCTORS: StandingRow[] = [
  { rank: 1, name: 'Ducati',  abbr: 'DUC', value: '291', sub: 'Temp. 2026', trend: 'up',   extra: {} },
  { rank: 2, name: 'Aprilia', abbr: 'APR', value: '143', sub: 'Temp. 2026', trend: 'up',   extra: {} },
  { rank: 3, name: 'KTM',     abbr: 'KTM', value: '95',  sub: 'Temp. 2026', trend: 'flat', extra: {} },
  { rank: 4, name: 'Yamaha',  abbr: 'YAM', value: '54',  sub: 'Temp. 2026', trend: 'down', extra: {} },
  { rank: 5, name: 'Honda',   abbr: 'HON', value: '38',  sub: 'Temp. 2026', trend: 'down', extra: {} },
]

// ─── Ciclismo ──────────────────────────────────────────────────────────────
export const CYCLING_AS_OF = '2026-04'
export const CYCLING_UCI: StandingRow[] = [
  { rank: 1, name: 'Tadej Pogačar',       abbr: 'UAE Team Emirates',     value: '7820', sub: `UCI · ${CYCLING_AS_OF}`, flag: '🇸🇮', trend: 'flat', extra: {} },
  { rank: 2, name: 'Jonas Vingegaard',    abbr: 'Visma–Lease a Bike',    value: '5280', sub: `UCI · ${CYCLING_AS_OF}`, flag: '🇩🇰', trend: 'up',   extra: {} },
  { rank: 3, name: 'Remco Evenepoel',     abbr: 'Soudal Quick-Step',     value: '4710', sub: `UCI · ${CYCLING_AS_OF}`, flag: '🇧🇪', trend: 'up',   extra: {} },
  { rank: 4, name: 'Mathieu van der Poel',abbr: 'Alpecin–Deceuninck',    value: '3950', sub: `UCI · ${CYCLING_AS_OF}`, flag: '🇳🇱', trend: 'flat', extra: {} },
  { rank: 5, name: 'Wout van Aert',       abbr: 'Visma–Lease a Bike',    value: '3540', sub: `UCI · ${CYCLING_AS_OF}`, flag: '🇧🇪', trend: 'up',   extra: {} },
  { rank: 6, name: 'Primož Roglič',       abbr: 'Red Bull–BORA',         value: '3210', sub: `UCI · ${CYCLING_AS_OF}`, flag: '🇸🇮', trend: 'flat', extra: {} },
]
export const CYCLING_GRAND_TOURS: StandingRow[] = [
  { rank: 1, name: "Giro d'Italia · Italia",   abbr: '🇮🇹', value: '8 may – 31 may',  sub: 'Maglia rosa',   trend: 'up',   extra: {} },
  { rank: 2, name: 'Tour de France · Francia',  abbr: '🇫🇷', value: '4 jul – 26 jul',  sub: 'Maillot jaune', trend: 'flat', extra: {} },
  { rank: 3, name: 'La Vuelta · España',         abbr: '🇪🇸', value: '22 ago – 13 sep', sub: 'Jersey rojo',   trend: 'flat', extra: {} },
]

// ─── Golf OWGR + LIV ───────────────────────────────────────────────────────
export const GOLF_AS_OF = '2026-04'
export const PGA_OWGR: StandingRow[] = [
  { rank: 1, name: 'Scottie Scheffler', abbr: 'USA', value: '14.62', sub: `OWGR · ${GOLF_AS_OF}`, flag: '🇺🇸', trend: 'flat', extra: {} },
  { rank: 2, name: 'Rory McIlroy',       abbr: 'NIR', value: '8.54',  sub: `OWGR · ${GOLF_AS_OF}`, flag: '🇬🇧', trend: 'up',   extra: {} },
  { rank: 3, name: 'Xander Schauffele',  abbr: 'USA', value: '7.89',  sub: `OWGR · ${GOLF_AS_OF}`, flag: '🇺🇸', trend: 'flat', extra: {} },
  { rank: 4, name: 'Collin Morikawa',    abbr: 'USA', value: '6.95',  sub: `OWGR · ${GOLF_AS_OF}`, flag: '🇺🇸', trend: 'up',   extra: {} },
  { rank: 5, name: 'Ludvig Åberg',       abbr: 'SWE', value: '6.21',  sub: `OWGR · ${GOLF_AS_OF}`, flag: '🇸🇪', trend: 'up',   extra: {} },
  { rank: 6, name: 'Viktor Hovland',     abbr: 'NOR', value: '5.47',  sub: `OWGR · ${GOLF_AS_OF}`, flag: '🇳🇴', trend: 'flat', extra: {} },
  { rank: 7, name: 'Tommy Fleetwood',    abbr: 'ENG', value: '5.12',  sub: `OWGR · ${GOLF_AS_OF}`, flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up',  extra: {} },
  { rank: 8, name: 'Hideki Matsuyama',   abbr: 'JPN', value: '4.98',  sub: `OWGR · ${GOLF_AS_OF}`, flag: '🇯🇵', trend: 'flat', extra: {} },
]
export const LIV_RANKING: StandingRow[] = [
  { rank: 1, name: 'Joaquin Niemann',    abbr: 'Torque GC',     value: '198.5', sub: '8 torneos', flag: '🇨🇱', trend: 'up',   extra: {} },
  { rank: 2, name: 'Jon Rahm',            abbr: 'Legion XIII',   value: '184.2', sub: '8 torneos', flag: '🇪🇸', trend: 'flat', extra: {} },
  { rank: 3, name: 'Bryson DeChambeau',   abbr: 'Crushers GC',   value: '162.0', sub: '8 torneos', flag: '🇺🇸', trend: 'up',   extra: {} },
  { rank: 4, name: 'Sergio García',       abbr: 'Fireballs GC',  value: '142.8', sub: '8 torneos', flag: '🇪🇸', trend: 'flat', extra: {} },
  { rank: 5, name: 'Dean Burmester',      abbr: 'Stinger GC',    value: '128.5', sub: '8 torneos', flag: '🇿🇦', trend: 'up',   extra: {} },
  { rank: 6, name: 'Cameron Smith',       abbr: 'Rippers GC',    value: '115.0', sub: '8 torneos', flag: '🇦🇺', trend: 'flat', extra: {} },
]
export const PGA_MAJORS_2026: StandingRow[] = [
  { rank: 1, name: 'The Masters · Augusta National', abbr: '⛳', value: '9-12 abr',  sub: 'Major #1',         trend: 'flat', extra: {} },
  { rank: 2, name: 'PGA Championship · Quail Hollow', abbr: '⛳', value: '14-17 may', sub: 'Major #2',         trend: 'up',   extra: {} },
  { rank: 3, name: 'US Open · Oakmont',                abbr: '⛳', value: '11-14 jun', sub: 'Major #3',         trend: 'flat', extra: {} },
  { rank: 4, name: 'The Open · Royal Portrush',        abbr: '⛳', value: '16-19 jul', sub: 'Major #4',         trend: 'flat', extra: {} },
]

// ─── UFC ───────────────────────────────────────────────────────────────────
export const UFC_NEXT_EVENT_AS_OF = 'May-2026'
export const UFC_NEXT_CARD: StandingRow[] = [
  { rank: 1, name: 'Pereira vs Ankalaev 2',     abbr: 'Title',    value: 'Main',     sub: `UFC 320 · ${UFC_NEXT_EVENT_AS_OF}`, trend: 'up',   extra: { División: 'Semi-pesado' } },
  { rank: 2, name: 'Dvalishvili vs Sandhagen',  abbr: 'Title',    value: 'Co-main',  sub: `UFC 320 · ${UFC_NEXT_EVENT_AS_OF}`, trend: 'up',   extra: { División: 'Gallo' } },
  { rank: 3, name: 'Hill vs Rountree',          abbr: 'Main card',value: '3rd',      sub: `UFC 320 · ${UFC_NEXT_EVENT_AS_OF}`, trend: 'flat', extra: { División: 'Semi-pesado' } },
  { rank: 4, name: 'Ulberg vs Reyes',           abbr: 'Main card',value: '4th',      sub: `UFC 320 · ${UFC_NEXT_EVENT_AS_OF}`, trend: 'flat', extra: { División: 'Semi-pesado' } },
]
export const UFC_STREAKS: StandingRow[] = [
  { rank: 1, name: 'Islam Makhachev',     abbr: 'LW',  value: '15', sub: 'Sin derrotas desde 2015', flag: '🇷🇺', trend: 'up', extra: {} },
  { rank: 2, name: 'Merab Dvalishvili',   abbr: 'BW',  value: '12', sub: 'Campeón actual',          flag: '🇬🇪', trend: 'up', extra: {} },
  { rank: 3, name: 'Belal Muhammad',      abbr: 'WW',  value: '10', sub: 'Sin derrotas desde 2019', flag: '🇺🇸', trend: 'up', extra: {} },
  { rank: 4, name: 'Movsar Evloev',       abbr: 'FW',  value: '9',  sub: 'Invicto en UFC',          flag: '🇷🇺', trend: 'up', extra: {} },
  { rank: 5, name: 'Ilia Topuria',        abbr: 'FW',  value: '8',  sub: 'Invicto profesional',     flag: '🇬🇪', trend: 'up', extra: {} },
  { rank: 6, name: 'Tom Aspinall',        abbr: 'HW',  value: '6',  sub: 'Campeón interino',        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up', extra: {} },
]

// ─── Tenis ─────────────────────────────────────────────────────────────────
export const TENNIS_SLAMS_2026: StandingRow[] = [
  { rank: 1, name: 'Australian Open · Melbourne', abbr: '🇦🇺', value: '19 ene – 1 feb', sub: 'Pista dura',       trend: 'flat', extra: {} },
  { rank: 2, name: 'Roland Garros · París',        abbr: '🇫🇷', value: '24 may – 7 jun', sub: 'Tierra batida',    trend: 'up',   extra: {} },
  { rank: 3, name: 'Wimbledon · Londres',          abbr: '🇬🇧', value: '29 jun – 12 jul', sub: 'Hierba',          trend: 'flat', extra: {} },
  { rank: 4, name: 'US Open · Nueva York',         abbr: '🇺🇸', value: '24 ago – 6 sep', sub: 'Pista dura',       trend: 'flat', extra: {} },
]
export const WTA_SURFACES: StandingRow[] = [
  { rank: 1, name: 'Iga Swiatek',     abbr: 'POL', value: '86%', sub: 'Tierra · 2024-25', flag: '🇵🇱', trend: 'up',   extra: { Dura: '72%', Hierba: '64%' } },
  { rank: 2, name: 'Aryna Sabalenka', abbr: 'BLR', value: '84%', sub: 'Dura · 2024-25',   flag: '🇧🇾', trend: 'up',   extra: { Dura: '84%', Tierra: '68%' } },
  { rank: 3, name: 'Elena Rybakina',  abbr: 'KAZ', value: '78%', sub: 'Hierba · 2024-25', flag: '🇰🇿', trend: 'up',   extra: { Dura: '74%', Hierba: '78%' } },
  { rank: 4, name: 'Coco Gauff',      abbr: 'USA', value: '74%', sub: 'Dura · 2024-25',   flag: '🇺🇸', trend: 'flat', extra: { Dura: '74%', Tierra: '70%' } },
  { rank: 5, name: 'Jessica Pegula',  abbr: 'USA', value: '71%', sub: 'Dura · 2024-25',   flag: '🇺🇸', trend: 'flat', extra: { Dura: '71%', Hierba: '62%' } },
]

// ─── NBA Rookie metadata (para el cálculo automático del ROY race) ────────
export const NBA_ROOKIE_NAMES = new Set<string>([
  'Stephon Castle',
  'Jaylen Wells',
  'Zach Edey',
  'Zaccharie Risacher',
  'Alex Sarr',
  'Donovan Clingan',
  'Reed Sheppard',
  'Matas Buzelis',
  'Rob Dillingham',
  'Bub Carrington',
  'Yves Missi',
  'Ron Holland',
])

// ─── Mundial 2026 — anfitriones (siempre clasificados) ────────────────────
export const WC_HOSTS = new Set<string>(['Estados Unidos', 'EEUU', 'USA', 'Canadá', 'Canada', 'México', 'Mexico'])
