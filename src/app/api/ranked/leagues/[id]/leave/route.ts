// POST /api/ranked/leagues/[id]/leave
// → Salir de una liga. El owner no puede salir (debe eliminar la liga).

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  const { id: leagueId } = await params

  // Owner no puede salir — debe eliminar la liga
  const { data: league } = await sb
    .from('ranked_leagues')
    .select('owner_id')
    .eq('id', leagueId)
    .single()

  if (!league) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (league.owner_id === user.id) {
    return NextResponse.json(
      { error: 'owner_cannot_leave', message: 'Eres el creador. Para disolver la liga, usa "Eliminar liga".' },
      { status: 409 }
    )
  }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ error: 'server_error' }, { status: 503 })

  await admin
    .from('ranked_league_members')
    .delete()
    .eq('league_id', leagueId)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
