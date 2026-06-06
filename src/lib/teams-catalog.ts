// ── Catálogo de equipos / fuentes deportivas ──────────────────
// Fuente única de verdad para nombres, abreviaturas, colores y metadata
// de cada equipo. Cualquier consumo de datos externos (ESPN, API-Sports)
// pasa por `normalizeTeam` para garantizar shape consistente y nombres
// no vacíos.

export type SportKey = 'soccer' | 'basketball' | 'tennis' | 'racing' | 'mma'

export interface TeamRecord {
  /** Identificador interno (ESPN id si lo conocemos, slug si no). */
  id: string
  /** ESPN team id si se conoce — para lookup directo desde el API. */
  espnId?: string
  /** Nombre canónico (lo que mostramos en cards). */
  name: string
  /** Nombre corto para chips y barras (~10 chars o última palabra). */
  shortName: string
  /** Sigla de 2-4 letras para badges. */
  abbr: string
  sport: SportKey
  /** Slug de competición (esp.1, eng.1, nba…). */
  league: string
  /** ISO-3166-1 alpha-2. */
  country?: string
  primary: string
  secondary: string
}

// Helpers ─────────────────────────────────────────────────────

export function teamSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ── Datos ─────────────────────────────────────────────────────
// Notas:
// - `espnId` se rellena para los principales equipos. Si falta, el lookup
//   por nombre (slug) sigue funcionando.
// - `shortName` está optimizado para 8-10 caracteres legibles.
// - Los colores siguen `clubs.ts` pero unificados para todos los deportes.

const TEAMS: Omit<TeamRecord, 'id'>[] = [
  // ── LaLiga (esp.1) ──────────────────────────────────────────
  { espnId: '86',  name: 'Real Madrid',         shortName: 'Madrid',     abbr: 'RMA', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#FFFFFF', secondary: '#D4AF37' },
  { espnId: '83',  name: 'Barcelona',           shortName: 'Barça',      abbr: 'BAR', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#004D98', secondary: '#A50044' },
  { espnId: '1068',name: 'Atlético Madrid',     shortName: 'Atleti',     abbr: 'ATM', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#CB3524', secondary: '#FFFFFF' },
  { espnId: '243', name: 'Sevilla',             shortName: 'Sevilla',    abbr: 'SEV', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#D80027', secondary: '#FFFFFF' },
  { espnId: '244', name: 'Real Betis',          shortName: 'Betis',      abbr: 'BET', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#00A650', secondary: '#FFFFFF' },
  { espnId: '94',  name: 'Valencia',            shortName: 'Valencia',   abbr: 'VAL', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#FF8C00', secondary: '#000000' },
  { espnId: '102', name: 'Villarreal',          shortName: 'Villarreal', abbr: 'VIL', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#FFD700', secondary: '#004994' },
  { espnId: '93',  name: 'Athletic Club',       shortName: 'Athletic',   abbr: 'ATH', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#EE2523', secondary: '#FFFFFF' },
  { espnId: '97',  name: 'Real Sociedad',       shortName: 'Real Soc.',  abbr: 'RSO', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#143C8B', secondary: '#FFFFFF' },
  { espnId: '99',  name: 'Osasuna',             shortName: 'Osasuna',    abbr: 'OSA', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#D72027', secondary: '#0C2340' },
  { espnId: '2922',name: 'Getafe',              shortName: 'Getafe',     abbr: 'GET', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#003DA5', secondary: '#FFFFFF' },
  { espnId: '85',  name: 'Celta Vigo',          shortName: 'Celta',      abbr: 'CEL', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#74B2E0', secondary: '#FFFFFF' },
  { espnId: '101', name: 'Rayo Vallecano',      shortName: 'Rayo',       abbr: 'RAY', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#E60000', secondary: '#FFCD00' },
  { espnId: '9812',name: 'Girona',              shortName: 'Girona',     abbr: 'GIR', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#B0001E', secondary: '#F89500' },
  { espnId: '84',  name: 'Mallorca',            shortName: 'Mallorca',   abbr: 'MLL', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#D80027', secondary: '#000000' },
  { espnId: '88',  name: 'Espanyol',            shortName: 'Espanyol',   abbr: 'ESP', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#003DA5', secondary: '#FFFFFF' },
  { espnId: '90',  name: 'Leganés',             shortName: 'Leganés',    abbr: 'LEG', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#003DA5', secondary: '#FFFFFF' },
  { espnId: '98',  name: 'Las Palmas',          shortName: 'Las Palmas', abbr: 'LPA', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#FFD700', secondary: '#003DA5' },
  { espnId: '96',  name: 'Alavés',              shortName: 'Alavés',     abbr: 'ALA', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#003DA5', secondary: '#FFFFFF' },
  { espnId: '95',  name: 'Real Valladolid',     shortName: 'Valladolid', abbr: 'VLL', sport: 'soccer', league: 'esp.1', country: 'ES', primary: '#7B1E7A', secondary: '#FFFFFF' },

  // ── Premier League (eng.1) ──────────────────────────────────
  { espnId: '382', name: 'Manchester City',     shortName: 'Man City',   abbr: 'MCI', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#6CADDF', secondary: '#FFFFFF' },
  { espnId: '360', name: 'Manchester United',   shortName: 'Man Utd',    abbr: 'MUN', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#DA020E', secondary: '#FFE000' },
  { espnId: '359', name: 'Arsenal',             shortName: 'Arsenal',    abbr: 'ARS', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#EF0107', secondary: '#FFFFFF' },
  { espnId: '364', name: 'Liverpool',           shortName: 'Liverpool',  abbr: 'LIV', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#C8102E', secondary: '#00B2A9' },
  { espnId: '363', name: 'Chelsea',             shortName: 'Chelsea',    abbr: 'CHE', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#034694', secondary: '#FFFFFF' },
  { espnId: '367', name: 'Tottenham Hotspur',   shortName: 'Tottenham',  abbr: 'TOT', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#132257', secondary: '#FFFFFF' },
  { espnId: '361', name: 'Newcastle United',    shortName: 'Newcastle',  abbr: 'NEW', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#000000', secondary: '#FFFFFF' },
  { espnId: '362', name: 'Aston Villa',         shortName: 'Villa',      abbr: 'AVL', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#95BFE5', secondary: '#670E36' },
  { espnId: '331', name: 'West Ham United',     shortName: 'West Ham',   abbr: 'WHU', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#7A263A', secondary: '#1BB1E7' },
  { espnId: '371', name: 'Everton',             shortName: 'Everton',    abbr: 'EVE', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#003399', secondary: '#FFFFFF' },
  { espnId: '384', name: 'Crystal Palace',      shortName: 'Palace',     abbr: 'CRY', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#1B458F', secondary: '#C4122E' },
  { espnId: '337', name: 'Brighton',            shortName: 'Brighton',   abbr: 'BHA', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#0057B8', secondary: '#FFFFFF' },
  { espnId: '397', name: 'Brentford',           shortName: 'Brentford',  abbr: 'BRE', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#E30613', secondary: '#FFFFFF' },
  { name: 'Fulham',              shortName: 'Fulham',     abbr: 'FUL', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#FFFFFF', secondary: '#000000' },
  { name: 'Wolverhampton Wanderers', shortName: 'Wolves',  abbr: 'WOL', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#FDB913', secondary: '#231F20' },
  { name: 'Nottingham Forest',   shortName: 'Forest',     abbr: 'NFO', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#DD0000', secondary: '#FFFFFF' },
  { name: 'Bournemouth',         shortName: 'Bournem.',   abbr: 'BOU', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#DA020E', secondary: '#000000' },
  { name: 'Sheffield United',    shortName: 'Sheff Utd',  abbr: 'SHU', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#EE2737', secondary: '#000000' },
  { name: 'Leicester City',      shortName: 'Leicester',  abbr: 'LEI', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#003090', secondary: '#FDBE11' },
  { name: 'Ipswich Town',        shortName: 'Ipswich',    abbr: 'IPS', sport: 'soccer', league: 'eng.1', country: 'GB', primary: '#003DA5', secondary: '#DC2626' },

  // ── Serie A (ita.1) ─────────────────────────────────────────
  { espnId: '110', name: 'Inter Milan',         shortName: 'Inter',      abbr: 'INT', sport: 'soccer', league: 'ita.1', country: 'IT', primary: '#0067B2', secondary: '#000000' },
  { espnId: '103', name: 'Milan',               shortName: 'Milan',      abbr: 'MIL', sport: 'soccer', league: 'ita.1', country: 'IT', primary: '#FB090B', secondary: '#000000' },
  { espnId: '111', name: 'Juventus',            shortName: 'Juventus',   abbr: 'JUV', sport: 'soccer', league: 'ita.1', country: 'IT', primary: '#000000', secondary: '#FFFFFF' },
  { espnId: '114', name: 'Napoli',              shortName: 'Napoli',     abbr: 'NAP', sport: 'soccer', league: 'ita.1', country: 'IT', primary: '#12A0D7', secondary: '#FFFFFF' },
  { espnId: '104', name: 'Roma',                shortName: 'Roma',       abbr: 'ROM', sport: 'soccer', league: 'ita.1', country: 'IT', primary: '#8E1F2F', secondary: '#F0BC42' },
  { espnId: '105', name: 'Lazio',               shortName: 'Lazio',      abbr: 'LAZ', sport: 'soccer', league: 'ita.1', country: 'IT', primary: '#87CEEB', secondary: '#FFFFFF' },
  { espnId: '113', name: 'Atalanta',            shortName: 'Atalanta',   abbr: 'ATA', sport: 'soccer', league: 'ita.1', country: 'IT', primary: '#1A2D58', secondary: '#000000' },
  { espnId: '112', name: 'Fiorentina',          shortName: 'Fiorentina', abbr: 'FIO', sport: 'soccer', league: 'ita.1', country: 'IT', primary: '#592C82', secondary: '#FFFFFF' },
  { espnId: '108', name: 'Bologna',             shortName: 'Bologna',    abbr: 'BOL', sport: 'soccer', league: 'ita.1', country: 'IT', primary: '#A50044', secondary: '#1B3A6F' },
  { espnId: '120', name: 'Torino',              shortName: 'Torino',     abbr: 'TOR', sport: 'soccer', league: 'ita.1', country: 'IT', primary: '#8B0000', secondary: '#FFFFFF' },
  { espnId: '107', name: 'Udinese',             shortName: 'Udinese',    abbr: 'UDI', sport: 'soccer', league: 'ita.1', country: 'IT', primary: '#000000', secondary: '#FFFFFF' },
  { espnId: '115', name: 'Genoa',               shortName: 'Genoa',      abbr: 'GEN', sport: 'soccer', league: 'ita.1', country: 'IT', primary: '#C8102E', secondary: '#003DA5' },

  // ── Bundesliga (ger.1) ──────────────────────────────────────
  { espnId: '132', name: 'Bayern Munich',       shortName: 'Bayern',     abbr: 'BAY', sport: 'soccer', league: 'ger.1', country: 'DE', primary: '#DC052D', secondary: '#0066B2' },
  { espnId: '124', name: 'Borussia Dortmund',   shortName: 'Dortmund',   abbr: 'BVB', sport: 'soccer', league: 'ger.1', country: 'DE', primary: '#FDE100', secondary: '#000000' },
  { espnId: '125', name: 'Bayer Leverkusen',    shortName: 'Leverkusen', abbr: 'B04', sport: 'soccer', league: 'ger.1', country: 'DE', primary: '#E32221', secondary: '#000000' },
  { espnId: '134', name: 'RB Leipzig',          shortName: 'Leipzig',    abbr: 'RBL', sport: 'soccer', league: 'ger.1', country: 'DE', primary: '#DD0741', secondary: '#FFFFFF' },
  { espnId: '127', name: 'Eintracht Frankfurt', shortName: 'Frankfurt',  abbr: 'SGE', sport: 'soccer', league: 'ger.1', country: 'DE', primary: '#000000', secondary: '#E1000F' },
  { espnId: '129', name: 'Wolfsburg',           shortName: 'Wolfsburg',  abbr: 'WOB', sport: 'soccer', league: 'ger.1', country: 'DE', primary: '#65B32E', secondary: '#FFFFFF' },
  { espnId: '128', name: 'Stuttgart',           shortName: 'Stuttgart',  abbr: 'VFB', sport: 'soccer', league: 'ger.1', country: 'DE', primary: '#E32219', secondary: '#FFFFFF' },
  { espnId: '139', name: 'Borussia Mönchengladbach', shortName: 'Gladbach', abbr: 'BMG', sport: 'soccer', league: 'ger.1', country: 'DE', primary: '#000000', secondary: '#00B04F' },
  { espnId: '136', name: 'Werder Bremen',       shortName: 'Bremen',     abbr: 'SVW', sport: 'soccer', league: 'ger.1', country: 'DE', primary: '#1D9053', secondary: '#FFFFFF' },
  { espnId: '131', name: 'Hoffenheim',          shortName: 'Hoffenh.',   abbr: 'TSG', sport: 'soccer', league: 'ger.1', country: 'DE', primary: '#1961AC', secondary: '#FFFFFF' },

  // ── Ligue 1 (fra.1) ─────────────────────────────────────────
  { espnId: '160', name: 'Paris Saint-Germain', shortName: 'PSG',        abbr: 'PSG', sport: 'soccer', league: 'fra.1', country: 'FR', primary: '#004170', secondary: '#DA291C' },
  { espnId: '174', name: 'Marseille',           shortName: 'Marseille',  abbr: 'OM',  sport: 'soccer', league: 'fra.1', country: 'FR', primary: '#2FAEE0', secondary: '#FFFFFF' },
  { espnId: '171', name: 'Lyon',                shortName: 'Lyon',       abbr: 'OL',  sport: 'soccer', league: 'fra.1', country: 'FR', primary: '#003DA5', secondary: '#E0001A' },
  { espnId: '180', name: 'Monaco',              shortName: 'Monaco',     abbr: 'ASM', sport: 'soccer', league: 'fra.1', country: 'FR', primary: '#E0001A', secondary: '#FFFFFF' },
  { espnId: '170', name: 'Lille',               shortName: 'Lille',      abbr: 'LOSC',sport: 'soccer', league: 'fra.1', country: 'FR', primary: '#E32219', secondary: '#000080' },
  { espnId: '177', name: 'Nice',                shortName: 'Nice',       abbr: 'NIC', sport: 'soccer', league: 'fra.1', country: 'FR', primary: '#E60012', secondary: '#000000' },
  { espnId: '167', name: 'Rennes',              shortName: 'Rennes',     abbr: 'REN', sport: 'soccer', league: 'fra.1', country: 'FR', primary: '#E20613', secondary: '#000000' },
  { espnId: '159', name: 'Lens',                shortName: 'Lens',       abbr: 'LEN', sport: 'soccer', league: 'fra.1', country: 'FR', primary: '#FFD700', secondary: '#E20613' },
  { espnId: '162', name: 'Nantes',              shortName: 'Nantes',     abbr: 'NAN', sport: 'soccer', league: 'fra.1', country: 'FR', primary: '#FCD700', secondary: '#000000' },
  { espnId: '158', name: 'Strasbourg',          shortName: 'Strasbg.',   abbr: 'STR', sport: 'soccer', league: 'fra.1', country: 'FR', primary: '#005BAA', secondary: '#FFFFFF' },

  // ── NBA ─────────────────────────────────────────────────────
  { espnId: '13',  name: 'Los Angeles Lakers',    shortName: 'Lakers',     abbr: 'LAL', sport: 'basketball', league: 'nba', country: 'US', primary: '#552583', secondary: '#FDB927' },
  { espnId: '2',   name: 'Boston Celtics',        shortName: 'Celtics',    abbr: 'BOS', sport: 'basketball', league: 'nba', country: 'US', primary: '#007A33', secondary: '#FFFFFF' },
  { espnId: '9',   name: 'Golden State Warriors', shortName: 'Warriors',   abbr: 'GSW', sport: 'basketball', league: 'nba', country: 'US', primary: '#1D428A', secondary: '#FFC72C' },
  { espnId: '15',  name: 'Milwaukee Bucks',       shortName: 'Bucks',      abbr: 'MIL', sport: 'basketball', league: 'nba', country: 'US', primary: '#00471B', secondary: '#EEE1C6' },
  { espnId: '6',   name: 'Dallas Mavericks',      shortName: 'Mavs',       abbr: 'DAL', sport: 'basketball', league: 'nba', country: 'US', primary: '#00538C', secondary: '#002B5E' },
  { espnId: '12',  name: 'Los Angeles Clippers',  shortName: 'Clippers',   abbr: 'LAC', sport: 'basketball', league: 'nba', country: 'US', primary: '#C8102E', secondary: '#1D428A' },
  { espnId: '21',  name: 'Phoenix Suns',          shortName: 'Suns',       abbr: 'PHX', sport: 'basketball', league: 'nba', country: 'US', primary: '#1D1160', secondary: '#E56020' },
  { espnId: '20',  name: 'Philadelphia 76ers',    shortName: '76ers',      abbr: 'PHI', sport: 'basketball', league: 'nba', country: 'US', primary: '#006BB6', secondary: '#ED174C' },
  { espnId: '18',  name: 'New York Knicks',       shortName: 'Knicks',     abbr: 'NYK', sport: 'basketball', league: 'nba', country: 'US', primary: '#006BB6', secondary: '#F58426' },
  { espnId: '17',  name: 'Brooklyn Nets',         shortName: 'Nets',       abbr: 'BKN', sport: 'basketball', league: 'nba', country: 'US', primary: '#000000', secondary: '#FFFFFF' },
  { espnId: '14',  name: 'Miami Heat',            shortName: 'Heat',       abbr: 'MIA', sport: 'basketball', league: 'nba', country: 'US', primary: '#98002E', secondary: '#F9A01B' },
  { espnId: '7',   name: 'Denver Nuggets',        shortName: 'Nuggets',    abbr: 'DEN', sport: 'basketball', league: 'nba', country: 'US', primary: '#0E2240', secondary: '#FEC524' },
  { espnId: '5',   name: 'Cleveland Cavaliers',   shortName: 'Cavs',       abbr: 'CLE', sport: 'basketball', league: 'nba', country: 'US', primary: '#860038', secondary: '#FDBB30' },
  { espnId: '4',   name: 'Chicago Bulls',         shortName: 'Bulls',      abbr: 'CHI', sport: 'basketball', league: 'nba', country: 'US', primary: '#CE1141', secondary: '#000000' },
  { espnId: '25',  name: 'Oklahoma City Thunder', shortName: 'Thunder',    abbr: 'OKC', sport: 'basketball', league: 'nba', country: 'US', primary: '#007AC1', secondary: '#EF3B24' },
  { espnId: '8',   name: 'Detroit Pistons',       shortName: 'Pistons',    abbr: 'DET', sport: 'basketball', league: 'nba', country: 'US', primary: '#C8102E', secondary: '#1D42BA' },
  { espnId: '11',  name: 'Indiana Pacers',        shortName: 'Pacers',     abbr: 'IND', sport: 'basketball', league: 'nba', country: 'US', primary: '#002D62', secondary: '#FDBB30' },
  { espnId: '10',  name: 'Houston Rockets',       shortName: 'Rockets',    abbr: 'HOU', sport: 'basketball', league: 'nba', country: 'US', primary: '#CE1141', secondary: '#000000' },
  { espnId: '16',  name: 'Minnesota Timberwolves',shortName: 'Wolves',     abbr: 'MIN', sport: 'basketball', league: 'nba', country: 'US', primary: '#0C2340', secondary: '#236192' },
  { espnId: '29',  name: 'Memphis Grizzlies',     shortName: 'Grizzlies',  abbr: 'MEM', sport: 'basketball', league: 'nba', country: 'US', primary: '#5D76A9', secondary: '#12173F' },
  { espnId: '19',  name: 'Orlando Magic',         shortName: 'Magic',      abbr: 'ORL', sport: 'basketball', league: 'nba', country: 'US', primary: '#0077C0', secondary: '#C4CED4' },
  { espnId: '22',  name: 'Portland Trail Blazers',shortName: 'Blazers',    abbr: 'POR', sport: 'basketball', league: 'nba', country: 'US', primary: '#E03A3E', secondary: '#000000' },
  { espnId: '23',  name: 'Sacramento Kings',      shortName: 'Kings',      abbr: 'SAC', sport: 'basketball', league: 'nba', country: 'US', primary: '#5A2D81', secondary: '#63727A' },
  { espnId: '24',  name: 'San Antonio Spurs',     shortName: 'Spurs',      abbr: 'SAS', sport: 'basketball', league: 'nba', country: 'US', primary: '#000000', secondary: '#C4CED4' },
  { espnId: '28',  name: 'Toronto Raptors',       shortName: 'Raptors',    abbr: 'TOR', sport: 'basketball', league: 'nba', country: 'US', primary: '#CE1141', secondary: '#000000' },
  { espnId: '26',  name: 'Utah Jazz',             shortName: 'Jazz',       abbr: 'UTA', sport: 'basketball', league: 'nba', country: 'US', primary: '#002B5C', secondary: '#F9A01B' },
  { espnId: '1',   name: 'Atlanta Hawks',         shortName: 'Hawks',      abbr: 'ATL', sport: 'basketball', league: 'nba', country: 'US', primary: '#E03A3E', secondary: '#C1D32F' },
  { espnId: '30',  name: 'Charlotte Hornets',     shortName: 'Hornets',    abbr: 'CHA', sport: 'basketball', league: 'nba', country: 'US', primary: '#1D1160', secondary: '#00788C' },
  { espnId: '27',  name: 'Washington Wizards',    shortName: 'Wizards',    abbr: 'WAS', sport: 'basketball', league: 'nba', country: 'US', primary: '#002B5C', secondary: '#E31837' },
  { espnId: '3',   name: 'New Orleans Pelicans',  shortName: 'Pelicans',   abbr: 'NOP', sport: 'basketball', league: 'nba', country: 'US', primary: '#0C2340', secondary: '#C8102E' },
]

// ── Índices ──────────────────────────────────────────────────

const recordsById = new Map<string, TeamRecord>()
const recordsByEspnId = new Map<string, TeamRecord>()
const recordsByNameSlug = new Map<string, TeamRecord>()
const recordsByAbbr = new Map<string, TeamRecord>()

for (const t of TEAMS) {
  const id = t.espnId ?? teamSlug(t.name)
  const rec: TeamRecord = { ...t, id }
  recordsById.set(id, rec)
  if (t.espnId) recordsByEspnId.set(t.espnId, rec)
  recordsByNameSlug.set(teamSlug(t.name), rec)
  recordsByNameSlug.set(teamSlug(t.shortName), rec)
  // Solo registramos abbr si es razonablemente único (las colisiones se ignoran)
  const abbrKey = `${t.sport}:${t.abbr}`
  if (!recordsByAbbr.has(abbrKey)) recordsByAbbr.set(abbrKey, rec)
}

// ── Lookup público ───────────────────────────────────────────

export function findTeamByEspnId(id: string | number | undefined | null): TeamRecord | undefined {
  if (id == null) return undefined
  return recordsByEspnId.get(String(id))
}

export function findTeamByName(name: string | undefined | null): TeamRecord | undefined {
  if (!name) return undefined
  return recordsByNameSlug.get(teamSlug(name))
}

export function findTeamByAbbr(abbr: string | undefined | null, sport?: SportKey): TeamRecord | undefined {
  if (!abbr) return undefined
  if (sport) return recordsByAbbr.get(`${sport}:${abbr.toUpperCase()}`)
  // Probar todos los deportes
  const sports: SportKey[] = ['soccer', 'basketball', 'tennis', 'racing', 'mma']
  for (const s of sports) {
    const r = recordsByAbbr.get(`${s}:${abbr.toUpperCase()}`)
    if (r) return r
  }
  return undefined
}

// ── Normalización en frontera ────────────────────────────────
// Cualquier dato externo (ESPN, API-Sports) pasa por aquí antes de llegar
// al cliente. Garantiza shape y nombres no vacíos.

export interface RawTeamInput {
  id?: string | number
  displayName?: string
  shortDisplayName?: string
  name?: string
  abbreviation?: string
  logo?: string
}

export interface NormalizedTeam {
  id: string
  name: string
  shortName: string
  abbr: string
  logo?: string
  primary?: string
  secondary?: string
}

/**
 * Normaliza un equipo crudo de ESPN/API-Sports usando el catálogo cuando
 * sea posible. Devuelve `null` si no hay datos suficientes para mostrar.
 */
export function normalizeTeam(raw: RawTeamInput | undefined | null): NormalizedTeam | null {
  if (!raw) return null

  // 1) Lookup por ESPN id (caso óptimo)
  const byEspn = findTeamByEspnId(raw.id)
  if (byEspn) {
    return {
      id: byEspn.id,
      name: byEspn.name,
      shortName: byEspn.shortName,
      abbr: byEspn.abbr,
      logo: raw.logo,
      primary: byEspn.primary,
      secondary: byEspn.secondary,
    }
  }

  // 2) Lookup por nombre
  const rawName = raw.displayName ?? raw.name ?? raw.shortDisplayName
  const byName = findTeamByName(rawName)
  if (byName) {
    return {
      id: byName.id,
      name: byName.name,
      shortName: byName.shortName,
      abbr: byName.abbr,
      logo: raw.logo,
      primary: byName.primary,
      secondary: byName.secondary,
    }
  }

  // 3) Fallback puro: usar lo que ESPN nos dio, validando que haya algo
  if (!rawName || !rawName.trim()) return null
  const cleanName = rawName.trim()
  const fallbackShort = raw.shortDisplayName?.trim() || lastWord(cleanName)
  const fallbackAbbr = raw.abbreviation?.trim().toUpperCase() || cleanName.slice(0, 3).toUpperCase()
  return {
    id: raw.id != null ? String(raw.id) : teamSlug(cleanName),
    name: cleanName,
    shortName: fallbackShort,
    abbr: fallbackAbbr,
    logo: raw.logo,
  }
}

function lastWord(s: string): string {
  const parts = s.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : s
}

// ── Atletas (tenis, MMA) ─────────────────────────────────────
// No tenemos catálogo, pero exponemos el mismo shape para uniformidad.

export interface RawAthleteInput {
  id?: string | number
  displayName?: string
  shortName?: string
  abbreviation?: string
  headshot?: string | { href?: string }
}

export function normalizeAthlete(raw: RawAthleteInput | undefined | null): NormalizedTeam | null {
  if (!raw) return null
  const name = raw.displayName?.trim()
  if (!name) return null
  const shortName = raw.shortName?.trim() || lastWord(name)
  const abbr = raw.abbreviation?.trim().toUpperCase() || initials(name)
  const headshot = typeof raw.headshot === 'string' ? raw.headshot : raw.headshot?.href
  return {
    id: raw.id != null ? String(raw.id) : teamSlug(name),
    name,
    shortName,
    abbr,
    logo: headshot,
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 3)
    .join('')
    .toUpperCase()
}

export const TEAMS_CATALOG_SIZE = recordsById.size
