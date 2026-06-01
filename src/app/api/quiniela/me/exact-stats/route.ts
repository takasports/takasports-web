// GET /api/quiniela/me/exact-stats
//
// Histórico de marcadores exactos del user autenticado, agregado sobre
// todas las jornadas liquidadas. Se usa en /perfil para mostrar el
// track-record de la habilidad "predecir el marcador exacto".
//
// Devuelve:
//   · totalAttempts:    nº de picks con exactScore guardado en jornadas settled.
//   · totalHits:        nº de picks con exactBonus=true en breakdown.
//   · hitRate:          totalHits / totalAttempts (0..1, 0 si no hay attempts).
//   · jornadasPlayed:   nº de jornadas distintas con ≥1 attempt.
//   · bestJornadaCount: máximo de exactos clavados en una sola jornada (0-3).
//   · bestJornada:      label de la jornada en la que se logró el best (string|null).
//
// Sin auth → 401.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

interface PicksJsonb {
  picks?: Array<{ exactScore?: unknown }>
  breakdown?: {
    perPick?: Array<{ exactBonus?: boolean }>
    exactHits?: number
  }
  settled?: boolean
  settledAt?: string
}

interface Row {
  jornada: string
  picks: PicksJsonb | null
}

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  // Fetch todas las filas settled del user. JSONB no permite filtrar por
  // .eq('picks->>settled', 'true') en algunas configuraciones; filtramos
  // client-side y limitamos para evitar costes desproporcionados.
  const { data: rows } = await sb
    .from('quiniela_picks')
    .select('jornada, picks')
    .eq('user_id', user.id)
    .limit(200)

  let totalAttempts = 0
  let totalHits = 0
  const attemptsByJornada = new Map<string, number>()
  const hitsByJornada = new Map<string, number>()

  for (const r of (rows ?? []) as Row[]) {
    if (r.picks?.settled !== true) continue
    if (typeof r.jornada !== 'string' || r.jornada.length === 0) continue

    // Attempts: picks con un exactScore guardado, válidamente object.
    const attempts = (r.picks?.picks ?? []).filter((p) => {
      const ex = p?.exactScore
      return ex && typeof ex === 'object'
    }).length

    // Hits: usa breakdown.exactHits si existe (atajo escrito por scorePicks),
    // si no, cuenta exactBonus=true en perPick.
    let hits = 0
    const direct = r.picks?.breakdown?.exactHits
    if (typeof direct === 'number' && Number.isFinite(direct)) {
      hits = Math.max(0, Math.floor(direct))
    } else {
      const perPick = r.picks?.breakdown?.perPick
      if (Array.isArray(perPick)) {
        hits = perPick.filter((p) => p?.exactBonus === true).length
      }
    }

    if (attempts === 0 && hits === 0) continue

    totalAttempts += attempts
    totalHits += hits
    attemptsByJornada.set(r.jornada, attempts)
    hitsByJornada.set(r.jornada, hits)
  }

  // Mejor jornada: la de más exactos clavados (no la de más attempts).
  let bestJornadaCount = 0
  let bestJornada: string | null = null
  for (const [jornada, hits] of hitsByJornada) {
    if (hits > bestJornadaCount) {
      bestJornadaCount = hits
      bestJornada = jornada
    }
  }

  const jornadasPlayed = attemptsByJornada.size
  const hitRate = totalAttempts > 0 ? totalHits / totalAttempts : 0

  return NextResponse.json(
    {
      totalAttempts,
      totalHits,
      hitRate,
      jornadasPlayed,
      bestJornadaCount,
      bestJornada,
    },
    {
      headers: {
        // Cambia raramente; cachear breve client-side.
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    },
  )
}
