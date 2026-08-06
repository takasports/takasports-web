import { describe, it, expect } from 'vitest'
import { PUZZLES, buildGrid, findPlayerForWord, gridSeedFor, moveCursor } from './sopa-puzzles'
import { getPlayerById } from './players-catalog'

// Forma comparable: minúsculas, sin acentos, sin espacios ni signos.
function joined(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}

describe('sopa-cracks · playerIds', () => {
  it('cada id mapeado existe en el catálogo', () => {
    for (const pz of PUZZLES) {
      for (const [word, id] of Object.entries(pz.playerIds ?? {})) {
        expect(getPlayerById(id), `${pz.id}/${word} → ${id} no existe`).toBeTruthy()
      }
    }
  })

  it('el jugador mapeado corresponde a la palabra (su nombre la contiene)', () => {
    // Guarda contra erratas y falsos positivos: el nombre del jugador debe
    // contener la palabra de la sopa (comparando sin espacios/acentos).
    for (const pz of PUZZLES) {
      for (const [word, id] of Object.entries(pz.playerIds ?? {})) {
        const p = getPlayerById(id)!
        expect(
          joined(p.name).includes(joined(word)),
          `${pz.id}/${word} → "${p.name}" no contiene la palabra`,
        ).toBe(true)
      }
    }
  })

  it('solo se mapean palabras que existen en el puzzle (words o intruder)', () => {
    for (const pz of PUZZLES) {
      const valid = new Set([...pz.words, ...(pz.intruder ? [pz.intruder] : [])])
      for (const word of Object.keys(pz.playerIds ?? {})) {
        expect(valid.has(word), `${pz.id}/${word} no está en el puzzle`).toBe(true)
      }
    }
  })
})

describe('sopa-cracks · las palabras caben en la cuadrícula', () => {
  // buildGrid descarta en silencio lo que no logra colocar en 200 intentos. Con
  // 31 sopas (la mayoría generadas desde el catálogo) hay que comprobarlo: una
  // sopa a la que le falten palabras se juega "corta" sin que nadie se entere.
  it('cada puzzle coloca TODAS sus palabras, con la semilla de cualquier semana', () => {
    // La semilla depende de la semana en la que toque el puzzle, así que no
    // basta con probar una: se recorren las 53 posibles.
    for (const pz of PUZZLES) {
      for (let week = 1; week <= 53; week++) {
        const seed = gridSeedFor(pz.id, `2026-W${String(week).padStart(2, '0')}`)
        const placedWords = new Set(buildGrid(pz, seed).placed.map(p => p.word))
        for (const w of pz.words) {
          expect(placedWords.has(w), `${pz.id} (semana ${week}): "${w}" no cabe`).toBe(true)
        }
      }
    }
  })

  it('ninguna palabra excede el lado de su cuadrícula', () => {
    for (const pz of PUZZLES) {
      for (const w of [...pz.words, ...(pz.intruder ? [pz.intruder] : [])]) {
        expect(w.length, `${pz.id}: "${w}" mide más que el lado (${pz.size})`)
          .toBeLessThanOrEqual(pz.size)
        expect(/^[A-Z]+$/.test(w), `${pz.id}: "${w}" tiene caracteres no válidos`).toBe(true)
      }
    }
  })

  it('no hay palabras repetidas dentro de un puzzle', () => {
    for (const pz of PUZZLES) {
      const all = [...pz.words, ...(pz.intruder ? [pz.intruder] : [])]
      expect(new Set(all).size, `${pz.id}: palabras repetidas`).toBe(all.length)
    }
  })

  it('los ids de puzzle son únicos', () => {
    const ids = PUZZLES.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('sopa-cracks · findPlayerForWord', () => {
  it('prioriza el id explícito del puzzle sobre el heurístico (homónimos)', () => {
    const champions = PUZZLES.find(p => p.id === 'champions-goleadores')!
    const laliga = PUZZLES.find(p => p.id === 'leyendas-laliga')!
    // Mismo apellido, jugador distinto según el puzzle.
    expect(findPlayerForWord('RONALDO', champions.playerIds)?.id).toBe('ronaldo-cr7')
    expect(findPlayerForWord('RONALDO', laliga.playerIds)?.id).toBe('ronaldo-r9')
  })

  it('resuelve nombres con espacios que el heurístico no encontraba', () => {
    const italia = PUZZLES.find(p => p.id === 'italia-calcio')!
    // Sin mapa, searchPlayers('DELPIERO') no casa con "Alessandro Del Piero".
    expect(findPlayerForWord('DELPIERO')).toBeNull()
    expect(findPlayerForWord('DELPIERO', italia.playerIds)?.name).toContain('Del Piero')
  })

  it('cae al heurístico por nombre cuando no hay entrada (featured editorial)', () => {
    // Sin playerIds, un apellido inequívoco se resuelve igual por nombre.
    expect(findPlayerForWord('MALDINI')?.id).toBe('maldini')
  })
})

describe('sopa-cracks · moveCursor (teclado)', () => {
  it('desplaza una celda por flecha', () => {
    expect(moveCursor({ r: 5, c: 5 }, 'ArrowUp', 13)).toEqual({ r: 4, c: 5 })
    expect(moveCursor({ r: 5, c: 5 }, 'ArrowDown', 13)).toEqual({ r: 6, c: 5 })
    expect(moveCursor({ r: 5, c: 5 }, 'ArrowLeft', 13)).toEqual({ r: 5, c: 4 })
    expect(moveCursor({ r: 5, c: 5 }, 'ArrowRight', 13)).toEqual({ r: 5, c: 6 })
  })

  it('se mantiene dentro de los bordes (sin wrap)', () => {
    expect(moveCursor({ r: 0, c: 0 }, 'ArrowUp', 13)).toEqual({ r: 0, c: 0 })
    expect(moveCursor({ r: 0, c: 0 }, 'ArrowLeft', 13)).toEqual({ r: 0, c: 0 })
    expect(moveCursor({ r: 12, c: 12 }, 'ArrowDown', 13)).toEqual({ r: 12, c: 12 })
    expect(moveCursor({ r: 12, c: 12 }, 'ArrowRight', 13)).toEqual({ r: 12, c: 12 })
  })

  it('ignora teclas que no son flechas', () => {
    expect(moveCursor({ r: 3, c: 7 }, 'Enter', 13)).toEqual({ r: 3, c: 7 })
    expect(moveCursor({ r: 3, c: 7 }, 'a', 13)).toEqual({ r: 3, c: 7 })
  })
})
