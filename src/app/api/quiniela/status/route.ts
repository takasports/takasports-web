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

import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { QuinielaData } from '@/app/api/quiniela/route'

export const dynamic = 'force-dynamic'

interface PicksRow {
  picks: { picks?: Array<{ pick?: string }> } | null
}

export async function GET(req: NextRequest) {
  // 1. Estado de la jornada — reusa cache del endpoint principal.
  const origin = new URL(req.url).origin
  let jornada: string | null = null
  let deadline: string | null = null
  let totalMatches = 0
  let topMatches: Array<{
    home: string; away: string; comp: string; kickoff: string;
    homeLogo?: string; awayLogo?: string;
    odds?: { home: number; draw: number; away: number };
  }> = []
  try {
    const r = await fetch(`${origin}/api/quiniela`, {
      // Reaprovecha el cache del proceso; no fuerza revalidación.
      cache: 'no-store',
      headers: { 'x-internal': 'status' },
    })
    if (r.ok) {
      const data = (await r.json()) as QuinielaData
      jornada = data.jornada
      const matches = data.matches ?? []
      totalMatches = matches.length
      // Deadline = kickoff más temprano de la jornada.
      const sorted = [...matches].sort((a, b) =>
        (a.isoDate ?? '').localeCompare(b.isoDate ?? ''),
      )
      deadline = sorted[0]?.isoDate ?? null
      // Top 3 partidos por orden cronológico para el hero.
      topMatches = sorted.slice(0, 3).map((m) => ({
        home: m.home,
        away: m.away,
        comp: m.comp,
        kickoff: m.isoDate,
        homeLogo: m.homeLogo,
        awayLogo: m.awayLogo,
        odds: m.odds,
      }))
    }
  } catch {
    // Silencioso — el CTA tiene fallback estático en cliente.
  }

  // 2. Estado del user (si hay sesión).
  let isAuthed = false
  let hasPicked = false
  let picksCount = 0
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
        const arr = data?.picks?.picks ?? []
        picksCount = Array.isArray(arr) ? arr.filter((p) => !!p?.pick).length : 0
        hasPicked = picksCount > 0
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
      topMatches,
      isAuthed,
      hasPicked,
      picksCount,
    },
    {
      headers: {
        // 60s en CDN, 5 min stale. El componente también cachea client-side.
        'Cache-Control': 'private, max-age=0, s-maxage=60, stale-while-revalidate=300',
      },
    },
  )
}
