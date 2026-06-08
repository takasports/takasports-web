// ─────────────────────────────────────────────────────────────────
// Mundial 2026 — lógica de cierre del torneo.
//
// Esta lógica SOLO se ejecuta cuando un admin dispara el endpoint
// /api/admin/mundial/close (manualmente, post-final 19 jul 2026). Por
// seguridad el endpoint NO se ejecuta antes de la fecha de cierre
// salvo override explícito (body.force=true).
//
// Acciones que ejecuta closeMundial2026():
//   1. Computa el podio: ranking acumulado de puntos del Mundial leídos
//      del ledger universal `point_transactions`
//      (source='ranked_prediction', sport='mundial'), que es donde
//      `score_ranked_prediction` (migr. 054) acredita al resolver cada
//      partido. El predictor de /mundial escribe en `ranked_predictions`
//      (NUNCA en quiniela_picks — ese era el bug del cierre anterior).
//   2. Otorga "top3_mundial_2026" a los TOP 3 del podio.
//   3. Backstop idempotente: re-otorga "mundialista_2026" a todos los
//      participantes reales (≥1 predicción en un evento Mundial). El
//      camino canónico de este badge es predictions/route.ts (al primer
//      pick); esto solo cubre fallos best-effort de aquel.
//   4. Devuelve resumen para auditoría.
//
// NO toca el wallet de puntos — los premios del podio (camisetas)
// se gestionan offline por email, fuera del scope automatizable.
// ─────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { awardBadges } from './badge-awards'

/** Fecha de cierre oficial del torneo. UTC para evitar ambigüedad. */
export const MUNDIAL_CLOSE_DATE = new Date('2026-07-19T23:59:59Z')

export interface MundialPodiumEntry {
  userId: string
  points: number   // suma de `amount` en point_transactions (Mundial)
  hits: number     // nº de predicciones acertadas que puntuaron (>0)
}

export interface MundialPodium {
  participants: string[]          // user_ids con ≥1 predicción Mundial
  ranked: MundialPodiumEntry[]    // ordenado por points desc, hits desc
}

export interface MundialClosureResult {
  ok: boolean
  reason?: string
  mundialistas: number       // participantes (≥1 predicción Mundial)
  top3: Array<{ userId: string; nickname: string; points: number; hits: number }>
  badgesAwarded: number      // total badges otorgados (mundialista backstop + top3)
  alreadyClosed?: boolean    // true si el re-run no otorgó nada nuevo
}

/**
 * Computa el podio del Mundial desde las fuentes REALES de datos.
 * Compartido por closeMundial2026() (POST) y el dry-run (GET) para que
 * preview y cierre nunca diverjan.
 *
 * - participants: distinct user_ids con ≥1 predicción en evento sport='mundial'
 *   (lee ranked_predictions). = titulares del badge mundialista_2026.
 * - ranked: suma de puntos por user desde point_transactions
 *   (source='ranked_prediction', sport='mundial', amount>0), desc.
 */
export async function computeMundialPodium(admin: SupabaseClient): Promise<MundialPodium> {
  // 1. Eventos del Mundial
  const { data: eventRows } = await admin
    .from('ranked_events')
    .select('id')
    .eq('sport', 'mundial')
  const eventIds = (eventRows ?? []).map((e: { id: string }) => e.id)

  // 2. Participantes: distinct users con ≥1 predicción en esos eventos
  let participants: string[] = []
  if (eventIds.length > 0) {
    const { data: predRows } = await admin
      .from('ranked_predictions')
      .select('user_id')
      .in('event_id', eventIds)
    participants = [...new Set((predRows ?? []).map((r: { user_id: string }) => r.user_id))]
  }

  // 3. Podio: suma de puntos Mundial del ledger universal
  const { data: ptRows } = await admin
    .from('point_transactions')
    .select('user_id, amount')
    .eq('source', 'ranked_prediction')
    .eq('sport', 'mundial')
    .gt('amount', 0)

  const byUser = new Map<string, { points: number; hits: number }>()
  for (const r of (ptRows ?? []) as Array<{ user_id: string; amount: number }>) {
    const prev = byUser.get(r.user_id) ?? { points: 0, hits: 0 }
    prev.points += r.amount
    prev.hits += 1
    byUser.set(r.user_id, prev)
  }
  const ranked: MundialPodiumEntry[] = [...byUser.entries()]
    .map(([userId, agg]) => ({ userId, points: agg.points, hits: agg.hits }))
    .sort((a, b) => b.points - a.points || b.hits - a.hits)

  return { participants, ranked }
}

/**
 * Cierra el Mundial 2026.
 *
 * @param admin       supabase service-role client (lee/escribe sin RLS)
 * @param opts.force  ignora el chequeo de fecha (testing/manual override)
 */
export async function closeMundial2026(
  admin: SupabaseClient,
  opts: { force?: boolean } = {},
): Promise<MundialClosureResult> {
  const now = new Date()
  if (!opts.force && now < MUNDIAL_CLOSE_DATE) {
    return {
      ok: false,
      reason: `Mundial aún no ha terminado (${MUNDIAL_CLOSE_DATE.toISOString()}). Usa force=true para override.`,
      mundialistas: 0,
      top3: [],
      badgesAwarded: 0,
    }
  }

  const { participants, ranked } = await computeMundialPodium(admin)

  if (participants.length === 0) {
    return {
      ok: true,
      reason: 'No hubo participantes — nada que cerrar.',
      mundialistas: 0,
      top3: [],
      badgesAwarded: 0,
    }
  }

  const top3 = ranked.slice(0, 3)

  // Profile lookup para nicknames del podio
  const { data: profileRows } = await admin
    .from('profiles')
    .select('id, display_name')
    .in('id', top3.map(t => t.userId))
  const nameById = new Map<string, string>()
  for (const p of profileRows ?? []) {
    const n = (p.display_name as string | null)?.trim()
    if (n) nameById.set(p.id as string, n)
  }

  // ── Otorgar badges ──────────────────────────────────────────────
  let totalBadges = 0

  // Backstop idempotente: mundialista_2026 a todos los participantes
  // reales. El camino canónico es predictions/route.ts (al primer pick);
  // esto solo recupera fallos best-effort de aquel. awardBadges es
  // idempotente, así que en el caso normal otorga 0 nuevos.
  const chunkSize = 20
  for (let i = 0; i < participants.length; i += chunkSize) {
    const chunk = participants.slice(i, i + chunkSize)
    await Promise.all(chunk.map(async uid => {
      const result = await awardBadges(admin, uid, ['mundialista_2026'])
      totalBadges += result.awarded.length
    }))
  }

  // top3_mundial_2026 a los 3 primeros del podio
  for (const t of top3) {
    const result = await awardBadges(admin, t.userId, ['top3_mundial_2026'])
    totalBadges += result.awarded.length
  }

  // Heurística "ya cerrado": si TODOS los badges ya estaban, este re-run
  // no otorgó nada nuevo.
  const alreadyClosed = totalBadges === 0 && participants.length > 0

  return {
    ok: true,
    mundialistas: participants.length,
    top3: top3.map(t => ({
      userId: t.userId,
      nickname: nameById.get(t.userId) ?? `Jugador-${t.userId.slice(0, 6)}`,
      points: t.points,
      hits: t.hits,
    })),
    badgesAwarded: totalBadges,
    alreadyClosed,
  }
}
