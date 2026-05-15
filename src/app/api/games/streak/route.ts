// POST /api/games/streak — incrementa la racha diaria global (vía RPC)
// GET  /api/games/streak — lee la racha del usuario actual
//
// La racha global cuenta cualquier juego: si juegas hoy, la racha se mantiene.
// Llamar al POST al completar cualquier partida (idempotente para el mismo día).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function POST() {
  if (!hasSupabaseEnv()) return NextResponse.json({ streak: null })

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ streak: null, reason: 'no_session' })

  const { data, error } = await sb.rpc('ping_game_streak')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ streak: data })
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
