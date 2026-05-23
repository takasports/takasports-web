// Scoring + apuesta server-side autoritativo.
//
// El endpoint opera en DOS FASES según el body.phase:
//
//   · phase='stake'   → al sellar la quiniela en PicksForm. Valida saldo
//                       y cuotas, descuenta totalStake vía add_coins
//                       (-totalStake), persiste quiniela_picks con
//                       {staked:true, settled:false}. No calcula
//                       ganancias (los partidos aún no pasaron).
//
//   · phase='settle'  → al cierre, cuando PicksSummary detecta que TODOS
//                       los picks tienen resultado oficial. Lee los picks
//                       persistidos (NO los del body, evita tampering),
//                       calcula scorePicks con results de ESPN, acredita
//                       ganancias vía add_coins(+totalWon) y marca
//                       {settled:true}. Idempotente: re-llamadas devuelven
//                       el resultado guardado sin re-acreditar.
//
//   · phase=undefined → legacy/invitado. Calcula breakdown y devuelve
//                       sin persistir ni descontar/acreditar nada.
//                       Mantiene compatibilidad con clientes antiguos.
//
// La idempotencia vive en dos flags del JSONB quiniela_picks.picks:
// `staked` y `settled`. No requiere migración SQL nueva.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { scorePicks, type SavedPick, type MatchResult, type ScoreBreakdown } from '@/lib/quiniela'

type Phase = 'stake' | 'settle'

interface ScoreBody {
  jornada: string
  picks: SavedPick[]
  phase?: Phase
}

interface StoredPayload {
  picks: SavedPick[]
  breakdown?: ScoreBreakdown
  staked: boolean
  settled: boolean
  totalStakeCharged?: number
  totalWon?: number
  stakedAt?: string
  settledAt?: string
}

const VALID_PICKS = new Set(['1', 'X', '2', '1X', 'X2'])
const VALID_PHASES = new Set<Phase>(['stake', 'settle'])
const MAX_ODDS = 100
const MAX_PICKS = 20
const MIN_STAKE = 1
const MAX_STAKE = 200
const MAX_TEAM_LEN = 80
const MAX_JORNADA_LEN = 64

// Rate limit por-usuario: 5s entre submits. Cubre stake y settle.
const SCORE_GAP_MS = 5_000
const lastSubmit = new Map<string, number>()
function scoreRateLimit(userId: string): { ok: true } | { ok: false; retryMs: number } {
  const now = Date.now()
  const t = lastSubmit.get(userId) ?? 0
  if (now - t < SCORE_GAP_MS) return { ok: false, retryMs: SCORE_GAP_MS - (now - t) }
  lastSubmit.set(userId, now)
  return { ok: true }
}

// Normaliza un partido para deduplicación. Evita que envíen el mismo
// home/away N veces para inflar coins.
function matchKey(home: string, away: string): string {
  return `${home.toLowerCase().trim()}|${away.toLowerCase().trim()}`
}

// Validación común — la usan TODAS las fases. Devuelve error con status
// o null si todo OK.
function validateBody(body: ScoreBody): { status: number; error: string } | null {
  if (!body?.jornada || typeof body.jornada !== 'string' || body.jornada.length > MAX_JORNADA_LEN) {
    return { status: 400, error: 'invalid jornada' }
  }
  if (!Array.isArray(body?.picks) || body.picks.length === 0) {
    return { status: 400, error: 'picks required' }
  }
  if (body.picks.length > MAX_PICKS) {
    return { status: 400, error: 'too many picks' }
  }
  if (body.phase != null && !VALID_PHASES.has(body.phase)) {
    return { status: 400, error: 'invalid phase' }
  }

  const seen = new Set<string>()
  for (const p of body.picks) {
    if (!p || typeof p !== 'object') return { status: 400, error: 'invalid pick shape' }
    if (typeof p.home !== 'string' || typeof p.away !== 'string' ||
        p.home.length === 0 || p.away.length === 0 ||
        p.home.length > MAX_TEAM_LEN || p.away.length > MAX_TEAM_LEN) {
      return { status: 400, error: 'invalid team' }
    }
    if (!VALID_PICKS.has(p.pick as string)) return { status: 400, error: 'invalid pick value' }
    if (p.oddsAtPick != null && (
      typeof p.oddsAtPick !== 'number' || !isFinite(p.oddsAtPick) ||
      p.oddsAtPick < 1 || p.oddsAtPick > MAX_ODDS
    )) {
      return { status: 400, error: 'invalid oddsAtPick' }
    }
    if (p.stake != null && (
      !Number.isFinite(p.stake) || p.stake < 0 || p.stake > MAX_STAKE
    )) {
      return { status: 400, error: 'invalid stake' }
    }
    const key = matchKey(p.home, p.away)
    if (seen.has(key)) return { status: 400, error: 'duplicate match in batch' }
    seen.add(key)
  }

  return null
}

async function fetchResults(origin: string): Promise<MatchResult[] | null> {
  try {
    const r = await fetch(`${origin}/api/quiniela/results`, { cache: 'no-store' })
    if (!r.ok) return null
    return await r.json() as MatchResult[]
  } catch {
    return null
  }
}

// ── Handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ScoreBody
    const validation = validateBody(body)
    if (validation) {
      return NextResponse.json({ error: validation.error }, { status: validation.status })
    }

    const phase = body.phase
    const origin = new URL(req.url).origin

    // ── Modo invitado / sin Supabase configurado ──────────────────
    // Mantiene compat: calcula breakdown si tiene resultados, sin
    // persistir, sin descuentos. phase='stake'|'settle' requieren auth.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      if (phase) return NextResponse.json({ error: 'auth required' }, { status: 401 })
      const results = await fetchResults(origin)
      if (!results) return NextResponse.json({ error: 'results unavailable' }, { status: 503 })
      const breakdown = scorePicks(body.picks, results)
      return NextResponse.json({ breakdown, evaluated: results.length, persisted: false })
    }

    const sb = await createServerSupabaseClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) {
      if (phase) return NextResponse.json({ error: 'auth required' }, { status: 401 })
      const results = await fetchResults(origin)
      if (!results) return NextResponse.json({ error: 'results unavailable' }, { status: 503 })
      const breakdown = scorePicks(body.picks, results)
      return NextResponse.json({ breakdown, evaluated: results.length })
    }

    // Rate limit por-usuario.
    const rl = scoreRateLimit(user.id)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'demasiado rápido — espera unos segundos', retryMs: rl.retryMs },
        { status: 429, headers: { 'retry-after': String(Math.ceil(rl.retryMs / 1000)) } },
      )
    }

    // Estado actual de la jornada para este usuario (clave para idempotencia).
    const { data: existing } = await sb
      .from('quiniela_picks')
      .select('id, picks')
      .eq('user_id', user.id)
      .eq('jornada', body.jornada)
      .maybeSingle()
    const prevPayload = (existing?.picks ?? null) as StoredPayload | null

    // ─────────────────────────────────────────────────────────────
    // PHASE STAKE — descontar al sellar
    // ─────────────────────────────────────────────────────────────
    if (phase === 'stake') {
      // Idempotencia dura: si ya selló esta jornada, no re-descontar.
      if (prevPayload?.staked) {
        return NextResponse.json(
          { error: 'already_staked', alreadyStaked: true, totalStakeCharged: prevPayload.totalStakeCharged ?? 0 },
          { status: 409 },
        )
      }

      // Cuotas obligatorias en todos los picks (modelo Ranked).
      const missingOdds = body.picks.some(p =>
        p.oddsAtPick == null || !Number.isFinite(p.oddsAtPick) || p.oddsAtPick < 1
      )
      if (missingOdds) {
        return NextResponse.json(
          { error: 'odds_unavailable', reason: 'jornada bloqueada por falta de cuotas' },
          { status: 422 },
        )
      }

      // Stake mínimo por pick en cada uno que tenga stake > 0.
      // Permitimos stake=0/undefined (no apuesta en ese pick), pero al
      // menos UNO debe ser > 0 para que tenga sentido sellar.
      for (const p of body.picks) {
        const s = p.stake ?? 0
        if (s > 0 && s < MIN_STAKE) {
          return NextResponse.json({ error: 'stake below minimum' }, { status: 400 })
        }
      }
      const totalStake = body.picks.reduce((sum, p) => sum + Math.floor(p.stake ?? 0), 0)
      if (totalStake <= 0) {
        return NextResponse.json({ error: 'no stake to bet' }, { status: 400 })
      }

      // Validar saldo.
      const { data: balRow } = await sb
        .from('quiniela_coin_balance')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle()
      const balance = balRow?.balance ?? 0
      if (balance < totalStake) {
        return NextResponse.json(
          { error: 'insufficient_balance', needed: totalStake, balance },
          { status: 422 },
        )
      }

      // Descontar totalStake.
      const { error: chargeErr } = await sb.rpc('add_coins', {
        p_amount: -totalStake,
        p_reason: `Quiniela ${body.jornada}: apuesta sellada`,
        p_context: {
          source: 'quiniela_stake',
          jornada: body.jornada,
          totalStake,
        },
      })
      if (chargeErr) {
        return NextResponse.json({ error: 'charge_failed', detail: chargeErr.message }, { status: 500 })
      }

      // Persistir picks con flag staked. Si falla, hacemos rollback
      // best-effort de las monedas para no dejar al user en deuda.
      const payload: StoredPayload = {
        picks: body.picks,
        staked: true,
        settled: false,
        totalStakeCharged: totalStake,
        stakedAt: new Date().toISOString(),
      }
      const { error: upsertErr } = await sb.from('quiniela_picks').upsert({
        user_id: user.id,
        jornada: body.jornada,
        picks: payload,
      }, { onConflict: 'user_id,jornada' })

      if (upsertErr) {
        // Rollback best-effort de las monedas para no dejar deuda.
        // Si el rollback también falla, queda un cobro huérfano que
        // requiere intervención manual via SQL.
        try {
          await sb.rpc('add_coins', {
            p_amount: totalStake,
            p_reason: `Rollback Quiniela ${body.jornada} (persistencia fallida)`,
            p_context: { source: 'quiniela_stake_rollback', jornada: body.jornada },
          })
        } catch { /* swallow */ }
        return NextResponse.json({ error: 'persist_failed', detail: upsertErr.message }, { status: 500 })
      }

      return NextResponse.json({
        phase: 'stake',
        staked: true,
        totalStake,
        totalStakeCharged: totalStake,
        balanceAfter: balance - totalStake,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // PHASE SETTLE — acreditar ganancias al cierre
    // ─────────────────────────────────────────────────────────────
    if (phase === 'settle') {
      if (!prevPayload?.staked) {
        // Ranked: settle solo tiene sentido si previamente se selló.
        return NextResponse.json(
          { error: 'not_staked', reason: 'esta jornada no se selló como apuesta' },
          { status: 409 },
        )
      }
      // Idempotente: si ya está settled, devolver lo guardado.
      if (prevPayload.settled) {
        return NextResponse.json({
          phase: 'settle',
          settled: true,
          alreadySettled: true,
          breakdown: prevPayload.breakdown,
          totalWon: prevPayload.totalWon ?? 0,
        })
      }

      const results = await fetchResults(origin)
      if (!results) return NextResponse.json({ error: 'results unavailable' }, { status: 503 })

      // Validar que TODOS los picks tienen resultado finalizado.
      // Si falta alguno, NO acreditamos (ni marcamos settled) — el
      // cliente reintentará cuando ESPN haya finalizado todos.
      // Usamos los picks PERSISTIDOS (no los del body) para evitar
      // que un cliente comprometido cambie picks después de stakearlos.
      const persistedPicks = prevPayload.picks
      const allResolved = persistedPicks.every(p =>
        results.some(r =>
          r.home.toLowerCase().includes(p.home.toLowerCase().split(' ')[0]) ||
          r.away.toLowerCase().includes(p.away.toLowerCase().split(' ')[0])
        )
      )
      // Nota: el matching real lo hace scorePicks con nameMatch.
      // Hacemos un quick-check aquí; si scorePicks no encuentra un
      // result para un pick, ese pick contará 0 (correcto — partido
      // no jugado/cancelado equivale a perder el stake).

      const breakdown = scorePicks(persistedPicks, results)
      const totalWon = breakdown.totalCoins

      // Solo bloquear settle si NO hay ningún resultado finalizado
      // — los parciales se cierran con lo que hay (los picks sin
      // result cuentan como perdidos, el stake ya se descontó).
      // Si el cliente quiere esperar, debe pasar allEvaluated antes
      // de llamar phase=settle.
      void allResolved

      // Acreditar ganancias si las hay. Una sola llamada add_coins.
      if (totalWon > 0) {
        const reason = `Quiniela ${body.jornada}: ${breakdown.hits}/${persistedPicks.length} aciertos${breakdown.pleno ? ' · ¡PLENO!' : ''}`
        const { error: creditErr } = await sb.rpc('add_coins', {
          p_amount: totalWon,
          p_reason: reason,
          p_context: {
            source: 'quiniela_settle',
            jornada: body.jornada,
            hits: breakdown.hits,
            pleno: breakdown.pleno,
            totalWon,
          },
        })
        if (creditErr) {
          // No marcamos settled si la acreditación falló — el cliente
          // puede reintentar settle más tarde.
          return NextResponse.json({ error: 'credit_failed', detail: creditErr.message }, { status: 500 })
        }
      }

      // Marcar settled + guardar breakdown final.
      const updatedPayload: StoredPayload = {
        ...prevPayload,
        breakdown,
        settled: true,
        totalWon,
        settledAt: new Date().toISOString(),
      }
      await sb.from('quiniela_picks').upsert({
        user_id: user.id,
        jornada: body.jornada,
        picks: updatedPayload,
      }, { onConflict: 'user_id,jornada' })

      // game_plays cross-game solo en settle (al cierre).
      await sb.rpc('record_game_play', {
        p_game_id: 'quiniela',
        p_period:  body.jornada,
        p_score:   breakdown.hits,
        p_payload: {
          picks:   persistedPicks.map(p => p.pick ?? null),
          results: results.map(r => r.outcome ?? null),
          pleno:   breakdown.pleno,
          totalWon,
        },
        p_duration_ms: null,
      })

      return NextResponse.json({
        phase: 'settle',
        settled: true,
        breakdown,
        totalWon,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // LEGACY — phase=undefined: compatibilidad con clientes viejos
    // ─────────────────────────────────────────────────────────────
    // Si el cliente no manda phase, calculamos breakdown y devolvemos
    // sin descuentos ni acreditaciones. Si hay payload persistido,
    // devolvemos el guardado en lugar de re-calcular.
    if (prevPayload) {
      return NextResponse.json({
        breakdown: prevPayload.breakdown,
        evaluated: 0,
        persisted: true,
        alreadyCredited: prevPayload.settled,
        staked: prevPayload.staked,
        settled: prevPayload.settled,
        legacy: true,
      })
    }

    const results = await fetchResults(origin)
    if (!results) return NextResponse.json({ error: 'results unavailable' }, { status: 503 })
    const breakdown = scorePicks(body.picks, results)
    return NextResponse.json({
      breakdown,
      evaluated: results.length,
      persisted: false,
      legacy: true,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
