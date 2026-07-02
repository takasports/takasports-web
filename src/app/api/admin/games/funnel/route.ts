// GET /api/admin/games/funnel
//
// Devuelve el resumen 7d por juego (v_game_funnel_7d_summary). Solo
// admin (header x-admin-token = GAMES_ADMIN_TOKEN).

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/admin-auth'
import { apiError } from '@/lib/api-utils'

async function authOk(req: NextRequest): Promise<boolean> {
  return isAdminRequest(req, {
    headerName: 'x-admin-token',
    tokenEnv: process.env.GAMES_ADMIN_TOKEN,
  })
}

export async function GET(req: NextRequest) {
  if (!(await authOk(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 503 })

  const { data, error } = await sb.from('v_game_funnel_7d_summary').select('*')
  if (error) return apiError('server_error', 500)
  return NextResponse.json({ summary: data ?? [] })
}
