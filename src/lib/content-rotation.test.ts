import { describe, it, expect } from 'vitest'
import { bagDraw, bagPick, dayOrdinal, weekOrdinal, useBagForDay, useBagForWeek } from './content-rotation'

/** Máxima ventana sin repeticiones que garantiza la bolsa. */
const window = (size: number) => Math.floor(size / 2)

describe('bagPick — un elemento por fecha', () => {
  it.each([50, 48, 13, 27])(
    'no repite nada dentro de una ventana de size/2 fechas (size=%i)',
    (SIZE) => {
      const start = dayOrdinal('2026-01-01')
      const seq = Array.from({ length: SIZE * 6 }, (_, i) => bagPick(start + i, SIZE))
      const w = window(SIZE)
      for (let i = 0; i < seq.length - w; i++) {
        expect(new Set(seq.slice(i, i + w)).size).toBe(w)
      }
    },
  )

  it('a la larga sale TODO el catálogo, sin favoritos', () => {
    const SIZE = 50
    const start = dayOrdinal('2026-08-07')
    const counts = new Map<number, number>()
    for (let i = 0; i < SIZE * 10; i++) {
      const idx = bagPick(start + i, SIZE)
      counts.set(idx, (counts.get(idx) ?? 0) + 1)
    }
    expect(counts.size).toBe(SIZE)
    // Cada elemento sale ~10 veces: reparto plano, no un dado con suerte.
    for (const c of counts.values()) {
      expect(c).toBeGreaterThanOrEqual(9)
      expect(c).toBeLessThanOrEqual(11)
    }
  })

  it('rebaraja: dos vueltas seguidas no salen en el mismo orden', () => {
    const SIZE = 48
    const start = dayOrdinal('2026-08-07')
    const v1 = Array.from({ length: SIZE }, (_, i) => bagPick(start + i, SIZE))
    const v2 = Array.from({ length: SIZE }, (_, i) => bagPick(start + SIZE + i, SIZE))
    expect(v1).not.toEqual(v2)
  })

  it('mejora de verdad sobre el dado sembrado que había antes', () => {
    // Fórmula vieja: índice independiente por fecha (con reposición).
    const SIZE = 50
    const legacy = (seed: number) => {
      let t = (seed + 0x6D2B79F5) | 0
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * SIZE)
    }
    const days = 90
    const start = dayOrdinal('2026-08-07')
    const oldSeq: number[] = []
    const newSeq: number[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date((start + i) * 86400000)
      oldSeq.push(legacy(d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()))
      newSeq.push(bagPick(start + i, SIZE))
    }
    // En 90 días la vieja gastaba menos catálogo y repetía puzzles varias veces.
    expect(new Set(newSeq).size).toBeGreaterThan(new Set(oldSeq).size)
    const maxRepeats = (s: number[]) => {
      const c = new Map<number, number>()
      s.forEach(x => c.set(x, (c.get(x) ?? 0) + 1))
      return Math.max(...c.values())
    }
    expect(maxRepeats(newSeq)).toBeLessThan(maxRepeats(oldSeq))
  })

  it('es determinista: la misma fecha da siempre lo mismo', () => {
    const o = dayOrdinal('2026-09-15')
    expect(bagPick(o, 50)).toBe(bagPick(o, 50))
  })

  it('bolsas con distinta sal no van sincronizadas', () => {
    const o = dayOrdinal('2026-08-07')
    const a = Array.from({ length: 20 }, (_, i) => bagPick(o + i, 30, 0))
    const b = Array.from({ length: 20 }, (_, i) => bagPick(o + i, 30, 7))
    expect(a).not.toEqual(b)
  })
})

describe('bagDraw — varios elementos por fecha', () => {
  it('devuelve N distintos y no repite en una ventana de size/2 extracciones', () => {
    const SIZE = 62
    const COUNT = 2
    const start = dayOrdinal('2026-08-07')
    const days = 200
    const flat: number[] = []
    for (let i = 0; i < days; i++) {
      const draw = bagDraw(start + i, COUNT, SIZE)
      expect(draw).toHaveLength(COUNT)
      expect(new Set(draw).size).toBe(COUNT)   // sin repetidos en la misma fecha
      flat.push(...draw)
    }
    const w = Math.floor(SIZE / 2)
    for (let i = 0; i < flat.length - w; i++) {
      expect(new Set(flat.slice(i, i + w)).size).toBe(w)
    }
  })

  it('índices siempre dentro de rango', () => {
    for (let i = 0; i < 200; i++) {
      for (const idx of bagDraw(i, 3, 27, 4)) {
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThan(27)
      }
    }
  })

  it('si se piden más elementos que el tamaño, devuelve la bolsa entera', () => {
    expect(bagDraw(5, 10, 4)).toEqual([0, 1, 2, 3])
  })

  it('tolera tamaños degenerados', () => {
    expect(bagDraw(3, 2, 0)).toEqual([])
    expect(bagDraw(3, 0, 10)).toEqual([])
    expect(bagPick(3, 1)).toBe(0)
  })
})

describe('ordinales de fecha', () => {
  it('días consecutivos son ordinales consecutivos', () => {
    expect(dayOrdinal('2026-08-07') - dayOrdinal('2026-08-06')).toBe(1)
    expect(dayOrdinal('2027-01-01') - dayOrdinal('2026-12-31')).toBe(1)
  })

  it('semanas consecutivas son ordinales consecutivos, incluso al cambiar de año', () => {
    expect(weekOrdinal('2026-W33') - weekOrdinal('2026-W32')).toBe(1)
    // 2026 tiene 53 semanas ISO: la W53 enlaza con la W01 de 2027.
    expect(weekOrdinal('2027-W01') - weekOrdinal('2026-W53')).toBe(1)
  })

  it('formatos inválidos no revientan', () => {
    expect(dayOrdinal('nope')).toBe(0)
    expect(weekOrdinal('2026-33')).toBe(0)
  })
})

describe('corte de migración', () => {
  it('las fechas anteriores al corte conservan la fórmula vieja', () => {
    expect(useBagForDay('2026-08-06')).toBe(false)
    expect(useBagForDay('2026-08-07')).toBe(false)   // día del despliegue
    expect(useBagForDay('2026-08-08')).toBe(true)
    expect(useBagForDay('2027-03-01')).toBe(true)
    expect(useBagForWeek('2026-W32')).toBe(false)    // semana en curso
    expect(useBagForWeek('2026-W33')).toBe(true)
  })
})
