import { describe, it, expect } from 'vitest'
import { PUZZLES, getValidAnswers } from './takagrid-puzzles'
import { CHALLENGES, type FormationId } from './mionce-challenges'
import { PLAYERS, PLAYERS_DEDUP, type PlayerPosition } from './players-catalog'

// ─────────────────────────────────────────────────────────────────────────────
// Test de solvencia (Fase 3 · 3a).
//
// Blinda que TakaGrid sea jugable a diario (9/9 alcanzable) y que los retos
// tagged de Mi Once tengan solución. Mide candidatos por celda/slot contra el
// catálogo real, así un puzzle imposible (o un reto roto) hace fallar `npm test`
// en vez de llegar a producción.
// ─────────────────────────────────────────────────────────────────────────────

// Mínimo de respuestas válidas por celda de TakaGrid. ≥2 mantiene la celda justa
// (nunca un único nombre forzado) y garantiza que el 9/9 del día siempre se pueda
// completar.
const MIN_PER_CELL = 2

// Slot → posición de cada formación de Mi Once (espejo de FORMATIONS en
// src/app/mionce/page.tsx). Los retos tagged bloquean la formación en
// `recommendedFormation`, así que la posición de cada slot es fija.
const FORMATION_POSITIONS: Record<FormationId, Record<string, PlayerPosition>> = {
  '4-3-3': { gk: 'GK', lb: 'DEF', cb1: 'DEF', cb2: 'DEF', rb: 'DEF', cm1: 'MID', cm2: 'MID', cm3: 'MID', lw: 'FWD', st: 'FWD', rw: 'FWD' },
  '4-4-2': { gk: 'GK', lb: 'DEF', cb1: 'DEF', cb2: 'DEF', rb: 'DEF', lm: 'MID', cm1: 'MID', cm2: 'MID', rm: 'MID', st1: 'FWD', st2: 'FWD' },
  '3-5-2': { gk: 'GK', cb1: 'DEF', cb2: 'DEF', cb3: 'DEF', lwb: 'MID', cm1: 'MID', cm2: 'MID', cm3: 'MID', rwb: 'MID', st1: 'FWD', st2: 'FWD' },
  '4-2-3-1': { gk: 'GK', lb: 'DEF', cb1: 'DEF', cb2: 'DEF', rb: 'DEF', dm1: 'MID', dm2: 'MID', lam: 'MID', cam: 'MID', ram: 'MID', st: 'FWD' },
}

// Puzzles sin solución pendientes de regeneración (3d). VACÍO desde la parte 2:
// los 50 grids se regeneraron con scripts/gen-takagrid-puzzles.ts garantizando
// ≥2 candidatos por celda. La allowlist sigue como red: si alguien introduce un
// grid imposible, el test falla aquí en vez de llegar a producción.
const KNOWN_BROKEN_PUZZLES: Record<number, string> = {}

// Retos tagged de Mi Once sin solución. VACÍO: `laliga-posicion` se retiró de la
// rotación en 3f (catálogo sin jugadores de Sevilla/Deportivo/Espanyol ni MID del
// Athletic). Si un reto tagged queda sin solución, el test lo caza aquí.
const KNOWN_BROKEN_CHALLENGES: Record<string, string> = {}

// ── Integridad del catálogo ──────────────────────────────────────────────────

describe('players-catalog · integridad', () => {
  it('no tiene ids duplicados', () => {
    const counts = new Map<string, number>()
    for (const p of PLAYERS) counts.set(p.id, (counts.get(p.id) ?? 0) + 1)
    const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([id, n]) => `${id}×${n}`)
    expect(dups, `IDs duplicados: ${dups.join(', ')}`).toEqual([])
  })

  it('no tiene a la misma persona dos veces (por nombre)', () => {
    const byName = new Map<string, string[]>()
    for (const p of PLAYERS_DEDUP) {
      const key = p.name.toLowerCase().trim()
      byName.set(key, [...(byName.get(key) ?? []), p.id])
    }
    const dups = [...byName.entries()].filter(([, ids]) => ids.length > 1).map(([name, ids]) => `${name} (${ids.join(', ')})`)
    expect(dups, `Personas duplicadas: ${dups.join(' · ')}`).toEqual([])
  })

  it('todo jugador tiene club no vacío', () => {
    const bad = PLAYERS_DEDUP.filter(p => !p.club || !p.club.trim()).map(p => p.id)
    expect(bad, `Sin club: ${bad.join(', ')}`).toEqual([])
  })
})

// ── Solvencia de TakaGrid ────────────────────────────────────────────────────

describe('takagrid · solvencia de los 50 puzzles', () => {
  it(`cada celda tiene ≥${MIN_PER_CELL} respuestas válidas`, () => {
    const realFailures: string[] = []
    const tolerated: string[] = []
    const fixedButListed: number[] = []

    PUZZLES.forEach((puzzle, idx) => {
      const grid = getValidAnswers(puzzle)
      const cellMsgs: string[] = []
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const n = grid[r][c].length
          if (n < MIN_PER_CELL) {
            cellMsgs.push(`[${puzzle.rows[r].label} × ${puzzle.cols[c].label}]=${n}`)
          }
        }
      }
      if (cellMsgs.length > 0) {
        const line = `#${idx} ${cellMsgs.join(' ')}`
        if (idx in KNOWN_BROKEN_PUZZLES) tolerated.push(line)
        else realFailures.push(line)
      } else if (idx in KNOWN_BROKEN_PUZZLES) {
        fixedButListed.push(idx)
      }
    })

    if (tolerated.length) console.warn(`\n⚠️  Puzzles rotos pendientes de 3d (${tolerated.length}):\n  ${tolerated.join('\n  ')}`)

    expect(
      fixedButListed,
      `Estos puzzles ya tienen solución: quítalos de KNOWN_BROKEN_PUZZLES → ${fixedButListed.join(', ')}`,
    ).toEqual([])
    expect(
      realFailures,
      `Puzzles sin solución (no listados):\n  ${realFailures.join('\n  ')}`,
    ).toEqual([])
  })
})

// ── Solvencia de los retos tagged de Mi Once ─────────────────────────────────

describe('mi once · solvencia de los retos por slot', () => {
  const tagged = CHALLENGES.filter(c => c.slotTags)

  it('cada slot de cada reto tagged tiene ≥1 candidato', () => {
    const realFailures: string[] = []
    const tolerated: string[] = []
    const fixedButListed: string[] = []

    for (const ch of tagged) {
      const posMap = FORMATION_POSITIONS[ch.recommendedFormation]
      const slotMsgs: string[] = []
      for (const [slotId, tag] of Object.entries(ch.slotTags!)) {
        const position = posMap[slotId]
        const candidates = PLAYERS_DEDUP.filter(
          p => p.position === position && tag.match(p) && (ch.filter ? ch.filter(p) : true),
        )
        if (candidates.length < 1) slotMsgs.push(`${slotId}(${tag.label})=0`)
      }
      if (slotMsgs.length > 0) {
        const line = `${ch.id}: ${slotMsgs.join(' ')}`
        if (ch.id in KNOWN_BROKEN_CHALLENGES) tolerated.push(line)
        else realFailures.push(line)
      } else if (ch.id in KNOWN_BROKEN_CHALLENGES) {
        fixedButListed.push(ch.id)
      }
    }

    if (tolerated.length) console.warn(`\n⚠️  Retos Mi Once rotos pendientes (${tolerated.length}):\n  ${tolerated.join('\n  ')}`)

    expect(
      fixedButListed,
      `Estos retos ya tienen solución: quítalos de KNOWN_BROKEN_CHALLENGES → ${fixedButListed.join(', ')}`,
    ).toEqual([])
    expect(
      realFailures,
      `Retos sin solución (no listados):\n  ${realFailures.join('\n  ')}`,
    ).toEqual([])
  })
})
