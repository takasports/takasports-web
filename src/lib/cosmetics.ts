// ─────────────────────────────────────────────────────────────────
// Cosmetics — helpers server-side para el sistema de personalización.
//
// El catálogo vive en DB (tabla `cosmetics`). Aquí están:
//   · fetchCosmetic       — leer un cosmético por id
//   · fetchCosmeticsByIds — batch fetch
//   · unlockCosmetics     — otorgar uno o varios cosméticos a un user
//                           (idempotente, fire-and-forget)
//   · cosmeticsForBadge   — devuelve qué cosméticos otorga un badge
//                           específico (lookup en DB)
//   · cosmeticsForLevel   — qué cosméticos se desbloquean al alcanzar
//                           cierto nivel
//
// Diseño: igual que badge-awards.ts. Las funciones son seguras de
// llamar muchas veces (idempotentes vía PK + ON CONFLICT DO NOTHING).
// Los errores se loguean pero no propagan (no quieres que un fallo
// de unlock cosmético rompa un settle de jornada).
// ─────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'

export type CosmeticType =
  | 'badge_chip' | 'title' | 'frame' | 'card_bg'
  | 'avatar_frame' | 'name_effect' | 'corner_sticker'
  | 'signature_stat' | 'background_pattern'

export type CosmeticRarity = 'common' | 'rare' | 'epic' | 'legendary'

export type CosmeticUnlockSource = 'badge' | 'level' | 'event' | 'sport_pick' | 'manual'

export interface CosmeticRow {
  id:                string
  type:              CosmeticType
  name:              string
  description:       string | null
  rarity:            CosmeticRarity
  data:              Record<string, unknown>
  unlock_source:     CosmeticUnlockSource
  unlock_condition:  Record<string, unknown>
  season:            string | null
  active:            boolean
  sort_order:        number
}

export interface CosmeticUnlockResult {
  awarded:    string[]   // ids nuevos otorgados en esta llamada
  alreadyHad: string[]   // ids que ya tenía
  invalid:    string[]   // ids no encontrados o inactivos
}

// ─────────────────────────────────────────────────────────────────
// LECTURA
// ─────────────────────────────────────────────────────────────────

export async function fetchCosmetic(
  sb: SupabaseClient,
  id: string,
): Promise<CosmeticRow | null> {
  const { data } = await sb
    .from('cosmetics')
    .select('*')
    .eq('id', id)
    .eq('active', true)
    .maybeSingle()
  return (data ?? null) as CosmeticRow | null
}

export async function fetchCosmeticsByIds(
  sb: SupabaseClient,
  ids: string[],
): Promise<Map<string, CosmeticRow>> {
  const out = new Map<string, CosmeticRow>()
  if (ids.length === 0) return out
  const { data } = await sb
    .from('cosmetics')
    .select('*')
    .eq('active', true)
    .in('id', ids)
  for (const row of (data ?? []) as CosmeticRow[]) {
    out.set(row.id, row)
  }
  return out
}

/**
 * Devuelve los cosméticos que un badge desbloquea (lookup en DB).
 * Por ej. badge_id="oraculo" → [title_oraculo].
 */
export async function cosmeticsForBadge(
  sb: SupabaseClient,
  badgeId: string,
): Promise<CosmeticRow[]> {
  const { data } = await sb
    .from('cosmetics')
    .select('*')
    .eq('unlock_source', 'badge')
    .eq('active', true)
    .filter('unlock_condition->>badge_id', 'eq', badgeId)
  return (data ?? []) as CosmeticRow[]
}

/**
 * Devuelve cosméticos cuyo unlock por nivel ya quedaría desbloqueado
 * al alcanzar `level` (min_level <= level).
 */
export async function cosmeticsForLevel(
  sb: SupabaseClient,
  level: number,
): Promise<CosmeticRow[]> {
  // Postgres jsonb: comparación numérica con cast.
  // Usamos filtro 'lte' después de cast a int.
  const { data } = await sb
    .from('cosmetics')
    .select('*')
    .eq('unlock_source', 'level')
    .eq('active', true)
    .lte('unlock_condition->min_level', level as unknown as string)
  return (data ?? []) as CosmeticRow[]
}

/**
 * Cosméticos free de un deporte (sport pick). Se otorgan al user al
 * elegir / seguir un deporte favorito por primera vez.
 */
export async function cosmeticsForSport(
  sb: SupabaseClient,
  sportSlug: string,
): Promise<CosmeticRow[]> {
  const { data } = await sb
    .from('cosmetics')
    .select('*')
    .eq('unlock_source', 'sport_pick')
    .eq('active', true)
    .filter('unlock_condition->>sport', 'eq', sportSlug)
  return (data ?? []) as CosmeticRow[]
}

// ─────────────────────────────────────────────────────────────────
// OTORGAR (unlock)
// ─────────────────────────────────────────────────────────────────

/**
 * Otorga uno o varios cosméticos a un user. Idempotente.
 *
 * Implementación: usa la RPC `unlock_cosmetic` definida en migration
 * 055, que valida que el cosmético existe + active + onConflict ignore.
 *
 * Fire-and-forget: los errores se loguean pero NO se propagan.
 *
 * @param sb         cliente Supabase con service_role
 * @param userId     uuid del user
 * @param cosmeticIds ids de cosméticos a otorgar
 * @param source     unlock_source para auditoría (badge/level/sport_pick/etc.)
 */
export async function unlockCosmetics(
  sb: SupabaseClient,
  userId: string,
  cosmeticIds: string[],
  source?: CosmeticUnlockSource,
): Promise<CosmeticUnlockResult> {
  const result: CosmeticUnlockResult = { awarded: [], alreadyHad: [], invalid: [] }
  if (!userId || cosmeticIds.length === 0) return result

  // Pre-fetch cuáles tiene ya (para distinguir awarded vs alreadyHad
  // sin depender del valor de retorno de la RPC, que varía).
  const { data: existing } = await sb
    .from('user_cosmetic_unlocks')
    .select('cosmetic_id')
    .eq('user_id', userId)
    .in('cosmetic_id', cosmeticIds)
  const had = new Set((existing ?? []).map(r => r.cosmetic_id as string))

  // Validar IDs (active=true)
  const { data: validCosmetics } = await sb
    .from('cosmetics')
    .select('id, unlock_source')
    .eq('active', true)
    .in('id', cosmeticIds)
  const validIds = new Set((validCosmetics ?? []).map(c => c.id as string))

  // Diagnóstico
  for (const id of cosmeticIds) {
    if (!validIds.has(id)) result.invalid.push(id)
    else if (had.has(id))  result.alreadyHad.push(id)
  }
  const toInsert = cosmeticIds.filter(id => validIds.has(id) && !had.has(id))
  if (toInsert.length === 0) return result

  // Bulk insert
  const rows = toInsert.map(cosmetic_id => ({
    user_id: userId,
    cosmetic_id,
    unlock_source: source ?? 'manual',
  }))
  const { error } = await sb
    .from('user_cosmetic_unlocks')
    .upsert(rows, { onConflict: 'user_id,cosmetic_id', ignoreDuplicates: true })

  if (error) {
    console.error('[unlockCosmetics] upsert failed', { userId, toInsert, error: error.message })
    return result
  }

  result.awarded = toInsert
  return result
}

// ─────────────────────────────────────────────────────────────────
// COMBINADORES — para llamar desde rutas de awarding
// ─────────────────────────────────────────────────────────────────

/**
 * Helper de alto nivel: tras otorgar un badge, otorga los cosméticos
 * que ese badge desbloquea. Llamado desde awardBadges() para mantener
 * la promesa "ganaste el badge X → ya equipable el cosmético Y" sin
 * que el caller tenga que coordinar las dos cosas.
 */
export async function unlockCosmeticsForBadge(
  sb: SupabaseClient,
  userId: string,
  badgeId: string,
): Promise<string[]> {
  const cosmetics = await cosmeticsForBadge(sb, badgeId)
  if (cosmetics.length === 0) return []
  const ids = cosmetics.map(c => c.id)
  const res = await unlockCosmetics(sb, userId, ids, 'badge')
  return res.awarded
}

/**
 * Helper para nivel: dado un user y un nivel (recién alcanzado),
 * otorga TODOS los cosméticos por nivel cuyo min_level <= newLevel
 * que el user todavía no tenga. Idempotente — llamarlo cada settle
 * con el nivel actual es seguro.
 */
export async function unlockCosmeticsForLevel(
  sb: SupabaseClient,
  userId: string,
  level: number,
): Promise<string[]> {
  const cosmetics = await cosmeticsForLevel(sb, level)
  if (cosmetics.length === 0) return []
  const ids = cosmetics.map(c => c.id)
  const res = await unlockCosmetics(sb, userId, ids, 'level')
  return res.awarded
}

/**
 * Helper para sport pick: otorga los cosméticos de un deporte cuando
 * el user lo elige como favorito. Llamado desde el endpoint de
 * preferencias.
 */
export async function unlockCosmeticsForSport(
  sb: SupabaseClient,
  userId: string,
  sportSlug: string,
): Promise<string[]> {
  const cosmetics = await cosmeticsForSport(sb, sportSlug)
  if (cosmetics.length === 0) return []
  const ids = cosmetics.map(c => c.id)
  const res = await unlockCosmetics(sb, userId, ids, 'sport_pick')
  return res.awarded
}
