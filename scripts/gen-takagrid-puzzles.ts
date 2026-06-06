/**
 * Generador de puzzles TakaGrid (Fase 3 · 3d).
 *
 * Construye grids 3×3 (rows = 3 clubes, cols = 3 atributos país/grupo/posición/era)
 * GARANTIZANDO que cada una de las 9 celdas tiene >= MIN candidatos en el catálogo
 * real. Selección greedy con variedad: balancea uso de clubes/ligas, mezcla tipos
 * de columna y prefiere celdas ricas. Determinista (mulberry32) → reproducible.
 *
 * Uso: npx tsx scripts/gen-takagrid-puzzles.ts [N]   (N = nº de puzzles, def 50)
 * Imprime el cuerpo del array PUZZLES listo para pegar + histogramas de control.
 */
import { C } from '../src/lib/takagrid-puzzles'
import { PLAYERS_DEDUP } from '../src/lib/players-catalog'

const TARGET = Number(process.argv[2] ?? 50)
const PHASE1 = Number(process.argv[3] ?? 38) // cuántos puzzles exigen celdas ≥3

const CLUBS = [
  'realMadrid', 'barcelona', 'atletico', 'valenciaClub', 'villarreal', 'athletic', 'realSociedad', 'sevilla',
  'manUtd', 'manCity', 'liverpool', 'arsenal', 'chelsea', 'tottenham',
  'juventus', 'milan', 'inter', 'roma', 'napoli',
  'bayern', 'dortmund', 'leverkusen', 'psg',
] as const

const ATTRS = [
  'spain', 'argentina', 'brasil', 'france', 'germany', 'italy', 'england', 'portugal', 'netherlands', 'croatia',
  'belgium', 'uruguay', 'colombia', 'serbia',
  'southAmerica', 'iberia', 'latin', 'africa', 'northEurope', 'eastEurope',
  'gk', 'def', 'mid', 'fwd',
  'historic', 'current',
] as const

const ATTR_TYPE: Record<string, 'C' | 'G' | 'P' | 'E'> = {}
;['spain', 'argentina', 'brasil', 'france', 'germany', 'italy', 'england', 'portugal', 'netherlands', 'croatia', 'belgium', 'uruguay', 'colombia', 'serbia'].forEach(a => (ATTR_TYPE[a] = 'C'))
;['southAmerica', 'iberia', 'latin', 'africa', 'northEurope', 'eastEurope'].forEach(a => (ATTR_TYPE[a] = 'G'))
;['gk', 'def', 'mid', 'fwd'].forEach(a => (ATTR_TYPE[a] = 'P'))
;['historic', 'current'].forEach(a => (ATTR_TYPE[a] = 'E'))

const LEAGUE: Record<string, string> = {
  realMadrid: 'ESP', barcelona: 'ESP', atletico: 'ESP', valenciaClub: 'ESP', villarreal: 'ESP', athletic: 'ESP', realSociedad: 'ESP', sevilla: 'ESP',
  manUtd: 'ENG', manCity: 'ENG', liverpool: 'ENG', arsenal: 'ENG', chelsea: 'ENG', tottenham: 'ENG',
  juventus: 'ITA', milan: 'ITA', inter: 'ITA', roma: 'ITA', napoli: 'ITA',
  bayern: 'GER', dortmund: 'GER', leverkusen: 'GER', psg: 'FRA',
}

type Cond = { test: (p: any) => boolean }
const cond = (k: string): Cond => (C as Record<string, Cond>)[k]

// ── Matriz de conteo club × atributo ────────────────────────────────────────
const M: Record<string, Record<string, number>> = {}
for (const c of CLUBS) {
  M[c] = {}
  for (const a of ATTRS) {
    let n = 0
    for (const p of PLAYERS_DEDUP) if (cond(c).test(p) && cond(a).test(p)) n++
    M[c][a] = n
  }
}

// ── RNG determinista ────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20260606)
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── Tripletas válidas (compat = clubes con todas las attrs ≥2) ──────────────
type Triple = { tri: string[]; types: string; compat: string[] }
const triples: Triple[] = []
for (let i = 0; i < ATTRS.length; i++)
  for (let j = i + 1; j < ATTRS.length; j++)
    for (let k = j + 1; k < ATTRS.length; k++) {
      const tri = [ATTRS[i], ATTRS[j], ATTRS[k]]
      // Evita columnas redundantes: no 3 grupos, no era+era (solo hay 2 eras).
      const nG = tri.filter(a => ATTR_TYPE[a] === 'G').length
      const nE = tri.filter(a => ATTR_TYPE[a] === 'E').length
      const nP = tri.filter(a => ATTR_TYPE[a] === 'P').length
      if (nG >= 2 || nE >= 2 || nP >= 3) continue
      const compat = CLUBS.filter(c => tri.every(a => M[c][a] >= 2))
      if (compat.length >= 3) triples.push({ tri, types: tri.map(a => ATTR_TYPE[a]).sort().join(''), compat })
    }
shuffle(triples)

// ── Selección greedy en dos fases ───────────────────────────────────────────
// Fase 1: celdas ricas (≥3). Fase 2: rellena con clubes "finos" (tope
// estructural de 2/celda) para que estén presentes en la rotación.
const THIN = ['villarreal', 'leverkusen', 'dortmund']
const clubUse: Record<string, number> = Object.fromEntries(CLUBS.map(c => [c, 0]))
const typeUse: Record<string, number> = {}
const attrUse: Record<string, number> = {} // tripleta de columnas exacta
type Sel = { tri: string[]; pick: string[]; minCell: number; types: string }
const selected: Sel[] = []
const seen = new Set<string>()

function chooseClubs(cc: string[], mustThin: boolean): string[] {
  const pool = [...cc].sort((a, b) => clubUse[a] - clubUse[b] || rng() - 0.5)
  const pick: string[] = []
  if (mustThin) {
    const thin = pool.find(c => THIN.includes(c))
    if (!thin) return []
    pick.push(thin)
  }
  const leagues = new Set(pick.map(c => LEAGUE[c]))
  for (const c of pool) {
    if (pick.includes(c)) continue
    if (!leagues.has(LEAGUE[c])) { pick.push(c); leagues.add(LEAGUE[c]) }
    if (pick.length === 3) break
  }
  if (pick.length < 3) for (const c of pool) { if (!pick.includes(c)) pick.push(c); if (pick.length === 3) break }
  return pick.length === 3 ? pick : []
}

function runPhase(floor: number, target: number, mustThin: boolean) {
  let guard = 0
  while (selected.length < target && guard++ < 200000) {
    let best: Sel | null = null, bestScore = -1e9, bestKey = ''
    for (const t of triples) {
      const cc = t.compat.filter(c => t.tri.every(a => M[c][a] >= floor))
      if (cc.length < 3) continue
      const pick = chooseClubs(cc, mustThin)
      if (!pick.length) continue
      const attrKey = [...t.tri].sort().join(',')
      const key = [...pick].sort().join(',') + '|' + attrKey
      if (seen.has(key)) continue
      const minCell = Math.min(...pick.flatMap(c => t.tri.map(a => M[c][a])))
      const score = -pick.reduce((s, c) => s + clubUse[c], 0) - (typeUse[t.types] || 0) * 1.0 - (attrUse[attrKey] || 0) * 2.0 + Math.min(minCell, 5) * 0.4 + rng() * 0.25
      if (score > bestScore) { bestScore = score; best = { tri: t.tri, pick, minCell, types: t.types }; bestKey = key }
    }
    if (!best) break
    const ak = [...best.tri].sort().join(',')
    selected.push(best); best.pick.forEach(c => clubUse[c]++); typeUse[best.types] = (typeUse[best.types] || 0) + 1; attrUse[ak] = (attrUse[ak] || 0) + 1; seen.add(bestKey)
  }
}

runPhase(3, Math.min(PHASE1, TARGET), false) // grueso con celdas ≥3
runPhase(2, TARGET, true)                     // rellena featuring clubes finos
runPhase(2, TARGET, false)                    // completa si quedara hueco

// ── Salida ──────────────────────────────────────────────────────────────────
// Orden de columnas legible: país(es) → grupo → posición → era.
const COL_ORDER: Record<string, number> = { C: 0, G: 1, P: 2, E: 3 }
const label = (k: string) => (C as Record<string, { label: string }>)[k].label
function fmtPuzzle(s: Sel, idx: number): string {
  const cols = [...s.tri].sort((a, b) => COL_ORDER[ATTR_TYPE[a]] - COL_ORDER[ATTR_TYPE[b]])
  const rowL = s.pick.map(label).join(' · ')
  const colL = cols.map(label).join(' · ')
  return `  // ${idx} — ${rowL}  ×  ${colL}  (min ${s.minCell})\n  { rows: [C.${s.pick[0]}, C.${s.pick[1]}, C.${s.pick[2]}], cols: [C.${cols[0]}, C.${cols[1]}, C.${cols[2]}] },`
}

console.log('export const PUZZLES: GridPuzzle[] = [')
selected.forEach((s, i) => console.log(fmtPuzzle(s, i)))
console.log(']')

console.error(`\n── Generados ${selected.length}/${TARGET} ──`)
console.error('Uso por club:', CLUBS.map(c => `${c}:${clubUse[c]}`).join('  '))
console.error('Uso por tipo de columnas:', Object.entries(typeUse).sort().map(([k, v]) => `${k}:${v}`).join('  '))
const minHist: Record<number, number> = {}
selected.forEach(s => (minHist[s.minCell] = (minHist[s.minCell] || 0) + 1))
console.error('Histograma de min-celda:', Object.entries(minHist).sort((a, b) => +a[0] - +b[0]).map(([k, v]) => `${k}→${v}`).join('  '))
const neverUsed = CLUBS.filter(c => clubUse[c] === 0)
if (neverUsed.length) console.error('⚠️  Clubes sin usar:', neverUsed.join(', '))
