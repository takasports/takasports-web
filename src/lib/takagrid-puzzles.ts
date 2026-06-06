// Puzzles diarios de TakaGrid.
// Cada puzzle define un grid 3×3: 3 filas (clubes) × 3 columnas (categorías).
// Un jugador es válido en una celda si cumple AMBAS condiciones: fila y columna.

import { PLAYERS_DEDUP, playerClubs, type Player } from './players-catalog'
import { madridParts, madridDayISO } from './taka-time'

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
  test: p => playerClubs(p).some(c => pattern.test(c)),
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

export const C = {
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
  // 0 — Real Madrid · Chelsea · Paris SG  ×  Latino · Defensas · Centrocampistas  (min 5)
  { rows: [C.realMadrid, C.chelsea, C.psg], cols: [C.latin, C.def, C.mid] },
  // 1 — Inter · AC Milan · Juventus  ×  Italia · Delanteros · Leyenda histórica  (min 7)
  { rows: [C.inter, C.milan, C.juventus], cols: [C.italy, C.fwd, C.historic] },
  // 2 — FC Barcelona · Manchester City · Bayern Múnich  ×  Defensas · Centrocampistas · En activo  (min 6)
  { rows: [C.barcelona, C.manCity, C.bayern], cols: [C.def, C.mid, C.current] },
  // 3 — Manchester United · Liverpool · Arsenal  ×  Inglaterra · Sudamérica · Defensas  (min 4)
  { rows: [C.manUtd, C.liverpool, C.arsenal], cols: [C.england, C.southAmerica, C.def] },
  // 4 — Atlético de Madrid · Liverpool · Real Sociedad  ×  España · España o Portugal · En activo  (min 4)
  { rows: [C.atletico, C.liverpool, C.realSociedad], cols: [C.spain, C.iberia, C.current] },
  // 5 — Valencia · Napoli · Chelsea  ×  Sudamérica · Delanteros · Leyenda histórica  (min 3)
  { rows: [C.valenciaClub, C.napoli, C.chelsea], cols: [C.southAmerica, C.fwd, C.historic] },
  // 6 — Juventus · AC Milan · Inter  ×  Italia · Defensas · Delanteros  (min 7)
  { rows: [C.juventus, C.milan, C.inter], cols: [C.italy, C.def, C.fwd] },
  // 7 — Real Madrid · Arsenal · Paris SG  ×  Brasil · Francia · Centrocampistas  (min 4)
  { rows: [C.realMadrid, C.arsenal, C.psg], cols: [C.brasil, C.france, C.mid] },
  // 8 — Tottenham · Atlético de Madrid · Bayern Múnich  ×  Defensas · Delanteros · En activo  (min 3)
  { rows: [C.tottenham, C.atletico, C.bayern], cols: [C.def, C.fwd, C.current] },
  // 9 — Roma · FC Barcelona · Manchester City  ×  Sudamérica · Centrocampistas · Leyenda histórica  (min 3)
  { rows: [C.roma, C.barcelona, C.manCity], cols: [C.southAmerica, C.mid, C.historic] },
  // 10 — Manchester United · Valencia · Napoli  ×  Argentina · Sudamérica · Leyenda histórica  (min 3)
  { rows: [C.manUtd, C.valenciaClub, C.napoli], cols: [C.argentina, C.southAmerica, C.historic] },
  // 11 — Dortmund · Real Madrid · Arsenal  ×  Alemania · Delanteros · En activo  (min 3)
  { rows: [C.dortmund, C.realMadrid, C.arsenal], cols: [C.germany, C.fwd, C.current] },
  // 12 — Athletic Club · Liverpool · FC Barcelona  ×  España · España o Portugal · Delanteros  (min 3)
  { rows: [C.athletic, C.liverpool, C.barcelona], cols: [C.spain, C.iberia, C.fwd] },
  // 13 — Inter · AC Milan · Juventus  ×  Francia · Italia · Latino  (min 3)
  { rows: [C.inter, C.milan, C.juventus], cols: [C.france, C.italy, C.latin] },
  // 14 — Manchester City · Paris SG · Atlético de Madrid  ×  Sudamérica · Defensas · Delanteros  (min 4)
  { rows: [C.manCity, C.psg, C.atletico], cols: [C.southAmerica, C.def, C.fwd] },
  // 15 — Manchester United · Chelsea · Arsenal  ×  Francia · Inglaterra · Leyenda histórica  (min 3)
  { rows: [C.manUtd, C.chelsea, C.arsenal], cols: [C.france, C.england, C.historic] },
  // 16 — Athletic Club · Bayern Múnich · Liverpool  ×  España o Portugal · Delanteros · En activo  (min 3)
  { rows: [C.athletic, C.bayern, C.liverpool], cols: [C.iberia, C.fwd, C.current] },
  // 17 — Roma · FC Barcelona · Paris SG  ×  Brasil · Centrocampistas · Leyenda histórica  (min 3)
  { rows: [C.roma, C.barcelona, C.psg], cols: [C.brasil, C.mid, C.historic] },
  // 18 — Valencia · Napoli · Manchester United  ×  Argentina · Latino · Leyenda histórica  (min 3)
  { rows: [C.valenciaClub, C.napoli, C.manUtd], cols: [C.argentina, C.latin, C.historic] },
  // 19 — Juventus · AC Milan · Inter  ×  Italia · Defensas · Centrocampistas  (min 7)
  { rows: [C.juventus, C.milan, C.inter], cols: [C.italy, C.def, C.mid] },
  // 20 — Real Sociedad · Liverpool · Real Madrid  ×  España · España o Portugal · Centrocampistas  (min 3)
  { rows: [C.realSociedad, C.liverpool, C.realMadrid], cols: [C.spain, C.iberia, C.mid] },
  // 21 — Chelsea · Atlético de Madrid · Bayern Múnich  ×  Centrocampistas · Delanteros · En activo  (min 4)
  { rows: [C.chelsea, C.atletico, C.bayern], cols: [C.mid, C.fwd, C.current] },
  // 22 — Real Sociedad · Manchester City · AC Milan  ×  España o Portugal · Centrocampistas · En activo  (min 3)
  { rows: [C.realSociedad, C.manCity, C.milan], cols: [C.iberia, C.mid, C.current] },
  // 23 — Paris SG · FC Barcelona · Real Madrid  ×  Brasil · Francia · Portugal  (min 3)
  { rows: [C.psg, C.barcelona, C.realMadrid], cols: [C.brasil, C.france, C.portugal] },
  // 24 — Napoli · Valencia · Manchester United  ×  Argentina · Delanteros · Leyenda histórica  (min 3)
  { rows: [C.napoli, C.valenciaClub, C.manUtd], cols: [C.argentina, C.fwd, C.historic] },
  // 25 — Arsenal · Manchester City · Chelsea  ×  Inglaterra · Centrocampistas · Delanteros  (min 4)
  { rows: [C.arsenal, C.manCity, C.chelsea], cols: [C.england, C.mid, C.fwd] },
  // 26 — Bayern Múnich · Atlético de Madrid · Juventus  ×  España o Portugal · Centrocampistas · Delanteros  (min 3)
  { rows: [C.bayern, C.atletico, C.juventus], cols: [C.iberia, C.mid, C.fwd] },
  // 27 — Inter · AC Milan · Juventus  ×  Francia · Italia · Centrocampistas  (min 3)
  { rows: [C.inter, C.milan, C.juventus], cols: [C.france, C.italy, C.mid] },
  // 28 — Roma · Real Madrid · Arsenal  ×  Brasil · Latino · Leyenda histórica  (min 3)
  { rows: [C.roma, C.realMadrid, C.arsenal], cols: [C.brasil, C.latin, C.historic] },
  // 29 — Paris SG · Manchester United · FC Barcelona  ×  Francia · Portugal · Sudamérica  (min 3)
  { rows: [C.psg, C.manUtd, C.barcelona], cols: [C.france, C.portugal, C.southAmerica] },
  // 30 — Athletic Club · Liverpool · Atlético de Madrid  ×  España · Delanteros · En activo  (min 3)
  { rows: [C.athletic, C.liverpool, C.atletico], cols: [C.spain, C.fwd, C.current] },
  // 31 — Tottenham · Inter · Bayern Múnich  ×  Defensas · Delanteros · En activo  (min 3)
  { rows: [C.tottenham, C.inter, C.bayern], cols: [C.def, C.fwd, C.current] },
  // 32 — Valencia · Napoli · Manchester United  ×  Argentina · Latino · Delanteros  (min 3)
  { rows: [C.valenciaClub, C.napoli, C.manUtd], cols: [C.argentina, C.latin, C.fwd] },
  // 33 — Roma · Chelsea · Paris SG  ×  Latino · Centrocampistas · Leyenda histórica  (min 3)
  { rows: [C.roma, C.chelsea, C.psg], cols: [C.latin, C.mid, C.historic] },
  // 34 — Athletic Club · Liverpool · Real Sociedad  ×  España · España o Portugal · En activo  (min 3)
  { rows: [C.athletic, C.liverpool, C.realSociedad], cols: [C.spain, C.iberia, C.current] },
  // 35 — Real Madrid · AC Milan · Arsenal  ×  Brasil · Francia · Países Bajos  (min 3)
  { rows: [C.realMadrid, C.milan, C.arsenal], cols: [C.brasil, C.france, C.netherlands] },
  // 36 — Manchester City · Atlético de Madrid · Inter  ×  Sudamérica · Defensas · Centrocampistas  (min 4)
  { rows: [C.manCity, C.atletico, C.inter], cols: [C.southAmerica, C.def, C.mid] },
  // 37 — Roma · FC Barcelona · Paris SG  ×  Brasil · Sudamérica · Centrocampistas  (min 3)
  { rows: [C.roma, C.barcelona, C.psg], cols: [C.brasil, C.southAmerica, C.mid] },
  // 38 — Villarreal · Tottenham · Roma  ×  Sudamérica · Defensas · Leyenda histórica  (min 2)
  { rows: [C.villarreal, C.tottenham, C.roma], cols: [C.southAmerica, C.def, C.historic] },
  // 39 — Dortmund · Tottenham · Juventus  ×  Defensas · Delanteros · Leyenda histórica  (min 2)
  { rows: [C.dortmund, C.tottenham, C.juventus], cols: [C.def, C.fwd, C.historic] },
  // 40 — Villarreal · Tottenham · Roma  ×  Latino · Defensas · Leyenda histórica  (min 2)
  { rows: [C.villarreal, C.tottenham, C.roma], cols: [C.latin, C.def, C.historic] },
  // 41 — Dortmund · Arsenal · FC Barcelona  ×  Alemania · Defensas · Delanteros  (min 2)
  { rows: [C.dortmund, C.arsenal, C.barcelona], cols: [C.germany, C.def, C.fwd] },
  // 42 — Bayer Leverkusen · Tottenham · Atlético de Madrid  ×  Defensas · Centrocampistas · En activo  (min 2)
  { rows: [C.leverkusen, C.tottenham, C.atletico], cols: [C.def, C.mid, C.current] },
  // 43 — Villarreal · Napoli · Chelsea  ×  Argentina · Sudamérica · Leyenda histórica  (min 2)
  { rows: [C.villarreal, C.napoli, C.chelsea], cols: [C.argentina, C.southAmerica, C.historic] },
  // 44 — Villarreal · Manchester City · Inter  ×  Argentina · Latino · Defensas  (min 2)
  { rows: [C.villarreal, C.manCity, C.inter], cols: [C.argentina, C.latin, C.def] },
  // 45 — Dortmund · Real Madrid · Arsenal  ×  Alemania · Defensas · En activo  (min 2)
  { rows: [C.dortmund, C.realMadrid, C.arsenal], cols: [C.germany, C.def, C.current] },
  // 46 — Bayer Leverkusen · Tottenham · AC Milan  ×  Defensas · Centrocampistas · En activo  (min 2)
  { rows: [C.leverkusen, C.tottenham, C.milan], cols: [C.def, C.mid, C.current] },
  // 47 — Villarreal · Chelsea · Juventus  ×  Argentina · Defensas · Leyenda histórica  (min 2)
  { rows: [C.villarreal, C.chelsea, C.juventus], cols: [C.argentina, C.def, C.historic] },
  // 48 — Villarreal · Manchester City · Inter  ×  Argentina · Sudamérica · Defensas  (min 2)
  { rows: [C.villarreal, C.manCity, C.inter], cols: [C.argentina, C.southAmerica, C.def] },
  // 49 — Villarreal · Napoli · Manchester United  ×  Argentina · Latino · Leyenda histórica  (min 2)
  { rows: [C.villarreal, C.napoli, C.manUtd], cols: [C.argentina, C.latin, C.historic] },
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
  const p = madridParts(d)
  return { year: p.year, month: p.month, day: p.day, key: madridDayISO(d) }
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
