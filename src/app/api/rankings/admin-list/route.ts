// Endpoint privado para el Admin UI. Devuelve entries completas (con cols _auto
// y _manual) de una categoría, ordenadas por rank (vista ranking_view).
// Auth: x-admin-token igual que el resto de endpoints de rankings.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/admin-auth'
import {
  RANKING_JUGADORES, RANKING_JUGADORAS, RANKING_CLUBES, RANKING_CLUBES_FEMENINO,
  RANKING_ENTRENADORES, RANKING_CREADORES, RANKING_PERIODISTAS,
  RANKING_LUCHADORAS_UFC, RANKING_CREADORES_WWE,
  RANKING_JUGADORES_SUB21, RANKING_JUGADORES_LATAM, RANKING_JUGADORES_CONCACAF,
  type RankingEntry,
} from '@/lib/rankings'

async function checkAuth(req: NextRequest): Promise<boolean> {
  return isAdminRequest(req, {
    headerName: 'x-admin-token',
    tokenEnv: process.env.RANKINGS_ADMIN_TOKEN,
  })
}

const STATIC_FALLBACK: Record<string, RankingEntry[]> = {
  jugadores:       RANKING_JUGADORES,
  jugadoras:       RANKING_JUGADORAS,
  clubes:          RANKING_CLUBES,
  clubes_femenino: RANKING_CLUBES_FEMENINO,
  entrenadores:    RANKING_ENTRENADORES,
  creadores:       RANKING_CREADORES,
  periodistas:     RANKING_PERIODISTAS,
  luchadoras_ufc:  RANKING_LUCHADORAS_UFC,
  creadores_wwe:   RANKING_CREADORES_WWE,
  sub21:           RANKING_JUGADORES_SUB21,
  latam:           RANKING_JUGADORES_LATAM,
  concacaf:        RANKING_JUGADORES_CONCACAF,
}

export async function GET(req: NextRequest) {
  if (!(await checkAuth(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url      = new URL(req.url)
  const category = url.searchParams.get('category') ?? 'jugadores'

  const sb = adminSupabase()
  if (!sb) {
    // Sin Supabase: fallback al estático
    const entries = (STATIC_FALLBACK[category] ?? []).map(e => ({
      id: e.id, category, name: e.name, subtitle: e.subtitle,
      rank: e.rank, score: e.score, trend: e.trend, insight: e.insight,
      editorial_locked: false,
      rank_auto: e.rank, rank_manual: null,
      score_auto: e.score, score_manual: null,
      insight_auto: e.insight, insight_manual: null,
      editorial_boost: e.editorialBoost ?? null,
      editorial_note: e.editorialNote ?? null,
      score_prev: e.scorePrev ?? null,
    }))
    return NextResponse.json({ entries, source: 'static' })
  }

  // Consulta a ranking_view (vista que aplica overrides) + ranking_entries (raw cols)
  const { data: viewData, error: viewErr } = await sb
    .from('ranking_view')
    .select('id, rank, score, trend, insight')
    .eq('category', category)
    .order('rank', { ascending: true })

  const { data: rawData, error: rawErr } = await sb
    .from('ranking_entries')
    .select([
      'id', 'name', 'subtitle', 'score_prev',
      'rank_auto', 'rank_manual',
      'score_auto', 'score_manual',
      'insight_auto', 'insight_manual',
      'editorial_boost', 'editorial_note', 'editorial_locked',
    ].join(','))
    .eq('category', category)

  if (viewErr || rawErr || !viewData || !rawData) {
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  // DB vacía (aún no se ha sembrado) → fallback al estático
  if (viewData.length === 0) {
    const entries = (STATIC_FALLBACK[category] ?? []).map(e => ({
      id: e.id, category, name: e.name, subtitle: e.subtitle,
      rank: e.rank, score: e.score, trend: e.trend, insight: e.insight,
      editorial_locked: false,
      rank_auto: e.rank, rank_manual: null,
      score_auto: e.score, score_manual: null,
      insight_auto: e.insight, insight_manual: null,
      editorial_boost: e.editorialBoost ?? null,
      editorial_note: e.editorialNote ?? null,
      score_prev: e.scorePrev ?? null,
    }))
    return NextResponse.json({ entries, source: 'static' })
  }

  // Mergear vista (rank/score finales) con tabla raw (cols _auto/_manual)
  const rawMap = new Map(rawData.map((r: any) => [r.id, r]))

  const entries = viewData.map((v: any) => {
    const raw = rawMap.get(v.id) ?? {}
    return {
      id: v.id,
      category,
      name:     raw.name     ?? v.id,
      subtitle: raw.subtitle ?? '',
      rank:  v.rank,
      score: v.score,
      trend: v.trend ?? 'flat',
      insight: v.insight ?? null,
      editorial_locked: raw.editorial_locked ?? false,
      rank_auto:    raw.rank_auto    ?? null,
      rank_manual:  raw.rank_manual  ?? null,
      score_auto:   raw.score_auto   ?? null,
      score_manual: raw.score_manual ?? null,
      insight_auto:   raw.insight_auto   ?? null,
      insight_manual: raw.insight_manual ?? null,
      editorial_boost: raw.editorial_boost ?? null,
      editorial_note:  raw.editorial_note  ?? null,
      score_prev: raw.score_prev ?? null,
    }
  })

  return NextResponse.json({ entries, source: 'db' })
}
