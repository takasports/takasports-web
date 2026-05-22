// ─────────────────────────────────────────────────────────────────
// Quiniela — lógica de scoring que toca Supabase.
// SE IMPORTA SOLO DESDE ROUTES SERVER-SIDE. Nunca desde 'use client'.
//
// Mantenemos lib/quiniela.ts (shared cliente/server) puro y sin
// dependencias de Supabase. Aquí van los wrappers que persisten en BD.
// ─────────────────────────────────────────────────────────────────

import { scorePicks, type SavedPick, type MatchResult, type Pick } from './quiniela'
import { adminSupabase } from './supabase-admin'

interface LeagueMatchKey { home: string; away: string; isoDate?: string; espnId?: string }
interface DbLeagueMember {
  user_id: string
  nickname: string
  picks: Record<string, Pick> | null
  exact_scores: Record<string, { home: number; away: number }> | null
  captain_idx: number | null
}

export interface PersistLeagueScoresResult {
  persisted: number
  skipped: number
  jornada: string | null
}

/**
 * Calcula y persiste scores reales de todos los miembros de una liga
 * para la jornada actual de esa liga.
 *
 * · Idempotente: upsert por (league_id, user_id, jornada). Llamar N
 *   veces deja el mismo resultado final.
 * · Defensivo: si la liga no existe, no hay resultados, no hay
 *   miembros, o Supabase no está configurado → retorna 0 sin errores.
 * · No requiere auth de usuario: se ejecuta con service_role para
 *   poder escribir saltando la RLS de la tabla de scores.
 *
 * @param leagueId  Código de la liga (6 chars upper).
 * @param results   Resultados oficiales finalizados (de /api/quiniela/results).
 *                  Si viene vacío, los scores quedarán en 0 — comportamiento
 *                  correcto cuando la jornada aún no ha cerrado.
 */
export async function persistLeagueScores(
  leagueId: string,
  results: MatchResult[],
): Promise<PersistLeagueScoresResult> {
  const sb = adminSupabase()
  if (!sb) return { persisted: 0, skipped: 0, jornada: null }

  const { data: league } = await sb
    .from('quiniela_leagues')
    .select('jornada, match_keys')
    .eq('id', leagueId)
    .maybeSingle()
  if (!league) return { persisted: 0, skipped: 0, jornada: null }

  const matchKeys = (league.match_keys ?? []) as LeagueMatchKey[]
  const jornada = String(league.jornada ?? '')
  if (matchKeys.length === 0 || !jornada) return { persisted: 0, skipped: 0, jornada }

  const { data: members } = await sb
    .from('quiniela_league_members')
    .select('user_id, nickname, picks, exact_scores, captain_idx')
    .eq('league_id', leagueId)
  if (!members || members.length === 0) return { persisted: 0, skipped: 0, jornada }

  const nowIso = new Date().toISOString()
  let skipped = 0

  const rows = (members as DbLeagueMember[]).map(m => {
    if (!m.user_id) { skipped++; return null }

    const memberPicks = m.picks ?? {}
    const memberExact = m.exact_scores ?? {}

    // Reconstruimos el array de SavedPick alineado a matchKeys.
    // Solo incluimos índices donde el miembro tiene pick (vacíos no puntúan).
    const indexedPicks: { idx: number; pick: SavedPick }[] = []
    matchKeys.forEach((mk, i) => {
      const pk = memberPicks[String(i)]
      if (!pk) return
      const ex = memberExact[String(i)]
      indexedPicks.push({
        idx: i,
        pick: {
          home: mk.home,
          away: mk.away,
          pick: pk,
          exactHome: ex?.home,
          exactAway: ex?.away,
        },
      })
    })

    // captainIdx en SavedPick[] es el índice DENTRO del array filtrado.
    // Si el capitán original cae en un índice sin pick, no aplicamos.
    let captainInFiltered: number | undefined
    if (m.captain_idx != null) {
      const pos = indexedPicks.findIndex(p => p.idx === m.captain_idx)
      if (pos >= 0) captainInFiltered = pos
    }

    if (indexedPicks.length === 0) {
      // Miembro sin picks → fila con ceros (mantiene presencia en ranking).
      return {
        league_id: leagueId,
        user_id: m.user_id,
        jornada,
        points: 0, hits: 0, exacts: 0, pleno: false,
        computed_at: nowIso,
      }
    }

    const breakdown = scorePicks(
      indexedPicks.map(p => p.pick),
      results,
      captainInFiltered,
    )

    return {
      league_id: leagueId,
      user_id: m.user_id,
      jornada,
      points: Math.round(breakdown.totalPoints * 100) / 100,
      hits: breakdown.hits,
      exacts: breakdown.exacts,
      // Pleno solo si llenó TODOS los partidos de la liga (no solo los suyos).
      pleno: breakdown.pleno && indexedPicks.length === matchKeys.length,
      computed_at: nowIso,
    }
  }).filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length === 0) return { persisted: 0, skipped, jornada }

  const { error } = await sb
    .from('quiniela_league_member_scores')
    .upsert(rows, { onConflict: 'league_id,user_id,jornada' })
  if (error) {
    // No interrumpimos el flujo del caller: devolvemos 0 persistidos.
    // El cliente sigue calculando standings en vivo (computeStandings).
    console.error('[persistLeagueScores]', error.message)
    return { persisted: 0, skipped: skipped + rows.length, jornada }
  }

  return { persisted: rows.length, skipped, jornada }
}
