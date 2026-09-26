// El endpoint de estado tiene que ver la SEMANA ENTERA, resueltos incluidos.
// Si vuelve a filtrar `.neq('status', 'resolved')` antes de agrupar, dirá que una
// Jornada cerrada sigue abierta (26/09/2026). Ver jornada.test.ts.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

describe('/api/ranked/football/status', () => {
  const src = readFileSync(join(__dirname, 'route.ts'), 'utf8').replace(/\/\/.*$/gm, '')
  it('no descarta los partidos resueltos antes de calcular el cierre', () => {
    // Solo la consulta que alimenta groupIntoJornadas. Más abajo hay otra que SÍ
    // filtra resueltos, a propósito: cuenta lo pendiente de la semana liquidada.
    const i = src.indexOf("select('id, sport, competition, event_date")
    const consulta = src.slice(i, src.indexOf('.limit(', i))
    expect(i).toBeGreaterThan(0)
    expect(consulta).not.toMatch(/\.neq\(\s*'status'\s*,\s*'resolved'\s*\)/)
  })
  it('solo ofrece para pronosticar partidos de Jornadas abiertas', () => {
    expect(src).toMatch(/upcoming:\s*jornadas\s*\.filter\(j => j\.firstLockAt !== null\)/)
  })
})
