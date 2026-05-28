// POST /api/quiniela/season/resolve
//
// Resuelve una pregunta del torneo (campeón, bota de oro, etc.) y
// acredita monedas a los acertantes. Restringido a admin (header
// X-Admin-Secret) — el cron-like endpoint que crea/resuelve preguntas
// debe vivir aparte del flujo del user.
//
// Body:
//   { questionId: string, winner: string, adminSecret: string }
//
// Flow:
//   1. Valida admin secret (PUSH_BROADCAST_SECRET reusado por simplicidad).
//   2. Lee la pregunta. Si ya está resolved, devuelve 200 sin re-acreditar.
//   3. Marca question.resolved = winner.
//   4. Lee todas las predictions de esa pregunta con answer=winner AND
//      prize_credited=false (idempotencia).
//   5. Para cada acertante: add_coins(prize_coins, reason, context).
//   6. Marca prize_credited=true en cada prediction acreditada.
//   7. Si es del torneo Mundial Y todas las preguntas del tournament
//      ya están resolved, scan badges: cada user con ≥3 aciertos
//      recibe el badge "profeta_mundial_2026".
//
// Idempotencia:
//   · La pregunta solo se marca resolved una vez.
//   · prize_credited evita doble crédito si se reintenta.
//   · Badge usa upsert por (user_id, badge_id).

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { safeEqual } from '@/lib/auth-utils'

interface ResolveBody {
  questionId: string
  winner: string
}

const PROFETA_BADGE_THRESHOLD = 3
const PROFETA_BADGE_ID = 'profeta_mundial_2026'

export async function POST(req: NextRequest) {
  const required = process.env.PUSH_BROADCAST_SECRET
  if (!required) {
    return NextResponse.json({ error: 'admin endpoint not configured' }, { status: 503 })
  }

  let body: ResolveBody
  try {
    body = await req.json() as ResolveBody
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  // Solo header `x-admin-secret`. El fallback a body.adminSecret fue eliminado:
  // los cuerpos JSON pueden quedar en logs de observabilidad/proxies APM.
  const provided = req.headers.get('x-admin-secret') ?? ''
  if (!safeEqual(provided, required)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!body.questionId || !body.winner) {
    return NextResponse.json({ error: 'questionId and winner required' }, { status: 400 })
  }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ error: 'no_supabase' }, { status: 503 })

  // 1. Leer pregunta
  const { data: q, error: qErr } = await admin
    .from('quiniela_season_questions')
    .select('id, question, prize_coins, resolved, tournament, options')
    .eq('id', body.questionId)
    .maybeSingle()
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
  if (!q) return NextResponse.json({ error: 'question not found' }, { status: 404 })

  // 2. Validar winner contra options
  const options = (q.options as { value: string; label: string }[]) ?? []
  const winnerOption = options.find(o => o.value === body.winner)
  if (!winnerOption) {
    return NextResponse.json({ error: 'winner not in options' }, { status: 400 })
  }

  // 3. Si ya está resolved con el mismo winner, idempotente — re-acreditar
  // a los nuevos predictors si los hubo (poco probable post-resolve, pero
  // por completitud).
  if (q.resolved && q.resolved !== body.winner) {
    return NextResponse.json(
      { error: 'already_resolved_with_different_winner', currentWinner: q.resolved },
      { status: 409 },
    )
  }

  // Marcar resolved (idempotente)
  if (!q.resolved) {
    const { error: updErr } = await admin
      .from('quiniela_season_questions')
      .update({ resolved: body.winner })
      .eq('id', body.questionId)
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }
  }

  // 4. Lee predictions acertantes sin acreditar
  const { data: winners, error: pErr } = await admin
    .from('quiniela_season_predictions')
    .select('user_id, prize_credited')
    .eq('question_id', body.questionId)
    .eq('answer', body.winner)
    .eq('prize_credited', false)
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const prize = q.prize_coins as number
  const reason = `Predicción acertada: ${q.question} → ${winnerOption.label}`
  let credited = 0
  let creditFailed = 0

  // 5. Acreditar uno por uno (no podemos usar RPC para múltiples users
  // porque add_coins solo opera sobre auth.uid()). Service role no
  // dispara RPC con auth.uid; usamos insert directo en quiniela_coin_txns
  // (lo permite la tabla porque admin bypasses RLS).
  if (prize > 0 && winners && winners.length > 0) {
    for (const w of winners) {
      const { error: insErr } = await admin
        .from('quiniela_coin_txns')
        .insert({
          user_id: w.user_id,
          amount: prize,
          reason,
          context: {
            source: 'season_question',
            question_id: body.questionId,
            tournament: q.tournament,
            answer: body.winner,
          },
        })
      if (insErr) { creditFailed += 1; continue }
      // Marcar prize_credited
      await admin
        .from('quiniela_season_predictions')
        .update({ prize_credited: true })
        .eq('user_id', w.user_id)
        .eq('question_id', body.questionId)
      credited += 1
    }
  }

  // 6. Badge "Profeta": solo si esta pregunta pertenece al Mundial y
  // hay torneo definido. Hacemos scan de usuarios con ≥3 aciertos
  // en preguntas del mismo tournament. Idempotente (badges upsert).
  let badgesGranted = 0
  if (q.tournament === 'mundial2026') {
    // Lee todas las preguntas resueltas del tournament
    const { data: tournamentQs } = await admin
      .from('quiniela_season_questions')
      .select('id, resolved')
      .eq('tournament', q.tournament)
      .not('resolved', 'is', null)
    const resolvedIds = (tournamentQs ?? []).map(t => t.id as string)
    const resolvedAnswers = new Map<string, string>()
    for (const t of tournamentQs ?? []) {
      if (t.resolved) resolvedAnswers.set(t.id as string, t.resolved as string)
    }

    if (resolvedIds.length > 0) {
      // Lee todas las predicciones del torneo
      const { data: allPreds } = await admin
        .from('quiniela_season_predictions')
        .select('user_id, question_id, answer')
        .in('question_id', resolvedIds)

      // Cuenta aciertos por user
      const hitsByUser = new Map<string, number>()
      for (const p of allPreds ?? []) {
        const winner = resolvedAnswers.get(p.question_id as string)
        if (winner && p.answer === winner) {
          const uid = p.user_id as string
          hitsByUser.set(uid, (hitsByUser.get(uid) ?? 0) + 1)
        }
      }

      // Insertar badge a los que califican (idempotente vía upsert por PK)
      const eligibleUsers = [...hitsByUser.entries()]
        .filter(([, h]) => h >= PROFETA_BADGE_THRESHOLD)
        .map(([uid]) => uid)
      for (const uid of eligibleUsers) {
        const { error: badgeErr } = await admin
          .from('quiniela_badges')
          .upsert({ user_id: uid, badge_id: PROFETA_BADGE_ID }, { onConflict: 'user_id,badge_id' })
        if (!badgeErr) badgesGranted += 1
      }
    }
  }

  return NextResponse.json({
    ok: true,
    questionId: body.questionId,
    winner: body.winner,
    prize,
    credited,
    creditFailed,
    badgesGranted,
  })
}
