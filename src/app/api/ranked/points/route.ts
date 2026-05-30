// GET /api/ranked/points — saldo de puntos Taka del usuario autenticado
// Devuelve { points: number | null } (null si no hay sesión o tabla aún no existe).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return NextResponse.json({ points: null })
  }

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ points: null, reason: 'no_session' })

  const { data, error } = await sb
    .from('profiles')
    .select('points_balance')
    .eq('id', user.id)
    .single()

  if (error) return NextResponse.json({ points: null })
  return NextResponse.json({ points: (data as { points_balance?: number } | null)?.points_balance ?? 0 })
}
