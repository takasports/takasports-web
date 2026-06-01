// GET /api/quiniela/status
//
// Endpoint LIGERO para el CTA "La Porra" del Header.
// Devuelve el estado mínimo necesario para renderizar el badge dinámico:
//
//   · jornada activa (string) y deadline (ISO del primer partido)
//   · total de partidos en la jornada
//   · si el user está logueado: hasPicked + picksCount
//
// Reutiliza el cache de /api/quiniela (30 min) vía fetch interna.
// Cache HTTP: 60s SWR para que el header no machaque al servidor.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getQuinielaData } from '@/app/api/quiniela/route'

export const dynamic = 'force-dynamic'

interface PicksRow {
  picks: {
    picks?: Array<{ home?: string; away?: string; pick?: string }>
    staked?: boolean
  } | null
}

interface SettledRow {
  jornada: string
  picks: {
    picks?: Array<{ pick?: string }>
    /** Estructura real (lib/quiniela.ts):
     *   breakdown.perPick: Array<{ hit, cancelled, points, coins, featuredBonus, exactBonus, ... }>
     *   breakdown.hits:    nº total de aciertos (atajo)
     *   breakdown.featuredHit: true si el user clavó el featured (x2 aplicado)
     *   breakdown.exactHits: nº de marcadores exactos acertados (E3) */
    breakdown?: {
      perPick?: Array<{ hit?: boolean; cancelled?: boolean; featuredBonus?: boolean; exactBonus?: boolean }>
      hits?: number
      featuredHit?: boolean
      exactHits?: number
    }
    settled?: boolean
    staked?: boolean
    totalWon?: number
    settledAt?: string
    stakedAt?: string
  } | null
}

export async function GET() {
  // 1. Estado de la jornada — llamada directa al builder (mismo cache módulo).
  let jornada: string | null = null
  let deadline: string | null = null
  let totalMatches = 0
  let matches: Array<{
    home: string; away: string; comp: string; kickoff: string;
    homeLogo?: string; awayLogo?: string;
    odds?: { home: number; draw: number; away: number };
    featured?: boolean;
  }> = []
  try {
    const data = await getQuinielaData()
    jornada = data.jornada
    const raw = data.matches ?? []
    totalMatches = raw.length
    const sorted = [...raw].sort((a, b) =>
      (a.isoDate ?? '').localeCompare(b.isoDate ?? ''),
    )
    deadline = sorted[0]?.isoDate ?? null
    matches = sorted.map((m) => ({
      home: m.home,
      away: m.away,
      comp: m.comp,
      kickoff: m.isoDate,
      homeLogo: m.homeLogo,
      awayLogo: m.awayLogo,
      odds: m.odds,
      featured: m.isFeatured,
    }))
  } catch {
    // Silencioso — el CTA tiene fallback estático en cliente.
  }

  // 2. Estado del user (si hay sesión).
  let isAuthed = false
  let hasPicked = false
  let picksCount = 0
  let lastSettled: {
    jornada: string
    totalWon: number
    correctCount: number
    totalPicks: number
    settledAt: string | null
    featuredHit?: boolean
    exactHits?: number
  } | null = null
  /** Streak: nº de jornadas consecutivas selladas (staked=true) por el user
   *  ordenadas por stakedAt DESC. Si la última jornada cerrada no fue
   *  sellada → streak=0 (se rompió). */
  let streakCurrent = 0
  /** Picks del user para la jornada activa (K). Cliente los cruza con
   *  /api/events/live para mostrar resultados parciales en el hero. */
  let userPicks: Array<{ home: string; away: string; pick: string }> = []
  /** Nº de usuarios distintos que sellaron picks en la jornada activa
   *  (proxy de "engagement esta semana" para social proof). */
  let weeklyParticipants = 0

  // F5 — Un único Supabase client reutilizado por todas las consultas
  // (antes hacíamos createServerSupabaseClient() dos veces).
  const sb = await createServerSupabaseClient()

  // 1bis. Engagement de la jornada activa (proxy para social proof).
  // Filtramos picks->>'staked' = 'true' para no contar filas huérfanas
  // y nos aseguramos que la RLS permita el count anónimo (si no, queda 0).
  if (jornada) {
    try {
      const { count } = await sb
        .from('quiniela_picks')
        .select('user_id', { count: 'exact', head: true })
        .eq('jornada', jornada)
        .eq('picks->>staked', 'true')
      if (typeof count === 'number' && Number.isFinite(count)) {
        weeklyParticipants = Math.max(0, count)
      }
    } catch { /* silencioso */ }
  }
  try {
    const { data: { user } } = await sb.auth.getUser()
    if (user) {
      isAuthed = true
      if (jornada) {
        const { data } = await sb
          .from('quiniela_picks')
          .select('picks')
          .eq('user_id', user.id)
          .eq('jornada', jornada)
          .maybeSingle<PicksRow>()
        // Solo cuenta como "ya jugado" si la jornada está sellada (staked=true).
        // Las filas con picks tentativos sin sellar NO bloquean el CTA "TE FALTA".
        const staked = data?.picks?.staked === true
        if (staked) {
          const arr = data?.picks?.picks ?? []
          picksCount = Array.isArray(arr) ? arr.filter((p) => !!p?.pick).length : 0
          hasPicked = picksCount > 0
          // K: picks del user para cruzar con live scores en el cliente.
          if (Array.isArray(arr)) {
            userPicks = arr
              .filter((p) => p && typeof p.home === 'string' && typeof p.away === 'string' && !!p.pick)
              .map((p) => ({ home: p.home as string, away: p.away as string, pick: p.pick as string }))
          }
        }
      }

      // Última jornada liquidada del user (para toast post-jornada).
      // Filtramos client-side por `settled=true` y elegimos la más reciente
      // por `settledAt` (orden lexicográfico de "jornada" no es fiable —
      // "Jornada 9" > "Jornada 38" lexicográficamente).
      // No usamos .order() porque desconocemos qué columnas timestamp tiene
      // la tabla en prod. Filtramos y ordenamos client-side por settledAt
      // dentro del JSONB. Limit 32 para cubrir varias jornadas históricas.
      const { data: rows } = await sb
        .from('quiniela_picks')
        .select('jornada, picks')
        .eq('user_id', user.id)
        .limit(32)
      const userRows = (rows as SettledRow[] | null ?? [])
      const settledRows = userRows.filter((r) => r.picks?.settled === true)
      settledRows.sort((a, b) => {
        const ta = a.picks?.settledAt ?? ''
        const tb = b.picks?.settledAt ?? ''
        return tb.localeCompare(ta) // desc
      })

      // STREAK (M): jornadas consecutivas selladas. Como no tenemos una
      // tabla de "todas las jornadas existentes", aproximamos por el gap
      // entre stakedAt timestamps: si dos jornadas consecutivas se sellaron
      // dentro de 14 días, las consideramos consecutivas; si el gap es
      // mayor, asumimos que el user se saltó alguna y reseteamos la racha.
      interface StakedTuple { jornada: string; stakedAt: number }
      const stakedTuples: StakedTuple[] = userRows
        .filter((r) => r.picks?.staked === true)
        .map((r) => {
          const s = typeof r.picks?.stakedAt === 'string'
            ? Date.parse(r.picks.stakedAt) : NaN
          return { jornada: r.jornada, stakedAt: s }
        })
        .filter((t) => t.jornada && Number.isFinite(t.stakedAt))
        .sort((a, b) => b.stakedAt - a.stakedAt) // más reciente primero
      // F6 — Streak gap: jornadas semanales son 7d, Mundial son ~3d.
      // 8d cubre semanal con margen y rompe la racha si te saltas
      // claramente una jornada Mundial (sin ser estricto en weekends).
      const STREAK_GAP_MAX_MS = 8 * 24 * 3_600_000
      let streak = 0
      for (let i = 0; i < stakedTuples.length; i++) {
        if (i === 0) { streak = 1; continue }
        const gap = stakedTuples[i - 1].stakedAt - stakedTuples[i].stakedAt
        if (gap > STREAK_GAP_MAX_MS) break
        streak += 1
      }
      streakCurrent = streak
      const settledRow = settledRows[0]
      if (settledRow && typeof settledRow.jornada === 'string' && settledRow.jornada.length > 0) {
        const arr = Array.isArray(settledRow.picks?.picks) ? settledRow.picks!.picks! : []
        const totalPicks = arr.filter((p) => !!p?.pick).length
        // Hits del breakdown: usa `breakdown.hits` (atajo) y si no hay,
        // cuenta `perPick.filter(p => p.hit && !p.cancelled)`.
        const perPick = Array.isArray(settledRow.picks?.breakdown?.perPick)
          ? settledRow.picks!.breakdown!.perPick!
          : []
        const correctFromPerPick = perPick.filter((p) => p?.hit === true && p?.cancelled !== true).length
        const hitsField = settledRow.picks?.breakdown?.hits
        const correctCount = typeof hitsField === 'number' && Number.isFinite(hitsField)
          ? hitsField
          : correctFromPerPick
        const totalWonField = settledRow.picks?.totalWon
        const totalWon = typeof totalWonField === 'number' && Number.isFinite(totalWonField)
          ? Math.max(0, Math.floor(totalWonField))
          : 0
        // Clamp defensivo: correctCount nunca puede superar totalPicks.
        const safeCorrect = Math.max(0, Math.min(correctCount, totalPicks))
        // Sólo publicamos lastSettled si tiene sentido (≥1 pick). Evita
        // toasts con "0/0" si una jornada se persistió huérfana.
        if (totalPicks > 0) {
          lastSettled = {
            jornada: settledRow.jornada,
            totalWon,
            correctCount: safeCorrect,
            totalPicks,
            settledAt: typeof settledRow.picks?.settledAt === 'string'
              ? settledRow.picks!.settledAt!
              : null,
            featuredHit: settledRow.picks?.breakdown?.featuredHit === true,
            exactHits: (() => {
              // E4 — Si el cron escribió `exactHits` (lib actualizada), úsalo;
              // si no, fallback contando flags en perPick (compat con rows
              // viejas con breakdown sin el campo agregado).
              const direct = settledRow.picks?.breakdown?.exactHits
              if (typeof direct === 'number' && Number.isFinite(direct)) {
                return Math.max(0, Math.floor(direct))
              }
              const arr = settledRow.picks?.breakdown?.perPick
              if (!Array.isArray(arr)) return 0
              return arr.filter((p) => p?.exactBonus === true).length
            })(),
          }
        }
      }
    }
  } catch {
    // sin sesión / sin Supabase → estado guest
  }

  // P — Comparativa con amigos: promedio de aciertos de la última jornada
  // entre miembros de tus ligas privadas. Solo se intenta si:
  //   · user autenticado
  //   · existe lastSettled (hay una jornada cerrada que compartir)
  // Se hace en silencio: si falla la query, friends queda null.
  let friendsAvgHits: number | null = null
  let friendsCount = 0
  /** R — Mejor ranking del user entre sus ligas privadas (la liga donde
   *  saca su mejor posición, para social proof positivo). */
  let bestLeagueRank: {
    leagueId: string
    leagueName: string
    rank: number
    total: number
    myPoints: number
  } | null = null
  if (lastSettled) {
    try {
      // Reusa el sb del scope exterior — F5: un solo client por request.
      const { data: { user } } = await sb.auth.getUser()
      if (user) {
        // 1. Ligas del user.
        const { data: myLeagues } = await sb
          .from('quiniela_league_members')
          .select('league_id')
          .eq('user_id', user.id)
        const leagueIds = (myLeagues ?? [])
          .map((r) => (r as { league_id?: string }).league_id)
          .filter((id): id is string => !!id)
        if (leagueIds.length > 0) {
          // 2. Otros miembros (excluye el propio user).
          const { data: peers } = await sb
            .from('quiniela_league_members')
            .select('user_id')
            .in('league_id', leagueIds)
            .neq('user_id', user.id)
          const peerIds = [...new Set(
            (peers ?? [])
              .map((r) => (r as { user_id?: string }).user_id)
              .filter((id): id is string => !!id),
          )]
          if (peerIds.length > 0) {
            // 3. Picks de los peers en la misma jornada.
            const { data: peerRows } = await sb
              .from('quiniela_picks')
              .select('picks')
              .eq('jornada', lastSettled.jornada)
              .in('user_id', peerIds)
            const peerHits: number[] = []
            for (const row of (peerRows ?? []) as SettledRow[]) {
              if (row.picks?.settled !== true) continue
              const h = row.picks?.breakdown?.hits
              if (typeof h === 'number' && Number.isFinite(h)) peerHits.push(h)
            }
            if (peerHits.length > 0) {
              const sum = peerHits.reduce((a, b) => a + b, 0)
              friendsAvgHits = Math.round((sum / peerHits.length) * 10) / 10
              friendsCount = peerHits.length
            }
          }

          // R — Ranking del user en cada liga para la jornada cerrada.
          // Usamos la tabla pre-computada quiniela_league_member_scores con
          // su índice (league_id, jornada, points DESC).
          interface ScoreRow {
            league_id: string
            user_id: string
            points: number
          }
          const { data: scoreRows } = await sb
            .from('quiniela_league_member_scores')
            .select('league_id, user_id, points')
            .in('league_id', leagueIds)
            .eq('jornada', lastSettled.jornada)
          const grouped = new Map<string, ScoreRow[]>()
          for (const row of (scoreRows ?? []) as ScoreRow[]) {
            const arr = grouped.get(row.league_id) ?? []
            arr.push(row)
            grouped.set(row.league_id, arr)
          }
          // Para cada liga: ordenar por points DESC, localizar al user,
          // computar rank (1-indexed). Quedarnos con la mejor posición.
          interface LeagueRank {
            leagueId: string
            rank: number
            total: number
            myPoints: number
          }
          const ranks: LeagueRank[] = []
          for (const [leagueId, rows] of grouped) {
            if (rows.length < 2) continue // liga sola no aporta nada
            rows.sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
            const idx = rows.findIndex((r) => r.user_id === user.id)
            if (idx < 0) continue
            ranks.push({
              leagueId,
              rank: idx + 1,
              total: rows.length,
              myPoints: rows[idx].points ?? 0,
            })
          }
          if (ranks.length > 0) {
            // Mejor: el de menor rank (1 = top). Desempate por liga más grande.
            ranks.sort((a, b) => a.rank - b.rank || b.total - a.total)
            const best = ranks[0]
            // Nombre humano de la liga.
            const { data: leagueRow } = await sb
              .from('quiniela_leagues')
              .select('name')
              .eq('id', best.leagueId)
              .maybeSingle<{ name: string | null }>()
            bestLeagueRank = {
              leagueId: best.leagueId,
              leagueName: leagueRow?.name ?? best.leagueId,
              rank: best.rank,
              total: best.total,
              myPoints: best.myPoints,
            }
          }
        }
      }
    } catch { /* silencioso */ }
  }

  return NextResponse.json(
    {
      jornada,
      deadline,
      totalMatches,
      matches,
      isAuthed,
      hasPicked,
      picksCount,
      lastSettled,
      streakCurrent,
      weeklyParticipants,
      userPicks,
      friendsAvgHits,
      friendsCount,
      bestLeagueRank,
    },
    {
      headers: {
        // 60s en CDN, 5 min stale. El componente también cachea client-side.
        'Cache-Control': 'private, max-age=0, s-maxage=60, stale-while-revalidate=300',
      },
    },
  )
}
