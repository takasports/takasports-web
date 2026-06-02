// GET /api/ranked/leagues/creators
// → Devuelve todas las ligas de tipo 'creator', con conteo de miembros.
// Ruta pública — no requiere sesión para listar.
// Con sesión devuelve además is_member para cada liga.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sb    = await createServerSupabaseClient()
  const admin = adminSupabase()

  // Sesión opcional
  const { data: { user } } = await sb.auth.getUser()

  const { data: leagues, error } = await sb
    .from('ranked_leagues')
    .select('id, name, sport, creator_slug, sponsor_name, sponsor_logo, max_members, created_at')
    .eq('type', 'creator')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!leagues?.length) return NextResponse.json({ leagues: [] })

  // Para cada liga: contar miembros + saber si el user ya es miembro
  const leagueIds = leagues.map((l: { id: string }) => l.id)

  const [memberCountRows, myMemberships] = await Promise.all([
    admin
      ? admin
          .from('ranked_league_members')
          .select('league_id')
          .in('league_id', leagueIds)
      : Promise.resolve({ data: [] }),
    user && admin
      ? admin
          .from('ranked_league_members')
          .select('league_id')
          .eq('user_id', user.id)
          .in('league_id', leagueIds)
      : Promise.resolve({ data: [] }),
  ])

  // Contar por liga
  const countMap: Record<string, number> = {}
  for (const row of (memberCountRows.data ?? [])) {
    const r = row as { league_id: string }
    countMap[r.league_id] = (countMap[r.league_id] ?? 0) + 1
  }

  const mySet = new Set(
    (myMemberships.data ?? []).map((r: { league_id: string }) => r.league_id)
  )

  const result = leagues.map((l: Record<string, unknown>) => ({
    ...l,
    member_count: countMap[l.id as string] ?? 0,
    is_member:    mySet.has(l.id as string),
  }))

  return NextResponse.json({ leagues: result })
}
