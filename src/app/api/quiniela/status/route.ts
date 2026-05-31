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
    picks?: Array<{ pick?: string }>
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
    totalWon?: number
    settledAt?: string
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
      const settledRows = (rows as SettledRow[] | null ?? [])
        .filter((r) => r.picks?.settled === true)
      settledRows.sort((a, b) => {
        const ta = a.picks?.settledAt ?? ''
        const tb = b.picks?.settledAt ?? ''
        return tb.localeCompare(ta) // desc
      })
      const settledRow = settledRows[0]
      if (settledRow) {
        const arr = settledRow.picks?.picks ?? []
        const totalPicks = Array.isArray(arr) ? arr.filter((p) => !!p?.pick).length : 0
        // Hits del breakdown: usa `breakdown.hits` (atajo) y si no hay,
        // cuenta `perPick.filter(p => p.hit && !p.cancelled)`.
        const perPick = settledRow.picks?.breakdown?.perPick ?? []
        const correctFromPerPick = Array.isArray(perPick)
          ? perPick.filter((p) => p?.hit === true && p?.cancelled !== true).length
          : 0
        const correctCount = settledRow.picks?.breakdown?.hits ?? correctFromPerPick
        lastSettled = {
          jornada: settledRow.jornada,
          totalWon: settledRow.picks?.totalWon ?? 0,
          correctCount,
          totalPicks,
          settledAt: settledRow.picks?.settledAt ?? null,
        }
      }
    }
  } catch {
    // sin sesión / sin Supabase → estado guest
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
    },
    {
      headers: {
        // 60s en CDN, 5 min stale. El componente también cachea client-side.
        'Cache-Control': 'private, max-age=0, s-maxage=60, stale-while-revalidate=300',
      },
    },
  )
}
