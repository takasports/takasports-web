// GET /api/ranked/profile/[userId]
// Perfil público de predicciones Ranked de un usuario.
// No requiere autenticación — datos públicos.
//
// Devuelve:
//   · info básica del user (display_name, avatar_url)
//   · badges (filtrados por !privateOnly)
//   · stats de predicciones mundiales (total, correct, pts)
//   · picks del Mundial ya resueltos (no se exponen picks abiertos → privacidad)

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { selectDisplayBadges } from '@/lib/badges'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params

  if (!userId || userId.length < 10) {
    return NextResponse.json({ error: 'invalid_user_id' }, { status: 400 })
  }

  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return NextResponse.json({ error: 'supabase_not_configured' }, { status: 503 })
  }

  const sb = await createServerSupabaseClient()

  // Todas las queries en paralelo
  const [profileRes, badgesRes, mundialRes] = await Promise.all([
    // 1. Perfil básico
    sb
      .from('profiles')
      .select('display_name, avatar_url, points_balance')
      .eq('id', userId)
      .single(),

    // 2. Badges
    sb
      .from('quiniela_badges')
      .select('badge_id, unlocked_at')
      .eq('user_id', userId),

    // 3. Picks del Mundial ya resueltos (is_correct no es null)
    sb
      .from('ranked_predictions')
      .select(`
        event_id,
        prediction,
        is_correct,
        points_awarded,
        created_at,
        ranked_events!inner(
          team_home,
          team_away,
          event_date,
          result,
          featured
        )
      `)
      .eq('user_id', userId)
      .not('is_correct', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
  }

  const profile = profileRes.data as {
    display_name: string | null
    avatar_url:   string | null
    points_balance: number | null
  }

  // Badges — top 6 para el perfil público (más que el ranking que muestra 3)
  const badgeIds = (badgesRes.data ?? []).map((r: { badge_id: string }) => r.badge_id)
  const topBadges = selectDisplayBadges(badgeIds, 6).map(b => ({
    id:    b.id,
    name:  b.name,
    emoji: b.emoji,
    color: b.color,
    bg:    b.bg,
    rarity: b.rarity,
  }))

  // Stats del Mundial
  type PredRow = {
    event_id: string
    prediction: { pick: '1' | 'X' | '2' }
    is_correct: boolean | null
    points_awarded: number | null
    created_at: string
    ranked_events: {
      team_home: string | null
      team_away: string | null
      event_date: string
      result: { winner: '1'|'X'|'2'; home_score?: number; away_score?: number } | null
      featured: boolean
    }
  }

  const mundialPicks = (mundialRes.data ?? []) as PredRow[]
  const totalMundial   = mundialPicks.length
  const correctMundial = mundialPicks.filter(p => p.is_correct === true).length
  const ptsMundial     = mundialPicks.reduce((s, p) => s + (p.points_awarded ?? 0), 0)

  // Solo exponemos los picks resueltos (is_correct !== null) → privacidad OK
  const resolvedPicks = mundialPicks.map(p => ({
    event_id:    p.event_id,
    pick:        p.prediction?.pick ?? null,
    is_correct:  p.is_correct,
    pts:         p.points_awarded ?? 0,
    team_home:   p.ranked_events?.team_home ?? null,
    team_away:   p.ranked_events?.team_away ?? null,
    event_date:  p.ranked_events?.event_date ?? null,
    result:      p.ranked_events?.result ?? null,
    featured:    p.ranked_events?.featured ?? false,
  }))

  return NextResponse.json({
    user_id:      userId,
    display_name: profile.display_name,
    avatar_url:   profile.avatar_url,
    badges:       topBadges,
    stats: {
      mundial: {
        total:    totalMundial,
        correct:  correctMundial,
        accuracy: totalMundial > 0 ? Math.round((correctMundial / totalMundial) * 100) : 0,
        pts:      ptsMundial,
      },
    },
    picks: resolvedPicks,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}
