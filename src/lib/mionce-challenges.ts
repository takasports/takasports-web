// Retos semanales rotativos para Mi Once. Cada lunes ISO se elige uno
// determinísticamente según la semana del año, igual que en Sopa de Cracks.

import { playerClubs, type Player } from './players-catalog'

export type FormationId = '4-3-3' | '4-4-2' | '3-5-2' | '4-2-3-1'

// Etiqueta opcional asignada a un slot concreto del once. Si está presente,
// el jugador colocado en ese slot debe cumplirla (además de la posición y
// del filtro global del reto). El tag se muestra como chip junto al slot.
export interface SlotTag {
  id: string
  label: string
  emoji: string
  match: (p: Player) => boolean
}

// Tags reutilizables — derivados de los campos disponibles en el catálogo.
export const TAG = {
  country: (label: string, emoji: string, countries: string[]): SlotTag => ({
    id: `country:${countries.join(',')}`,
    label,
    emoji,
    match: p => countries.includes(p.country),
  }),
  era: (era: 'current' | 'historic'): SlotTag => era === 'current'
    ? { id: 'era:current', label: 'En activo', emoji: '⚡', match: p => p.era === 'current' }
    : { id: 'era:historic', label: 'Leyenda', emoji: '🏛️', match: p => p.era === 'historic' },
  club: (label: string, emoji: string, pattern: RegExp): SlotTag => ({
    id: `club:${label}`,
    label,
    emoji,
    match: p => playerClubs(p).some(c => pattern.test(c)),
  }),
}

export interface Challenge {
  id: string
  title: string
  tagline: string
  description: string
  // Filtro global opcional sobre el catálogo (aplicado a todos los slots).
  filter?: (p: Player) => boolean
  // Formación recomendada (el usuario puede cambiarla)
  recommendedFormation: FormationId
  // Reto con restricción por slot: cada hueco lleva su propia etiqueta.
  // Cuando se define, la formación queda bloqueada en `recommendedFormation`
  // para que los IDs coincidan, y se valida match por slot.
  slotTags?: Record<string, SlotTag>
  // Meta-regla: prohíbe colocar dos jugadores que comparten club.
  noRepeatClub?: boolean
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
    filter: p => /Real Madrid|FC Barcelona|Atlético de Madrid|Valencia|Sevilla|Villarreal|Athletic|Real Sociedad|Real Betis|Celta|Deportivo|Espanyol|Málaga|Mallorca|Las Palmas|Getafe|Osasuna|Rayo|Cádiz|Alavés/i.test(p.club),
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
  {
    id: 'eleven-nations',
    title: 'Once de 11 nacionalidades',
    tagline: 'Un país distinto en cada posición',
    description: 'Cada hueco está reservado a una nacionalidad concreta. Acierta los 11 sin repetir país y sin repetir club.',
    recommendedFormation: '4-3-3',
    noRepeatClub: true,
    slotTags: {
      gk:  TAG.country('Español',    '🇪🇸', ['España']),
      lb:  TAG.country('Brasileño',  '🇧🇷', ['Brasil']),
      cb1: TAG.country('Argentino',  '🇦🇷', ['Argentina']),
      cb2: TAG.country('Italiano',   '🇮🇹', ['Italia']),
      rb:  TAG.country('Inglés',     '🏴',   ['Inglaterra']),
      cm1: TAG.country('Francés',    '🇫🇷', ['Francia']),
      cm2: TAG.country('Alemán',     '🇩🇪', ['Alemania']),
      cm3: TAG.country('Croata',     '🇭🇷', ['Croacia']),
      lw:  TAG.country('Portugués',  '🇵🇹', ['Portugal']),
      st:  TAG.country('Uruguayo',   '🇺🇾', ['Uruguay']),
      rw:  TAG.country('Belga',      '🇧🇪', ['Bélgica']),
    },
  },
  {
    id: 'eras-mixed',
    title: 'Once entre dos épocas',
    tagline: 'Mitad leyendas, mitad presente',
    description: 'Cada posición pide leyenda histórica o jugador en activo. Sin repetir club.',
    recommendedFormation: '4-4-2',
    noRepeatClub: true,
    slotTags: {
      gk:  TAG.era('historic'),
      lb:  TAG.era('current'),
      cb1: TAG.era('historic'),
      cb2: TAG.era('current'),
      rb:  TAG.era('historic'),
      lm:  TAG.era('current'),
      cm1: TAG.era('historic'),
      cm2: TAG.era('current'),
      rm:  TAG.era('historic'),
      st1: TAG.era('current'),
      st2: TAG.era('historic'),
    },
  },
  // ── Retos por club y posición ─────────────────────────────────────
  {
    id: 'grandes-europa',
    title: 'Los 11 grandes de Europa',
    tagline: 'Un club diferente por posición',
    description: 'Cada hueco exige un jugador de un club europeo concreto. Un club distinto en cada posición.',
    recommendedFormation: '4-3-3',
    slotTags: {
      gk:  TAG.club('Real Madrid',   '⚪', /Real Madrid/i),
      lb:  TAG.club('Barcelona',     '🔵', /FC Barcelona/i),
      cb1: TAG.club('Liverpool',     '🔴', /Liverpool/i),
      cb2: TAG.club('Bayern',        '🔴', /Bayern/i),
      rb:  TAG.club('Juventus',      '⚫', /Juventus/i),
      cm1: TAG.club('Man City',      '🔵', /Manchester City/i),
      cm2: TAG.club('PSG',           '🔵', /Paris Saint-Germain/i),
      cm3: TAG.club('Arsenal',       '🔴', /Arsenal/i),
      lw:  TAG.club('Inter',         '⚫', /Internazionale/i),
      st:  TAG.club('Atlético',      '🔴', /Atlético de Madrid/i),
      rw:  TAG.club('Chelsea',       '🔵', /Chelsea/i),
    },
  },
  {
    id: 'clasico-xl',
    title: 'El Clásico — 11 puestos',
    tagline: 'Real Madrid vs Barça posición a posición',
    description: 'Alterna jugadores históricos del Real Madrid y del FC Barcelona en cada posición de tu once. Sin repetir club globalmente.',
    recommendedFormation: '4-3-3',
    noRepeatClub: false,
    slotTags: {
      gk:  TAG.club('Real Madrid',   '⚪', /Real Madrid/i),
      lb:  TAG.club('Barcelona',     '🔵', /FC Barcelona/i),
      cb1: TAG.club('Real Madrid',   '⚪', /Real Madrid/i),
      cb2: TAG.club('Barcelona',     '🔵', /FC Barcelona/i),
      rb:  TAG.club('Real Madrid',   '⚪', /Real Madrid/i),
      cm1: TAG.club('Barcelona',     '🔵', /FC Barcelona/i),
      cm2: TAG.club('Real Madrid',   '⚪', /Real Madrid/i),
      cm3: TAG.club('Barcelona',     '🔵', /FC Barcelona/i),
      lw:  TAG.club('Real Madrid',   '⚪', /Real Madrid/i),
      st:  TAG.club('Barcelona',     '🔵', /FC Barcelona/i),
      rw:  TAG.club('Real Madrid',   '⚪', /Real Madrid/i),
    },
  },
  {
    id: 'laliga-posicion',
    title: 'LaLiga por club y posición',
    tagline: 'Cada puesto, un grande de España',
    description: 'Coloca un jugador de cada uno de los clubes históricos de LaLiga en su posición. Sin repetir club.',
    recommendedFormation: '4-4-2',
    slotTags: {
      gk:  TAG.club('Real Madrid',   '⚪', /Real Madrid/i),
      lb:  TAG.club('Atlético',      '🔴', /Atlético de Madrid/i),
      cb1: TAG.club('Barcelona',     '🔵', /FC Barcelona/i),
      cb2: TAG.club('Valencia',      '🦇', /Valencia/i),
      rb:  TAG.club('Sevilla',       '🔴', /Sevilla/i),
      lm:  TAG.club('Athletic',      '🔴', /Athletic/i),
      cm1: TAG.club('Villarreal',    '🟡', /Villarreal/i),
      cm2: TAG.club('Real Betis',    '🟢', /Real Betis/i),
      rm:  TAG.club('Real Sociedad', '🔵', /Real Sociedad/i),
      st1: TAG.club('Deportivo',     '⚪', /Deportivo/i),
      st2: TAG.club('Espanyol',      '🔵', /Espanyol/i),
    },
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
