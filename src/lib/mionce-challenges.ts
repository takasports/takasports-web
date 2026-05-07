// Retos semanales rotativos para Mi Once. Cada lunes ISO se elige uno
// determinísticamente según la semana del año, igual que en Sopa de Cracks.

import type { Player } from './players-catalog'

export type FormationId = '4-3-3' | '4-4-2' | '3-5-2' | '4-2-3-1'

export interface Challenge {
  id: string
  title: string
  tagline: string
  description: string
  // Filtro opcional sobre el catálogo. Si devuelve true, el jugador es válido.
  filter?: (p: Player) => boolean
  // Formación recomendada (el usuario puede cambiarla)
  recommendedFormation: FormationId
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'all-time',
    title: 'Once histórico de todos los tiempos',
    tagline: 'Los mejores de la historia',
    description: 'Tu once ideal sin restricciones. Mezcla eras, ligas y leyendas.',
    recommendedFormation: '4-3-3',
  },
  {
    id: 'laliga',
    title: 'Once histórico de LaLiga',
    tagline: 'Solo Real Madrid, Barça, Atleti, Valencia… leyendas españolas',
    description: 'Únicamente jugadores asociados a clubes de LaLiga.',
    filter: p => /Real Madrid|FC Barcelona|Atlético|Valencia|Sevilla|Villarreal|Athletic|Real Sociedad|Real Betis|Celta|Deportivo|Espanyol|Málaga|Mallorca|Las Palmas|Getafe|Osasuna|Rayo|Cádiz|Alavés/i.test(p.club),
    recommendedFormation: '4-3-3',
  },
  {
    id: 'world-cup',
    title: 'Once de campeones del mundo',
    tagline: 'Solo selecciones que han ganado un Mundial',
    description: 'Jugadores nacidos en países que han ganado al menos una Copa del Mundo.',
    filter: p => ['Brasil', 'Argentina', 'Alemania', 'Italia', 'Francia', 'España', 'Inglaterra', 'Uruguay'].includes(p.country),
    recommendedFormation: '4-4-2',
  },
  {
    id: 'current',
    title: 'Once de la temporada actual',
    tagline: 'Solo jugadores en activo',
    description: 'Únicamente jugadores que están jugando ahora mismo en las grandes ligas.',
    filter: p => p.era === 'current',
    recommendedFormation: '4-3-3',
  },
  {
    id: 'no-galacticos',
    title: 'Once sin Real Madrid ni Barça',
    tagline: 'Demuestra que hay vida fuera del clásico',
    description: 'Forma tu once sin ningún jugador asociado al Real Madrid o al FC Barcelona.',
    filter: p => !/Real Madrid|FC Barcelona/i.test(p.club),
    recommendedFormation: '4-3-3',
  },
  {
    id: 'south-america',
    title: 'Once sudamericano',
    tagline: 'Latinoamérica al poder',
    description: 'Solo jugadores nacidos en América del Sur.',
    filter: p => ['Brasil', 'Argentina', 'Uruguay', 'Colombia', 'Chile', 'Paraguay', 'Perú', 'Ecuador', 'Bolivia', 'Venezuela'].includes(p.country),
    recommendedFormation: '4-3-3',
  },
  {
    id: 'premier',
    title: 'Once histórico de Premier League',
    tagline: 'Inglaterra, su tierra',
    description: 'Solo jugadores asociados a clubes de la Premier League.',
    filter: p => /Manchester United|Manchester City|Liverpool|Arsenal|Chelsea|Tottenham|Newcastle|Aston Villa|Everton|Brighton|West Ham|Crystal Palace|Fulham|Leicester|Stoke|Bolton|Wolves|Brentford|Nottingham/i.test(p.club),
    recommendedFormation: '4-4-2',
  },
  {
    id: 'serie-a',
    title: 'Once histórico de Serie A',
    tagline: 'Calcio del bueno',
    description: 'Solo jugadores asociados a clubes italianos.',
    filter: p => /Milan|Internazionale|Juventus|Roma|Lazio|Napoli|Fiorentina|Atalanta|Sampdoria|Torino|Udinese|Bologna|Sassuolo/i.test(p.club),
    recommendedFormation: '3-5-2',
  },
  {
    id: 'underdogs',
    title: 'Once de los infravalorados',
    tagline: 'Sin los clubes top',
    description: 'Sin jugadores de Real Madrid, Barça, Manchester City, PSG o Bayern Múnich.',
    filter: p => !/Real Madrid|FC Barcelona|Manchester City|Paris Saint-Germain|Bayern Múnich/i.test(p.club),
    recommendedFormation: '4-2-3-1',
  },
  {
    id: 'nineties',
    title: 'Once de los 90s y 2000s',
    tagline: 'El fútbol de antes',
    description: 'Solo leyendas históricas, nada de jugadores actuales.',
    filter: p => p.era === 'historic',
    recommendedFormation: '4-4-2',
  },
]

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
  const target = new Date(d.valueOf())
  const dayNr = (d.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setUTCMonth(0, 1)
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7)
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
  const year = new Date(firstThursday).getUTCFullYear()
  return { year, week, key: `${year}-W${String(week).padStart(2, '0')}` }
}

export function getWeeklyChallenge(d: Date = new Date()): { challenge: Challenge; week: IsoWeek } {
  const week = getIsoWeek(d)
  const seed = week.year * 100 + week.week
  const rand = mulberry32(seed)
  const idx = Math.floor(rand() * CHALLENGES.length)
  return { challenge: CHALLENGES[idx], week }
}
