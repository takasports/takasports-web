// Generador de tableros "posición × club" para Mi Once.
//
// Cada tablero = una formación + un club asignado a cada uno de los 11 huecos,
// de forma que CADA celda (posición del hueco × club) tenga ≥2 jugadores en el
// catálogo (jugó esa posición en ese club, contando multiclub = club+altClubs).
// Los 11 clubes del tablero son DISTINTOS (un club por posición). Verificado por
// backtracking. La selección usa un RNG sembrado (mulberry32) → reproducible.
//
// Uso:  npx tsx scripts/gen-mionce-boards.ts [nPorFormacion=12] [seed=42]
// Pegar la salida BOARDS en src/lib/mionce-challenges.ts. El test
// mionce-boards.test.ts blinda la solvencia (falla si una celda queda con <2).

import { PLAYERS_DEDUP, playerClubs, type PlayerPosition } from '../src/lib/players-catalog'
import { FORMATIONS, FORMATION_LIST } from '../src/lib/mionce-formations'
import type { FormationId } from '../src/lib/mionce-challenges'

const PER_FORMATION = Number(process.argv[2]) || 12
const SEED = Number(process.argv[3]) || 42
const MIN_PER_CELL = 2

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// coverage: posición -> club -> nº de jugadores que jugaron esa posición en ese club
const POSITIONS: PlayerPosition[] = ['GK', 'DEF', 'MID', 'FWD']
const cov: Record<PlayerPosition, Map<string, number>> = { GK: new Map(), DEF: new Map(), MID: new Map(), FWD: new Map() }
for (const p of PLAYERS_DEDUP) {
  for (const c of playerClubs(p)) cov[p.position].set(c, (cov[p.position].get(c) || 0) + 1)
}
const eligible: Record<PlayerPosition, string[]> = { GK: [], DEF: [], MID: [], FWD: [] }
for (const pos of POSITIONS) {
  eligible[pos] = [...cov[pos].entries()].filter(([, n]) => n >= MIN_PER_CELL).map(([c]) => c).sort()
}

console.error('Clubes elegibles por posición (≥' + MIN_PER_CELL + ' jugadores):')
for (const pos of POSITIONS) console.error(`  ${pos}: ${eligible[pos].length}`)

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Asigna clubes distintos a los huecos (backtracking), huecos ordenados por
// pool más pequeño primero (GK suele ser el cuello de botella).
function assign(formation: FormationId, rng: () => number): Record<string, string> | null {
  const slots = [...FORMATIONS[formation]].sort((a, b) => eligible[a.position].length - eligible[b.position].length)
  const used = new Set<string>()
  const out: Record<string, string> = {}
  function rec(i: number): boolean {
    if (i === slots.length) return true
    const s = slots[i]
    for (const club of shuffle(eligible[s.position], rng)) {
      if (used.has(club)) continue
      out[s.id] = club
      used.add(club)
      if (rec(i + 1)) return true
      used.delete(club)
      delete out[s.id]
    }
    return false
  }
  return rec(0) ? out : null
}

const rng = mulberry32(SEED)
const boards: { id: string; formation: FormationId; clubs: Record<string, string> }[] = []
const seen = new Set<string>()
let n = 0

for (const formation of FORMATION_LIST) {
  let made = 0
  let attempts = 0
  while (made < PER_FORMATION && attempts < PER_FORMATION * 200) {
    attempts++
    const clubs = assign(formation, rng)
    if (!clubs) break
    // firma para deduplicar tableros idénticos (mismos clubes por hueco)
    const sig = formation + '|' + Object.entries(clubs).sort().map(([k, v]) => `${k}:${v}`).join(',')
    if (seen.has(sig)) continue
    seen.add(sig)
    n++
    boards.push({ id: 'b' + String(n).padStart(2, '0'), formation, clubs })
    made++
  }
  if (made < PER_FORMATION) console.error(`⚠ ${formation}: solo ${made}/${PER_FORMATION} tableros únicos`)
}

// Verificación final: cada celda ≥2 y clubes distintos
let bad = 0
for (const b of boards) {
  const clubs = Object.values(b.clubs)
  if (new Set(clubs).size !== clubs.length) { console.error(`✗ ${b.id}: clubes repetidos`); bad++ }
  for (const s of FORMATIONS[b.formation]) {
    const club = b.clubs[s.id]
    const count = cov[s.position].get(club) || 0
    if (count < MIN_PER_CELL) { console.error(`✗ ${b.id} ${s.id}(${s.position})×${club}: ${count} jugadores`); bad++ }
  }
}
console.error(`\n${boards.length} tableros generados · ${bad} celdas/clubes inválidos`)

// Salida TS para pegar
console.log('export const BOARDS: PositionClubBoard[] = [')
for (const b of boards) {
  const slots = FORMATIONS[b.formation]
  const entries = slots.map(s => `${s.id}: '${b.clubs[s.id]}'`).join(', ')
  console.log(`  { id: '${b.id}', formation: '${b.formation}', clubs: { ${entries} } },`)
}
console.log(']')
