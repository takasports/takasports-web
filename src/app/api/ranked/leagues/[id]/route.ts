// GET    /api/ranked/leagues/[id]  → detalles de la liga + leaderboard de miembros
// DELETE /api/ranked/leagues/[id]  → eliminar liga (solo owner)

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { publicId } from '@/lib/public-id'

export const dynamic = 'force-dynamic'

function hasEnv() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasEnv()) return NextResponse.json({ error: 'no_config' }, { status: 503 })

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  const { id: leagueId } = await params

  // Verificar que el user es miembro
  const { data: membership } = await sb
    .from('ranked_league_members')
    .select('league_id')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  // Detalles de la liga
  const { data: league, error: ligaErr } = await sb
    .from('ranked_leagues')
    .select('id, name, sport, type, owner_id, max_members, invite_code, creator_slug, sponsor_name, sponsor_logo, created_at')
    .eq('id', leagueId)
    .single()

  if (ligaErr || !league) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Leaderboard vía RPC
  const { data: entries, error: lbErr } = await sb
    .rpc('ranked_league_leaderboard', { p_league_id: leagueId })

  if (lbErr) return NextResponse.json({ error: lbErr.message }, { status: 500 })

  // El leaderboard del RPC trae user_id crudo por miembro. Lo cambiamos por
  // un pid opaco (sha256) para no exponer UUIDs de auth de terceros; my_pid
  // deja al cliente marcar su propia fila ("tú") comparando pids.
  const safeLeaderboard = (entries ?? []).map((e: Record<string, unknown>) => {
    const { user_id, ...rest } = e as { user_id?: string } & Record<string, unknown>
    return { ...rest, pid: user_id ? publicId(user_id) : '' }
  })

  // No exponer owner_id crudo (UUID auth) — is_owner ya lo deriva.
  const { owner_id: leagueOwnerId, ...leagueSafe } = league as { owner_id?: string } & Record<string, unknown>
  return NextResponse.json({
    league: {
      ...leagueSafe,
      is_owner:     leagueOwnerId === user.id,
      my_pid:       publicId(user.id),
    },
    leaderboard: safeLeaderboard,
  })
}

// ── DELETE ────────────────────────────────────────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasEnv()) return NextResponse.json({ error: 'no_config' }, { status: 503 })

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  const { id: leagueId } = await params

  // Solo el owner puede eliminar
  const { data: league } = await sb
    .from('ranked_leagues')
    .select('owner_id')
    .eq('id', leagueId)
    .single()

  if (!league) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (league.owner_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ error: 'server_error' }, { status: 503 })

  // Eliminar miembros primero, luego la liga
  await admin.from('ranked_league_members').delete().eq('league_id', leagueId)
  await admin.from('ranked_leagues').delete().eq('id', leagueId)

  return NextResponse.json({ ok: true })
}
