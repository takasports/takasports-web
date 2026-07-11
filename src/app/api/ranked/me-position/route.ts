// GET /api/ranked/me-position?sport=global
//
// Rank del usuario AUTENTICADO en la Liga Taka (para la barra "tu posición" de
// /liga-taka). Requiere sesión (cookie). Si el usuario aún no tiene puntos,
// devuelve { rank: null }. No cacheado (per-user).
//
// Con la base de usuarios actual, top-200 cubre a todos; buscamos al usuario en
// la clasificación global (get_ranked_leaderboard, SECURITY DEFINER vía admin)
// y devolvemos su rank/total/nivel + el total de usuarios rankeados.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { publicId } from '@/lib/public-id'
import { fetchLevelsByUser } from '@/lib/level-progression'

export const dynamic = 'force-dynamic'

interface LbRow { user_id: string; total_points: number; rank: number }

export async function GET(req: NextRequest) {
  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return NextResponse.json({ rank: null })
  }

  const sport = new URL(req.url).searchParams.get('sport') ?? 'global'
  const { user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ rank: null, reason: 'no_session' })

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ rank: null })

  const { data, error } = await admin.rpc('get_ranked_leaderboard', {
    p_sport: sport === 'global' ? null : sport,
    p_limit: 200,
  })
  if (error) return NextResponse.json({ rank: null })

  const rows = (data as LbRow[] ?? [])
  const mine = rows.find(r => r.user_id === user.id)
  if (!mine) {
    // Sin puntos todavía: devolvemos el pid para que el cliente sepa que es él.
    return NextResponse.json(
      { rank: null, pid: publicId(user.id), of: rows.length },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const levels = await fetchLevelsByUser(admin, [user.id])
  const lvl = levels.get(user.id)

  return NextResponse.json(
    {
      rank:      mine.rank,
      total:     mine.total_points,
      pid:       publicId(user.id),
      level:     lvl?.level ?? 1,
      levelName: lvl?.levelName ?? 'Novato',
      of:        rows.length,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
