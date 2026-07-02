// GET /api/games/leaderboard?game=...&period=...&limit=50
// Lectura pública. Cache ISR vía Cache-Control para no martillar Supabase.
//
// Enriquece cada entrada con badges (hasta 3) y equipment activo
// (badge/title/frame/card_bg). El cache sigue siendo público — los badges/
// equipment no son secretos.

import { NextRequest, NextResponse } from 'next/server'
import { publicId } from '@/lib/public-id'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { fetchEquipmentByUser, type UserEquipment } from '@/lib/equipment'
import { fetchBadgesByUser, type LeaderboardBadge, type LeaderboardEquipment } from '@/lib/leaderboard-badges'
import { apiError } from '@/lib/api-utils'

const GAME_IDS = ['quiniela', 'crackquiz', 'mionce', 'sopacracks', 'takagrid', 'strikerrush'] as const
type GameId = typeof GAME_IDS[number]

// publicId() vive en @/lib/public-id (fuente única, compartida con los
// leaderboards de Ranked).

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

  // Lee la vista con service_role (bypassa RLS) para no depender del acceso
  // anónimo a v_game_leaderboard, que cerramos a nivel de BD. Fallback a la
  // sesión solo en dev sin SUPABASE_SERVICE_ROLE_KEY.
  const admin = adminSupabase()
  const reader = admin ?? await createServerSupabaseClient()

  const { data, error } = await reader
    .from('v_game_leaderboard')
    .select('user_id, score, duration_ms, created_at, display_name, avatar_url, position')
    .eq('game_id', game)
    .eq('period', period)
    .order('position', { ascending: true })
    .limit(limit)

  if (error) {
    return apiError('server_error', 500)
  }

  const rows = data ?? []
  const userIds = rows.map(r => r.user_id as string).filter(Boolean)

  const [badgesByUser, equipByUser] = await Promise.all([
    fetchBadgesByUser(admin, userIds, 3),
    admin ? fetchEquipmentByUser(admin, userIds) : Promise.resolve(new Map<string, UserEquipment>()),
  ])

  const entries = rows.map(r => {
    const uid = r.user_id as string
    const badges: LeaderboardBadge[] = badgesByUser.get(uid) ?? []
    const equipment = serializeEquipment(equipByUser.get(uid))
    // Construcción explícita: NO se incluye `user_id` (UUID de auth). Se
    // expone solo `pid`, un hash opaco que basta como key en el cliente.
    return {
      pid:          uid ? publicId(uid) : '',
      score:        r.score,
      duration_ms:  r.duration_ms,
      display_name: r.display_name,
      avatar_url:   r.avatar_url,
      position:     r.position,
      created_at:   r.created_at,
      badges: badges.length > 0 ? badges : undefined,
      equipment,
    }
  })

  return NextResponse.json(
    { entries, total: entries.length },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
  )
}
