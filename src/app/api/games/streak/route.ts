// POST /api/games/streak — incrementa la racha diaria global (vía RPC)
// GET  /api/games/streak — lee la racha del usuario actual
//
// La racha global cuenta cualquier juego: si juegas hoy, la racha se mantiene.
// Llamar al POST al completar cualquier partida (idempotente para el mismo día).
//
// Milestone bonuses (idempotentes por user+streak+date) — escala baja Liga Taka:
//   3 días  → +3 pts  |  7 días → +5 pts
//   14 días → +8 pts  |  30 días → +12 pts

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { awardBadges } from '@/lib/badge-awards'

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// Días de racha → puntos bonus
const STREAK_MILESTONES: Record<number, number> = {
  3:  3,
  7:  5,
  14: 8,
  30: 12,
}

export async function POST() {
  if (!hasSupabaseEnv()) return NextResponse.json({ streak: null })

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ streak: null, reason: 'no_session' })

  const { data, error } = await sb.rpc('ping_game_streak')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Milestone bonus points ────────────────────────────────────────
  // El importe es SERVER-autoritativo: lo decide `current_streak` (que calcula
  // ping_game_streak desde game_streaks vía auth.uid()) contra el mapa fijo, NUNCA
  // el cliente. La ESCRITURA va con service_role (admin), no con el cliente del
  // usuario: así point_transactions y increment_points_balance se pueden cerrar a
  // inserción/llamada directa del cliente (RLS + grants) sin que nadie se infle puntos.
  const admin = adminSupabase()
  let milestoneAwarded = 0
  const streakData = data as { current_streak: number; last_played_date: string } | null
  if (streakData && admin) {
    const { current_streak, last_played_date } = streakData
    const bonusPoints = STREAK_MILESTONES[current_streak]

    if (bonusPoints && last_played_date) {
      // Idempotencia a nivel DB: UNIQUE INDEX parcial
      // (user_id, context->>'streak', context->>'date') WHERE source='streak_milestone'.
      // Un segundo request simultáneo da 23505 (unique_violation) → no se duplica.
      const { error: txnErr } = await admin.from('point_transactions').insert({
        user_id: user.id,
        amount:  bonusPoints,
        source:  'streak_milestone',
        sport:   'all',
        context: { streak: current_streak, date: last_played_date },
      })

      if (!txnErr) {
        // Fila insertada → acreditar el balance (atómico, mismo importe)
        const { error: rpcErr } = await admin.rpc('increment_points_balance', {
          p_user_id: user.id,
          p_amount:  bonusPoints,
        })
        // Solo informamos milestone_awarded si el balance realmente se incrementó.
        // Si el RPC falla, la txn queda registrada pero el balance no — se
        // reconcilia en el siguiente ping (la txn idempotente no se duplica).
        if (!rpcErr) milestoneAwarded = bonusPoints
      }
      // 23505 → ya acreditado (idempotente, silencioso). Otros errores: best-effort.
    }
  }

  // ── Milestone badge awards ────────────────────────────────────────
  if (milestoneAwarded > 0 && streakData && admin) {
    try {
      const { current_streak } = streakData
      const badgeMap: Record<number, string> = { 3: 'racha_dias_3', 7: 'racha_dias_7', 14: 'racha_dias_14', 30: 'racha_dias_30' }
      const badgeId = badgeMap[current_streak]
      if (badgeId) await awardBadges(admin, user.id, [badgeId])
    } catch { /* badge fallo — silencioso */ }
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
