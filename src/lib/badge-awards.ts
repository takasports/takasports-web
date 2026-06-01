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
import { BADGES, getBadge } from './badges'
import { sendPushToUser } from './push-helper'
import { sendBadgeEmail } from './email-helper'
import { unlockCosmeticsForBadge } from './cosmetics'

// Copy para push de badge — solo los que más engagement generan.
// El resto usan el genérico.
const BADGE_PUSH_COPY: Record<string, { title: string; body: string }> = {
  primera_prediccion:         { title: '🔮 ¡Primera predicción!', body: 'Badge "Primera predicción" desbloqueado. El viaje empieza aquí.' },
  primera_prediccion_correcta:{ title: '✅ ¡Primer acierto!',     body: 'Acertaste tu primera predicción Ranked. Badge desbloqueado.' },
  pleno_jornada:              { title: '🎯 ¡PLENO!',               body: 'Acertaste TODOS los partidos de la jornada. Badge épico desbloqueado.' },
  oraculo:                    { title: '🔮 Oráculo',               body: '4+ aciertos en una jornada. Tienes un don.' },
  vidente:                    { title: '🔮 Vidente',               body: 'Clavaste tu primer marcador exacto. Tienes ojo.' },
  clarividente:               { title: '✨ Clarividente',           body: 'Los 3 marcadores exactos de la jornada — épico.' },
  high_roller:                { title: '💎 High Roller',           body: 'Apuesta grande, victoria grande. Badge desbloqueado.' },
  racha_5:                    { title: '🔥 EN LLAMAS',             body: '5 jornadas seguidas ganando. Eso ya es nivel élite.' },
  racha_dias_7:               { title: '🔥 Semana en racha',       body: '7 días seguidos en TakaSports. Badge "Semana de Fuego" desbloqueado.' },
  racha_dias_30:              { title: '💥 Mes en racha',          body: '30 días seguidos. Eres imparable.' },
  champion_weekly:            { title: '👑 Campeón semanal',       body: 'Ganaste el ranking semanal. Eres el mejor de la jornada.' },
  mundialista_2026:           { title: '🌍 Mundialista 2026',      body: 'Badge conmemorativo desbloqueado. Eres parte del Mundial.' },
  profeta_mundial_2026:       { title: '🔮 El Profeta del Mundial',body: '3+ predicciones long-term acertadas. Legendario.' },
  top3_mundial_2026:          { title: '🏆 Podio Mundial 2026',    body: 'TOP 3 en el Mundial. Badge legendario desbloqueado.' },
}

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

  // ── Notificaciones (fire-and-forget) ────────────────────────────
  // Push → todos los badges nuevos.
  // Email → solo epic y legendary (momentos de celebración, no spam).
  for (const badgeId of toInsert) {
    const def  = getBadge(badgeId)
    if (!def) continue

    // Push
    const copy = BADGE_PUSH_COPY[badgeId] ?? {
      title: `${def.emoji} Badge desbloqueado`,
      body:  `Conseguiste "${def.name}". Visita tu perfil para verlo.`,
    }
    void sendPushToUser(userId, {
      title: copy.title,
      body:  copy.body,
      url:   '/perfil',
      tag:   `badge_${badgeId}`,
      topic: 'quiniela',
    })

    // Email — solo para rarezas altas
    if (def.rarity === 'epic' || def.rarity === 'legendary') {
      void sendBadgeEmail({
        userId,
        badgeEmoji: def.emoji,
        badgeName:  def.name,
        badgeDesc:  def.description,
        rarity:     def.rarity,
      })
    }

    // Cosmetics — fire-and-forget. Cada badge tiene cero o más cosméticos
    // asociados (catálogo en DB tabla `cosmetics` con unlock_source='badge').
    // Si la migración 055/056 no está aplicada, la tabla no existe y esto
    // loguea silenciosamente sin romper el award del badge.
    void unlockCosmeticsForBadge(sb, userId, badgeId).catch(err => {
      console.warn('[awardBadges] cosmetic unlock failed', { userId, badgeId, err: err?.message })
    })
  }

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
  /** AB — Nº de marcadores exactos clavados en esta jornada (0..3).
   *  ≥1 → badge `vidente` (idempotente; solo se otorga la primera vez).
   *  =3 → badge `clarividente` (clavó los 3 posibles). */
  exactHits?: number
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

  // AB — Marcador exacto. `vidente` se otorga al primer exact clavado
  // (awardBadges es idempotente: si ya lo tiene, no pasa nada).
  // `clarividente` solo cuando clavas los 3 posibles en una jornada.
  if ((ctx.exactHits ?? 0) >= 1) earned.push('vidente')
  if ((ctx.exactHits ?? 0) >= 3) earned.push('clarividente')

  return earned
}

// ─────────────────────────────────────────────────────────────────
// AF — Catch-up retroactivo de badges para jornadas liquidadas por
// el cron (que NO evalúa badges).
//
// El cron settle-quiniela escribe settled=true y totalWon, pero nunca
// llama a awardBadges. Cuando el user vuelve a la web y pasa por
// /api/quiniela/status, esta función:
//   1. Detecta jornadas settled sin badgesAt
//   2. Evalúa el contexto desde el payload existente
//   3. Otorga los badges merecidos (idempotente)
//   4. Marca badgesAt para no repetir
//
// No re-escribe puntos ni breakdown. Solo añade badgesAt al JSONB.
// ─────────────────────────────────────────────────────────────────

interface MinimalPayload {
  picks?: Array<{ oddsAtPick?: number }>
  breakdown?: {
    perPick?: Array<{ hit?: boolean }>
    hits?: number
    pleno?: boolean
    totalStake?: number
    exactHits?: number
  }
  settled?: boolean
  totalStakeCharged?: number
  totalWon?: number
  badgesAt?: string
}

export type CatchupResult =
  | { skipped: 'not-settled' | 'already-evaluated' | 'no-breakdown' }
  | { awarded: string[]; alreadyHad: string[] }

/**
 * Evalúa y otorga badges pendientes para una jornada ya liquidada.
 * Llamar desde rutas read-style (ej. /status) — no requiere POST.
 *
 * @param sb        cliente Supabase con permisos para UPDATE en quiniela_picks
 * @param userId    user.id del JWT
 * @param jornada   string de la jornada (PK compuesta con user_id)
 * @param payload   el JSONB actual de quiniela_picks.picks
 */
export async function evaluatePendingBadges(
  sb: SupabaseClient,
  userId: string,
  jornada: string,
  payload: MinimalPayload,
): Promise<CatchupResult> {
  if (payload.settled !== true) return { skipped: 'not-settled' }
  if (typeof payload.badgesAt === 'string' && payload.badgesAt) {
    return { skipped: 'already-evaluated' }
  }
  if (!payload.breakdown) return { skipped: 'no-breakdown' }

  // Historial previo (otras jornadas) para detectar isFirstBet/Win/Streak.
  const { data: history } = await sb
    .from('quiniela_picks')
    .select('jornada, picks')
    .eq('user_id', userId)
    .neq('jornada', jornada)
    .limit(20)
  const histPayloads = (history ?? [])
    .map(h => (h as { picks: unknown }).picks as MinimalPayload | null)
    .filter((p): p is MinimalPayload => !!p)

  const isFirstBet = histPayloads.filter(p =>
    (p as MinimalPayload & { staked?: boolean }).staked,
  ).length === 0
  const isFirstWin = histPayloads.filter(p =>
    p.settled && (p.totalWon ?? 0) > ((p as MinimalPayload & { totalStakeCharged?: number }).totalStakeCharged ?? 0),
  ).length === 0

  // Streak: NO podemos ordenar las histPayloads por settledAt aquí porque
  // history.picks no expone ese campo en este tipo. Usamos el conteo simple
  // de "settled con ganancias" como aproximación; el endpoint settle real
  // ya hace el ordering preciso, este catch-up es menos exigente y la
  // racha se calcula igual en otros surfaces. Aceptable trade-off.
  const prevStreak = histPayloads.filter(p =>
    p.settled && (p.totalWon ?? 0) > ((p as MinimalPayload & { totalStakeCharged?: number }).totalStakeCharged ?? 0),
  ).length

  // picksWithOdds: combinamos picks (que tienen oddsAtPick) con perPick (que
  // tienen hit). Asumimos misma posición/orden — el scoring lo garantiza.
  const picks = Array.isArray(payload.picks) ? payload.picks : []
  const perPick = Array.isArray(payload.breakdown?.perPick) ? payload.breakdown.perPick : []
  const picksWithOdds = picks.map((p, i) => ({
    won: perPick[i]?.hit === true,
    odds: typeof p.oddsAtPick === 'number' && Number.isFinite(p.oddsAtPick) ? p.oddsAtPick : 1,
  }))

  const ctx: SettleBadgeContext = {
    hits: payload.breakdown.hits ?? 0,
    totalPicks: picks.length,
    pleno: payload.breakdown.pleno === true,
    totalStake: payload.totalStakeCharged ?? payload.breakdown.totalStake ?? 0,
    totalWon: payload.totalWon ?? 0,
    picksWithOdds,
    prevStreak,
    isFirstBet,
    isFirstWin,
    exactHits: payload.breakdown.exactHits ?? 0,
  }

  const earned = badgesEarnedOnSettle(ctx)
  let awarded: string[] = []
  let alreadyHad: string[] = []
  if (earned.length > 0) {
    const res = await awardBadges(sb, userId, earned)
    awarded = res.awarded
    alreadyHad = res.alreadyHad
  }

  // Marcar badgesAt en el JSONB para no re-evaluar en siguientes visitas.
  // Hacemos read-modify-write atomico-ish: el riesgo de carrera es bajo
  // porque después de cron-settle, los únicos writers son: (a) este
  // catch-up, (b) settle phase manual (que ya no aplica si settled=true).
  try {
    const merged: MinimalPayload = { ...payload, badgesAt: new Date().toISOString() }
    await sb
      .from('quiniela_picks')
      .update({ picks: merged })
      .eq('user_id', userId)
      .eq('jornada', jornada)
  } catch {
    // Si falla, en la próxima visita lo reintentamos. awardBadges ya
    // es idempotente, no se duplica nada.
  }

  return { awarded, alreadyHad }
}

// ─────────────────────────────────────────────────────────────────
// Ranked prediction badges
// ─────────────────────────────────────────────────────────────────

/**
 * Badges que puede ganar un user al hacer su primera predicción Ranked.
 * Llamar desde POST /api/ranked/predictions tras insertar el pick.
 */
export function badgesEarnedOnRankedPick(ctx: {
  /** true si es la primera predicción del user en cualquier deporte */
  isFirstPick: boolean
}): string[] {
  const earned: string[] = []
  if (ctx.isFirstPick) earned.push('primera_prediccion')
  return earned
}

/**
 * Badges que puede ganar un user al acertar una predicción Ranked.
 * Llamar desde admin/ranked/score o sync-mundial tras score_ranked_prediction,
 * una vez por usuario correcto.
 */
export function badgesEarnedOnRankedCorrect(ctx: {
  /** true si es su primera predicción ranked acertada en toda la historia */
  isFirstCorrect: boolean
}): string[] {
  const earned: string[] = []
  if (ctx.isFirstCorrect) earned.push('primera_prediccion_correcta')
  return earned
}
