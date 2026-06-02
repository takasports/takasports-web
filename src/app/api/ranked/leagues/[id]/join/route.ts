// POST /api/ranked/leagues/[id]/join
// body: { invite_code: string }
// → Unirse a una liga privada si el código es correcto y hay hueco.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  let body: { invite_code?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const code     = typeof body.invite_code === 'string' ? body.invite_code.trim().toUpperCase() : ''
  const leagueId = params.id

  const { data: league } = await sb
    .from('ranked_leagues')
    .select('id, invite_code, max_members, type')
    .eq('id', leagueId)
    .single()

  if (!league)                                    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (league.type !== 'private')                  return NextResponse.json({ error: 'not_private' }, { status: 400 })
  if (league.invite_code !== code)                return NextResponse.json({ error: 'wrong_code', message: 'Código incorrecto.' }, { status: 400 })

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ error: 'server_error' }, { status: 503 })

  // ¿Ya es miembro?
  const { data: existing } = await admin
    .from('ranked_league_members')
    .select('league_id')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ ok: true, already_member: true })

  // ¿Hay hueco?
  const { count: memberCount } = await admin
    .from('ranked_league_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('league_id', leagueId)

  if ((memberCount ?? 0) >= league.max_members) {
    return NextResponse.json({ error: 'league_full', message: 'La liga ya está llena (máx. 15 miembros).' }, { status: 409 })
  }

  const { error } = await admin
    .from('ranked_league_members')
    .insert({ league_id: leagueId, user_id: user.id })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, joined: true }, { status: 201 })
}
