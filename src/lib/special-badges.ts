// ─────────────────────────────────────────────────────────────────
// Special badges — helpers server-side para badges en DB
// (quiniela_special_badges) que se otorgan por jornada.
//
// Distinción con badges/catálogo (src/lib/badges.ts):
//   · Catálogo: vive en código, requiere deploy para agregar/cambiar.
//   · Special: vive en DB, admin los crea con endpoint sin redeploy.
//
// El badge_id del special tiene prefijo "sp_" por convención (no es
// enforced, pero ayuda a distinguir en queries y UI).
// ─────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BadgeDef } from './badges'

export interface SpecialBadgeRow {
  badge_id: string
  name: string
  emoji: string
  color: string
  bg: string
  description: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  jornada: string | null
  criteria_type: 'top_n' | 'min_hits' | 'pleno' | 'all_participants' | 'manual'
  criteria_value: number
  max_grants: number
  granted_count: number
  expires_at: string | null
  active: boolean
}

/**
 * Fetch metadata de special badges por sus IDs. Devuelve un Map con
 * BadgeDef-compatible para mergearlo con el catálogo de código.
 */
export async function fetchSpecialBadgeDefs(
  sb: SupabaseClient,
  badgeIds: string[],
): Promise<Map<string, BadgeDef>> {
  const out = new Map<string, BadgeDef>()
  if (badgeIds.length === 0) return out
  const { data } = await sb
    .from('quiniela_special_badges')
    .select('badge_id, name, emoji, color, bg, description, rarity')
    .in('badge_id', badgeIds)
  if (!data) return out
  for (const r of data) {
    out.set(r.badge_id as string, {
      id: r.badge_id as string,
      name: r.name as string,
      emoji: r.emoji as string,
      color: r.color as string,
      bg: r.bg as string,
      description: r.description as string,
      rarity: (r.rarity as 'common'|'rare'|'epic'|'legendary'),
      category: 'special',
    })
  }
  return out
}

/**
 * Lee los special badges activos asociados a una jornada concreta.
 * Filtrados por active=true y expires_at en el futuro (o null).
 * Usado por score/route.ts al settle para evaluar criterios.
 */
export async function fetchActiveSpecialBadgesForJornada(
  sb: SupabaseClient,
  jornada: string,
): Promise<SpecialBadgeRow[]> {
  const nowIso = new Date().toISOString()
  const { data, error } = await sb
    .from('quiniela_special_badges')
    .select('*')
    .eq('active', true)
    .or(`jornada.eq.${jornada},jornada.is.null`)
    .or(`expires_at.gt.${nowIso},expires_at.is.null`)
  if (error || !data) return []
  return data as SpecialBadgeRow[]
}

/**
 * Evalúa si un user merece un special badge dado su breakdown de jornada.
 * Para criterios que requieren contexto cross-user (top_n, all_participants
 * con cap), el caller debe pre-filtrar antes de invocar.
 */
export function userMeetsCriteria(
  badge: SpecialBadgeRow,
  ctx: {
    hits: number
    pleno: boolean
    totalStake: number
    rankInJornada?: number  // 1-based, solo para top_n
  },
): boolean {
  switch (badge.criteria_type) {
    case 'pleno':
      return ctx.pleno
    case 'min_hits':
      return ctx.hits >= badge.criteria_value
    case 'all_participants':
      return ctx.totalStake > 0
    case 'top_n':
      return ctx.rankInJornada != null && ctx.rankInJornada <= badge.criteria_value
    case 'manual':
      return false  // jamás auto
  }
}

/**
 * Otorga un special badge a un user respetando max_grants y haciendo
 * upsert idempotente en quiniela_badges. Actualiza granted_count en
 * quiniela_special_badges (no atómico, pero el cap se vuelve a
 * verificar antes de cada grant — race conditions son tolerables a
 * este volumen, peor caso es 1-2 over-grants).
 */
export async function grantSpecialBadge(
  sb: SupabaseClient,
  badge: SpecialBadgeRow,
  userId: string,
): Promise<'granted' | 'already_had' | 'capped' | 'error'> {
  // Cap check
  if (badge.max_grants > 0 && badge.granted_count >= badge.max_grants) {
    return 'capped'
  }
  // ¿Ya lo tenía?
  const { data: existing } = await sb
    .from('quiniela_badges')
    .select('badge_id')
    .eq('user_id', userId)
    .eq('badge_id', badge.badge_id)
    .maybeSingle()
  if (existing) return 'already_had'

  const { error: insErr } = await sb
    .from('quiniela_badges')
    .upsert({ user_id: userId, badge_id: badge.badge_id }, { onConflict: 'user_id,badge_id', ignoreDuplicates: true })
  if (insErr) return 'error'

  // Update counter (best-effort, no atómico)
  await sb
    .from('quiniela_special_badges')
    .update({ granted_count: badge.granted_count + 1 })
    .eq('badge_id', badge.badge_id)

  return 'granted'
}
