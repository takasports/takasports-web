// GET /api/quiniela/me/exact-stats
//
// Histórico de marcadores exactos del user autenticado, agregado sobre
// AMBOS paths del sistema:
//   · quiniela_picks (path legacy /quiniela) — usa breakdown.exactHits
//   · ranked_predictions (path real /mundial) — usa point_transactions
//     con source='ranked_prediction' y context.exact_hit=true
//
// Se usa en /perfil para mostrar el track-record de la habilidad.
//
// Devuelve:
//   · totalAttempts:    nº de picks con exactScore guardado en jornadas/eventos resueltos.
//   · totalHits:        nº de picks con exact bonus aplicado.
//   · hitRate:          totalHits / totalAttempts (0..1, 0 si no hay attempts).
//   · jornadasPlayed:   nº de jornadas distintas con ≥1 attempt.
//   · bestJornadaCount: máximo de exactos clavados en una sola jornada (0-3).
//   · bestJornada:      label de la jornada en la que se logró el best (string|null).
//
// Sin auth → 401.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'

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

export async function GET(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }
  const { supabase: sb, user } = await supabaseForRequest(req)
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

  // AS2 — Añadir datos del path Mundial (ranked_predictions).
  //
  // Estrategia:
  //   · attempts Mundial: predictions del user con exactScore definido
  //     en eventos ya resueltos (donde tenía sentido evaluar).
  //   · hits Mundial: point_transactions con context.exact_hit=true
  //     (escrito por la RPC score_ranked_prediction).
  //
  // Estos events no tienen el concepto de "jornada" como en quiniela;
  // cada evento es independiente. Para "bestJornada" en este path,
  // usamos un proxy: hits agrupados por fecha del event_date.
  let mundialAttempts = 0
  let mundialHits = 0
  try {
    // Para "totalAttempts": predictions con exactScore en eventos resueltos
    // (status='resolved'). Hacemos una sola query con JOIN implícito.
    const { data: resolvedEvents } = await sb
      .from('ranked_events')
      .select('id, event_date')
      .eq('sport', 'mundial')
      .eq('status', 'resolved')
    const resolvedIds = (resolvedEvents ?? []).map(e => (e as { id: string }).id)

    if (resolvedIds.length > 0) {
      const { data: preds } = await sb
        .from('ranked_predictions')
        .select('event_id, prediction')
        .eq('user_id', user.id)
        .in('event_id', resolvedIds)

      for (const p of (preds ?? []) as Array<{ event_id: string; prediction: { exactScore?: unknown } | null }>) {
        if (p.prediction?.exactScore && typeof p.prediction.exactScore === 'object') {
          mundialAttempts++
        }
      }
    }

    // Hits Mundial — leemos directamente del ledger universal
    const { data: hitTxns } = await sb
      .from('point_transactions')
      .select('context')
      .eq('user_id', user.id)
      .eq('source', 'ranked_prediction')
      .filter('context->>exact_hit', 'eq', 'true')
    mundialHits = (hitTxns ?? []).length

    // Para best-day del Mundial, agrupamos hits por día del evento.
    // Reutilizamos la misma estructura `hitsByJornada` con label "Mundial · 14 jun".
    if (mundialHits > 0) {
      const hitEventIds: string[] = []
      for (const t of (hitTxns ?? []) as Array<{ context: { event_id?: string } | null }>) {
        const eid = t.context?.event_id
        if (typeof eid === 'string') hitEventIds.push(eid)
      }
      if (hitEventIds.length > 0) {
        const { data: evRows } = await sb
          .from('ranked_events')
          .select('id, event_date')
          .in('id', hitEventIds)
        // Agrupar por fecha (YYYY-MM-DD) y emitir como "jornada" virtual.
        const hitsByDay = new Map<string, number>()
        const dayLabels = new Map<string, string>()
        const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })
        for (const e of (evRows ?? []) as Array<{ id: string; event_date: string }>) {
          if (!e.event_date) continue
          const d = new Date(e.event_date)
          if (Number.isNaN(d.getTime())) continue
          const day = d.toISOString().slice(0, 10)
          hitsByDay.set(day, (hitsByDay.get(day) ?? 0) + 1)
          if (!dayLabels.has(day)) {
            dayLabels.set(day, `Mundial · ${fmt.format(d)}`)
          }
        }
        // Mergeamos cada día como pseudo-jornada en el mapa principal.
        for (const [day, hits] of hitsByDay) {
          const label = dayLabels.get(day) ?? `Mundial · ${day}`
          hitsByJornada.set(label, (hitsByJornada.get(label) ?? 0) + hits)
          attemptsByJornada.set(label, (attemptsByJornada.get(label) ?? 0) + hits)
        }
      }
    }

    totalAttempts += mundialAttempts
    totalHits += mundialHits
  } catch { /* silencioso: si Mundial no responde, el path legacy ya está reflejado */ }

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
