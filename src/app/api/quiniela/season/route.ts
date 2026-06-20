// Bonus questions de larga duración (campeón, pichichi, descenso…)
// GET  → lista de preguntas activas + tu respuesta si estás logueado
// POST → guarda/actualiza tu respuesta a una pregunta (solo si no ha cerrado)

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { readJson } from '@/lib/api-utils'
import { captureException } from '@/lib/monitoring'

interface SeasonQuestion {
  id: string
  competition: string
  season: string
  question: string
  options: Array<{ value: string; label: string; logo?: string }>
  closes_at: string
  resolved: string | null
}

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ questions: [], mine: {}, authed: false })
  }
  const sb = await createServerSupabaseClient()
  const { data: questions, error } = await sb
    .from('quiniela_season_questions')
    .select('*')
    .order('closes_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { user } } = await sb.auth.getUser()
  let mine: Record<string, string> = {}
  if (user) {
    const { data: preds } = await sb
      .from('quiniela_season_predictions')
      .select('question_id, answer')
      .eq('user_id', user.id)
    if (preds) mine = Object.fromEntries(preds.map(p => [p.question_id, p.answer]))
  }

  return NextResponse.json({
    questions: questions ?? [],
    mine,
    authed: !!user,
  })
}

export async function POST(req: NextRequest) {
  const parsed = await readJson<{ questionId?: string; answer?: string }>(req)
  if ('error' in parsed) return parsed.error
  const { questionId, answer } = parsed.data
  try {
    if (!questionId || !answer) return NextResponse.json({ error: 'questionId and answer required' }, { status: 400 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'supabase not configured' }, { status: 503 })
    }
    const sb = await createServerSupabaseClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

    const { data: q } = await sb
      .from('quiniela_season_questions').select('*').eq('id', questionId).maybeSingle()
    if (!q) return NextResponse.json({ error: 'question not found' }, { status: 404 })
    const question = q as SeasonQuestion
    if (new Date(question.closes_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'question closed' }, { status: 403 })
    }
    if (question.resolved) {
      return NextResponse.json({ error: 'question resolved' }, { status: 403 })
    }
    if (!question.options.some(o => o.value === answer)) {
      return NextResponse.json({ error: 'invalid answer' }, { status: 400 })
    }

    const { error } = await sb.from('quiniela_season_predictions').upsert({
      user_id: user.id,
      question_id: questionId,
      answer,
    }, { onConflict: 'user_id,question_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    captureException(e, { route: 'quiniela/season' })
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
