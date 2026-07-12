// GET/POST /api/cron/crackquiz-featured — T7·1
//
// Productor de la "pregunta de actualidad" (Q1) de CrackQuiz. Lee un artículo
// reciente de Sanity, genera una MCQ con Gemini (flash-lite) y la guarda en
// crackquiz_featured para el día de hoy (Madrid). El juego ya la consume como
// primera pregunta con el badge "Actualidad".
//
// Pensado para:
//   - Vercel Cron (schedule en vercel.json; envía Authorization: Bearer <CRON_SECRET>)
//   - manual:  curl -H "x-cron-secret: $CRON_SECRET" https://.../api/cron/crackquiz-featured
//   - prueba en seco (genera pero NO escribe):  ?dry=1
//   - regenerar la de hoy:  ?force=1
//
// Auth: header `x-cron-secret` o `Authorization: Bearer <CRON_SECRET>`.
// Idempotente: si ya hay pregunta para hoy y no se fuerza, no regenera (ahorra
// llamadas al LLM). Coste ~$0 (gemini flash-lite). No otorga puntos.

import { NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { adminSupabase } from '@/lib/supabase-admin'
import { generateFeaturedQuestion } from '@/lib/crackquiz-featured-gen'
import { todayKey } from '@/lib/crackquiz-questions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dry = url.searchParams.get('dry') === '1'
  const force = url.searchParams.get('force') === '1'
  const day = todayKey()

  const admin = adminSupabase()
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'admin client unavailable' }, { status: 503 })
  }

  // Idempotencia: si ya existe la pregunta de hoy y no se fuerza, no regeneramos.
  if (!dry && !force) {
    const { data: existing } = await admin
      .from('crackquiz_featured')
      .select('day_iso')
      .eq('day_iso', day)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ ok: true, day, generated: false, reason: 'already_exists' })
    }
  }

  const result = await generateFeaturedQuestion(day)
  if (!result) {
    return NextResponse.json({ ok: true, day, generated: false, reason: 'no_valid_question' })
  }

  if (dry) {
    return NextResponse.json({ ok: true, day, dry: true, question: result.question, source: result.source })
  }

  const { error } = await admin
    .from('crackquiz_featured')
    .upsert({ day_iso: day, question: result.question }, { onConflict: 'day_iso' })
  if (error) {
    return NextResponse.json({ ok: false, day, error: 'db_write_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, day, generated: true, question: result.question, source: result.source })
}

export async function GET(req: Request) {
  return handle(req)
}
export async function POST(req: Request) {
  return handle(req)
}
