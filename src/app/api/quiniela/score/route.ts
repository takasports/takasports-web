// Scoring autoritativo server-side.
// El cliente NUNCA debería confiar en su propio cálculo de monedas/puntos:
// envía sus picks aquí y recibe el desglose oficial.
//
// Si Supabase está disponible y el usuario está autenticado, también
// registra el resultado en quiniela_picks (audit) y sube monedas via RPC.
//
// Sin auth, devuelve solo el desglose calculado (modo invitado).

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { scorePicks, SCORING, type SavedPick, type MatchResult } from '@/lib/quiniela'

interface ScoreBody {
  jornada: string
  picks: SavedPick[]
  captainIdx?: number
  // Resultados se obtienen del endpoint oficial — el cliente NO los inyecta
}

const VALID_PICKS = new Set(['1', 'X', '2', '1X', 'X2'])
const MAX_ODDS = 100
const MAX_PICKS = 20

// Rate limit por-usuario: 5s entre submits. Evita doble crédito por
// reintentos de red flaky aunque la idempotencia DB ya protegiera
// (defensa en profundidad).
const SCORE_GAP_MS = 5_000
const lastSubmit = new Map<string, number>()
function scoreRateLimit(userId: string): { ok: true } | { ok: false; retryMs: number } {
  const now = Date.now()
  const t = lastSubmit.get(userId) ?? 0
  if (now - t < SCORE_GAP_MS) return { ok: false, retryMs: SCORE_GAP_MS - (now - t) }
  lastSubmit.set(userId, now)
  return { ok: true }
}
const MAX_TEAM_LEN = 80
const MAX_GOALS = 20
const MAX_JORNADA_LEN = 64

// Normaliza un partido para deduplicación. Evita que envíen el mismo
// home/away N veces para multiplicar coins por acierto.
function matchKey(home: string, away: string): string {
  return `${home.toLowerCase().trim()}|${away.toLowerCase().trim()}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ScoreBody
    if (!body?.jornada || typeof body.jornada !== 'string' || body.jornada.length > MAX_JORNADA_LEN) {
      return NextResponse.json({ error: 'invalid jornada' }, { status: 400 })
    }
    if (!Array.isArray(body?.picks) || body.picks.length === 0) {
      return NextResponse.json({ error: 'picks required' }, { status: 400 })
    }
    if (body.picks.length > MAX_PICKS) {
      return NextResponse.json({ error: 'too many picks' }, { status: 400 })
    }
    if (body.captainIdx != null && (
      !Number.isInteger(body.captainIdx) ||
      body.captainIdx < 0 ||
      body.captainIdx >= body.picks.length
    )) {
      return NextResponse.json({ error: 'invalid captainIdx' }, { status: 400 })
    }
    // Validación por pick — cualquier irregularidad bloquea el batch
    const seen = new Set<string>()
    for (const p of body.picks) {
      if (!p || typeof p !== 'object') {
        return NextResponse.json({ error: 'invalid pick shape' }, { status: 400 })
      }
      if (typeof p.home !== 'string' || typeof p.away !== 'string' ||
          p.home.length === 0 || p.away.length === 0 ||
          p.home.length > MAX_TEAM_LEN || p.away.length > MAX_TEAM_LEN) {
        return NextResponse.json({ error: 'invalid team' }, { status: 400 })
      }
      if (!VALID_PICKS.has(p.pick as string)) {
        return NextResponse.json({ error: 'invalid pick value' }, { status: 400 })
      }
      if (p.oddsAtPick != null && (
        typeof p.oddsAtPick !== 'number' || !isFinite(p.oddsAtPick) ||
        p.oddsAtPick < 1 || p.oddsAtPick > MAX_ODDS
      )) {
        return NextResponse.json({ error: 'invalid oddsAtPick' }, { status: 400 })
      }
      if (p.exactHome != null && (
        !Number.isInteger(p.exactHome) || p.exactHome < 0 || p.exactHome > MAX_GOALS
      )) {
        return NextResponse.json({ error: 'invalid exactHome' }, { status: 400 })
      }
      if (p.exactAway != null && (
        !Number.isInteger(p.exactAway) || p.exactAway < 0 || p.exactAway > MAX_GOALS
      )) {
        return NextResponse.json({ error: 'invalid exactAway' }, { status: 400 })
      }
      const key = matchKey(p.home, p.away)
      if (seen.has(key)) {
        return NextResponse.json({ error: 'duplicate match in batch' }, { status: 400 })
      }
      seen.add(key)
    }

    // Validación BOOSTER: máx 1 pick boosted por jornada
    const boostedCount = body.picks.filter(p => p.boosted === true).length
    if (boostedCount > 1) {
      return NextResponse.json({ error: 'max 1 booster per jornada' }, { status: 400 })
    }

    // Cargamos resultados oficiales del endpoint server-side
    const origin = new URL(req.url).origin
    const resultsRes = await fetch(`${origin}/api/quiniela/results`, { cache: 'no-store' })
    if (!resultsRes.ok) {
      return NextResponse.json({ error: 'results unavailable' }, { status: 503 })
    }
    const results = await resultsRes.json() as MatchResult[]

    // Si Supabase no está configurado, sin auth efectiva → strip booster
    // antes de scoring (no se cobró nada, no se acredita bonus gratis).
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const safePicks = body.picks.map(p => ({ ...p, boosted: false }))
      const breakdown = scorePicks(safePicks, results, body.captainIdx)
      return NextResponse.json({ breakdown, evaluated: results.length, persisted: false })
    }

    const sb = await createServerSupabaseClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) {
      // Modo invitado: strip booster (sin saldo del que descontar).
      const safePicks = body.picks.map(p => ({ ...p, boosted: false }))
      const breakdown = scorePicks(safePicks, results, body.captainIdx)
      return NextResponse.json({ breakdown, evaluated: results.length })
    }

    // Rate limit por-usuario (in-memory, mismo patrón que chat).
    const rl = scoreRateLimit(user.id)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'demasiado rápido — espera unos segundos', retryMs: rl.retryMs },
        { status: 429, headers: { 'retry-after': String(Math.ceil(rl.retryMs / 1000)) } },
      )
    }

    // Idempotencia: si ya hay envío para (user, jornada), NO se vuelve
    // a acreditar monedas ni a registrar game_plays ni a descontar booster.
    // Las picks se actualizan (upsert) — el cierre por kickoff se valida aparte.
    // Requiere índice único quiniela_picks(user_id, jornada) — migración 027.
    const { data: existing } = await sb
      .from('quiniela_picks')
      .select('id, picks')
      .eq('user_id', user.id)
      .eq('jornada', body.jornada)
      .maybeSingle()
    const alreadyCredited = !!existing

    // BOOSTER: decidir picks "efectivas" según estado del usuario.
    // Reglas:
    //   · Si ya está acreditado, respetar el booster YA aplicado en la
    //     primera entrega (no permitir activarlo retroactivamente sin pago).
    //   · Si es primera entrega y el cliente pidió booster: validar saldo,
    //     descontar 30 monedas, mantener boosted=true.
    //   · Si no hay saldo: strippear boosted (sin error, sin bonus, sin cobro).
    let effectivePicks: SavedPick[] = body.picks
    let boosterCharged = false
    let boosterRejected: string | null = null

    if (alreadyCredited) {
      // Recupera el booster previo del payload guardado y aplica solo ese.
      const prevPayload = existing.picks as { picks?: SavedPick[] } | null
      const prevBoostedIdx = (prevPayload?.picks ?? []).findIndex(p => p?.boosted === true)
      effectivePicks = body.picks.map((p, i) => ({ ...p, boosted: i === prevBoostedIdx }))
    } else if (boostedCount === 1) {
      const { data: balRow } = await sb
        .from('quiniela_coin_balance')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle()
      const balance = balRow?.balance ?? 0
      if (balance < SCORING.BOOSTER_COST) {
        boosterRejected = 'insufficient_balance'
        effectivePicks = body.picks.map(p => ({ ...p, boosted: false }))
      } else {
        const { error: chargeErr } = await sb.rpc('add_coins', {
          p_amount: -SCORING.BOOSTER_COST,
          p_reason: `Booster Quiniela ${body.jornada}`,
          p_context: { source: 'quiniela_booster', jornada: body.jornada },
        })
        if (chargeErr) {
          boosterRejected = 'charge_failed'
          effectivePicks = body.picks.map(p => ({ ...p, boosted: false }))
        } else {
          boosterCharged = true
        }
      }
    }

    const breakdown = scorePicks(effectivePicks, results, body.captainIdx)

    await sb.from('quiniela_picks').upsert({
      user_id: user.id,
      jornada: body.jornada,
      picks: { picks: effectivePicks, captainIdx: body.captainIdx, breakdown },
    }, { onConflict: 'user_id,jornada' })

    if (!alreadyCredited) {
      if (breakdown.totalCoins > 0) {
        await sb.rpc('add_coins', {
          p_amount: breakdown.totalCoins,
          p_reason: `Quiniela ${body.jornada}: ${breakdown.hits}/${body.picks.length} aciertos${breakdown.pleno ? ' · ¡PLENO!' : ''}`,
          p_context: { jornada: body.jornada, hits: breakdown.hits, exacts: breakdown.exacts, pleno: breakdown.pleno },
        })
      }

      // game_plays sólo en la primera entrega — para no inflar el cross-game.
      await sb.rpc('record_game_play', {
        p_game_id: 'quiniela',
        p_period:  body.jornada,
        p_score:   breakdown.hits,
        p_payload: {
          picks:   body.picks.map(p => p.pick ?? null),
          results: results.map(r => r.outcome ?? null),
          exacts:  breakdown.exacts,
          pleno:   breakdown.pleno,
        },
        p_duration_ms: null,
      })
    }

    return NextResponse.json({
      breakdown,
      evaluated: results.length,
      persisted: true,
      alreadyCredited,
      boosterCharged,
      boosterRejected,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
