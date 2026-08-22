// GET /api/ranked/jornada-leaderboard?week=YYYY-MM-DD
//
// Clasificación de UNA Jornada. Sin `week`, la de la semana en curso.
//
// La tabla de Ranked era solo acumulada de toda la vida, y en un juego semanal
// eso envejece mal: a las cinco semanas quien llega nuevo no puede alcanzar a
// nadie y el líder puede dormirse. Esto es lo que permite que la semana tenga
// un ganador y que jugar hoy sirva para algo aunque empieces hoy. La acumulada
// (Liga Taka) se queda como relato de temporada.
//
// Lectura pública: los picks ya son visibles una vez cerrada la Jornada.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { thisWeekKey } from '@/components/ranked/soccer/jornada'
import { apiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/
const TOP = 10

interface Row {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  total_points: number
  hits: number
  played: number
  rank: number
}

export async function GET(req: NextRequest) {
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ weekKey: null, entries: [] })

  const asked = req.nextUrl.searchParams.get('week')
  // Se valida el formato: llega en la URL y va directo a un filtro por texto.
  const weekKey = asked && WEEK_RE.test(asked) ? asked : thisWeekKey()

  const { data, error } = await admin.rpc('get_jornada_leaderboard', {
    p_week_key: weekKey,
    p_limit:    100,
  })
  if (error) return apiError('server_error', 500)

  const rows = (data ?? []) as Row[]

  // Quién lo pide, para poder enseñarle su puesto aunque no entre en el top.
  // Sin sesión no hay `me` y la respuesta sigue siendo válida.
  let me: Row | null = null
  try {
    const { user } = await supabaseForRequest(req)
    if (user) me = rows.find(r => r.user_id === user.id) ?? null
  } catch { /* sin sesión */ }

  return NextResponse.json({
    weekKey,
    total: rows.length,
    entries: rows.slice(0, TOP).map(r => ({
      userId: r.user_id,
      name:   r.display_name,
      avatar: r.avatar_url,
      points: r.total_points,
      hits:   r.hits,
      played: r.played,
      rank:   r.rank,
    })),
    me: me && {
      userId: me.user_id,
      points: me.total_points,
      hits:   me.hits,
      played: me.played,
      rank:   me.rank,
    },
  })
}
