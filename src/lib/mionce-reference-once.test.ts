import { describe, it, expect } from 'vitest'
import { BOARDS, boardToChallenge } from './mionce-challenges'
import { computeReferenceForChallenge } from './mionce-reference-once'
import { FORMATIONS } from './mionce-formations'
import { getPlayerById, playerClubs } from './players-catalog'

// El once de referencia (fallback algorítmico del once editorial) debe ser, para
// CADA tablero: completo (11 huecos), sin repetir jugador, y con cada pick
// cumpliendo la posición de la formación y el club del slot. Misma garantía de
// solvencia que mionce-boards.test.ts, pero sobre la alineación concreta elegida.
describe('mionce — once de referencia', () => {
  for (const board of BOARDS) {
    it(`${board.id}: completo, sin repetir y válido`, () => {
      const ref = computeReferenceForChallenge(boardToChallenge(board))
      expect(ref).not.toBeNull()
      if (!ref) return

      expect(ref.formation).toBe(board.formation)

      const slotDefs = FORMATIONS[board.formation]
      const ids = Object.values(ref.slots)

      // 11 huecos rellenos
      expect(Object.keys(ref.slots).length).toBe(slotDefs.length)
      // sin repetir jugador
      expect(new Set(ids).size).toBe(ids.length)

      for (const slot of slotDefs) {
        const pid = ref.slots[slot.id]
        expect(pid, `hueco ${slot.id} vacío`).toBeTruthy()
        const p = getPlayerById(pid)
        expect(p, `jugador ${pid} no existe`).toBeTruthy()
        if (!p) continue
        expect(p.position, `${p.name}: posición ${p.position} ≠ ${slot.position} (${slot.id})`).toBe(slot.position)
        const club = board.clubs[slot.id]
        expect(playerClubs(p).includes(club), `${p.name} no jugó en ${club} (${slot.id})`).toBe(true)
      }
    })
  }
})
