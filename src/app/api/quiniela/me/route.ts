// GET /api/quiniela/me
//
// Endpoint agregador para el panel de Hitos del user logueado.
// Devuelve en UNA sola request:
//   · balance actual de monedas
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
}

function toMeBadge(def: BadgeDef, unlockedAt: string | null): MeBadge {
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

  // Balance actual
  const { data: balRow } = await sb
    .from('quiniela_coin_balance')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle()
  const balance = balRow?.balance ?? 0

  // Lifetime positive coins (para XP). RLS en quiniela_coin_txns
  // limita a self → no podemos sumar todas si admin no estuviera,
  // pero auth.uid() = user.id → ok.
  const { data: txns } = await sb
    .from('quiniela_coin_txns')
    .select('amount')
    .eq('user_id', user.id)
    .gt('amount', 0)
  const lifetimePositive = (txns ?? []).reduce(
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
    lifetimePositiveCoins: lifetimePositive,
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

  return NextResponse.json({
    balance,
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
  })
}
