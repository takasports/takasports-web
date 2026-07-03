// GET /api/ranked/points — saldo de puntos Taka del usuario autenticado
// Devuelve { points: number | null } (null si no hay sesión o tabla aún no existe).

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return NextResponse.json({ points: null })
  }

  // Acepta cookie (web) Y Authorization: Bearer (app Expo) → antes la app,
  // que va con Bearer y sin cookie, recibía siempre points:null/no_session.
  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ points: null, reason: 'no_session' })

  const { data, error } = await sb
    .from('profiles')
    .select('points_balance')
    .eq('id', user.id)
    .single()

  if (error) return NextResponse.json({ points: null })
  return NextResponse.json({ points: (data as { points_balance?: number } | null)?.points_balance ?? 0 })
}
