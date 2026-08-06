// GET /api/crackquiz/today?day=YYYY-MM-DD  (default = hoy en Madrid)
//
// Sirve las MISMAS 10 preguntas del día que juega la web y, si la redacción
// inyectó una pregunta de "actualidad" para ese día (tabla crackquiz_featured),
// la antepone como Q1 deduplicando por id.
//
// La composición de la ronda vive en @/lib/crackquiz-day (fuente única): la
// comparten este endpoint (lo que juega la app), la derivación de score del
// servidor y el heatmap social. Si divergieran, la app jugaría un set y el
// servidor puntuaría contra otro.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { composeDailyRound, normalizeFeatured } from '@/lib/crackquiz-day'
import { todayKey } from '@/lib/crackquiz-questions'
import { CRACKQUIZ } from '@/lib/game-scoring'

export const dynamic = 'force-dynamic'

function assertDay(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export async function GET(req: NextRequest) {
  const param = new URL(req.url).searchParams.get('day')
  if (param !== null && !assertDay(param)) {
    return NextResponse.json({ error: 'day (YYYY-MM-DD) required' }, { status: 400 })
  }
  const day = param ?? todayKey()

  // Featured (actualidad) del día — degradado si no hay admin client o fila.
  let featured = null
  try {
    const admin = adminSupabase()
    if (admin) {
      const { data } = await admin
        .from('crackquiz_featured')
        .select('question')
        .eq('day_iso', day)
        .maybeSingle()
      featured = normalizeFeatured(data?.question ?? null)
    }
  } catch {
    /* sin featured — se sirve solo el set determinista */
  }

  const { questions, featuredId } = composeDailyRound(day, featured)

  return NextResponse.json(
    {
      day,
      count: questions.length,
      featuredId,
      questions,
      // Reglas de la ronda: la app las usa para montar SU cronómetro y su
      // marcador con la misma fórmula que el servidor (no las hardcodea).
      rules: {
        questionTime:   CRACKQUIZ.QUESTION_TIME,
        basePoints:     CRACKQUIZ.BASE_PTS,
        timeBonusMax:   CRACKQUIZ.TIME_BONUS_MAX,
        streakBonusMax: CRACKQUIZ.STREAK_BONUS_MAX,
      },
    },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } },
  )
}
