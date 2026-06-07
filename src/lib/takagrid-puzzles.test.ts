import { describe, it, expect } from 'vitest'
import { PUZZLES, getValidAnswers } from './takagrid-puzzles'
import { PLAYERS, PLAYERS_DEDUP } from './players-catalog'

// ─────────────────────────────────────────────────────────────────────────────
// Test de solvencia de TakaGrid (Fase 3 · 3a) + integridad del catálogo.
//
// Blinda que TakaGrid sea jugable a diario (9/9 alcanzable): mide candidatos por
// celda contra el catálogo real, así un puzzle imposible hace fallar `npm test`
// en vez de llegar a producción. (La solvencia de los tableros posición×club de
// Mi Once vive en mionce-boards.test.ts.)
// ─────────────────────────────────────────────────────────────────────────────

// Mínimo de respuestas válidas por celda de TakaGrid. ≥2 mantiene la celda justa
// (nunca un único nombre forzado) y garantiza que el 9/9 del día siempre se pueda
// completar.
const MIN_PER_CELL = 2

// Puzzles sin solución pendientes de regeneración (3d). VACÍO desde la parte 2:
// los 50 grids se regeneraron con scripts/gen-takagrid-puzzles.ts garantizando
// ≥2 candidatos por celda. La allowlist sigue como red: si alguien introduce un
// grid imposible, el test falla aquí en vez de llegar a producción.
const KNOWN_BROKEN_PUZZLES: Record<number, string> = {}

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
