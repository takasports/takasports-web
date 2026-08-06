// Genera sopas TEMÁTICAS a partir del catálogo de jugadores.
//
// Por qué: con 12 sopas y una por semana, la bolsa de rotación garantiza no
// repetir durante media vuelta = 6 semanas. Es el catálogo más corto de los
// cuatro juegos y, por tanto, el que antes cansa. Ampliarlo es la palanca.
//
// No se inventa NADA: cada palabra es un jugador que ya está en
// `players-catalog.ts`, y el tema sale de sus propios atributos (club, país,
// posición, era). El `playerIds` se resuelve en el mismo paso, así que no hay
// que pasar luego por gen-sopa-playerids.ts.
//
// Uso:  npx tsx scripts/gen-sopa-puzzles.ts
// Pega la salida al final de PUZZLES en src/lib/sopa-puzzles.ts.

import { PLAYERS_DEDUP, playerClubs, type Player } from '../src/lib/players-catalog'

const SIZE = 13
const MIN_WORDS = 8
const MAX_WORDS = 10
const MAX_LEN = SIZE - 1   // margen para que quepa en cualquier dirección

/** Palabra de sopa: mayúsculas, sin acentos ni signos ni espacios. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
}

/**
 * Palabra con la que se busca al jugador: SIEMPRE su apellido (o su mononombre,
 * como Pelé o Cafu). Si no cabe en la cuadrícula, el jugador se DESCARTA en vez
 * de caer al nombre de pila: buscar "BASTIAN" en lugar de "SCHWEINSTEIGER" no
 * lo reconoce nadie. Hay jugadores de sobra en cada tema para permitírselo.
 */
/** Partículas que forman parte del apellido tal y como se lee ("van Dijk"). */
const PARTICLES = new Set(['van', 'von', 'de', 'di', 'del', 'der', 'den', 'da', 'dos', 'du', 'la', 'le'])

function wordFor(p: Player): string | null {
  const parts = p.name.split(/\s+/).filter(Boolean)
  const surname = parts[parts.length - 1]
  const prev = parts[parts.length - 2]

  const candidates: string[] = []
  // Con partícula(s), si cabe: VANDIJK antes que DIJK, DEPAUL antes que PAUL
  // (que además es un nombre de pila y despista), VANDERSAR antes que DERSAR.
  if (prev && PARTICLES.has(prev.toLowerCase())) {
    let i = parts.length - 2
    while (i > 0 && PARTICLES.has(parts[i - 1].toLowerCase())) i--
    candidates.push(parts.slice(i).join(''))
  }
  // Apellidos con guion: Alexander-Arnold → ARNOLD.
  if (surname.includes('-')) candidates.push(surname.split('-').pop()!)
  candidates.push(surname)

  for (const c of candidates) {
    const w = fold(c)
    if (w.length >= 4 && w.length <= MAX_LEN) return w
  }
  return null
}

interface Theme {
  id: string
  title: string
  subtitle: string
  match: (p: Player) => boolean
  /** Orden de preferencia: los más icónicos primero (leyendas antes que otros). */
  rank?: (p: Player) => number
}

const CLUB_THEMES: Array<[string, string, string]> = [
  ['Milan',               'Il Diavolo',            'Cracks que vistieron el rojinegro'],
  ['Internazionale',      'Nerazzurri',            'Los que brillaron en el Inter'],
  ['Chelsea',             'Orgullo de Stamford',   'Leyendas del Chelsea'],
  ['Manchester United',   'Old Trafford',          'Los elegidos del United'],
  ['Juventus',            'La Vecchia Signora',    'Historia de la Juve'],
  ['Bayern Múnich',       'Mia san mia',           'Los grandes del Bayern'],
  ['Arsenal',             'Gunners',               'Cracks del Arsenal'],
  ['Manchester City',     'Etihad',                'La era del City'],
  ['Paris Saint-Germain', 'París es una fiesta',   'Estrellas del PSG'],
  ['Liverpool',           "You'll Never Walk Alone", 'Ídolos de Anfield'],
  ['Atlético de Madrid',  'Nunca dejes de creer',  'Cracks del Atleti'],
  ['Real Madrid',         'Los blancos',           'Leyendas del Bernabéu'],
  ['FC Barcelona',        'Més que un club',       'Historia del Camp Nou'],
]

// Países SIN sopa curada previa. Se dejan fuera Italia, Alemania e Inglaterra
// porque ya tienen la suya ('italia-calcio', 'bundesliga-cracks',
// 'crack-premier') y dos sopas del mismo tema se leen como repetida aunque las
// palabras cambien.
const COUNTRY_THEMES: Array<[string, string, string]> = [
  ['Francia',      'Les Bleus',        'Los cracks del fútbol francés'],
  ['Países Bajos', 'Naranja mecánica', 'Genios del fútbol neerlandés'],
  ['Portugal',     'A Seleção',        'Los mejores portugueses'],
]

const POSITION_THEMES: Array<[Player['position'], string, string]> = [
  ['DEF', 'Muro por delante',   'Defensas que no pasaban una'],
  ['MID', 'El motor del equipo', 'Centrocampistas de época'],
  ['FWD', 'Puro gol',            'Delanteros que marcaron una era'],
]

function themes(): Theme[] {
  const out: Theme[] = []
  for (const [club, title, subtitle] of CLUB_THEMES) {
    out.push({
      id: `club-${fold(club).toLowerCase()}`,
      title,
      subtitle,
      match: p => playerClubs(p).includes(club),
      rank: p => (p.era === 'historic' ? 0 : 1),
    })
  }
  for (const [country, title, subtitle] of COUNTRY_THEMES) {
    out.push({
      id: `pais-${fold(country).toLowerCase()}`,
      title,
      subtitle,
      match: p => p.country === country,
      rank: p => (p.era === 'historic' ? 0 : 1),
    })
  }
  for (const [pos, title, subtitle] of POSITION_THEMES) {
    out.push({
      id: `pos-${pos.toLowerCase()}-leyendas`,
      title,
      subtitle,
      match: p => p.position === pos && p.era === 'historic',
    })
  }
  return out
}

interface GeneratedPuzzle {
  id: string
  title: string
  subtitle: string
  size: number
  words: string[]
  intruder?: string
  playerIds: Record<string, string>
}

/**
 * Reparto por posición. El catálogo está ordenado por puesto (porteros primero),
 * así que coger "los N primeros" daba sopas de porteros y defensas: un tema del
 * Milan sin un solo delantero. Se sirve como un once: 1 portero, 3 defensas,
 * 3 medios y 3 delanteros, y lo que falte se completa con el resto del tema.
 */
const POSITION_QUOTA: Array<[Player['position'], number]> = [
  ['FWD', 3], ['MID', 3], ['DEF', 3], ['GK', 1],
]

function build(theme: Theme): GeneratedPuzzle | null {
  const pool = PLAYERS_DEDUP.filter(theme.match)
  const ranked = theme.rank ? [...pool].sort((a, b) => theme.rank!(a) - theme.rank!(b)) : pool

  const words: string[] = []
  const playerIds: Record<string, string> = {}
  const taken = new Set<string>()

  const add = (p: Player): boolean => {
    if (words.length >= MAX_WORDS || taken.has(p.id)) return false
    const w = wordFor(p)
    if (!w || playerIds[w]) return false   // sin apellido usable o repetido
    words.push(w)
    playerIds[w] = p.id
    taken.add(p.id)
    return true
  }

  for (const [pos, quota] of POSITION_QUOTA) {
    let n = 0
    for (const p of ranked) {
      if (n >= quota) break
      if (p.position === pos && add(p)) n++
    }
  }
  // Relleno si algún puesto no tenía suficientes en este tema.
  for (const p of ranked) {
    if (words.length >= MAX_WORDS) break
    add(p)
  }
  if (words.length < MIN_WORDS) return null

  // Intrusa: el siguiente del pool que no haya entrado. Da bonus al encontrarla
  // y no es obligatoria, así que basta con que pertenezca al mismo tema.
  let intruder: string | undefined
  for (const p of ranked) {
    if (taken.has(p.id)) continue
    const w = wordFor(p)
    if (!w || playerIds[w]) continue
    intruder = w
    playerIds[w] = p.id
    break
  }

  return { id: theme.id, title: theme.title, subtitle: theme.subtitle, size: SIZE, words, intruder, playerIds }
}

function serialize(p: GeneratedPuzzle): string {
  const ids = Object.entries(p.playerIds).map(([w, id]) => `${w}: '${id}'`).join(', ')
  return `  {
    id: '${p.id}',
    title: '${p.title.replace(/'/g, "\\'")}',
    subtitle: '${p.subtitle.replace(/'/g, "\\'")}',
    size: ${p.size},
    words: [${p.words.map(w => `'${w}'`).join(', ')}],${p.intruder ? `\n    intruder: '${p.intruder}',` : ''}
    playerIds: { ${ids} },
  },`
}

const generated = themes().map(build).filter((p): p is GeneratedPuzzle => !!p)

console.log(`// ${generated.length} sopas generadas desde el catálogo con scripts/gen-sopa-puzzles.ts`)
for (const p of generated) console.log(serialize(p))
console.error(`\n→ ${generated.length} temas con al menos ${MIN_WORDS} jugadores`)
for (const p of generated) {
  console.error(`   ${p.id.padEnd(28)} ${p.words.length} palabras + intrusa ${p.intruder ?? '—'}`)
}
