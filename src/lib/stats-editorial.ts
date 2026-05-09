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
