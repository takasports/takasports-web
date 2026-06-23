// GET /api/ranked/leagues/by-code?code=XXXX
// → Devuelve el league_id de la liga con ese invite_code (si existe).
// Requiere sesión.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  const code = new URL(req.url).searchParams.get('code')?.trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'missing_code' }, { status: 400 })

  const { data: league } = await sb
    .from('ranked_leagues')
    .select('id, name, sport, max_members')
    .eq('invite_code', code)
    .eq('type', 'private')
    .maybeSingle()

  if (!league) return NextResponse.json({ error: 'not_found', message: 'Código no encontrado. Comprueba que sea correcto.' }, { status: 404 })

  return NextResponse.json({ league_id: league.id, name: league.name, sport: league.sport })
}
