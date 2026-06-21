// GET /api/crackquiz/today?day=YYYY-MM-DD  (default = hoy en Madrid)
//
// Sirve las MISMAS 10 preguntas del día que juega la web (getDailyQuestionsFor,
// determinista por día de Madrid) y, si la redacción inyectó una pregunta de
// "actualidad" para ese día (tabla crackquiz_featured), la antepone como Q1
// deduplicando por id — idéntico a lo que hace el cliente web. La app deja de
// barajar con Math.random y consume este orden tal cual.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { getDailyQuestionsFor, todayKey, type QuizQuestion, type QuizSport } from '@/lib/crackquiz-questions'

export const dynamic = 'force-dynamic'

// Forma de salida: la featured trae `category` libre (string), no el union
// QuizCategory, así que ensanchamos ese campo para la respuesta.
type OutQuestion = {
  id: string
  question: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  category: string
  sport: QuizSport
  difficulty: 1 | 2 | 3
}

function assertDay(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export async function GET(req: NextRequest) {
  const param = new URL(req.url).searchParams.get('day')
  if (param !== null && !assertDay(param)) {
    return NextResponse.json({ error: 'day (YYYY-MM-DD) required' }, { status: 400 })
  }
  const day = param ?? todayKey()

  const base: OutQuestion[] = getDailyQuestionsFor(day, 10)
  let questions: OutQuestion[] = base
  let featuredId: string | null = null

  // Featured (actualidad) del día — degradado si no hay admin client o fila.
  try {
    const admin = adminSupabase()
    if (admin) {
      const { data } = await admin
        .from('crackquiz_featured')
        .select('question')
        .eq('day_iso', day)
        .maybeSingle()
      const f = data?.question as
        | { id?: string; question?: string; options?: unknown; correctIndex?: number; category?: string }
        | null
        | undefined
      if (
        f && typeof f.id === 'string' &&
        Array.isArray(f.options) && f.options.length === 4 &&
        f.options.every(o => typeof o === 'string') &&
        typeof f.correctIndex === 'number' && f.correctIndex >= 0 && f.correctIndex <= 3
      ) {
        const opts = f.options as string[]
        const featured: OutQuestion = {
          id: f.id,
          question: f.question ?? '',
          options: [opts[0], opts[1], opts[2], opts[3]],
          correctIndex: f.correctIndex as 0 | 1 | 2 | 3,
          category: typeof f.category === 'string' ? f.category : 'actualidad',
          sport: 'general',
          difficulty: 1,
        }
        featuredId = featured.id
        questions = [featured, ...base.filter(q => q.id !== featured.id)].slice(0, 10)
      }
    }
  } catch {
    /* sin featured — se sirve solo el set determinista */
  }

  return NextResponse.json(
    { day, count: questions.length, featuredId, questions },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } },
  )
}
