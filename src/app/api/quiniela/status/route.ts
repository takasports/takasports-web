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
     *   breakdown.perPick: Array<{ hit, cancelled, points, coins, ... }>
     *   breakdown.hits:    nº total de aciertos (atajo) */
    breakdown?: {
      perPick?: Array<{ hit?: boolean; cancelled?: boolean }>
      hits?: number
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

  // 1bis. Engagement de la jornada activa (proxy para social proof).
  // count(distinct user_id) en quiniela_picks de la jornada actual.
  // Llamada anónima sin auth.
  if (jornada) {
    try {
      const sb = await createServerSupabaseClient()
      const { count } = await sb
        .from('quiniela_picks')
        .select('user_id', { count: 'exact', head: true })
        .eq('jornada', jornada)
      if (typeof count === 'number' && Number.isFinite(count)) {
        weeklyParticipants = Math.max(0, count)
      }
    } catch { /* silencioso */ }
  }
  try {
    const sb = await createServerSupabaseClient()
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
      const STREAK_GAP_MAX_MS = 14 * 24 * 3_600_000
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
  if (lastSettled) {
    try {
      const sb = await createServerSupabaseClient()
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
    },
    {
      headers: {
        // 60s en CDN, 5 min stale. El componente también cachea client-side.
        'Cache-Control': 'private, max-age=0, s-maxage=60, stale-while-revalidate=300',
      },
    },
  )
}
