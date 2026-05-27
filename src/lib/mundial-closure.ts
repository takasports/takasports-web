// ─────────────────────────────────────────────────────────────────
// Mundial 2026 — lógica de cierre del torneo.
//
// Esta lógica SOLO se ejecuta cuando un admin dispara el endpoint
// /api/admin/mundial/close (manualmente, post-final 19 jul 2026). Por
// seguridad el endpoint NO se ejecuta antes de la fecha de cierre
// salvo override explícito por env (QUINIELA_FORCE_MUNDIAL_CLOSE).
//
// Acciones que ejecuta closeMundial2026():
//   1. Lee todos los user_ids únicos que sellaron ≥1 jornada del
//      Mundial (jornada ILIKE 'Mundial%', staked=true).
//   2. Otorga badge "mundialista_2026" a TODOS ellos (idempotente).
//   3. Computa ranking acumulado (sum totalCoins por user).
//   4. Otorga "top3_mundial_2026" a los TOP 3.
//   5. Devuelve resumen para auditoría.
//
// NO toca el wallet de monedas — los premios del podio (camisetas)
// se gestionan offline por email, fuera del scope automatizable.
// ─────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { awardBadges } from './badge-awards'

/** Fecha de cierre oficial del torneo. UTC para evitar ambigüedad. */
export const MUNDIAL_CLOSE_DATE = new Date('2026-07-19T23:59:59Z')

export interface MundialClosureResult {
  ok: boolean
  reason?: string
  mundialistas: number       // users que recibieron mundialista_2026
  top3: Array<{ userId: string; nickname: string; coins: number; jornadas: number }>
  badgesAwarded: number      // total badges otorgados (mundialista + top3, sin doble-conteo)
  alreadyClosed?: boolean    // true si la mayoría ya tenía el badge (heurístico)
}

interface PickRow {
  user_id: string
  jornada: string
  picks: { staked?: boolean; breakdown?: { totalCoins?: number } } | null
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

  // 1. Lee TODOS los picks de jornadas Mundial
  const { data: rows, error } = await admin
    .from('quiniela_picks')
    .select('user_id, jornada, picks')
    .ilike('jornada', 'Mundial%')
  if (error) {
    return { ok: false, reason: error.message, mundialistas: 0, top3: [], badgesAwarded: 0 }
  }

  const stakedRows = (rows ?? []).filter((r): r is PickRow =>
    !!r && !!r.picks && (r.picks as { staked?: boolean }).staked === true
  )

  if (stakedRows.length === 0) {
    return {
      ok: true,
      reason: 'No hubo participantes — nada que cerrar.',
      mundialistas: 0,
      top3: [],
      badgesAwarded: 0,
    }
  }

  // 2. user_ids únicos que jugaron al menos una jornada del Mundial
  const participants = [...new Set(stakedRows.map(r => r.user_id))]

  // 3. Ranking acumulado por user_id
  const byUser = new Map<string, { coins: number; jornadas: number }>()
  for (const r of stakedRows) {
    const coins = r.picks?.breakdown?.totalCoins ?? 0
    const prev = byUser.get(r.user_id) ?? { coins: 0, jornadas: 0 }
    prev.coins += coins
    prev.jornadas += 1
    byUser.set(r.user_id, prev)
  }
  const ranked = [...byUser.entries()]
    .map(([userId, agg]) => ({ userId, coins: agg.coins, jornadas: agg.jornadas }))
    .sort((a, b) => b.coins - a.coins || b.jornadas - a.jornadas)
  const top3 = ranked.slice(0, 3)

  // 4. Profile lookup para nicknames del podio
  const { data: profileRows } = await admin
    .from('profiles')
    .select('id, display_name')
    .in('id', top3.map(t => t.userId))
  const nameById = new Map<string, string>()
  for (const p of profileRows ?? []) {
    const n = (p.display_name as string | null)?.trim()
    if (n) nameById.set(p.id as string, n)
  }

  // 5. Otorgar badges
  let totalBadges = 0
  // 5a. mundialista_2026 a todos los participantes (batch en chunks de 20)
  const chunkSize = 20
  for (let i = 0; i < participants.length; i += chunkSize) {
    const chunk = participants.slice(i, i + chunkSize)
    await Promise.all(chunk.map(async uid => {
      const result = await awardBadges(admin, uid, ['mundialista_2026'])
      totalBadges += result.awarded.length
    }))
  }

  // 5b. top3_mundial_2026 a los 3 primeros
  for (const t of top3) {
    const result = await awardBadges(admin, t.userId, ['top3_mundial_2026'])
    totalBadges += result.awarded.length
  }

  // Heurística "ya cerrado": si TODOS los participantes ya tenían el
  // mundialista_2026, este re-run no otorgó nada nuevo.
  const alreadyClosed = totalBadges === 0 && participants.length > 0

  return {
    ok: true,
    mundialistas: participants.length,
    top3: top3.map(t => ({
      userId: t.userId,
      nickname: nameById.get(t.userId) ?? `Jugador-${t.userId.slice(0, 6)}`,
      coins: t.coins,
      jornadas: t.jornadas,
    })),
    badgesAwarded: totalBadges,
    alreadyClosed,
  }
}
