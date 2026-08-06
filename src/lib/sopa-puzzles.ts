// Datos y resolución de jugadores de "Sopa de Cracks". Módulo puro (sin React)
// para que los puzzles y el mapeo palabra→jugador sean testeables.
//
// `playerIds` mapea cada palabra del grid al `id` de catálogo del jugador, para
// la mini-bio. Resuelto por NOMBRE (los ids del catálogo están reciclados y no
// son fiables por su forma) con `scripts/gen-sopa-playerids.ts`; los homónimos
// (RONALDO=R9/CR7, ROBERTO Carlos, Fernando TORRES) se desambiguan ahí a mano.
// Palabras sin entrada (Zarra, managers, etc.) caen al heurístico por nombre.

import { searchPlayers, getPlayerById, type Player } from './players-catalog'
import { bagPick, weekOrdinal, useBagForWeek } from './content-rotation'

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

  // ── Generadas desde el catálogo ────────────────────────────────
  // scripts/gen-sopa-puzzles.ts las compone con jugadores que YA están en
  // players-catalog.ts, repartidos como un once (1 portero, 3 defensas,
  // 3 medios, 3 delanteros) para que el tema se reconozca de un vistazo.
  // Regenerables: no editar a mano, cambiar el script.
// 19 sopas generadas desde el catálogo con scripts/gen-sopa-puzzles.ts
  {
    id: 'club-milan',
    title: 'Il Diavolo',
    subtitle: 'Cracks que vistieron el rojinegro',
    size: 13,
    words: ['NAZARIO', 'VANBASTEN', 'GULLIT', 'RIVERA', 'RIVALDO', 'RONALDINHO', 'MALDINI', 'BARESI', 'NESTA', 'MAIGNAN'],
    intruder: 'DESAILLY',
    playerIds: { NAZARIO: 'ronaldo-r9', VANBASTEN: 'van-basten', GULLIT: 'gullit', RIVERA: 'rivera', RIVALDO: 'rivaldo', RONALDINHO: 'ronaldinho', MALDINI: 'maldini', BARESI: 'baresi', NESTA: 'nesta', MAIGNAN: 'maignan', DESAILLY: 'desailly' },
  },
  {
    id: 'club-internazionale',
    title: 'Nerazzurri',
    subtitle: 'Los que brillaron en el Inter',
    size: 13,
    words: ['NAZARIO', 'VIERI', 'ADRIANO', 'VIEIRA', 'PIRLO', 'BAGGIO', 'CANNAVARO', 'BLANC', 'LUCIO', 'ZENGA'],
    intruder: 'SAMUEL',
    playerIds: { NAZARIO: 'ronaldo-r9', VIERI: 'baggio-d', ADRIANO: 'ronaldo-luiz', VIEIRA: 'vieira', PIRLO: 'pirlo', BAGGIO: 'baggio', CANNAVARO: 'cannavaro', BLANC: 'blanc', LUCIO: 'lucio', ZENGA: 'gordon', SAMUEL: 'samuel' },
  },
  {
    id: 'club-chelsea',
    title: 'Orgullo de Stamford',
    subtitle: 'Leyendas del Chelsea',
    size: 13,
    words: ['ROBBEN', 'TORRES', 'SHEVCHENKO', 'LAMPARD', 'MAKELELE', 'DESCHAMPS', 'DESAILLY', 'TERRY', 'COLE', 'CECH'],
    intruder: 'IVANOVIC',
    playerIds: { ROBBEN: 'robben', TORRES: 'torres', SHEVCHENKO: 'shevchenko', LAMPARD: 'lampard', MAKELELE: 'makelele', DESCHAMPS: 'deschamps', DESAILLY: 'desailly', TERRY: 'terry', COLE: 'cole-a', CECH: 'cech', IVANOVIC: 'ivanovic' },
  },
  {
    id: 'club-manchesterunited',
    title: 'Old Trafford',
    subtitle: 'Los elegidos del United',
    size: 13,
    words: ['ROONEY', 'CANTONA', 'NISTELROOY', 'BECKHAM', 'SCHOLES', 'KEANE', 'BLANC', 'PIQUE', 'HEINZE', 'SCHMEICHEL'],
    intruder: 'VANDERSAR',
    playerIds: { ROONEY: 'rooney', CANTONA: 'cantona', NISTELROOY: 'van-nistelrooy', BECKHAM: 'beckham', SCHOLES: 'scholes', KEANE: 'keane', BLANC: 'blanc', PIQUE: 'pique', HEINZE: 'heinze', SCHMEICHEL: 'schmeichel-p', VANDERSAR: 'vansar' },
  },
  {
    id: 'club-juventus',
    title: 'La Vecchia Signora',
    subtitle: 'Historia de la Juve',
    size: 13,
    words: ['HENRY', 'VIERI', 'INZAGHI', 'PLATINI', 'ZIDANE', 'VIEIRA', 'CANNAVARO', 'THURAM', 'LUCIO', 'ZOFF'],
    intruder: 'BUFFON',
    playerIds: { HENRY: 'henry', VIERI: 'baggio-d', INZAGHI: 'inzaghi-f', PLATINI: 'platini', ZIDANE: 'zidane', VIEIRA: 'vieira', CANNAVARO: 'cannavaro', THURAM: 'thuram', LUCIO: 'lucio', ZOFF: 'zoff', BUFFON: 'buffon' },
  },
  {
    id: 'club-bayernmunich',
    title: 'Mia san mia',
    subtitle: 'Los grandes del Bayern',
    size: 13,
    words: ['MULLER', 'ROBBEN', 'KLINSMANN', 'ALONSO', 'EFFENBERG', 'BALLACK', 'BECKENBAUER', 'LUCIO', 'MATTHAUS', 'KAHN'],
    intruder: 'MAIER',
    playerIds: { MULLER: 'muller', ROBBEN: 'robben', KLINSMANN: 'klinsmann', ALONSO: 'alonso-x', EFFENBERG: 'effenberg', BALLACK: 'ballack', BECKENBAUER: 'beckenbauer', LUCIO: 'lucio', MATTHAUS: 'matthaus', KAHN: 'kahn', MAIER: 'maier' },
  },
  {
    id: 'club-arsenal',
    title: 'Gunners',
    subtitle: 'Cracks del Arsenal',
    size: 13,
    words: ['HENRY', 'BERGKAMP', 'VANPERSIE', 'VIEIRA', 'PIRES', 'PETIT', 'MERTESACKER', 'CAMPBELL', 'COLE', 'CECH'],
    intruder: 'SEAMAN',
    playerIds: { HENRY: 'henry', BERGKAMP: 'bergkamp', VANPERSIE: 'van-persie', VIEIRA: 'vieira', PIRES: 'henry-thierry', PETIT: 'petit', MERTESACKER: 'mertesacker', CAMPBELL: 'campbell', COLE: 'cole-a', CECH: 'cech', SEAMAN: 'seaman' },
  },
  {
    id: 'club-manchestercity',
    title: 'Etihad',
    subtitle: 'La era del City',
    size: 13,
    words: ['WEAH', 'TEVEZ', 'AGUERO', 'VIEIRA', 'TOURE', 'SILVA', 'MAICON', 'CANCELO', 'DIAS', 'SCHMEICHEL'],
    intruder: 'ROBINHO',
    playerIds: { WEAH: 'weah', TEVEZ: 'tevez', AGUERO: 'aguero', VIEIRA: 'vieira', TOURE: 'zambrano', SILVA: 'silva-d', MAICON: 'maicon', CANCELO: 'cancelo', DIAS: 'dias-r', SCHMEICHEL: 'schmeichel-p', ROBINHO: 'ronaldinho-2' },
  },
  {
    id: 'club-parissaintgermain',
    title: 'París es una fiesta',
    subtitle: 'Estrellas del PSG',
    size: 13,
    words: ['WEAH', 'IBRAHIMOVIC', 'PAULETA', 'RONALDINHO', 'BECKHAM', 'VERRATTI', 'RAMOS', 'HEINZE', 'SILVA', 'BUFFON'],
    intruder: 'LUIZ',
    playerIds: { WEAH: 'weah', IBRAHIMOVIC: 'ibra', PAULETA: 'ronaldo-portu', RONALDINHO: 'ronaldinho', BECKHAM: 'beckham', VERRATTI: 'verratti', RAMOS: 'sergio-ramos', HEINZE: 'heinze', SILVA: 'thiago-silva', BUFFON: 'buffon', LUIZ: 'david-luiz' },
  },
  {
    id: 'club-liverpool',
    title: 'You\'ll Never Walk Alone',
    subtitle: 'Ídolos de Anfield',
    size: 13,
    words: ['OWEN', 'MORIENTES', 'TORRES', 'GERRARD', 'ALONSO', 'ALCANTARA', 'VANDIJK', 'ARNOLD', 'ROBERTSON', 'REINA'],
    intruder: 'SUAREZ',
    playerIds: { OWEN: 'owen', MORIENTES: 'morientes', TORRES: 'torres', GERRARD: 'gerrard', ALONSO: 'alonso-x', ALCANTARA: 'thiago', VANDIJK: 'van-dijk', ARNOLD: 'taa', ROBERTSON: 'robertson', REINA: 'reina', SUAREZ: 'suarez-l' },
  },
  {
    id: 'club-atleticodemadrid',
    title: 'Nunca dejes de creer',
    subtitle: 'Cracks del Atleti',
    size: 13,
    words: ['VILLA', 'TORRES', 'VIERI', 'PARTEY', 'KOKE', 'DEPAUL', 'GIMENEZ', 'SAVIC', 'HERMOSO', 'COURTOIS'],
    intruder: 'AGUERO',
    playerIds: { VILLA: 'villa', TORRES: 'torres', VIERI: 'baggio-d', PARTEY: 'partey', KOKE: 'koke', DEPAUL: 'de-paul', GIMENEZ: 'gimenez', SAVIC: 'savic', HERMOSO: 'hermoso', COURTOIS: 'courtois', AGUERO: 'aguero' },
  },
  {
    id: 'club-realmadrid',
    title: 'Los blancos',
    subtitle: 'Leyendas del Bernabéu',
    size: 13,
    words: ['NAZARIO', 'NISTELROOY', 'ROBBEN', 'ZIDANE', 'DISTEFANO', 'PUSKAS', 'CANNAVARO', 'HIERRO', 'RAMOS', 'CASILLAS'],
    intruder: 'SALGADO',
    playerIds: { NAZARIO: 'ronaldo-r9', NISTELROOY: 'van-nistelrooy', ROBBEN: 'robben', ZIDANE: 'zidane', DISTEFANO: 'di-stefano', PUSKAS: 'puskas-f', CANNAVARO: 'cannavaro', HIERRO: 'hierro', RAMOS: 'sergio-ramos', CASILLAS: 'casillas', SALGADO: 'salgado' },
  },
  {
    id: 'club-fcbarcelona',
    title: 'Més que un club',
    subtitle: 'Historia del Camp Nou',
    size: 13,
    words: ['ROMARIO', 'NAZARIO', 'HENRY', 'CRUYFF', 'MARADONA', 'RIVALDO', 'THURAM', 'BLANC', 'PUYOL', 'ZUBIZARRETA'],
    intruder: 'VALDES',
    playerIds: { ROMARIO: 'romario', NAZARIO: 'ronaldo-r9', HENRY: 'henry', CRUYFF: 'cruyff', MARADONA: 'maradona', RIVALDO: 'rivaldo', THURAM: 'thuram', BLANC: 'blanc', PUYOL: 'puyol', ZUBIZARRETA: 'zubizarreta', VALDES: 'valdes' },
  },
  {
    id: 'pais-francia',
    title: 'Les Bleus',
    subtitle: 'Los cracks del fútbol francés',
    size: 13,
    words: ['HENRY', 'CANTONA', 'MBAPPE', 'PLATINI', 'ZIDANE', 'VIEIRA', 'THURAM', 'DESAILLY', 'BLANC', 'LLORIS'],
    intruder: 'PIRES',
    playerIds: { HENRY: 'henry', CANTONA: 'cantona', MBAPPE: 'mbappe', PLATINI: 'platini', ZIDANE: 'zidane', VIEIRA: 'vieira', THURAM: 'thuram', DESAILLY: 'desailly', BLANC: 'blanc', LLORIS: 'lloris', PIRES: 'henry-thierry' },
  },
  {
    id: 'pais-paisesbajos',
    title: 'Naranja mecánica',
    subtitle: 'Genios del fútbol neerlandés',
    size: 13,
    words: ['BERGKAMP', 'VANBASTEN', 'GULLIT', 'CRUYFF', 'DAVIDS', 'SEEDORF', 'KOEMAN', 'RIJKAARD', 'STAM', 'VANDERSAR'],
    intruder: 'SNEIJDER',
    playerIds: { BERGKAMP: 'bergkamp', VANBASTEN: 'van-basten', GULLIT: 'gullit', CRUYFF: 'cruyff', DAVIDS: 'davids', SEEDORF: 'seedorf', KOEMAN: 'koeman', RIJKAARD: 'rijkaard', STAM: 'stam', VANDERSAR: 'vansar', SNEIJDER: 'sneijder' },
  },
  {
    id: 'pais-portugal',
    title: 'A Seleção',
    subtitle: 'Los mejores portugueses',
    size: 13,
    words: ['EUSEBIO', 'PAULETA', 'RONALDO', 'FIGO', 'COSTA', 'DECO', 'PEPE', 'CARVALHO', 'COENTRAO', 'CANCELO'],
    intruder: 'DIAS',
    playerIds: { EUSEBIO: 'puskas-fwd', PAULETA: 'ronaldo-portu', RONALDO: 'ronaldo-cr7', FIGO: 'figo', COSTA: 'rui-costa', DECO: 'deco', PEPE: 'pepe', CARVALHO: 'carvalho-r', COENTRAO: 'coentrao', CANCELO: 'cancelo', DIAS: 'dias-r' },
  },
  {
    id: 'pos-def-leyendas',
    title: 'Muro por delante',
    subtitle: 'Defensas que no pasaban una',
    size: 13,
    words: ['BECKENBAUER', 'MALDINI', 'BARESI', 'CANNAVARO', 'NESTA', 'THURAM', 'DESAILLY', 'BLANC', 'PUYOL', 'HIERRO'],
    intruder: 'RAMOS',
    playerIds: { BECKENBAUER: 'beckenbauer', MALDINI: 'maldini', BARESI: 'baresi', CANNAVARO: 'cannavaro', NESTA: 'nesta', THURAM: 'thuram', DESAILLY: 'desailly', BLANC: 'blanc', PUYOL: 'puyol', HIERRO: 'hierro', RAMOS: 'sergio-ramos' },
  },
  {
    id: 'pos-mid-leyendas',
    title: 'El motor del equipo',
    subtitle: 'Centrocampistas de época',
    size: 13,
    words: ['CRUYFF', 'PLATINI', 'ZIDANE', 'MARADONA', 'PELE', 'DISTEFANO', 'PUSKAS', 'RIVERA', 'RIVELLINO', 'SOCRATES'],
    intruder: 'ZICO',
    playerIds: { CRUYFF: 'cruyff', PLATINI: 'platini', ZIDANE: 'zidane', MARADONA: 'maradona', PELE: 'pele', DISTEFANO: 'di-stefano', PUSKAS: 'puskas-f', RIVERA: 'rivera', RIVELLINO: 'rivelino', SOCRATES: 'socrates', ZICO: 'zico' },
  },
  {
    id: 'pos-fwd-leyendas',
    title: 'Puro gol',
    subtitle: 'Delanteros que marcaron una era',
    size: 13,
    words: ['EUSEBIO', 'GARRINCHA', 'MULLER', 'ROMARIO', 'NAZARIO', 'HENRY', 'SHEARER', 'OWEN', 'ROONEY', 'CANTONA'],
    intruder: 'BERGKAMP',
    playerIds: { EUSEBIO: 'puskas-fwd', GARRINCHA: 'cruyff-fwd', MULLER: 'muller', ROMARIO: 'romario', NAZARIO: 'ronaldo-r9', HENRY: 'henry', SHEARER: 'shearer', OWEN: 'owen', ROONEY: 'rooney', CANTONA: 'cantona', BERGKAMP: 'bergkamp' },
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

// ── Construcción de la cuadrícula ─────────────────────────────────
//
// Vivía dentro del componente de página, así que no había forma de comprobar en
// un test que las palabras de un puzzle CABEN de verdad. Con 31 sopas (muchas
// generadas) eso importa: una palabra que no entra desaparece en silencio.

export interface GridCell { r: number; c: number }
export interface PlacedWord { word: string; cells: GridCell[]; intruder?: boolean }
export interface BuiltGrid {
  letters: string[][]
  placed: PlacedWord[]
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],   // →
  [0, -1],  // ←
  [1, 0],   // ↓
  [-1, 0],  // ↑
  [1, 1],   // ↘
  [-1, -1], // ↖
  [1, -1],  // ↙
  [-1, 1],  // ↗
]

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** PRNG determinista por semilla (mulberry32). */
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Coloca las palabras del puzzle (y la intrusa) en una cuadrícula NxN y rellena
 * el resto con letras al azar. Determinista por `seed` → misma semilla, misma
 * sopa en web y en app.
 *
 * Las palabras que no logran encajar tras 200 intentos se quedan fuera: quien
 * consume esto debe puntuar sobre `placed`, no sobre `puzzle.words`.
 */
export function buildGrid(puzzle: Puzzle, seed: number): BuiltGrid {
  const N = puzzle.size
  const rand = mulberry32(seed)
  const letters: string[][] = Array.from({ length: N }, () => Array(N).fill(''))
  const placed: PlacedWord[] = []

  const toPlace: Array<{ word: string; intruder: boolean }> = [
    ...puzzle.words.map(w => ({ word: w, intruder: false })),
    ...(puzzle.intruder ? [{ word: puzzle.intruder, intruder: true }] : []),
  ]
  // Las largas primero: son las que menos sitios tienen.
  const sorted = toPlace.sort((a, b) => b.word.length - a.word.length)

  for (const item of sorted) {
    const { word } = item
    let placedOk = false
    for (let attempt = 0; attempt < 200 && !placedOk; attempt++) {
      const dir = DIRS[Math.floor(rand() * DIRS.length)]
      const r0 = Math.floor(rand() * N)
      const c0 = Math.floor(rand() * N)

      const cells: GridCell[] = []
      let fits = true
      for (let i = 0; i < word.length; i++) {
        const r = r0 + dir[0] * i
        const c = c0 + dir[1] * i
        if (r < 0 || r >= N || c < 0 || c >= N) { fits = false; break }
        const existing = letters[r][c]
        if (existing && existing !== word[i]) { fits = false; break }
        cells.push({ r, c })
      }
      if (!fits) continue

      for (let i = 0; i < word.length; i++) {
        letters[cells[i].r][cells[i].c] = word[i]
      }
      placed.push(item.intruder ? { word, cells, intruder: true } : { word, cells })
      placedOk = true
    }
  }

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!letters[r][c]) letters[r][c] = ALPHABET[Math.floor(rand() * 26)]
    }
  }

  return { letters, placed }
}

// ── Selección semanal ─────────────────────────────────────────────
//
// FUENTE ÚNICA de "qué sopa toca esta semana" y de su semilla de cuadrícula.
// Antes esto vivía DUPLICADO en la página (`getCurrentPuzzle` + hash del id) y
// en `/api/sopa-cracks/today`; si una de las dos cambiaba, la app y la web
// jugaban sopas distintas.

/** Sal propia de este juego (ver content-rotation). */
const ROTATION_SALT = 303

/**
 * Índice de la sopa estática de una semana ISO. Desde ROTATION_FROM_WEEK va por
 * BOLSA; antes era `semana % 13`, que repetía el mismo puzzle en la misma semana
 * todos los años y siempre en el mismo orden.
 */
export function puzzleIndexForWeek(weekISO: string): number {
  if (useBagForWeek(weekISO)) {
    return bagPick(weekOrdinal(weekISO), PUZZLES.length, ROTATION_SALT)
  }
  const weekNumber = Number(weekISO.slice(-2))
  return (Number.isFinite(weekNumber) ? weekNumber : 0) % PUZZLES.length
}

export function getWeeklyPuzzle(weekISO: string): Puzzle {
  return PUZZLES[puzzleIndexForWeek(weekISO)]
}

/** Semilla de construcción de la cuadrícula. La app la recibe tal cual desde
 *  `/api/sopa-cracks/today` y NO la recalcula. */
export function gridSeedFor(puzzleId: string, weekISO: string): number {
  let h = 0
  for (const ch of puzzleId) h = (h * 31 + ch.charCodeAt(0)) | 0
  return h + (Number(weekISO.slice(-2)) || 0)
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
