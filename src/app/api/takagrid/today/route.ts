// GET /api/takagrid/today?day=YYYY-MM-DD  (default = hoy en Madrid)
//
// Sirve el MISMO puzzle diario que juega la web (getDailyPuzzle, determinista
// por día de Madrid) ya serializado para que la app lo renderice y valide sin
// reimplementar el catálogo:
//   · puzzle.rows / cols → solo {id, label, emoji} (las funciones `test` no son
//     serializables; la validación la resuelve el server vía validAnswers).
//   · validAnswers["r,c"] → lista de playerId válidos en esa celda.
// La app pinta las cabeceras y valida la respuesta del usuario contra esa lista;
// los nombres los resuelve con /api/players/catalog (catálogo compartido).

import { NextRequest, NextResponse } from 'next/server'
import { getDailyPuzzle, getValidAnswers, PUZZLES, type GridPuzzle } from '@/lib/takagrid-puzzles'
import { madridDayISO } from '@/lib/taka-time'

export const dynamic = 'force-dynamic'

function assertDay(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

// Date a mediodía UTC del día pedido: madridParts cae en la fecha correcta sin
// arriesgar el borde de medianoche por zona horaria.
function dateForDay(day: string): Date {
  return new Date(`${day}T12:00:00Z`)
}

function serializeConds(conds: GridPuzzle['rows'] | GridPuzzle['cols']) {
  return conds.map(c => ({ id: c.id, label: c.label, emoji: c.emoji ?? null }))
}

export async function GET(req: NextRequest) {
  const param = new URL(req.url).searchParams.get('day')
  if (param !== null && !assertDay(param)) {
    return NextResponse.json({ error: 'day (YYYY-MM-DD) required' }, { status: 400 })
  }
  const day = param ?? madridDayISO()

  const { puzzle } = getDailyPuzzle(dateForDay(day))
  const index = PUZZLES.indexOf(puzzle)
  const valid = getValidAnswers(puzzle)

  const validAnswers: Record<string, string[]> = {}
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      validAnswers[`${r},${c}`] = valid[r][c].map(p => p.id)
    }
  }

  return NextResponse.json(
    {
      day,
      index,
      puzzle: { rows: serializeConds(puzzle.rows), cols: serializeConds(puzzle.cols) },
      validAnswers,
    },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } },
  )
}
