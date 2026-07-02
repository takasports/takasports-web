// POST /api/ranked/leagues/[id]/join
// body (privadas): { invite_code: string }
// body (creadores): {} — sin código, acceso libre
//
// Las ligas type='creator' son de acceso abierto (sin código).
// Las ligas type='private' requieren invite_code correcto.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { apiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  let body: { invite_code?: unknown } = {}
  try { body = await req.json() } catch { /* body vacío es OK para creator */ }

  const { id: leagueId } = await params

  const { data: league } = await sb
    .from('ranked_leagues')
    .select('id, invite_code, max_members, type')
    .eq('id', leagueId)
    .single()

  if (!league) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Validar código solo en ligas privadas
  if (league.type === 'private') {
    const code = typeof body.invite_code === 'string' ? body.invite_code.trim().toUpperCase() : ''
    if (league.invite_code !== code) {
      return NextResponse.json({ error: 'wrong_code', message: 'Código incorrecto.' }, { status: 400 })
    }
  }
  // Las ligas de tipo 'creator' son acceso libre — no requieren código

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ error: 'server_error' }, { status: 503 })

  // Alta ATÓMICA: la RPC bloquea la fila de la liga y hace "comprobar aforo +
  // insertar" en una sola transacción, cerrando la carrera TOCTOU por la que
  // dos peticiones simultáneas podían superar max_members. La validación del
  // invite_code (arriba) sigue en la ruta; la RPC está bloqueada a service_role.
  const { data: result, error } = await admin.rpc('join_ranked_league', {
    p_league_id: leagueId,
    p_user_id:   user.id,
  })

  if (error) return apiError('server_error', 500)

  const status = (result as { status?: string } | null)?.status
  if (status === 'already_member') return NextResponse.json({ ok: true, already_member: true })
  if (status === 'not_found')      return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (status === 'full') {
    return NextResponse.json({
      error: 'league_full',
      message: `La liga ya está llena (máx. ${league.max_members} miembros).`,
    }, { status: 409 })
  }

  // status === 'joined'
  return NextResponse.json({ ok: true, joined: true }, { status: 201 })
}
