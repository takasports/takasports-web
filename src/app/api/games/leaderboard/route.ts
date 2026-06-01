// GET /api/games/leaderboard?game=...&period=...&limit=50
// Lectura pública. Cache ISR vía Cache-Control para no martillar Supabase.
//
// Enriquece cada entrada con badges (hasta 3) y equipment activo
// (badge/title/frame/card_bg). El cache sigue siendo público — los badges/
// equipment no son secretos.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { fetchEquipmentByUser, type UserEquipment } from '@/lib/equipment'
import { fetchBadgesByUser, type LeaderboardBadge, type LeaderboardEquipment } from '@/lib/leaderboard-badges'

const GAME_IDS = ['quiniela', 'crackquiz', 'mionce', 'sopacracks', 'takagrid', 'strikerrush'] as const
type GameId = typeof GAME_IDS[number]

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

function serializeEquipment(eq: UserEquipment | undefined): LeaderboardEquipment | undefined {
  if (!eq) return undefined
  const out: LeaderboardEquipment = {}
  if (eq.badge)   out.badge   = { emoji: eq.badge.emoji, color: eq.badge.color, bg: eq.badge.bg, name: eq.badge.name }
  if (eq.title)   out.title   = { text:  eq.title.text,  color: eq.title.color }
  if (eq.frame)   out.frame   = { color: eq.frame.color }
  if (eq.card_bg) out.card_bg = { gradient: eq.card_bg.gradient }
  if (!out.badge && !out.title && !out.frame && !out.card_bg) return undefined
  return out
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const game   = url.searchParams.get('game')
  const period = url.searchParams.get('period')
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200)

  if (!game || !period) {
    return NextResponse.json({ error: 'game and period required' }, { status: 400 })
  }
  if (!GAME_IDS.includes(game as GameId)) {
    return NextResponse.json({ error: 'invalid game_id' }, { status: 400 })
  }
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ entries: [], total: 0 })
  }

  const sb = await createServerSupabaseClient()

  const { data, error } = await sb
    .from('v_game_leaderboard')
    .select('user_id, score, duration_ms, created_at, display_name, avatar_url, position')
    .eq('game_id', game)
    .eq('period', period)
    .order('position', { ascending: true })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = data ?? []
  const userIds = rows.map(r => r.user_id as string).filter(Boolean)

  const admin = adminSupabase()
  const [badgesByUser, equipByUser] = await Promise.all([
    fetchBadgesByUser(admin, userIds, 3),
    admin ? fetchEquipmentByUser(admin, userIds) : Promise.resolve(new Map<string, UserEquipment>()),
  ])

  const entries = rows.map(r => {
    const uid = r.user_id as string
    const badges: LeaderboardBadge[] = badgesByUser.get(uid) ?? []
    const equipment = serializeEquipment(equipByUser.get(uid))
    return {
      ...r,
      badges: badges.length > 0 ? badges : undefined,
      equipment,
    }
  })

  return NextResponse.json(
    { entries, total: entries.length },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
  )
}
