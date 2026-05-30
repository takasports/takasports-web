// POST /api/games/streak — incrementa la racha diaria global (vía RPC)
// GET  /api/games/streak — lee la racha del usuario actual
//
// La racha global cuenta cualquier juego: si juegas hoy, la racha se mantiene.
// Llamar al POST al completar cualquier partida (idempotente para el mismo día).
//
// Milestone bonuses (idempotentes por user+streak+date):
//   3 días  → +5 pts  |  7 días → +10 pts
//   14 días → +20 pts |  30 días → +50 pts

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// Días de racha → puntos bonus
const STREAK_MILESTONES: Record<number, number> = {
  3:  5,
  7:  10,
  14: 20,
  30: 50,
}

export async function POST() {
  if (!hasSupabaseEnv()) return NextResponse.json({ streak: null })

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ streak: null, reason: 'no_session' })

  const { data, error } = await sb.rpc('ping_game_streak')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Milestone bonus points ────────────────────────────────────────
  let milestoneAwarded = 0
  const streakData = data as { current_streak: number; last_played_date: string } | null
  if (streakData) {
    const { current_streak, last_played_date } = streakData
    const bonusPoints = STREAK_MILESTONES[current_streak]

    if (bonusPoints && last_played_date) {
      // Un UNIQUE INDEX parcial en point_transactions garantiza idempotencia a
      // nivel DB: (user_id, context->>'streak', context->>'date') WHERE source='streak_milestone'.
      // Si dos requests simultáneos llegan, solo uno insertará — el otro obtendrá
      // un error 23505 (unique_violation) que capturamos para no acreditar dos veces.
      const { error: txnErr } = await sb.from('point_transactions').insert({
        user_id: user.id,
        amount:  bonusPoints,
        source:  'streak_milestone',
        sport:   'all',
        context: { streak: current_streak, date: last_played_date },
      })

      if (!txnErr) {
        // Fila insertada → acreditar puntos atómicamente
        const { error: rpcErr } = await sb.rpc('increment_points_balance', {
          p_user_id: user.id,
          p_amount:  bonusPoints,
        })
        // Solo informamos milestone_awarded si el balance realmente se incrementó.
        // Si el RPC falla, la transacción en point_transactions queda registrada
        // pero los puntos no se acreditaron — se detecta en el siguiente ping.
        if (!rpcErr) milestoneAwarded = bonusPoints
      }
      // Si txnErr.code === '23505' → ya acreditado (idempotente, silencioso)
      // Cualquier otro error se ignora (milestone es best-effort)
    }
  }

  return NextResponse.json({ streak: data, milestone_awarded: milestoneAwarded })
}

export async function GET() {
  if (!hasSupabaseEnv()) return NextResponse.json({ streak: null })

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ streak: null, reason: 'no_session' })

  const { data, error } = await sb
    .from('game_streaks')
    .select('current_streak, best_streak, last_played_date, total_plays, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ streak: data })
}
