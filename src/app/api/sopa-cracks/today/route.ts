// GET /api/sopa-cracks/today?week=YYYY-Www  (default = semana actual de Madrid)
//
// Sirve el MISMO puzzle semanal que juega la web: el estático PUZZLES[week % len]
// o, si la redacción inyectó un featured para esa semana, ese. Además devuelve el
// `seed` EXACTO que usa la web (hash31(puzzle.id) + nº de semana) para que la app
// reconstruya la cuadrícula idéntica con su propio buildGrid (mismo mulberry32,
// mismo orden de direcciones, mismo relleno). La app NO recalcula el seed.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { PUZZLES, type Puzzle } from '@/lib/sopa-puzzles'
import { madridWeekISO } from '@/lib/taka-time'

export const dynamic = 'force-dynamic'

function assertWeek(s: string | null): s is string {
  return !!s && /^\d{4}-W\d{2}$/.test(s)
}

// Igual que en el cliente web (sopa-cracks/page.tsx): hash de 31 del id.
function hash31(id: string): number {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return h
}

export async function GET(req: NextRequest) {
  const param = new URL(req.url).searchParams.get('week')
  if (param !== null && !assertWeek(param)) {
    return NextResponse.json({ error: 'week (YYYY-Www) required' }, { status: 400 })
  }
  const week = param ?? madridWeekISO()
  const weekNumber = Number(week.slice(-2))

  let puzzle: Puzzle = PUZZLES[weekNumber % PUZZLES.length]
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

  const seed = hash31(puzzle.id) + weekNumber

  return NextResponse.json(
    { week, weekNumber, source, puzzle, seed },
    { headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' } },
  )
}
