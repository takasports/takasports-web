// GET /api/admin/games/funnel
//
// Devuelve el resumen 7d por juego (v_game_funnel_7d_summary). Solo
// admin (header x-admin-token = GAMES_ADMIN_TOKEN).

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'

function authOk(req: NextRequest): boolean {
  const token    = req.headers.get('x-admin-token')
  const expected = process.env.GAMES_ADMIN_TOKEN
  if (!expected) return false
  return token === expected
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 503 })

  const { data, error } = await sb.from('v_game_funnel_7d_summary').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ summary: data ?? [] })
}
