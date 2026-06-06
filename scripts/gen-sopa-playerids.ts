// Genera el mapa palabra→playerId para cada puzzle de Sopa de Cracks.
// Resuelve por el NOMBRE del catálogo (los ids están reciclados y NO son fiables
// por su forma: `carles-puyol`=Capdevila, `henry-thierry`=Pirès, etc.).
// Donde un apellido tiene varios homónimos en el catálogo, se desambigua a mano
// vía OVERRIDES. Pega la salida en PUZZLES de src/app/sopa-cracks/page.tsx.
//
// Uso: npx tsx scripts/gen-sopa-playerids.ts
import { PLAYERS_DEDUP, getPlayerById, type Player } from '../src/lib/players-catalog'

// Normaliza quitando acentos, signos y espacios → forma comparable "pegada".
function joined(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}
// Tokens del nombre (palabras sueltas, sin acentos ni signos).
function tokens(s: string): string[] {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean)
}

const PUZZLES: { id: string; words: string[]; intruder?: string }[] = [
  { id: 'leyendas-laliga',        words: ['MESSI','RAUL','ZIDANE','PUYOL','INIESTA','XAVI','CASILLAS','KROOS','MODRIC','RONALDO'], intruder: 'HIERRO' },
  { id: 'pichichis-historicos',   words: ['ZARRA','MESSI','CRISTIANO','BENZEMA','SUAREZ','FORLAN','VILLA','AGUERO','ETOO'], intruder: 'HIGUAIN' },
  { id: 'leyendas-mundiales',     words: ['MARADONA','PELE','CRUYFF','BECKENBAUER','PLATINI','ZICO','ROMARIO','MALDINI','BAGGIO'], intruder: 'STOICHKOV' },
  { id: 'champions-goleadores',   words: ['RONALDO','MESSI','BENZEMA','RAUL','MORIENTES','HENRY','SHEVCHENKO','INZAGHI'], intruder: 'LEWANDOWSKI' },
  { id: 'porteros-leyenda',       words: ['CASILLAS','BUFFON','NEUER','YASHIN','ZOFF','SCHMEICHEL','KAHN','SEAMAN'], intruder: 'COURTOIS' },
  { id: 'seleccion-espana',       words: ['XAVI','INIESTA','VILLA','CASILLAS','PUYOL','TORRES','BUSQUETS','FABREGAS','RAMOS'], intruder: 'PIQUE' },
  { id: 'crack-premier',          words: ['HENRY','BERGKAMP','GERRARD','LAMPARD','SCHOLES','SHEARER','GIGGS','BECKHAM'], intruder: 'KEANE' },
  { id: 'generacion-argentina',   words: ['MARADONA','MESSI','BATISTUTA','CANIGGIA','RIQUELME','TEVEZ','AGUERO','VERON'], intruder: 'ZANETTI' },
  { id: 'entrenadores-historia',  words: ['MOURINHO','ANCELOTTI','GUARDIOLA','FERGUSON','CAPELLO','CRUYFF','MICHELS','SACCHI'], intruder: 'BIELSA' },
  { id: 'brasil-magico',          words: ['PELE','RONALDO','RONALDINHO','ZICO','ROMARIO','CAFU','ROBERTO','RIVALDO'], intruder: 'NEYMAR' },
  { id: 'bundesliga-cracks',      words: ['MULLER','BECKENBAUER','RUMMENIGGE','ROBBEN','RIBERY','LEWANDOWSKI','NEUER','KAHN'], intruder: 'REUS' },
  { id: 'italia-calcio',          words: ['MALDINI','BUFFON','TOTTI','DELPIERO','BAGGIO','BARESI','ZOLA','PIRLO'], intruder: 'VIERI' },
]

// Desambiguación manual: apellidos con varios homónimos en el catálogo.
const OVERRIDES: Record<string, Record<string, string>> = {
  'leyendas-laliga':      { RONALDO: 'ronaldo-r9' },   // contexto LaLiga galáctica → Nazário
  'champions-goleadores': { RONALDO: 'ronaldo-cr7' },  // máx. goleador histórico de Champions → Cristiano
  'brasil-magico':        { RONALDO: 'ronaldo-r9', ROBERTO: 'roberto-carlos' },
  'seleccion-espana':     { TORRES: 'torres' },         // Fernando Torres (no Ferran)
}

// Falsos positivos por subcadena: la palabra es un entrenador/jugador que NO está
// en el catálogo, pero "encaja" dentro del nombre de otro. Mejor sin bio que errónea.
const SKIP: Record<string, string[]> = {
  'entrenadores-historia': ['MICHELS'],   // Rinus Michels ≠ Míchel Salgado
}

function resolve(word: string): Player[] {
  const w = joined(word)
  const exactTok: Player[] = []
  const joinedEq: Player[] = []
  const sub: Player[] = []
  for (const p of PLAYERS_DEDUP) {
    if (tokens(p.name).includes(w)) exactTok.push(p)
    else if (joined(p.name) === w) joinedEq.push(p)
    else if (joined(p.name).includes(w)) sub.push(p)
  }
  if (exactTok.length) return exactTok
  if (joinedEq.length) return joinedEq
  return sub
}

let totalWarns = 0
for (const pz of PUZZLES) {
  const map: Record<string, string> = {}
  const warns: string[] = []
  const all = [...pz.words, ...(pz.intruder ? [pz.intruder] : [])]
  for (const w of all) {
    if (SKIP[pz.id]?.includes(w)) { warns.push(`${w}: SKIP (sin bio, falso positivo)`); continue }
    const ov = OVERRIDES[pz.id]?.[w]
    if (ov) {
      const p = getPlayerById(ov)
      if (!p) warns.push(`OVERRIDE ${w}→${ov} NO EXISTE`)
      else map[w] = ov
      continue
    }
    const cands = resolve(w)
    if (cands.length === 0) { warns.push(`${w}: sin match (sin bio)`); continue }
    if (cands.length > 1) { warns.push(`${w}: AMBIGUO → ${cands.map(c => `${c.id}:${c.name}`).join(' | ')}`); continue }
    map[w] = cands[0].id
  }
  const entries = Object.entries(map).map(([k, v]) => `${k}: '${v}'`).join(', ')
  console.log(`\n// ${pz.id}  (${Object.keys(map).length}/${all.length} con bio)`)
  console.log(`    playerIds: { ${entries} },`)
  if (warns.length) { totalWarns += warns.length; console.log(`    // ⚠ ${warns.join('  ;;  ')}`) }
}
console.log(`\n// total avisos: ${totalWarns}`)
