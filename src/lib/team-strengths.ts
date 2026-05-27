// ─────────────────────────────────────────────────────────────────
// Tabla curada de fuerzas de equipos.
//
// Cuando las standings ESPN no devuelven un equipo (recién ascendido,
// inicio de temporada con gp=0, equipo invitado en Copa, partido de
// selecciones, etc.), usamos esta tabla como fallback para que las
// cuotas internas reflejen la fuerza histórica del club.
//
// Escala compatible con el cálculo de standings ESPN:
//   strength_standings = pts + 0.3 * gd
// Top equipo LaLiga al final de temporada: ~90pts + ~+60gd → ~108
// Equipo recién ascendido / colero: ~30pts + ~-50gd → ~15
// Equipo medio: ~50pts + 0gd → ~50
//
// Por eso esta tabla usa rango ~10-110 (no 0-100).
// Valores curados al 2026-05-24 — actualizar manualmente cada
// 6-12 meses según resultados de la última temporada.
//
// Hay que pensar en TRES claves de matching:
//   · Nombre completo ESPN ("Real Madrid", "Manchester City")
//   · Nombre corto / popular ("Madrid", "Man City")
//   · Aliases comunes ("Atléti", "PSG", "Bayern")
//
// nameMatch (lib/quiniela.ts) ya normaliza, así que aquí guardamos
// el nombre canónico (suficiente para que el match find lo encuentre).
// ─────────────────────────────────────────────────────────────────

import { nameMatch } from './quiniela'

interface CuratedStrength {
  /** Nombre canónico (lo que ESPN suele devolver). */
  name: string
  /** Fuerza en la misma escala que pts + 0.3*gd: 10 (colero) – 110 (élite). */
  strength: number
}

// ── Selecciones (Mundial 2026 + clasificación) ───────────────────
const NATIONAL_TEAMS: CuratedStrength[] = [
  // Tier S — elite mundial
  { name: 'Argentina', strength: 105 },
  { name: 'France', strength: 102 },
  { name: 'Brazil', strength: 100 },
  { name: 'Spain', strength: 100 },
  { name: 'England', strength: 95 },
  { name: 'Germany', strength: 92 },
  { name: 'Portugal', strength: 92 },
  // Tier A — selecciones fuertes
  { name: 'Netherlands', strength: 88 },
  { name: 'Italy', strength: 85 },
  { name: 'Belgium', strength: 83 },
  { name: 'Croatia', strength: 82 },
  { name: 'Uruguay', strength: 80 },
  { name: 'Colombia', strength: 78 },
  { name: 'Morocco', strength: 75 },
  { name: 'Switzerland', strength: 72 },
  { name: 'Denmark', strength: 72 },
  { name: 'USA', strength: 70 },
  { name: 'Mexico', strength: 70 },
  { name: 'Senegal', strength: 68 },
  { name: 'Japan', strength: 68 },
  { name: 'South Korea', strength: 65 },
  // Tier B — selecciones medias
  { name: 'Ecuador', strength: 62 },
  { name: 'Chile', strength: 60 },
  { name: 'Peru', strength: 55 },
  { name: 'Australia', strength: 55 },
  { name: 'Canada', strength: 55 },
  { name: 'Iran', strength: 55 },
  { name: 'Saudi Arabia', strength: 52 },
  { name: 'Tunisia', strength: 50 },
  { name: 'Egypt', strength: 55 },
  { name: 'Ghana', strength: 55 },
  // Tier C — outsiders
  { name: 'Costa Rica', strength: 45 },
  { name: 'Panama', strength: 40 },
  { name: 'Qatar', strength: 38 },
]

// ── LaLiga ───────────────────────────────────────────────────────
const LALIGA: CuratedStrength[] = [
  { name: 'Real Madrid', strength: 105 },
  { name: 'Barcelona', strength: 100 },
  { name: 'Atletico Madrid', strength: 90 },
  { name: 'Athletic Club', strength: 75 },
  { name: 'Real Sociedad', strength: 72 },
  { name: 'Real Betis', strength: 68 },
  { name: 'Villarreal', strength: 68 },
  { name: 'Valencia', strength: 60 },
  { name: 'Sevilla', strength: 60 },
  { name: 'Girona', strength: 58 },
  { name: 'Osasuna', strength: 52 },
  { name: 'Celta Vigo', strength: 50 },
  { name: 'Mallorca', strength: 48 },
  { name: 'Rayo Vallecano', strength: 48 },
  { name: 'Getafe', strength: 45 },
  { name: 'Espanyol', strength: 42 },
  { name: 'Alavés', strength: 40 },
  { name: 'Las Palmas', strength: 38 },
  { name: 'Elche', strength: 35 },
  { name: 'Leganés', strength: 35 },
  { name: 'Real Valladolid', strength: 30 },
]

// ── Premier League ───────────────────────────────────────────────
const PREMIER: CuratedStrength[] = [
  { name: 'Manchester City', strength: 105 },
  { name: 'Liverpool', strength: 100 },
  { name: 'Arsenal', strength: 95 },
  { name: 'Chelsea', strength: 85 },
  { name: 'Tottenham Hotspur', strength: 80 },
  { name: 'Manchester United', strength: 78 },
  { name: 'Newcastle United', strength: 75 },
  { name: 'Aston Villa', strength: 72 },
  { name: 'Brighton & Hove Albion', strength: 65 },
  { name: 'West Ham United', strength: 60 },
  { name: 'Crystal Palace', strength: 55 },
  { name: 'Brentford', strength: 55 },
  { name: 'Fulham', strength: 52 },
  { name: 'Bournemouth', strength: 50 },
  { name: 'Wolverhampton Wanderers', strength: 48 },
  { name: 'Nottingham Forest', strength: 48 },
  { name: 'Everton', strength: 48 },
  { name: 'Sunderland', strength: 38 },
  { name: 'Leeds United', strength: 45 },
  { name: 'Burnley', strength: 40 },
  { name: 'Ipswich Town', strength: 38 },
  { name: 'Sheffield United', strength: 35 },
  { name: 'Luton Town', strength: 32 },
]

// ── Serie A ──────────────────────────────────────────────────────
const SERIE_A: CuratedStrength[] = [
  { name: 'Inter Milan', strength: 100 },
  { name: 'AC Milan', strength: 90 },
  { name: 'Juventus', strength: 88 },
  { name: 'Napoli', strength: 88 },
  { name: 'AS Roma', strength: 80 },
  { name: 'Atalanta', strength: 80 },
  { name: 'Lazio', strength: 72 },
  { name: 'Fiorentina', strength: 65 },
  { name: 'Bologna', strength: 62 },
  { name: 'Torino', strength: 55 },
  { name: 'Genoa', strength: 50 },
  { name: 'Como', strength: 48 },
  { name: 'Udinese', strength: 48 },
  { name: 'Cagliari', strength: 45 },
  { name: 'Hellas Verona', strength: 42 },
  { name: 'Empoli', strength: 42 },
  { name: 'Parma', strength: 40 },
  { name: 'Lecce', strength: 38 },
  { name: 'Monza', strength: 35 },
  { name: 'Venezia', strength: 32 },
]

// ── Bundesliga ───────────────────────────────────────────────────
const BUNDESLIGA: CuratedStrength[] = [
  { name: 'Bayern Munich', strength: 105 },
  { name: 'Borussia Dortmund', strength: 85 },
  { name: 'RB Leipzig', strength: 82 },
  { name: 'Bayer Leverkusen', strength: 90 },
  { name: 'Eintracht Frankfurt', strength: 70 },
  { name: 'VfB Stuttgart', strength: 68 },
  { name: 'Borussia Monchengladbach', strength: 58 },
  { name: 'VfL Wolfsburg', strength: 55 },
  { name: 'FSV Mainz 05', strength: 52 },
  { name: 'Werder Bremen', strength: 52 },
  { name: 'TSG Hoffenheim', strength: 50 },
  { name: 'Augsburg', strength: 48 },
  { name: 'SC Freiburg', strength: 55 },
  { name: 'Union Berlin', strength: 48 },
  { name: 'FC Köln', strength: 42 },
  { name: 'St. Pauli', strength: 40 },
  { name: 'Heidenheim', strength: 38 },
  { name: 'Holstein Kiel', strength: 32 },
]

// ── Ligue 1 ──────────────────────────────────────────────────────
const LIGUE_1: CuratedStrength[] = [
  { name: 'Paris Saint-Germain', strength: 100 },
  { name: 'Olympique de Marseille', strength: 75 },
  { name: 'Olympique Lyonnais', strength: 70 },
  { name: 'AS Monaco', strength: 72 },
  { name: 'OGC Nice', strength: 60 },
  { name: 'Lille', strength: 65 },
  { name: 'Stade Rennais', strength: 55 },
  { name: 'RC Strasbourg', strength: 52 },
  { name: 'RC Lens', strength: 58 },
  { name: 'Stade Brestois', strength: 50 },
  { name: 'Toulouse', strength: 48 },
  { name: 'Nantes', strength: 45 },
  { name: 'Auxerre', strength: 42 },
  { name: 'Angers', strength: 40 },
  { name: 'Montpellier', strength: 38 },
  { name: 'Reims', strength: 40 },
  { name: 'Le Havre', strength: 38 },
  { name: 'Saint-Étienne', strength: 40 },
]

// ── Otros: Champions / Europa / Copas ────────────────────────────
// Equipos que aparecen en torneos europeos pero no en las 5 grandes ligas.
const OTHER_EUROPE: CuratedStrength[] = [
  { name: 'FC Porto', strength: 75 },
  { name: 'SL Benfica', strength: 78 },
  { name: 'Sporting CP', strength: 75 },
  { name: 'Ajax', strength: 70 },
  { name: 'PSV Eindhoven', strength: 68 },
  { name: 'Feyenoord', strength: 65 },
  { name: 'Galatasaray', strength: 65 },
  { name: 'Fenerbahçe', strength: 65 },
  { name: 'Beşiktaş', strength: 55 },
  { name: 'Celtic', strength: 60 },
  { name: 'Rangers', strength: 58 },
  { name: 'Shakhtar Donetsk', strength: 58 },
  { name: 'Dynamo Kyiv', strength: 50 },
  { name: 'Red Bull Salzburg', strength: 62 },
  { name: 'Sturm Graz', strength: 50 },
  { name: 'Slavia Praha', strength: 52 },
  { name: 'Sparta Praha', strength: 50 },
]

// Combinamos todas las tablas en una sola para lookup rápido.
const ALL_TEAMS: CuratedStrength[] = [
  ...NATIONAL_TEAMS,
  ...LALIGA,
  ...PREMIER,
  ...SERIE_A,
  ...BUNDESLIGA,
  ...LIGUE_1,
  ...OTHER_EUROPE,
]

/**
 * Busca la fuerza curada de un equipo por nombre.
 * Devuelve `null` si no está en la tabla (caller debe usar
 * neutralStrength() ~50 como último recurso).
 *
 * Match es tolerante via `nameMatch` de lib/quiniela.ts:
 * "Real Madrid", "Madrid", "Real Madrid CF" todos casan con la entry "Real Madrid".
 */
export function curatedStrength(teamName: string): number | null {
  if (!teamName) return null
  const found = ALL_TEAMS.find(t => nameMatch(t.name, teamName))
  return found ? found.strength : null
}

/** Fuerza promedio para un equipo desconocido (50 = mid-tier neutral). */
export const NEUTRAL_STRENGTH = 50

/** Útil para tests/debug. */
export function teamStrengthsCount(): number {
  return ALL_TEAMS.length
}
