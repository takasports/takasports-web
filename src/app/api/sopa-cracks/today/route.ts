// GET /api/sopa-cracks/today?week=YYYY-Www  (default = semana actual de Madrid)
//
// Sirve el MISMO puzzle semanal que juega la web —lo decide `getWeeklyPuzzle`
// (sopa-puzzles.ts, fuente única para web, app y servidor)— o, si la redacción
// inyectó un featured para esa semana, ese. Además devuelve el `seed` EXACTO con
// el que la web construye la cuadrícula, para que la app la reconstruya idéntica
// con su propio buildGrid (mismo mulberry32, mismo orden de direcciones, mismo
// relleno). La app NO recalcula el seed.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { getWeeklyPuzzle, gridSeedFor, type Puzzle } from '@/lib/sopa-puzzles'
import { madridWeekISO } from '@/lib/taka-time'

export const dynamic = 'force-dynamic'

function assertWeek(s: string | null): s is string {
  return !!s && /^\d{4}-W\d{2}$/.test(s)
}

export async function GET(req: NextRequest) {
  const param = new URL(req.url).searchParams.get('week')
  if (param !== null && !assertWeek(param)) {
    return NextResponse.json({ error: 'week (YYYY-Www) required' }, { status: 400 })
  }
  const week = param ?? madridWeekISO()
  const weekNumber = Number(week.slice(-2))

  // Misma selección que juega la web (sopa-puzzles.ts es la fuente única).
  let puzzle: Puzzle = getWeeklyPuzzle(week)
  let source: 'static' | 'featured' = 'static'

  // Override editorial (si existe para esta semana).
  try {
    const admin = adminSupabase()
    if (admin) {
      const { data } = await admin
        .from('sopa_cracks_featured')
        .select('title, subtitle, size, words, intruder')
        .eq('week_iso', week)
        .maybeSingle()
      if (data && Array.isArray(data.words) && data.words.length >= 5) {
        puzzle = {
          id: `featured-${week}`,
          title: data.title,
          subtitle: data.subtitle,
          size: data.size,
          words: data.words,
          intruder: data.intruder ?? undefined,
        }
        source = 'featured'
      }
    }
  } catch {
    /* sin featured — se sirve el puzzle estático */
  }

  const seed = gridSeedFor(puzzle.id, week)

  return NextResponse.json(
    { week, weekNumber, source, puzzle, seed },
    { headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' } },
  )
}
