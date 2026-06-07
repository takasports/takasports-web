// Datos y resolución de jugadores de "Sopa de Cracks". Módulo puro (sin React)
// para que los puzzles y el mapeo palabra→jugador sean testeables.
//
// `playerIds` mapea cada palabra del grid al `id` de catálogo del jugador, para
// la mini-bio. Resuelto por NOMBRE (los ids del catálogo están reciclados y no
// son fiables por su forma) con `scripts/gen-sopa-playerids.ts`; los homónimos
// (RONALDO=R9/CR7, ROBERTO Carlos, Fernando TORRES) se desambiguan ahí a mano.
// Palabras sin entrada (Zarra, managers, etc.) caen al heurístico por nombre.

import { searchPlayers, getPlayerById, type Player } from './players-catalog'

export interface Puzzle {
  id: string
  title: string
  subtitle: string
  size: number
  words: string[]
  /** Palabra "intrusa": no se anuncia en la sidebar pero está escondida
   * en el grid. Encontrarla da bonus pero no es obligatoria para ganar. */
  intruder?: string
  /** Mapa palabra→id de catálogo para la mini-bio (desambigua homónimos y
   * nombres con espacios). Las palabras sin entrada usan el heurístico. */
  playerIds?: Record<string, string>
}

export const PUZZLES: Puzzle[] = [
  {
    id: 'leyendas-laliga',
    title: 'Leyendas de LaLiga',
    subtitle: 'Diez cracks que dejaron huella en España',
    size: 13,
    words: ['MESSI', 'RAUL', 'ZIDANE', 'PUYOL', 'INIESTA', 'XAVI', 'CASILLAS', 'KROOS', 'MODRIC', 'RONALDO'],
    intruder: 'HIERRO',
    playerIds: { MESSI: 'messi', RAUL: 'raul', ZIDANE: 'zidane', PUYOL: 'puyol', INIESTA: 'iniesta', XAVI: 'xavi', CASILLAS: 'casillas', KROOS: 'kroos', MODRIC: 'modric', RONALDO: 'ronaldo-r9', HIERRO: 'hierro' },
  },
  {
    id: 'pichichis-historicos',
    title: 'Pichichis históricos',
    subtitle: 'Goleadores que reinaron en LaLiga',
    size: 13,
    words: ['ZARRA', 'MESSI', 'CRISTIANO', 'BENZEMA', 'SUAREZ', 'FORLAN', 'VILLA', 'AGUERO', 'ETOO'],
    intruder: 'HIGUAIN',
    playerIds: { MESSI: 'messi', CRISTIANO: 'ronaldo-cr7', BENZEMA: 'benzema', SUAREZ: 'suarez-l', FORLAN: 'forlan', VILLA: 'villa', AGUERO: 'aguero', ETOO: 'eto-o', HIGUAIN: 'higuain' },
  },
  {
    id: 'leyendas-mundiales',
    title: 'Leyendas mundiales',
    subtitle: 'Iconos del fútbol global',
    size: 14,
    words: ['MARADONA', 'PELE', 'CRUYFF', 'BECKENBAUER', 'PLATINI', 'ZICO', 'ROMARIO', 'MALDINI', 'BAGGIO'],
    intruder: 'STOICHKOV',
    playerIds: { MARADONA: 'maradona', PELE: 'pele', CRUYFF: 'cruyff', BECKENBAUER: 'beckenbauer', PLATINI: 'platini', ZICO: 'zico', ROMARIO: 'romario', MALDINI: 'maldini', BAGGIO: 'baggio', STOICHKOV: 'stoichkov' },
  },
  {
    id: 'champions-goleadores',
    title: 'Reyes de la Champions',
    subtitle: 'Los máximos goleadores de la historia europea',
    size: 13,
    words: ['RONALDO', 'MESSI', 'BENZEMA', 'RAUL', 'MORIENTES', 'HENRY', 'SHEVCHENKO', 'INZAGHI'],
    intruder: 'LEWANDOWSKI',
    playerIds: { RONALDO: 'ronaldo-cr7', MESSI: 'messi', BENZEMA: 'benzema', RAUL: 'raul', MORIENTES: 'morientes', HENRY: 'henry', SHEVCHENKO: 'shevchenko', INZAGHI: 'inzaghi-f', LEWANDOWSKI: 'lewandowski' },
  },
  {
    id: 'porteros-leyenda',
    title: 'Porteros de leyenda',
    subtitle: 'Los mejores guardametas de la historia',
    size: 13,
    words: ['CASILLAS', 'BUFFON', 'NEUER', 'YASHIN', 'ZOFF', 'SCHMEICHEL', 'KAHN', 'SEAMAN'],
    intruder: 'COURTOIS',
    playerIds: { CASILLAS: 'casillas', BUFFON: 'buffon', NEUER: 'neuer', YASHIN: 'yashin', ZOFF: 'zoff', SCHMEICHEL: 'schmeichel-p', KAHN: 'kahn', SEAMAN: 'seaman', COURTOIS: 'courtois' },
  },
  {
    id: 'seleccion-espana',
    title: 'La Roja campeona',
    subtitle: 'Héroes de los Mundiales y Europas de España',
    size: 13,
    words: ['XAVI', 'INIESTA', 'VILLA', 'CASILLAS', 'PUYOL', 'TORRES', 'BUSQUETS', 'FABREGAS', 'RAMOS'],
    intruder: 'PIQUE',
    playerIds: { XAVI: 'xavi', INIESTA: 'iniesta', VILLA: 'villa', CASILLAS: 'casillas', PUYOL: 'puyol', TORRES: 'torres', BUSQUETS: 'busquets', FABREGAS: 'fabregas', RAMOS: 'sergio-ramos', PIQUE: 'pique' },
  },
  {
    id: 'crack-premier',
    title: 'Estrellas de la Premier',
    subtitle: 'Cracks que brillaron en Inglaterra',
    size: 13,
    words: ['HENRY', 'BERGKAMP', 'GERRARD', 'LAMPARD', 'SCHOLES', 'SHEARER', 'GIGGS', 'BECKHAM'],
    intruder: 'KEANE',
    playerIds: { HENRY: 'henry', BERGKAMP: 'bergkamp', GERRARD: 'gerrard', LAMPARD: 'lampard', SCHOLES: 'scholes', SHEARER: 'shearer', BECKHAM: 'beckham', KEANE: 'keane' },
  },
  {
    id: 'generacion-argentina',
    title: 'Argentina de oro',
    subtitle: 'Mitos del fútbol albiceleste',
    size: 13,
    words: ['MARADONA', 'MESSI', 'BATISTUTA', 'CANIGGIA', 'RIQUELME', 'TEVEZ', 'AGUERO', 'VERON'],
    intruder: 'ZANETTI',
    playerIds: { MARADONA: 'maradona', MESSI: 'messi', BATISTUTA: 'batistuta', RIQUELME: 'riquelme', TEVEZ: 'tevez', AGUERO: 'aguero', VERON: 'verón' },
  },
  {
    id: 'entrenadores-historia',
    title: 'Genios del banquillo',
    subtitle: 'Los mejores entrenadores de la historia',
    size: 14,
    words: ['MOURINHO', 'ANCELOTTI', 'GUARDIOLA', 'FERGUSON', 'CAPELLO', 'CRUYFF', 'MICHELS', 'SACCHI'],
    intruder: 'BIELSA',
    playerIds: { GUARDIOLA: 'guardiola', CRUYFF: 'cruyff' },
  },
  {
    id: 'brasil-magico',
    title: 'Brasil mágico',
    subtitle: 'La Canarinha en estado puro',
    size: 13,
    words: ['PELE', 'RONALDO', 'RONALDINHO', 'ZICO', 'ROMARIO', 'CAFU', 'ROBERTO', 'RIVALDO'],
    intruder: 'NEYMAR',
    playerIds: { PELE: 'pele', RONALDO: 'ronaldo-r9', RONALDINHO: 'ronaldinho', ZICO: 'zico', ROMARIO: 'romario', CAFU: 'cafu', ROBERTO: 'roberto-carlos', RIVALDO: 'rivaldo', NEYMAR: 'neymar' },
  },
  {
    id: 'bundesliga-cracks',
    title: 'Leyendas de la Bundesliga',
    subtitle: 'Los mejores de Alemania',
    size: 13,
    words: ['MULLER', 'BECKENBAUER', 'RUMMENIGGE', 'ROBBEN', 'RIBERY', 'LEWANDOWSKI', 'NEUER', 'KAHN'],
    intruder: 'REUS',
    playerIds: { MULLER: 'muller', BECKENBAUER: 'beckenbauer', ROBBEN: 'robben', LEWANDOWSKI: 'lewandowski', NEUER: 'neuer', KAHN: 'kahn', REUS: 'reus' },
  },
  {
    id: 'italia-calcio',
    title: 'El Calcio eterno',
    subtitle: 'Ídolos del fútbol italiano',
    size: 13,
    words: ['MALDINI', 'BUFFON', 'TOTTI', 'DELPIERO', 'BAGGIO', 'BARESI', 'ZOLA', 'PIRLO'],
    intruder: 'VIERI',
    playerIds: { MALDINI: 'maldini', BUFFON: 'buffon', TOTTI: 'totti', DELPIERO: 'del-piero', BAGGIO: 'baggio', BARESI: 'baresi', PIRLO: 'pirlo', VIERI: 'baggio-d' },
  },
]

// Busca el jugador asociado a una palabra de la sopa para la mini-bio. Prioriza
// el mapeo explícito palabra→id del puzzle (desambigua homónimos como RONALDO
// =R9/CR7 y nombres con espacios como DEL PIERO); si no hay entrada, cae a una
// búsqueda heurística por nombre (featured editorial sin mapa, etc.).
export function findPlayerForWord(word: string, playerIds?: Record<string, string>): Player | null {
  if (!word) return null
  const mappedId = playerIds?.[word]
  if (mappedId) {
    const mapped = getPlayerById(mappedId)
    if (mapped) return mapped
  }
  if (word.length < 3) return null
  const res = searchPlayers(word, { limit: 5 })
  if (res.length === 0) return null
  // Preferimos a quien tenga la palabra como token (apellido o nombre) exacto.
  const target = word.toLowerCase()
  const exact = res.find(p => p.name.toLowerCase().split(/\s+/).includes(target))
  return exact ?? res[0]
}

// Mueve el cursor del teclado en la cuadrícula (a11y). Las flechas desplazan una
// celda; cualquier otra tecla no cambia la posición. Se mantiene dentro de
// [0, size-1] en ambos ejes (no hace wrap). Pura → testeable.
export function moveCursor(cursor: { r: number; c: number }, key: string, size: number): { r: number; c: number } {
  let { r, c } = cursor
  if (key === 'ArrowUp') r -= 1
  else if (key === 'ArrowDown') r += 1
  else if (key === 'ArrowLeft') c -= 1
  else if (key === 'ArrowRight') c += 1
  const clamp = (n: number) => Math.max(0, Math.min(size - 1, n))
  return { r: clamp(r), c: clamp(c) }
}
