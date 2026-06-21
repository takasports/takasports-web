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
  /** Si true, el badge es un "reto semanal" visible en la sidebar.
   *  El user debe reclamarlo manualmente para obtener badge + coin_bonus. */
  show_in_sidebar?: boolean
  coin_bonus?: number
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
    rankInJornada?: number  // 1-based, solo para top_n
  },
): boolean {
  switch (badge.criteria_type) {
    case 'pleno':
      return ctx.pleno
    case 'min_hits':
      return ctx.hits >= badge.criteria_value
    case 'all_participants':
      // La gana cualquiera que llegó al settle (selló su quiniela esa
      // jornada). Antes exigía un stake>0 del modelo de apuestas retirado,
      // así que NUNCA se otorgaba (stake siempre 0). El caller solo evalúa
      // boletos ya liquidados → la participación está garantizada.
      return true
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

// ─────────────────────────────────────────────────────────────────
// top_n — evaluación cross-user tras el CIERRE COMPLETO de una jornada.
//
// A diferencia de los otros criterios (pleno/min_hits/all_participants),
// top_n necesita rankear a TODOS los participantes entre sí, así que no
// puede evaluarse en el settle individual de cada usuario (score/route).
// Se ejecuta desde el cron settle-quiniela una vez la jornada no tiene
// boletos pendientes de liquidar. Idempotente: grantSpecialBadge no
// duplica, así que re-ejecutarlo cada pasada es inocuo.
// ─────────────────────────────────────────────────────────────────

/** Lee los special badges top_n activos, no expirados y con jornada
 *  concreta. Un top_n sin jornada es ambiguo ("¿top N de qué semana?")
 *  → se ignora. Devuelve [] si no hay ninguno (caso normal). */
export async function fetchActiveTopNBadges(sb: SupabaseClient): Promise<SpecialBadgeRow[]> {
  const nowIso = new Date().toISOString()
  const { data, error } = await sb
    .from('quiniela_special_badges')
    .select('*')
    .eq('active', true)
    .eq('criteria_type', 'top_n')
    .not('jornada', 'is', null)
    .or(`expires_at.gt.${nowIso},expires_at.is.null`)
  if (error || !data) return []
  return data as SpecialBadgeRow[]
}

interface SettledPickRow {
  user_id: string
  picks: { totalWon?: number } | null
}

export interface TopNEvalResult {
  badgesEvaluated: number   // top_n badges activos encontrados
  jornadasReady:   number   // jornadas completamente liquidadas evaluadas
  granted:         number   // badges otorgados (grant inmediato)
  completions:     number   // completions registradas (retos a reclamar)
}

/**
 * Dado un ranking YA ordenado por puntos descendente y N, devuelve los
 * user_ids que entran en el TOP N, incluyendo empates en el puesto de
 * corte (si dos comparten los puntos del puesto N, entran ambos). Pura y
 * testeable; el cap por max_grants se aplica fuera. Asume entrada ordenada.
 */
export function topNWinners(
  ranking: Array<{ user_id: string; points: number }>,
  n: number,
): string[] {
  if (ranking.length === 0 || n < 1) return []
  const cutoff = ranking[Math.min(n, ranking.length) - 1].points
  return ranking.filter(p => p.points >= cutoff).map(p => p.user_id)
}

/**
 * Evalúa y otorga todos los special badges top_n cuya jornada ya está
 * COMPLETAMENTE liquidada (sin boletos sellados pendientes). Rankea a los
 * participantes liquidados por puntos (totalWon) descendente y otorga a
 * los que entran en el TOP N (criteria_value), incluyendo empates en el
 * puesto de corte. Best-effort: un fallo por badge/jornada no aborta el
 * resto. Idempotente. Pensado para llamarse al final del cron de settle.
 */
export async function evaluateTopNBadges(sb: SupabaseClient): Promise<TopNEvalResult> {
  const out: TopNEvalResult = { badgesEvaluated: 0, jornadasReady: 0, granted: 0, completions: 0 }

  const badges = await fetchActiveTopNBadges(sb)
  if (badges.length === 0) return out   // caso normal: no-op barato
  out.badgesEvaluated = badges.length

  // Agrupar por jornada → rankear una sola vez por jornada aunque haya
  // varios top_n (p.ej. top_3 y top_10 de la misma semana).
  const byJornada = new Map<string, SpecialBadgeRow[]>()
  for (const b of badges) {
    const j = b.jornada as string
    const arr = byJornada.get(j) ?? []
    arr.push(b)
    byJornada.set(j, arr)
  }

  const nowIso = new Date().toISOString()

  for (const [jornada, jBadges] of byJornada) {
    // 1. ¿Quedan boletos sellados sin liquidar en esta jornada? Si sí, la
    //    jornada no ha cerrado del todo → esperar (no premiar a alguien que
    //    va primero a media liquidación y luego cae al añadirse más).
    const { data: pendingRows } = await sb
      .from('quiniela_picks')
      .select('id')
      .eq('jornada', jornada)
      .eq('picks->>staked', 'true')
      .or('picks->>settled.is.null,picks->>settled.eq.false')
      .limit(1)
    if (pendingRows && pendingRows.length > 0) continue
    out.jornadasReady++

    // 2. Ranking de la jornada: participantes liquidados, por puntos desc.
    const { data: settledRows } = await sb
      .from('quiniela_picks')
      .select('user_id, picks')
      .eq('jornada', jornada)
      .eq('picks->>settled', 'true')
    if (!settledRows || settledRows.length === 0) continue

    // Dedup por usuario (máximo de puntos) y solo quienes puntuaron (>0):
    // no tiene sentido un "TOP 3" que premie a alguien con 0 puntos por
    // ser de los pocos que jugaron.
    const byUser = new Map<string, number>()
    for (const r of settledRows as unknown as SettledPickRow[]) {
      const pts = r.picks?.totalWon ?? 0
      const prev = byUser.get(r.user_id) ?? -1
      if (pts > prev) byUser.set(r.user_id, pts)
    }
    const ranking = [...byUser.entries()]
      .map(([user_id, points]) => ({ user_id, points }))
      .filter(p => p.points > 0)
      .sort((a, b) => b.points - a.points)
    if (ranking.length === 0) continue

    // 3. Para cada badge: los del TOP N (empates de corte incluidos),
    //    acotado por max_grants. Llevamos el contador localmente para
    //    respetar el cap aunque haya varios ganadores en el mismo bucle.
    for (const badge of jBadges) {
      const winnerIds = topNWinners(ranking, badge.criteria_value)
      let grantedCount = badge.granted_count
      for (const uid of winnerIds) {
        if (badge.show_in_sidebar) {
          // Reto a reclamar: completion idempotente; badge+coin_bonus al claim.
          const { error } = await sb
            .from('quiniela_challenge_completions')
            .upsert(
              { user_id: uid, badge_id: badge.badge_id, jornada, completed_at: nowIso },
              { onConflict: 'user_id,badge_id,jornada', ignoreDuplicates: true },
            )
          if (!error) out.completions++
        } else {
          if (badge.max_grants > 0 && grantedCount >= badge.max_grants) break
          const res = await grantSpecialBadge(sb, { ...badge, granted_count: grantedCount }, uid)
          if (res === 'granted') { out.granted++; grantedCount++ }
        }
      }
    }
  }

  return out
}
