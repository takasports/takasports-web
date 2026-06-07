import { describe, it, expect } from 'vitest'
import { BOARDS, getWeeklyChallenge } from './mionce-challenges'
import { FORMATIONS } from './mionce-formations'
import { PLAYERS_DEDUP, playerClubs, type PlayerPosition } from './players-catalog'

// ─────────────────────────────────────────────────────────────────────────────
// Solvencia de los tableros posición×club de Mi Once.
//
// Cada tablero es una formación + un club por hueco. Una celda (posición del
// hueco × club) debe tener ≥2 jugadores en el catálogo que jugaron esa posición
// en ese club (multiclub = club principal + altClubs). Así un tablero injusto o
// imposible hace fallar `npm test` en vez de llegar a producción. Regenerar con
// scripts/gen-mionce-boards.ts.
// ─────────────────────────────────────────────────────────────────────────────

const MIN_PER_CELL = 2

// coverage[posición][club] = nº de jugadores que jugaron esa posición en ese club
const cov: Record<PlayerPosition, Map<string, number>> = { GK: new Map(), DEF: new Map(), MID: new Map(), FWD: new Map() }
for (const p of PLAYERS_DEDUP) for (const c of playerClubs(p)) cov[p.position].set(c, (cov[p.position].get(c) ?? 0) + 1)

describe('mi once · tableros posición×club', () => {
  it('hay tableros y los ids son únicos', () => {
    expect(BOARDS.length).toBeGreaterThan(0)
    const ids = BOARDS.map(b => b.id)
    expect(new Set(ids).size, 'ids duplicados').toBe(ids.length)
  })

  it('cada tablero asigna un club a CADA hueco de su formación (sin huecos ni extras)', () => {
    const bad: string[] = []
    for (const b of BOARDS) {
      const slotIds = FORMATIONS[b.formation].map(s => s.id).sort()
      const clubKeys = Object.keys(b.clubs).sort()
      if (JSON.stringify(slotIds) !== JSON.stringify(clubKeys)) bad.push(`${b.id}: ${clubKeys.join(',')} ≠ ${slotIds.join(',')}`)
    }
    expect(bad, `Tableros con huecos mal cubiertos:\n  ${bad.join('\n  ')}`).toEqual([])
  })

  it('cada tablero usa 11 clubes distintos (un club por posición)', () => {
    const bad: string[] = []
    for (const b of BOARDS) {
      const clubs = Object.values(b.clubs)
      if (clubs.length !== 11 || new Set(clubs).size !== clubs.length) bad.push(`${b.id}: ${clubs.length} clubes, ${new Set(clubs).size} únicos`)
    }
    expect(bad, `Tableros con clubes repetidos o ≠11:\n  ${bad.join('\n  ')}`).toEqual([])
  })

  it(`cada celda (posición×club) tiene ≥${MIN_PER_CELL} jugadores`, () => {
    const failures: string[] = []
    for (const b of BOARDS) {
      for (const s of FORMATIONS[b.formation]) {
        const club = b.clubs[s.id]
        const count = cov[s.position].get(club) ?? 0
        if (count < MIN_PER_CELL) failures.push(`${b.id} ${s.id}(${s.position})×${club}=${count}`)
      }
    }
    expect(failures, `Celdas sin solución suficiente:\n  ${failures.join('\n  ')}`).toEqual([])
  })

  it('getWeeklyChallenge devuelve un reto con slotTags para todos los huecos', () => {
    const { challenge } = getWeeklyChallenge(new Date('2026-06-07T12:00:00Z'))
    expect(challenge.slotTags, 'slotTags').toBeDefined()
    for (const s of FORMATIONS[challenge.recommendedFormation]) {
      expect(challenge.slotTags![s.id], `falta slotTag ${s.id}`).toBeDefined()
    }
  })
})
