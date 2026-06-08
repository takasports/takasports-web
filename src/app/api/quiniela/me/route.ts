// GET /api/quiniela/me
//
// Endpoint agregador para el panel de Hitos del user logueado.
// Devuelve en UNA sola request:
//   · XP lifetime + level + progreso al siguiente
//   · lista de badges desbloqueados (con metadata del catálogo)
//   · lista de badges aún por desbloquear (locked, del catálogo)
//
// Sin autenticación → 401 (no expone datos públicos por este endpoint —
// el leaderboard ya hace eso). El usuario consume este endpoint en su
// propia sidebar.
//
// Cache: no-store (datos volátiles tras cada settle).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { BADGES, listAllBadges, type BadgeDef } from '@/lib/badges'
import { fetchSpecialBadgeDefs } from '@/lib/special-badges'
import { computeLevel, computeXp } from '@/lib/levels'
import { type EquipSlot } from '@/lib/equipment'

interface MeBadge {
  id: string
  name: string
  emoji: string
  color: string
  bg: string
  rarity: string
  category: string
  description: string
  unlockedAt: string | null   // null = locked
  /** Slots que este badge puede ocupar en equipamiento. */
  equipSlots: EquipSlot[]
}

/** Equipamiento activo del user (slot → badge_id). */
interface MeEquipment {
  badge?:   string  // badge_id
  title?:   string
  frame?:   string
  card_bg?: string
}

function toMeBadge(def: BadgeDef, unlockedAt: string | null): MeBadge {
  const slots: EquipSlot[] = ['badge']
  if (def.unlocks?.title)      slots.push('title')
  if (def.unlocks?.frameColor) slots.push('frame')
  if (def.unlocks?.cardBg)     slots.push('card_bg')
  return {
    id: def.id,
    name: def.name,
    emoji: def.emoji,
    color: def.color,
    bg: def.bg,
    rarity: def.rarity,
    category: def.category,
    description: def.description,
    unlockedAt,
    equipSlots: slots,
  }
}

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'auth required' }, { status: 401 })
  }

  // Lifetime positivo en point_transactions (fuente universal de puntos Taka)
  const { data: ptRows } = await sb
    .from('point_transactions')
    .select('amount')
    .eq('user_id', user.id)
    .gt('amount', 0)
  const lifetimePts = (ptRows ?? []).reduce(
    (sum, t) => sum + (t.amount as number), 0,
  )

  // Badges del user
  const { data: badgeRows } = await sb
    .from('quiniela_badges')
    .select('badge_id, unlocked_at')
    .eq('user_id', user.id)

  const unlockedMap = new Map<string, string>()
  for (const r of badgeRows ?? []) {
    unlockedMap.set(r.badge_id as string, (r.unlocked_at as string) ?? new Date(0).toISOString())
  }

  // Defs del catálogo conocido
  const unlockedIds = [...unlockedMap.keys()]
  const unlockedCatalog = unlockedIds
    .map(id => BADGES[id])
    .filter((b): b is BadgeDef => !!b)

  // Defs de special badges que el user tenga pero NO están en el catálogo de código
  const unknownIds = unlockedIds.filter(id => !BADGES[id])
  const specialDefs = unknownIds.length > 0
    ? await fetchSpecialBadgeDefs(sb, unknownIds)
    : new Map<string, BadgeDef>()
  const unlockedSpecials = [...specialDefs.values()]

  const unlockedDefs = [...unlockedCatalog, ...unlockedSpecials]

  const xp = computeXp({
    lifetimePts,
    badgesCount: unlockedDefs.length,
  })
  const levelInfo = computeLevel(xp)

  // Catálogo completo (código) + special badges desbloqueados por el user.
  // Los special badges que el user NO tiene se omiten del listado (no
  // queremos exponer todos los specials posibles a todos los users — son
  // sorpresa). Los que sí tiene aparecen como unlocked en su perfil.
  const allBadges = [...listAllBadges(), ...unlockedSpecials]
  const meBadges: MeBadge[] = allBadges.map(def =>
    toMeBadge(def, unlockedMap.get(def.id) ?? null),
  )

  // Stats extra para los signature_stat cosmetics:
  //   · predictions  → total de predicciones ranked
  //   · racha        → racha actual de juegos diarios
  // Lecturas en paralelo, fallar silenciosamente si las tablas no
  // están disponibles.
  const [predictionsRes, streakRes] = await Promise.all([
    sb.from('ranked_predictions').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    sb.from('game_streaks').select('current_streak').eq('user_id', user.id).maybeSingle(),
  ])
  const predictionsTotal = predictionsRes.count ?? 0
  const currentStreak    = (streakRes.data?.current_streak as number | undefined) ?? 0

  // Equipamiento activo del user
  const { data: equipRows } = await sb
    .from('quiniela_user_equipment')
    .select('slot, badge_id')
    .eq('user_id', user.id)

  const equipment: MeEquipment = {}
  for (const r of equipRows ?? []) {
    const slot = r.slot as EquipSlot
    const bid  = r.badge_id as string
    if (slot === 'badge')   equipment.badge   = bid
    if (slot === 'title')   equipment.title   = bid
    if (slot === 'frame')   equipment.frame   = bid
    if (slot === 'card_bg') equipment.card_bg = bid
  }

  return NextResponse.json({
    xp,
    level: levelInfo.current.level,
    levelName: levelInfo.current.name,
    levelColor: levelInfo.current.color,
    nextLevel: levelInfo.next ? {
      level: levelInfo.next.level,
      name: levelInfo.next.name,
      minXp: levelInfo.next.minXp,
    } : null,
    xpInLevel: levelInfo.xpInLevel,
    xpToNext: levelInfo.xpToNext,
    progress: levelInfo.progress,
    badges: meBadges,
    unlockedCount: unlockedDefs.length,
    totalBadges: allBadges.length,
    equipment,
    stats: {
      predictions: predictionsTotal,
      racha:       currentStreak,
    },
  })
}
