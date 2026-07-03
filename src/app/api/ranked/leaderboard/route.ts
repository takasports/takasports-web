// GET /api/ranked/leaderboard?sport=mundial&limit=50
// Ranking de usuarios por puntos acumulados en un deporte.
// Público — no requiere auth.
//
// Usa la función SQL get_ranked_leaderboard() que hace GROUP BY en Postgres,
// evitando traer todas las filas de point_transactions a memoria JS.
//
// Incluye badges (hasta 3 por user) y equipment activo (badge/title/frame/
// card_bg) para que el ranking sea visualmente expresivo y aproveche todo el
// sistema de personalización.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { fetchEquipmentByUser, type UserEquipment } from '@/lib/equipment'
import { fetchBadgesByUser, type LeaderboardBadge } from '@/lib/leaderboard-badges'
import { fetchLevelsByUser } from '@/lib/level-progression'
import { publicId } from '@/lib/public-id'

export const dynamic = 'force-dynamic'

interface LeaderboardEntry {
  user_id:      string
  display_name: string | null
  avatar_url:   string | null
  total_points: number   // nombre de la columna SQL; se expone como 'total' en la respuesta JSON
  rank:         number
}

/** Reduce UserEquipment a forma serializable (9 slots) para el cliente.
 *  Compatible con LeaderboardEquipment (4 legacy) + slots nuevos para que
 *  PlacaRowV3 pueda construir la placa completa. */
function serializeEquipment(eq: UserEquipment | undefined): Record<string, unknown> | undefined {
  if (!eq) return undefined
  const out: Record<string, unknown> = {}
  if (eq.badge)   out.badge   = { emoji: eq.badge.emoji, color: eq.badge.color, bg: eq.badge.bg, name: eq.badge.name }
  if (eq.title)   out.title   = { text:  eq.title.text,  color: eq.title.color }
  if (eq.frame)   out.frame   = { color: eq.frame.color }
  if (eq.card_bg) out.card_bg = { gradient: eq.card_bg.gradient }
  if (eq.avatar_frame)       out.avatar_frame       = eq.avatar_frame
  if (eq.name_effect)        out.name_effect        = eq.name_effect
  if (eq.corner_sticker)     out.corner_sticker     = eq.corner_sticker
  if (eq.signature_stat)     out.signature_stat     = eq.signature_stat
  if (eq.background_pattern) out.background_pattern = eq.background_pattern
  return Object.keys(out).length > 0 ? out : undefined
}

export async function GET(req: NextRequest) {
  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return NextResponse.json({ entries: [] })
  }

  const { searchParams } = new URL(req.url)
  const sport = searchParams.get('sport') ?? 'mundial'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  const sb = await createServerSupabaseClient()
  // El leaderboard se lee con el cliente de servicio (service_role) para poder
  // revocar el acceso público al RPC get_ranked_leaderboard (que devuelve
  // user_id crudo) sin dejar el ranking en blanco a los visitantes anónimos.
  // Sin service role (dev local) cae al cliente normal.
  const admin = adminSupabase()
  const lbClient = admin ?? sb

  // has_live: hay algún evento en estado 'closed' (en curso). En 'global' el
  // ranking mezcla TODOS los deportes, así que el check NO debe filtrar por
  // 'mundial' (antes un UFC en directo no disparaba el auto-refresh del cliente);
  // sin filtro de deporte = cualquier evento en curso vale.
  const liveBase = sb.from('ranked_events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'closed')
  const liveQuery = sport === 'global' ? liveBase : liveBase.eq('sport', sport)

  // Leaderboard + check de partidos en curso (para auto-refresh del cliente)
  const [lbResult, liveResult] = await Promise.all([
    lbClient.rpc('get_ranked_leaderboard', {
      p_sport: sport === 'global' ? null : sport,
      p_limit: limit,
    }),
    liveQuery,
  ])

  if (lbResult.error) return NextResponse.json({ error: 'server_error' }, { status: 500 })

  const rows = (lbResult.data as LeaderboardEntry[] ?? [])
  const userIds = rows.map(r => r.user_id).filter((u): u is string => !!u)

  // Fetch badges + equipment en paralelo. Si no hay admin client (env sin
  // service role), devolvemos los rows sin enriquecer — la UI tiene fallback.
  const [badgesByUser, equipByUser, levelsByUser] = await Promise.all([
    fetchBadgesByUser(admin, userIds, 3),
    admin ? fetchEquipmentByUser(admin, userIds) : Promise.resolve(new Map<string, UserEquipment>()),
    admin ? fetchLevelsByUser(admin, userIds)    : Promise.resolve(new Map<string, { level: number; levelName: string; xp: number }>()),
  ])

  const entries = rows.map((e, i) => {
    const equipment = serializeEquipment(equipByUser.get(e.user_id))
    const badges: LeaderboardBadge[] = badgesByUser.get(e.user_id) ?? []
    const lvl = levelsByUser.get(e.user_id)
    return {
      pid:          e.user_id ? publicId(e.user_id) : '',
      display_name: e.display_name,
      avatar_url:   e.avatar_url,
      total:        e.total_points,
      rank:         e.rank ?? i + 1,
      level:        lvl?.level ?? 1,
      levelName:    lvl?.levelName ?? 'Novato',
      badges:       badges.length > 0 ? badges : undefined,
      equipment,
    }
  })

  const has_live = (liveResult.count ?? 0) > 0

  return NextResponse.json({ entries, has_live }, {
    // Si hay partidos en curso, no cachear (datos cambian rápido).
    // En reposo: 2 min de cache + stale-while-revalidate.
    headers: {
      'Cache-Control': has_live
        ? 'no-store'
        : 'public, s-maxage=120, stale-while-revalidate=300',
    },
  })
}
