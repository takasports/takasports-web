// Retos semanales de Mi Once — modelo "posición × club".
//
// Cada semana ISO (Europe/Madrid) se elige determinísticamente un TABLERO: una
// formación fija donde cada hueco lleva una posición (de la formación) y un club
// asignado. El jugador debe nombrar a alguien que jugó esa posición en ese club
// en algún momento de la historia (multiclub: vale club principal o altClubs).
// Los 11 clubes del tablero son distintos (un club por posición).
//
// Los tableros viven en BOARDS (generados con scripts/gen-mionce-boards.ts, que
// garantiza ≥2 jugadores por celda usando el catálogo real). El test
// mionce-boards.test.ts blinda esa solvencia.

import { playerClubs, type Player } from './players-catalog'
import { madridWeekISO } from './taka-time'

export type FormationId = '4-3-3' | '4-4-2' | '3-5-2' | '4-2-3-1'

// Etiqueta de un slot: el jugador colocado debe cumplirla (además de la posición
// del hueco, que ya filtra el buscador). Se muestra como chip junto al slot.
export interface SlotTag {
  id: string
  label: string
  emoji: string
  match: (p: Player) => boolean
}

export interface Challenge {
  id: string
  title: string
  tagline: string
  description: string
  // Filtro global opcional sobre el catálogo (no se usa en el modelo posición×club).
  filter?: (p: Player) => boolean
  // Formación recomendada. En modelo posición×club queda bloqueada (los slotTags
  // se anclan a slots concretos).
  recommendedFormation: FormationId
  // Restricción por slot: cada hueco lleva su etiqueta (club). Cuando se define,
  // la formación queda bloqueada y se valida match por slot.
  slotTags?: Record<string, SlotTag>
  // Meta-regla legacy (no se usa en posición×club: cada slot ya tiene su club).
  noRepeatClub?: boolean
}

// Tablero posición×club: formación + club canónico por slot. Fuente de datos
// (regenerable). Se convierte a Challenge en runtime con boardToChallenge().
export interface PositionClubBoard {
  id: string
  formation: FormationId
  clubs: Record<string, string>   // slotId -> nombre canónico de club
}

// Emoji por club (decorativo): círculo aproximando el color de camiseta más
// reconocible; 🛡️ por defecto. No afecta a la validación.
const CLUB_EMOJI: Record<string, string> = {
  'Real Madrid': '⚪', 'FC Barcelona': '🔵', 'Atlético de Madrid': '🔴',
  'Valencia': '⚪', 'Villarreal': '🟡', 'Athletic Club': '🔴', 'Real Sociedad': '🔵',
  'Real Betis': '🟢', 'Celta de Vigo': '🔵',
  'Manchester United': '🔴', 'Manchester City': '🔵', 'Liverpool': '🔴', 'Arsenal': '🔴',
  'Chelsea': '🔵', 'Tottenham': '⚪', 'Newcastle': '⚫', 'Aston Villa': '🟣',
  'Everton': '🔵', 'West Ham': '🟣', 'Brighton': '🔵', 'Fulham': '⚪',
  'Milan': '🔴', 'Internazionale': '🔵', 'Juventus': '⚫', 'Roma': '🟡', 'Lazio': '🔵',
  'Napoli': '🔵', 'Fiorentina': '🟣', 'Atalanta': '🔵', 'Sampdoria': '🔵', 'Udinese': '⚫',
  'Bayern Múnich': '🔴', 'Borussia Dortmund': '🟡', 'Bayer Leverkusen': '🔴',
  'RB Leipzig': '⚪', 'Eintracht Frankfurt': '⚫', 'Stuttgart': '⚪',
  'Paris Saint-Germain': '🔵', 'Marsella': '⚪', 'Mónaco': '🔴', 'Niza': '🔴',
  'Benfica': '🔴', 'Sporting CP': '🟢', 'Celtic': '🟢', 'Galatasaray': '🟡',
  'Feyenoord': '🔴', 'River Plate': '⚪', 'Botafogo': '⚫', 'Corinthians': '⚫',
  'Flamengo': '🔴', 'Santos': '⚪', 'LA Galaxy': '🔵',
}
function clubEmoji(club: string): string { return CLUB_EMOJI[club] ?? '🛡️' }

export const BOARDS: PositionClubBoard[] = [
  { id: 'b01', formation: '4-3-3', clubs: { gk: 'Paris Saint-Germain', lb: 'Juventus', cb1: 'Real Sociedad', cb2: 'Newcastle', rb: 'Borussia Dortmund', cm1: 'Villarreal', cm2: 'Mónaco', cm3: 'Bayer Leverkusen', lw: 'Valencia', st: 'Aston Villa', rw: 'Manchester United' } },
  { id: 'b02', formation: '4-3-3', clubs: { gk: 'FC Barcelona', lb: 'Marsella', cb1: 'West Ham', cb2: 'Mónaco', rb: 'Liverpool', cm1: 'Fiorentina', cm2: 'Lazio', cm3: 'Tottenham', lw: 'Paris Saint-Germain', st: 'Real Betis', rw: 'Feyenoord' } },
  { id: 'b03', formation: '4-3-3', clubs: { gk: 'Paris Saint-Germain', lb: 'Newcastle', cb1: 'Tottenham', cb2: 'Manchester City', rb: 'Arsenal', cm1: 'Real Sociedad', cm2: 'Borussia Dortmund', cm3: 'Bayern Múnich', lw: 'Roma', st: 'Manchester United', rw: 'Juventus' } },
  { id: 'b04', formation: '4-3-3', clubs: { gk: 'Atlético de Madrid', lb: 'FC Barcelona', cb1: 'Aston Villa', cb2: 'Stuttgart', rb: 'Chelsea', cm1: 'Real Sociedad', cm2: 'Arsenal', cm3: 'Manchester City', lw: 'Paris Saint-Germain', st: 'River Plate', rw: 'Everton' } },
  { id: 'b05', formation: '4-3-3', clubs: { gk: 'Juventus', lb: 'Internazionale', cb1: 'Everton', cb2: 'Feyenoord', rb: 'Real Madrid', cm1: 'Villarreal', cm2: 'Paris Saint-Germain', cm3: 'Roma', lw: 'Borussia Dortmund', st: 'Bayern Múnich', rw: 'Mónaco' } },
  { id: 'b06', formation: '4-3-3', clubs: { gk: 'Tottenham', lb: 'Marsella', cb1: 'Aston Villa', cb2: 'Villarreal', rb: 'Internazionale', cm1: 'Mónaco', cm2: 'Arsenal', cm3: 'Bayern Múnich', lw: 'Athletic Club', st: 'River Plate', rw: 'Sporting CP' } },
  { id: 'b07', formation: '4-3-3', clubs: { gk: 'Roma', lb: 'Marsella', cb1: 'Manchester City', cb2: 'Stuttgart', rb: 'Real Sociedad', cm1: 'Atlético de Madrid', cm2: 'Mónaco', cm3: 'Juventus', lw: 'Brighton', st: 'Newcastle', rw: 'Sampdoria' } },
  { id: 'b08', formation: '4-3-3', clubs: { gk: 'Juventus', lb: 'RB Leipzig', cb1: 'Athletic Club', cb2: 'FC Barcelona', rb: 'Atlético de Madrid', cm1: 'Internazionale', cm2: 'Manchester City', cm3: 'Sampdoria', lw: 'Paris Saint-Germain', st: 'West Ham', rw: 'Stuttgart' } },
  { id: 'b09', formation: '4-3-3', clubs: { gk: 'Athletic Club', lb: 'Milan', cb1: 'Lazio', cb2: 'Roma', rb: 'Real Sociedad', cm1: 'Juventus', cm2: 'Botafogo', cm3: 'Sampdoria', lw: 'Bayern Múnich', st: 'Everton', rw: 'Paris Saint-Germain' } },
  { id: 'b10', formation: '4-3-3', clubs: { gk: 'Atlético de Madrid', lb: 'Lazio', cb1: 'Juventus', cb2: 'Aston Villa', rb: 'Feyenoord', cm1: 'Villarreal', cm2: 'Mónaco', cm3: 'Bayern Múnich', lw: 'Newcastle', st: 'Borussia Dortmund', rw: 'Napoli' } },
  { id: 'b11', formation: '4-3-3', clubs: { gk: 'Arsenal', lb: 'Juventus', cb1: 'Bayern Múnich', cb2: 'Celtic', rb: 'Stuttgart', cm1: 'Real Betis', cm2: 'LA Galaxy', cm3: 'River Plate', lw: 'Manchester United', st: 'Benfica', rw: 'FC Barcelona' } },
  { id: 'b12', formation: '4-3-3', clubs: { gk: 'Manchester United', lb: 'Tottenham', cb1: 'Arsenal', cb2: 'Bayern Múnich', rb: 'Real Sociedad', cm1: 'River Plate', cm2: 'Villarreal', cm3: 'Milan', lw: 'Feyenoord', st: 'RB Leipzig', rw: 'Stuttgart' } },
  { id: 'b13', formation: '4-4-2', clubs: { gk: 'Real Madrid', lb: 'Newcastle', cb1: 'Marsella', cb2: 'FC Barcelona', rb: 'Arsenal', lm: 'Borussia Dortmund', cm1: 'Internazionale', cm2: 'Bayern Múnich', rm: 'Milan', st1: 'Sampdoria', st2: 'Galatasaray' } },
  { id: 'b14', formation: '4-4-2', clubs: { gk: 'Atlético de Madrid', lb: 'RB Leipzig', cb1: 'Marsella', cb2: 'Mónaco', rb: 'Bayer Leverkusen', lm: 'Milan', cm1: 'River Plate', cm2: 'Juventus', rm: 'Villarreal', st1: 'Stuttgart', st2: 'Everton' } },
  { id: 'b15', formation: '4-4-2', clubs: { gk: 'Paris Saint-Germain', lb: 'Lazio', cb1: 'Tottenham', cb2: 'Atlético de Madrid', rb: 'Newcastle', lm: 'Real Betis', cm1: 'Chelsea', cm2: 'Bayern Múnich', rm: 'Marsella', st1: 'Roma', st2: 'Sampdoria' } },
  { id: 'b16', formation: '4-4-2', clubs: { gk: 'Athletic Club', lb: 'Bayern Múnich', cb1: 'Real Sociedad', cb2: 'Feyenoord', rb: 'Chelsea', lm: 'Manchester City', cm1: 'Real Madrid', cm2: 'Bayer Leverkusen', rm: 'Arsenal', st1: 'Roma', st2: 'LA Galaxy' } },
  { id: 'b17', formation: '4-4-2', clubs: { gk: 'Internazionale', lb: 'West Ham', cb1: 'Everton', cb2: 'Atlético de Madrid', rb: 'Athletic Club', lm: 'Juventus', cm1: 'River Plate', cm2: 'Napoli', rm: 'Bayern Múnich', st1: 'Real Betis', st2: 'Real Madrid' } },
  { id: 'b18', formation: '4-4-2', clubs: { gk: 'Internazionale', lb: 'Real Sociedad', cb1: 'Lazio', cb2: 'Stuttgart', rb: 'RB Leipzig', lm: 'Bayern Múnich', cm1: 'Manchester City', cm2: 'Mónaco', rm: 'Valencia', st1: 'Marsella', st2: 'Atlético de Madrid' } },
  { id: 'b19', formation: '4-4-2', clubs: { gk: 'Bayern Múnich', lb: 'Manchester United', cb1: 'Mónaco', cb2: 'West Ham', rb: 'Lazio', lm: 'FC Barcelona', cm1: 'Bayer Leverkusen', cm2: 'Villarreal', rm: 'Milan', st1: 'Newcastle', st2: 'Sporting CP' } },
  { id: 'b20', formation: '4-4-2', clubs: { gk: 'Aston Villa', lb: 'Borussia Dortmund', cb1: 'Villarreal', cb2: 'Everton', rb: 'Juventus', lm: 'Manchester United', cm1: 'Bayern Múnich', cm2: 'LA Galaxy', rm: 'Botafogo', st1: 'Brighton', st2: 'Stuttgart' } },
  { id: 'b21', formation: '4-4-2', clubs: { gk: 'Arsenal', lb: 'Roma', cb1: 'Aston Villa', cb2: 'Celtic', rb: 'Internazionale', lm: 'Napoli', cm1: 'Tottenham', cm2: 'Chelsea', rm: 'Manchester City', st1: 'Stuttgart', st2: 'Feyenoord' } },
  { id: 'b22', formation: '4-4-2', clubs: { gk: 'Atlético de Madrid', lb: 'Liverpool', cb1: 'West Ham', cb2: 'Bayern Múnich', rb: 'RB Leipzig', lm: 'Roma', cm1: 'Fiorentina', cm2: 'Mónaco', rm: 'Valencia', st1: 'Bayer Leverkusen', st2: 'Newcastle' } },
  { id: 'b23', formation: '4-4-2', clubs: { gk: 'Juventus', lb: 'RB Leipzig', cb1: 'Stuttgart', cb2: 'Lazio', rb: 'Mónaco', lm: 'Internazionale', cm1: 'Marsella', cm2: 'Fiorentina', rm: 'Napoli', st1: 'Borussia Dortmund', st2: 'Bayern Múnich' } },
  { id: 'b24', formation: '4-4-2', clubs: { gk: 'Manchester United', lb: 'Arsenal', cb1: 'Chelsea', cb2: 'Manchester City', rb: 'Everton', lm: 'LA Galaxy', cm1: 'Corinthians', cm2: 'Atlético de Madrid', rm: 'Bayern Múnich', st1: 'Valencia', st2: 'Sporting CP' } },
  { id: 'b25', formation: '3-5-2', clubs: { gk: 'Tottenham', cb1: 'Manchester United', cb2: 'Manchester City', cb3: 'Athletic Club', lwb: 'Bayern Múnich', cm1: 'Mónaco', cm2: 'Paris Saint-Germain', cm3: 'FC Barcelona', rwb: 'Chelsea', st1: 'Valencia', st2: 'Lazio' } },
  { id: 'b26', formation: '3-5-2', clubs: { gk: 'Juventus', cb1: 'Tottenham', cb2: 'Roma', cb3: 'Bayern Múnich', lwb: 'Milan', cm1: 'Manchester City', cm2: 'Mónaco', cm3: 'Real Madrid', rwb: 'Marsella', st1: 'FC Barcelona', st2: 'Manchester United' } },
  { id: 'b27', formation: '3-5-2', clubs: { gk: 'Roma', cb1: 'Manchester City', cb2: 'Real Madrid', cb3: 'Celtic', lwb: 'Juventus', cm1: 'Borussia Dortmund', cm2: 'Bayern Múnich', cm3: 'Mónaco', rwb: 'Arsenal', st1: 'Fiorentina', st2: 'Valencia' } },
  { id: 'b28', formation: '3-5-2', clubs: { gk: 'Athletic Club', cb1: 'Arsenal', cb2: 'Atlético de Madrid', cb3: 'FC Barcelona', lwb: 'Tottenham', cm1: 'Villarreal', cm2: 'Marsella', cm3: 'Real Madrid', rwb: 'Napoli', st1: 'Brighton', st2: 'Paris Saint-Germain' } },
  { id: 'b29', formation: '3-5-2', clubs: { gk: 'Athletic Club', cb1: 'Juventus', cb2: 'Real Sociedad', cb3: 'Everton', lwb: 'Corinthians', cm1: 'Paris Saint-Germain', cm2: 'Roma', cm3: 'Liverpool', rwb: 'River Plate', st1: 'Napoli', st2: 'West Ham' } },
  { id: 'b30', formation: '3-5-2', clubs: { gk: 'Roma', cb1: 'Stuttgart', cb2: 'Manchester City', cb3: 'Bayer Leverkusen', lwb: 'Mónaco', cm1: 'Corinthians', cm2: 'River Plate', cm3: 'Real Betis', rwb: 'Milan', st1: 'Feyenoord', st2: 'Liverpool' } },
  { id: 'b31', formation: '3-5-2', clubs: { gk: 'Athletic Club', cb1: 'Atlético de Madrid', cb2: 'Liverpool', cb3: 'Everton', lwb: 'Bayer Leverkusen', cm1: 'Juventus', cm2: 'Mónaco', cm3: 'Milan', rwb: 'Bayern Múnich', st1: 'Internazionale', st2: 'Stuttgart' } },
  { id: 'b32', formation: '3-5-2', clubs: { gk: 'Bayern Múnich', cb1: 'Milan', cb2: 'Mónaco', cb3: 'Aston Villa', lwb: 'Chelsea', cm1: 'Botafogo', cm2: 'Arsenal', cm3: 'Atlético de Madrid', rwb: 'Marsella', st1: 'Sporting CP', st2: 'Tottenham' } },
  { id: 'b33', formation: '3-5-2', clubs: { gk: 'FC Barcelona', cb1: 'Liverpool', cb2: 'Celtic', cb3: 'West Ham', lwb: 'Lazio', cm1: 'Manchester City', cm2: 'Fiorentina', cm3: 'Chelsea', rwb: 'Sampdoria', st1: 'River Plate', st2: 'Roma' } },
  { id: 'b34', formation: '3-5-2', clubs: { gk: 'Paris Saint-Germain', cb1: 'Juventus', cb2: 'Manchester City', cb3: 'Aston Villa', lwb: 'Valencia', cm1: 'LA Galaxy', cm2: 'Arsenal', cm3: 'Real Sociedad', rwb: 'Manchester United', st1: 'Feyenoord', st2: 'RB Leipzig' } },
  { id: 'b35', formation: '3-5-2', clubs: { gk: 'Internazionale', cb1: 'Roma', cb2: 'Real Madrid', cb3: 'Atlético de Madrid', lwb: 'FC Barcelona', cm1: 'Lazio', cm2: 'Chelsea', cm3: 'Botafogo', rwb: 'Juventus', st1: 'West Ham', st2: 'Galatasaray' } },
  { id: 'b36', formation: '3-5-2', clubs: { gk: 'Arsenal', cb1: 'Manchester City', cb2: 'Celtic', cb3: 'Everton', lwb: 'Internazionale', cm1: 'Marsella', cm2: 'Bayer Leverkusen', cm3: 'Villarreal', rwb: 'Napoli', st1: 'Juventus', st2: 'Tottenham' } },
  { id: 'b37', formation: '4-2-3-1', clubs: { gk: 'Manchester United', lb: 'Athletic Club', cb1: 'Celtic', cb2: 'Real Madrid', rb: 'Paris Saint-Germain', dm1: 'Juventus', dm2: 'Manchester City', lam: 'Napoli', cam: 'Roma', ram: 'River Plate', st: 'Everton' } },
  { id: 'b38', formation: '4-2-3-1', clubs: { gk: 'Tottenham', lb: 'Villarreal', cb1: 'Newcastle', cb2: 'Celtic', rb: 'Paris Saint-Germain', dm1: 'Manchester City', dm2: 'Internazionale', lam: 'Arsenal', cam: 'Bayern Múnich', ram: 'Juventus', st: 'FC Barcelona' } },
  { id: 'b39', formation: '4-2-3-1', clubs: { gk: 'FC Barcelona', lb: 'Roma', cb1: 'Atlético de Madrid', cb2: 'Feyenoord', rb: 'RB Leipzig', dm1: 'Milan', dm2: 'Mónaco', lam: 'Real Sociedad', cam: 'Arsenal', ram: 'Liverpool', st: 'River Plate' } },
  { id: 'b40', formation: '4-2-3-1', clubs: { gk: 'Roma', lb: 'Tottenham', cb1: 'Arsenal', cb2: 'West Ham', rb: 'Aston Villa', dm1: 'FC Barcelona', dm2: 'Internazionale', lam: 'Villarreal', cam: 'Bayer Leverkusen', ram: 'Marsella', st: 'Real Betis' } },
  { id: 'b41', formation: '4-2-3-1', clubs: { gk: 'Chelsea', lb: 'Liverpool', cb1: 'Marsella', cb2: 'Real Sociedad', rb: 'Milan', dm1: 'Villarreal', dm2: 'Manchester City', lam: 'Borussia Dortmund', cam: 'Bayern Múnich', ram: 'Mónaco', st: 'Roma' } },
  { id: 'b42', formation: '4-2-3-1', clubs: { gk: 'Chelsea', lb: 'Villarreal', cb1: 'Atlético de Madrid', cb2: 'Internazionale', rb: 'Celtic', dm1: 'Roma', dm2: 'Real Sociedad', lam: 'Juventus', cam: 'Tottenham', ram: 'LA Galaxy', st: 'Everton' } },
  { id: 'b43', formation: '4-2-3-1', clubs: { gk: 'Tottenham', lb: 'Aston Villa', cb1: 'FC Barcelona', cb2: 'Manchester United', rb: 'Everton', dm1: 'River Plate', dm2: 'Bayern Múnich', lam: 'Real Madrid', cam: 'Arsenal', ram: 'Paris Saint-Germain', st: 'Atalanta' } },
  { id: 'b44', formation: '4-2-3-1', clubs: { gk: 'Paris Saint-Germain', lb: 'Mónaco', cb1: 'Tottenham', cb2: 'Stuttgart', rb: 'Bayern Múnich', dm1: 'Fiorentina', dm2: 'Botafogo', lam: 'Liverpool', cam: 'LA Galaxy', ram: 'Real Betis', st: 'Borussia Dortmund' } },
  { id: 'b45', formation: '4-2-3-1', clubs: { gk: 'Roma', lb: 'Bayer Leverkusen', cb1: 'Aston Villa', cb2: 'Everton', rb: 'Feyenoord', dm1: 'Tottenham', dm2: 'Corinthians', lam: 'Juventus', cam: 'Napoli', ram: 'Paris Saint-Germain', st: 'River Plate' } },
  { id: 'b46', formation: '4-2-3-1', clubs: { gk: 'Liverpool', lb: 'Internazionale', cb1: 'Lazio', cb2: 'Athletic Club', rb: 'Feyenoord', dm1: 'Real Betis', dm2: 'Juventus', lam: 'Tottenham', cam: 'Fiorentina', ram: 'Manchester United', st: 'Sporting CP' } },
  { id: 'b47', formation: '4-2-3-1', clubs: { gk: 'Arsenal', lb: 'Chelsea', cb1: 'Internazionale', cb2: 'Lazio', rb: 'Milan', dm1: 'Botafogo', dm2: 'Bayer Leverkusen', lam: 'Valencia', cam: 'Napoli', ram: 'Roma', st: 'Athletic Club' } },
  { id: 'b48', formation: '4-2-3-1', clubs: { gk: 'Manchester City', lb: 'West Ham', cb1: 'Real Sociedad', cb2: 'Juventus', rb: 'Newcastle', dm1: 'FC Barcelona', dm2: 'Corinthians', lam: 'Real Madrid', cam: 'Chelsea', ram: 'LA Galaxy', st: 'Aston Villa' } },
]

// Convierte un tablero en un Challenge: cada slot recibe un tag de club con match
// EXACTO contra playerClubs (club principal + altClubs). La posición la exige la
// formación (FORMATIONS en mionce-formations.ts) vía el buscador y validBySlot.
export function boardToChallenge(b: PositionClubBoard): Challenge {
  const slotTags: Record<string, SlotTag> = {}
  for (const [slotId, club] of Object.entries(b.clubs)) {
    slotTags[slotId] = {
      id: `club:${club}`,
      label: club,
      emoji: clubEmoji(club),
      match: (p: Player) => playerClubs(p).includes(club),
    }
  }
  return {
    id: b.id,
    title: 'Un once, once clubes',
    tagline: 'Una posición y un club por hueco',
    description: 'Cada puesto pide un jugador que jugó esa posición en ese club en algún momento de la historia. Acierta los 11 sin repetir jugador.',
    recommendedFormation: b.formation,
    slotTags,
  }
}

// PRNG determinista por semana ISO (mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface IsoWeek {
  year: number
  week: number
  key: string  // "2026-W18"
}

export function getIsoWeek(d: Date = new Date()): IsoWeek {
  const key = madridWeekISO(d)
  const [y, w] = key.split('-W')
  return { year: Number(y), week: Number(w), key }
}

export function getWeeklyChallenge(d: Date = new Date()): { challenge: Challenge; week: IsoWeek } {
  const week = getIsoWeek(d)
  const seed = week.year * 100 + week.week
  const rand = mulberry32(seed)
  const idx = Math.floor(rand() * BOARDS.length)
  return { challenge: boardToChallenge(BOARDS[idx]), week }
}

// Igual que getWeeklyChallenge pero a partir de la clave ISO "YYYY-Www" (sin
// Date). Mismo seed → MISMO tablero, para que el servidor calcule el reto/once
// de una semana dada sin depender de la zona horaria del runtime.
export function getChallengeForWeek(key: string): Challenge | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(key)
  if (!m) return null
  const seed = Number(m[1]) * 100 + Number(m[2])
  const rand = mulberry32(seed)
  const idx = Math.floor(rand() * BOARDS.length)
  return boardToChallenge(BOARDS[idx])
}
