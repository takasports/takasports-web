// ─────────────────────────────────────────────────────────────────
// Badge awards — funciones server-side para otorgar badges.
//
// Diseño:
//   · Una sola función pública: awardBadges(userId, badgeIds[]).
//   · Idempotente: upsert con onConflict ignora duplicados (PK
//     user_id+badge_id). Llamarlo N veces con el mismo badge no
//     genera txn nueva ni rompe nada.
//   · Valida cada badge_id contra el catálogo (lib/badges.ts) — si no
//     existe, lo loguea y lo descarta. Evita guardar IDs huérfanos.
//   · Fire-and-forget desde callers: errores se loguean pero NO
//     propagan. Un fallo de badge nunca debe romper el settle de una
//     apuesta o la resolución de una pregunta de temporada.
//
// Triggers actuales (Fase 1):
//   · score/route.ts (phase=settle)        → first_bet, first_win,
//                                              pleno_jornada, oraculo,
//                                              high_roller, underdog,
//                                              racha_3, racha_5
//   · season/resolve/route.ts              → profeta_mundial_2026
//                                              (lógica histórica, ahora
//                                              también usa esta función)
//
// Trigger pendiente (Fase 5):
//   · admin/mundial/close                   → mundialista_2026 (todos los
//                                              que jugaron ≥1 jornada),
//                                              top3_mundial_2026 (TOP 3)
// ─────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { BADGES } from './badges'

export interface BadgeAwardResult {
  awarded: string[]      // badges nuevos que se otorgaron en esta llamada
  alreadyHad: string[]   // badges que el user ya tenía (no se re-otorgaron)
  invalid: string[]      // badge_ids desconocidos (no en catálogo)
}

/**
 * Otorga uno o más badges a un user. Idempotente.
 *
 * @param sb       cliente Supabase (service role o user-scoped — ambos
 *                 sirven gracias a UPSERT onConflict)
 * @param userId   uuid del user (auth.users.id)
 * @param badgeIds array de badge_ids a otorgar
 */
export async function awardBadges(
  sb: SupabaseClient,
  userId: string,
  badgeIds: string[],
): Promise<BadgeAwardResult> {
  const result: BadgeAwardResult = { awarded: [], alreadyHad: [], invalid: [] }
  if (!userId || badgeIds.length === 0) return result

  // Filtrar IDs desconocidos
  const valid = badgeIds.filter(id => {
    if (BADGES[id]) return true
    result.invalid.push(id)
    return false
  })
  if (valid.length === 0) return result

  // Detectar cuáles ya tiene (para distinguir awarded vs alreadyHad)
  const { data: existing } = await sb
    .from('quiniela_badges')
    .select('badge_id')
    .eq('user_id', userId)
    .in('badge_id', valid)

  const had = new Set((existing ?? []).map(r => r.badge_id as string))
  const toInsert = valid.filter(id => !had.has(id))
  result.alreadyHad = valid.filter(id => had.has(id))

  if (toInsert.length === 0) return result

  // Upsert con onConflict por idempotencia ante race conditions
  const { error } = await sb.from('quiniela_badges').upsert(
    toInsert.map(badge_id => ({ user_id: userId, badge_id })),
    { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
  )

  if (error) {
    console.error('[awardBadges] upsert failed', { userId, toInsert, error: error.message })
    return result
  }

  result.awarded = toInsert
  return result
}

// ─────────────────────────────────────────────────────────────────
// Helper: detecta qué badges merece un user tras settle de jornada.
// Se llama desde score/route.ts (phase=settle).
//
// Inputs:
//   · breakdown:   resultado de scorePicks
//   · totalStake:  monedas apostadas (para high_roller)
//   · totalWon:    monedas ganadas (para first_win)
//   · picks:       picks con oddsAtPick para detectar underdog
//   · prevStreak:  nº de jornadas consecutivas con ganancias ANTES de esta
//                  (0 = no streak previa)
// ─────────────────────────────────────────────────────────────────

interface SettleBadgeContext {
  hits: number
  totalPicks: number
  pleno: boolean
  totalStake: number
  totalWon: number
  picksWithOdds: Array<{ won: boolean; odds: number }>
  prevStreak: number
  isFirstBet: boolean
  isFirstWin: boolean
}

export function badgesEarnedOnSettle(ctx: SettleBadgeContext): string[] {
  const earned: string[] = []

  if (ctx.isFirstBet) earned.push('first_bet')
  if (ctx.isFirstWin && ctx.totalWon > ctx.totalStake) earned.push('first_win')

  if (ctx.pleno && ctx.totalPicks > 0) earned.push('pleno_jornada')
  if (ctx.hits >= 4) earned.push('oraculo')

  if (ctx.totalStake >= 500 && ctx.totalWon > ctx.totalStake) {
    earned.push('high_roller')
  }

  // Underdog: ganó al menos un pick con cuota ≥ 4.0
  if (ctx.picksWithOdds.some(p => p.won && p.odds >= 4)) {
    earned.push('underdog')
  }

  // Racha: contamos esta jornada como ganadora si totalWon > totalStake.
  const wonThis = ctx.totalWon > ctx.totalStake
  if (wonThis) {
    const newStreak = ctx.prevStreak + 1
    if (newStreak >= 3) earned.push('racha_3')
    if (newStreak >= 5) earned.push('racha_5')
  }

  return earned
}
