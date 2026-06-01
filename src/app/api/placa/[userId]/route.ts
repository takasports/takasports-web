// GET /api/placa/[userId]
//
// Devuelve toda la data necesaria para renderizar la PlacaCardV3
// de cualquier usuario. Público, sin auth.
//
// Estructura:
//   {
//     displayName, handle, avatarUrl,
//     level, levelName, xp,
//     equipment: ApiEquipment,     // hidratado, listo para adapter
//     badges:    LeaderboardBadge[],
//     liveStats: { xp, ... },
//   }
//
// Cache: 60s public + SWR 300s. Los datos del placa cambian con la
// frecuencia de los settles, no en tiempo real, así que el cache
// CDN ahorra muchos hits a Postgres.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { fetchUserEquipment } from '@/lib/equipment'
import { fetchBadgesByUser } from '@/lib/leaderboard-badges'
import { computeLevel, XP_PER_BADGE } from '@/lib/levels'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  if (!userId) {
    return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
  }

  const admin = adminSupabase()
  if (!admin) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  // ── Lecturas en paralelo ─────────────────────────────────────
  const [
    profileRes,
    ptRes,
    badgeCountRes,
    badgesByUser,
    equipment,
    predictionsRes,
    plenoCountRes,
    streakRes,
  ] = await Promise.all([
    admin.from('profiles').select('display_name, avatar_url').eq('id', userId).maybeSingle(),
    admin.from('point_transactions').select('amount').eq('user_id', userId).gt('amount', 0),
    admin.from('quiniela_badges').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    fetchBadgesByUser(admin, [userId], 5),
    fetchUserEquipment(admin, userId),
    admin.from('ranked_predictions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('quiniela_badges').select('*', { count: 'exact', head: true })
      .eq('user_id', userId).eq('badge_id', 'pleno_jornada'),
    admin.from('game_streaks').select('current_streak').eq('user_id', userId).maybeSingle(),
  ])

  if (!profileRes.data) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 })
  }

  const displayName = (profileRes.data.display_name as string | null) ?? 'Takero'
  const avatarUrl   = (profileRes.data.avatar_url   as string | null) ?? null

  // Handle: usamos display_name slugified (no exponemos email del user)
  const handle = displayName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'takero'

  // XP = sum(point_transactions positivas) + 200 * badges
  const lifetimePts = (ptRes.data ?? []).reduce(
    (sum, t) => sum + ((t.amount as number) ?? 0), 0,
  )
  const badgeCount = badgeCountRes.count ?? 0
  const xp = lifetimePts + badgeCount * XP_PER_BADGE
  const levelInfo = computeLevel(xp)

  const badges = badgesByUser.get(userId) ?? []

  // liveStats — alimenta los signature_stat con keys conocidos.
  // Cada nuevo `signature_stat` cosmetic referencia un key aquí.
  const predictions = predictionsRes.count ?? 0
  const plenos      = plenoCountRes.count ?? 0
  const racha       = (streakRes.data?.current_streak as number | undefined) ?? 0

  return NextResponse.json({
    displayName,
    handle,
    avatarUrl,
    level:     levelInfo.current.level,
    levelName: levelInfo.current.name,
    xp,
    equipment,
    badges,
    liveStats: {
      xp:           xp.toLocaleString('es-ES'),
      badgesCount:  String(badgeCount),
      predictions:  String(predictions),
      plenos:       plenos > 0 ? `x${plenos}` : '0',
      racha:        String(racha),
    },
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
