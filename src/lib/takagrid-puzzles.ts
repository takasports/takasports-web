// Puzzles diarios de TakaGrid.
// Cada puzzle define un grid 3×3: 3 filas (clubes) × 3 columnas (categorías).
// Un jugador es válido en una celda si cumple AMBAS condiciones: fila y columna.

import { PLAYERS_DEDUP, type Player } from './players-catalog'

// ── Tipos ────────────────────────────────────────────────────────

export interface GridCondition {
  id: string
  label: string              // Texto que se muestra en el header de fila/columna
  emoji?: string             // Emoji decorativo
  test: (p: Player) => boolean
}

export interface GridPuzzle {
  rows: [GridCondition, GridCondition, GridCondition]
  cols: [GridCondition, GridCondition, GridCondition]
}

// ── Condiciones reutilizables ────────────────────────────────────

// Clubes
const club = (name: string, emoji: string, pattern: RegExp): GridCondition => ({
  id: `club-${name.toLowerCase().replace(/\s/g, '-')}`,
  label: name,
  emoji,
  test: p => pattern.test(p.club),
})

// Países
const country = (name: string, emoji: string): GridCondition => ({
  id: `country-${name}`,
  label: name,
  emoji,
  test: p => p.country === name,
})

// Posición
const pos = (position: Player['position'], label: string, emoji: string): GridCondition => ({
  id: `pos-${position}`,
  label,
  emoji,
  test: p => p.position === position,
})

// Era
const era = (e: Player['era'], label: string, emoji: string): GridCondition => ({
  id: `era-${e}`,
  label,
  emoji,
  test: p => p.era === e,
})

// Grupos de país
const fromCountries = (id: string, label: string, emoji: string, countries: string[]): GridCondition => ({
  id,
  label,
  emoji,
  test: p => countries.includes(p.country),
})

// ── Definiciones de condiciones ──────────────────────────────────

const C = {
  // Clubes — LaLiga
  realMadrid:   club('Real Madrid',       '⚪',  /Real Madrid/i),
  barcelona:    club('FC Barcelona',      '🔴',  /FC Barcelona/i),
  atletico:     club('Atlético de Madrid','🔴',  /Atlético de Madrid/i),
  valenciaClub: club('Valencia',          '🟠',  /^Valencia$/i),
  villarreal:   club('Villarreal',        '🟡',  /Villarreal/i),
  athletic:     club('Athletic Club',     '⚫',  /Athletic Club/i),
  realSociedad: club('Real Sociedad',     '🔵',  /Real Sociedad/i),
  sevilla:      club('Sevilla',           '⚪',  /Sevilla/i),

  // Clubes — Premier
  manUtd:       club('Manchester United', '🔴',  /Manchester United/i),
  manCity:      club('Manchester City',   '🔵',  /Manchester City/i),
  liverpool:    club('Liverpool',         '🔴',  /Liverpool/i),
  arsenal:      club('Arsenal',           '🔴',  /Arsenal/i),
  chelsea:      club('Chelsea',           '🔵',  /Chelsea/i),
  tottenham:    club('Tottenham',         '⚪',  /Tottenham/i),

  // Clubes — Serie A
  juventus:     club('Juventus',          '⚫',  /Juventus/i),
  milan:        club('AC Milan',          '🔴',  /^Milan$/i),
  inter:        club('Inter',             '🔵',  /Internazionale/i),
  roma:         club('Roma',              '🟡',  /^Roma$/i),
  napoli:       club('Napoli',            '🔵',  /Napoli/i),

  // Clubes — Bundesliga
  bayern:       club('Bayern Múnich',     '🔴',  /Bayern Múnich/i),
  dortmund:     club('Dortmund',          '🟡',  /Borussia Dortmund/i),
  leverkusen:   club('Bayer Leverkusen',  '🔴',  /Bayer Leverkusen/i),

  // Clubes — Ligue 1
  psg:          club('Paris SG',          '🔵',  /Paris Saint-Germain/i),

  // Países
  spain:        country('España',       '🇪🇸'),
  argentina:    country('Argentina',    '🇦🇷'),
  brasil:       country('Brasil',       '🇧🇷'),
  france:       country('Francia',      '🇫🇷'),
  germany:      country('Alemania',     '🇩🇪'),
  italy:        country('Italia',       '🇮🇹'),
  england:      country('Inglaterra',   '🏴󠁧󠁢󠁥󠁮󠁧󠁿'),
  portugal:     country('Portugal',     '🇵🇹'),
  netherlands:  country('Países Bajos', '🇳🇱'),
  croatia:      country('Croacia',      '🇭🇷'),

  // Países adicionales
  belgium:      country('Bélgica',        '🇧🇪'),
  uruguay:      country('Uruguay',        '🇺🇾'),
  colombia:     country('Colombia',       '🇨🇴'),
  serbia:       country('Serbia',         '🇷🇸'),

  // Grupos de país
  southAmerica: fromCountries('sudamerica', 'Sudamérica', '🌎', ['Brasil','Argentina','Uruguay','Colombia','Chile','Paraguay','Perú','Ecuador']),
  iberia:       fromCountries('iberia', 'España o Portugal', '🌊', ['España','Portugal']),
  latin:        fromCountries('latin', 'Latino', '🌎', ['Brasil','Argentina','Uruguay','Colombia','Chile','Paraguay','México','Ecuador','Costa Rica']),
  africa:       fromCountries('africa', 'África', '🌍', ['Nigeria','Ghana','Camerún','Marruecos','Senegal','Costa de Marfil']),
  northEurope:  fromCountries('northeurope', 'Norte de Europa', '🌍', ['Dinamarca','Suecia','Noruega','Finlandia']),
  eastEurope:   fromCountries('easteurope', 'Europa del Este', '🌍', ['Croacia','Serbia','Ucrania','Polonia','Rusia','Hungría','República Checa']),

  // Posiciones
  gk:           pos('GK', 'Porteros', '🧤'),
  def:          pos('DEF', 'Defensas', '🛡️'),
  mid:          pos('MID', 'Centrocampistas', '⚙️'),
  fwd:          pos('FWD', 'Delanteros', '⚽'),

  // Eras
  historic:     era('historic', 'Leyenda histórica', '🏆'),
  current:      era('current', 'En activo', '⚡'),
}

// ── Puzzles definidos ─────────────────────────────────────────────

export const PUZZLES: GridPuzzle[] = [
  // 0 — Clásico español
  {
    rows: [C.realMadrid, C.barcelona, C.atletico],
    cols: [C.spain, C.brasil, C.fwd],
  },
  // 1 — Premier league
  {
    rows: [C.manUtd, C.liverpool, C.arsenal],
    cols: [C.england, C.france, C.def],
  },
  // 2 — Serie A
  {
    rows: [C.juventus, C.milan, C.inter],
    cols: [C.italy, C.brasil, C.mid],
  },
  // 3 — Mezclado europeo
  {
    rows: [C.realMadrid, C.manCity, C.bayern],
    cols: [C.france, C.southAmerica, C.gk],
  },
  // 4 — España vs Premier
  {
    rows: [C.barcelona, C.arsenal, C.chelsea],
    cols: [C.spain, C.netherlands, C.historic],
  },
  // 5 — Nacionales europeos
  {
    rows: [C.realMadrid, C.psg, C.inter],
    cols: [C.portugal, C.argentina, C.current],
  },
  // 6 — Clásico histórico
  {
    rows: [C.manUtd, C.juventus, C.milan],
    cols: [C.italy, C.netherlands, C.fwd],
  },
  // 7 — Mix moderno
  {
    rows: [C.liverpool, C.manCity, C.barcelona],
    cols: [C.brasil, C.england, C.def],
  },
  // 8 — Ibérico
  {
    rows: [C.realMadrid, C.atletico, C.villarreal],
    cols: [C.iberia, C.argentina, C.mid],
  },
  // 9 — Bundesliga + Serie A
  {
    rows: [C.bayern, C.dortmund, C.napoli],
    cols: [C.germany, C.italy, C.fwd],
  },
  // 10 — Premier puro
  {
    rows: [C.manCity, C.chelsea, C.tottenham],
    cols: [C.england, C.brasil, C.gk],
  },
  // 11 — Latinoamérica
  {
    rows: [C.realMadrid, C.barcelona, C.psg],
    cols: [C.latin, C.croatia, C.current],
  },
  // 12 — Histórico legendario
  {
    rows: [C.manUtd, C.milan, C.realMadrid],
    cols: [C.historic, C.italy, C.mid],
  },
  // 13 — Mix defensivo
  {
    rows: [C.liverpool, C.juventus, C.atletico],
    cols: [C.def, C.spain, C.brasil],
  },
  // 14 — Modernos
  {
    rows: [C.arsenal, C.leverkusen, C.inter],
    cols: [C.current, C.england, C.fwd],
  },

  // 15 — Premier clásico
  {
    rows: [C.manUtd, C.liverpool, C.arsenal],
    cols: [C.england, C.spain, C.def],
  },
  // 16 — Chelsea y el dinero
  {
    rows: [C.chelsea, C.manCity, C.tottenham],
    cols: [C.france, C.brasil, C.mid],
  },
  // 17 — Premier goleadores
  {
    rows: [C.arsenal, C.chelsea, C.liverpool],
    cols: [C.netherlands, C.brasil, C.fwd],
  },
  // 18 — Premier porteros
  {
    rows: [C.manUtd, C.manCity, C.arsenal],
    cols: [C.england, C.spain, C.gk],
  },
  // 19 — Español profundo
  {
    rows: [C.realMadrid, C.barcelona, C.atletico],
    cols: [C.germany, C.portugal, C.def],
  },
  // 20 — LaLiga vs Sudamérica
  {
    rows: [C.realMadrid, C.barcelona, C.sevilla],
    cols: [C.argentina, C.brasil, C.mid],
  },
  // 21 — España periférica
  {
    rows: [C.athletic, C.realSociedad, C.villarreal],
    cols: [C.spain, C.southAmerica, C.fwd],
  },
  // 22 — Madrid y la Premier
  {
    rows: [C.realMadrid, C.manUtd, C.liverpool],
    cols: [C.portugal, C.france, C.mid],
  },
  // 23 — Italia clásica
  {
    rows: [C.juventus, C.milan, C.inter],
    cols: [C.argentina, C.france, C.gk],
  },
  // 24 — Serie A defensores
  {
    rows: [C.juventus, C.inter, C.napoli],
    cols: [C.italy, C.brasil, C.def],
  },
  // 25 — Serie A delanteros
  {
    rows: [C.milan, C.roma, C.napoli],
    cols: [C.italy, C.southAmerica, C.fwd],
  },
  // 26 — Bundesliga y Champions
  {
    rows: [C.bayern, C.dortmund, C.leverkusen],
    cols: [C.germany, C.spain, C.mid],
  },
  // 27 — Alemania vs Premier
  {
    rows: [C.bayern, C.manCity, C.arsenal],
    cols: [C.germany, C.france, C.def],
  },
  // 28 — PSG y élite europea
  {
    rows: [C.psg, C.barcelona, C.juventus],
    cols: [C.brasil, C.france, C.fwd],
  },
  // 29 — Tríada continental
  {
    rows: [C.realMadrid, C.juventus, C.bayern],
    cols: [C.germany, C.argentina, C.mid],
  },
  // 30 — Liverpool histórico
  {
    rows: [C.liverpool, C.juventus, C.inter],
    cols: [C.italy, C.england, C.fwd],
  },
  // 31 — Barça y sus rivales
  {
    rows: [C.barcelona, C.manUtd, C.psg],
    cols: [C.france, C.portugal, C.mid],
  },
  // 32 — Galácticos comparados
  {
    rows: [C.realMadrid, C.manUtd, C.psg],
    cols: [C.france, C.portugal, C.gk],
  },
  // 33 — Europa clásica
  {
    rows: [C.arsenal, C.milan, C.inter],
    cols: [C.netherlands, C.italy, C.fwd],
  },
  // 34 — Mix moderno
  {
    rows: [C.chelsea, C.manCity, C.psg],
    cols: [C.brasil, C.france, C.def],
  },
  // 35 — Iberia en Europa
  {
    rows: [C.realMadrid, C.barcelona, C.psg],
    cols: [C.iberia, C.brasil, C.def],
  },
  // 36 — Belgas en la élite
  {
    rows: [C.manCity, C.chelsea, C.atletico],
    cols: [C.belgium, C.spain, C.mid],
  },
  // 37 — Leyendas holandesas
  {
    rows: [C.barcelona, C.manUtd, C.arsenal],
    cols: [C.netherlands, C.france, C.fwd],
  },
  // 38 — Uruguay en Europa
  {
    rows: [C.barcelona, C.psg, C.atletico],
    cols: [C.uruguay, C.argentina, C.fwd],
  },
  // 39 — Colombianos en la élite
  {
    rows: [C.realMadrid, C.atletico, C.juventus],
    cols: [C.colombia, C.southAmerica, C.mid],
  },
  // 40 — Porteros míticos
  {
    rows: [C.realMadrid, C.manUtd, C.juventus],
    cols: [C.gk, C.spain, C.italy],
  },
  // 41 — Defensas históricos
  {
    rows: [C.milan, C.barcelona, C.liverpool],
    cols: [C.def, C.italy, C.historic],
  },
  // 42 — Centrocampistas de oro
  {
    rows: [C.barcelona, C.realMadrid, C.manUtd],
    cols: [C.mid, C.spain, C.historic],
  },
  // 43 — Delanteros actuales
  {
    rows: [C.manCity, C.psg, C.inter],
    cols: [C.current, C.fwd, C.southAmerica],
  },
  // 44 — España en la Premier
  {
    rows: [C.liverpool, C.arsenal, C.manCity],
    cols: [C.spain, C.southAmerica, C.mid],
  },
  // 45 — Brasil en Italia
  {
    rows: [C.milan, C.inter, C.roma],
    cols: [C.brasil, C.italy, C.mid],
  },
  // 46 — Serie A histórica
  {
    rows: [C.juventus, C.milan, C.inter],
    cols: [C.historic, C.france, C.def],
  },
  // 47 — Bundesliga histórica
  {
    rows: [C.bayern, C.dortmund, C.leverkusen],
    cols: [C.historic, C.brasil, C.fwd],
  },
  // 48 — Europa del Este
  {
    rows: [C.barcelona, C.realMadrid, C.inter],
    cols: [C.eastEurope, C.argentina, C.mid],
  },
  // 49 — Top europeo mixto
  {
    rows: [C.manCity, C.barcelona, C.napoli],
    cols: [C.argentina, C.spain, C.fwd],
  },
]


// ── PRNG + puzzle diario ──────────────────────────────────────────

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface DayKey {
  year: number
  month: number
  day: number
  key: string  // "2026-05-03"
}

export function getTodayKey(d: Date = new Date()): DayKey {
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return { year, month, day, key }
}

export function getDailyPuzzle(d: Date = new Date()): { puzzle: GridPuzzle; dayKey: DayKey } {
  const dayKey = getTodayKey(d)
  const seed = dayKey.year * 10000 + dayKey.month * 100 + dayKey.day
  const rand = mulberry32(seed)
  const idx = Math.floor(rand() * PUZZLES.length)
  return { puzzle: PUZZLES[idx], dayKey }
}

// ── Validador ────────────────────────────────────────────────────

export interface CellCoord { row: 0 | 1 | 2; col: 0 | 1 | 2 }

export function isValidAnswer(player: Player, puzzle: GridPuzzle, cell: CellCoord): boolean {
  return puzzle.rows[cell.row].test(player) && puzzle.cols[cell.col].test(player)
}

// Pre-computar respuestas válidas por celda (para hints / verificación instantánea)
export function getValidAnswers(puzzle: GridPuzzle): Player[][][] {
  const grid: Player[][][] = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => []))
  PLAYERS_DEDUP.forEach(p => {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (puzzle.rows[r].test(p) && puzzle.cols[c].test(p)) {
          grid[r][c].push(p)
        }
      }
    }
  })
  return grid
}
