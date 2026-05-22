// POST /api/quiniela/leagues/score?id=ABCDEF
//
// Recalcula y persiste scores de TODOS los miembros de una liga privada
// para su jornada actual. Idempotente — llamar N veces deja el mismo
// estado final.
//
// Quién lo llama:
//   · Cliente (MyLeagues / LeagueExpanded) cuando abre una liga, para
//     que el ranking persistido se mantenga fresco sin requerir cron.
//   · (futuro) un cron interno cuando se cierre la última jornada de
//     la liga, para snapshot final del campeonato.
//
// Por qué no requiere auth:
//   · Es read-only conceptualmente: lee picks ya escritos + resultados
//     oficiales y los agrega. No modifica monedas, ni picks, ni
//     balances. La escritura solo va a quiniela_league_member_scores
//     que es una vista materializada del estado de la liga.
//   · Rate-limit defensivo: cache server-side breve (10s) por liga
//     para evitar que múltiples opens en paralelo dispare N escrituras.

import { NextRequest, NextResponse } from 'next/server'
import { persistLeagueScores } from '@/lib/quiniela-server'
import type { MatchResult } from '@/lib/quiniela'

// Rate-limit por liga: si se llamó hace <10s, devolvemos cached sin recalcular.
const lastRun = new Map<string, { ts: number; out: unknown }>()
const RUN_GAP_MS = 10_000

export async function POST(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')?.toUpperCase()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const now = Date.now()
  const prev = lastRun.get(id)
  if (prev && now - prev.ts < RUN_GAP_MS) {
    return NextResponse.json({ ok: true, cached: true, ...prev.out as object })
  }

  try {
    // Fetch resultados oficiales del mismo origen (caché interna 2 min).
    const origin = new URL(req.url).origin
    const resultsRes = await fetch(`${origin}/api/quiniela/results`, { cache: 'no-store' })
    const results: MatchResult[] = resultsRes.ok ? await resultsRes.json() : []

    const out = await persistLeagueScores(id, results)
    lastRun.set(id, { ts: now, out })
    return NextResponse.json({ ok: true, cached: false, ...out })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
