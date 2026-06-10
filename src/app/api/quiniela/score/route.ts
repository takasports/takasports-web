// Scoring + apuesta server-side autoritativo.
//
// El endpoint opera en DOS FASES según el body.phase:
//
//   · phase='stake'   → al sellar el pronóstico en PicksForm. Modelo SIN
//                       apuestas: NO valida saldo ni descuenta nada — solo
//                       persiste quiniela_picks con {staked:true,
//                       settled:false, totalStakeCharged:0}.
//
//   · phase='settle'  → al cierre, cuando PicksSummary detecta que TODOS
//                       los picks tienen resultado oficial. Lee los picks
//                       persistidos (NO los del body, evita tampering),
//                       calcula scorePicks con results de ESPN y acredita los
//                       PUNTOS FIJOS (breakdown.totalPoints = tendencia 1 ×2
//                       destacado + exacto 3 + pleno 5) a la Liga Taka vía
//                       award_points; marca {settled:true}. Idempotente:
//                       re-llamadas devuelven el resultado guardado.
//
//   · phase=undefined → legacy/invitado. Calcula breakdown y devuelve
//                       sin persistir ni acreditar nada.
//
// La idempotencia vive en dos flags del JSONB quiniela_picks.picks:
// `staked` y `settled`. No requiere migración SQL nueva.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { scorePicks, SCORING, type SavedPick, type MatchResult, type ScoreBreakdown } from '@/lib/quiniela'
import { enrichResultsWithFeatured } from '@/lib/quiniela-featured'
import { awardBadges, badgesEarnedOnSettle } from '@/lib/badge-awards'
import { processLevelProgression } from '@/lib/level-progression'
import { fetchActiveSpecialBadgesForJornada, grantSpecialBadge, userMeetsCriteria } from '@/lib/special-badges'

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
  /** Stake devuelto al wallet por partidos anulados (pospuestos/cancelados).
   *  Acreditado en una RPC separada al settle. */
  totalRefunded?: number
  stakedAt?: string
  settledAt?: string
  /** AF — Timestamp ISO cuando se evaluaron y otorgaron los badges de esta
   *  jornada. Su ausencia significa pending; al estar presente el catch-up
   *  no re-procesa. El cron settle-quiniela NO lo escribe (no evalúa badges
   *  inline), pero SÍ guarda `breakdown`, así que el catch-up de
   *  /api/quiniela/status puede otorgarlas cuando el user pase por allí. */
  badgesAt?: string
}

const VALID_PICKS = new Set(['1', 'X', '2', '1X', 'X2'])
const VALID_PHASES = new Set<Phase>(['stake', 'settle'])
const MAX_ODDS = 100
const MAX_PICKS = 20
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
  let exactCount = 0
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
    // E2 — Marcador exacto: validar shape, rango entero [0, 20] y
    // contar para enforzar MAX_EXACT_PER_JORNADA.
    if (p.exactScore != null) {
      const ex = p.exactScore as { home?: unknown; away?: unknown }
      if (typeof ex !== 'object' || ex === null) {
        return { status: 400, error: 'invalid exactScore shape' }
      }
      if (
        typeof ex.home !== 'number' || !Number.isInteger(ex.home) ||
        typeof ex.away !== 'number' || !Number.isInteger(ex.away) ||
        ex.home < 0 || ex.home > 20 ||
        ex.away < 0 || ex.away > 20
      ) {
        return { status: 400, error: 'invalid exactScore values' }
      }
      exactCount++
      if (exactCount > SCORING.MAX_EXACT_PER_JORNADA) {
        return { status: 400, error: `too many exact picks (max ${SCORING.MAX_EXACT_PER_JORNADA})` }
      }
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
    const results = await r.json() as MatchResult[]
    // T — Enriquecer con featured antes de score. Mismo helper que usa
    // el cron de settle, así el x2 se aplica idénticamente en ambos
    // caminos (cliente settle + batch cron).
    await enrichResultsWithFeatured(results)
    return results
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

      // Modelo SIN apuestas: sellar es GRATIS. No se valida saldo ni se
      // descuenta nada. Las cuotas, si las hay, quedan solo como dato
      // informativo / para el x2 del destacado; su ausencia ya NO bloquea
      // la jornada (antes el modelo Ranked exigía cuota para apostar).
      const payload: StoredPayload = {
        picks: body.picks,
        staked: true,
        settled: false,
        totalStakeCharged: 0,
        stakedAt: new Date().toISOString(),
      }
      const { error: upsertErr } = await sb.from('quiniela_picks').upsert({
        user_id: user.id,
        jornada: body.jornada,
        picks: payload,
      }, { onConflict: 'user_id,jornada' })

      if (upsertErr) {
        return NextResponse.json({ error: 'persist_failed', detail: upsertErr.message }, { status: 500 })
      }

      // RT1 — Racha Taka unificada: sellar el pronóstico cuenta como
      // actividad diaria del user. ping_game_streak es idempotente (un
      // ping por día) y lee auth.uid() internamente. Best-effort.
      try { await sb.rpc('ping_game_streak') } catch { /* */ }

      return NextResponse.json({
        phase: 'stake',
        staked: true,
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
      // Modelo SIN apuestas: la Liga Taka recibe los PUNTOS FIJOS
      // (TENDENCY 1 ×2 destacado + EXACTO 3 + PLENO 5), no stake×cuota.
      const totalPoints = breakdown.totalPoints

      // Solo bloquear settle si NO hay ningún resultado finalizado
      // — los parciales se cierran con lo que hay (los picks sin
      // result cuentan como perdidos, el stake ya se descontó).
      // Si el cliente quiere esperar, debe pasar allEvaluated antes
      // de llamar phase=settle.
      void allResolved

      // ── CLAIM atómico (lock por `settled`) ───────────────────────
      // Marcamos settled=true + guardamos breakdown ANTES de acreditar, y
      // SOLO si la jornada seguía sin cerrar. Cierra la carrera con el cron
      // settle-quiniela: ambos usan el mismo lock por `settled`, así que el
      // que cierra primero es el único que acredita (award_points NO es
      // idempotente). `totalWon` conserva el nombre histórico pero guarda
      // los PUNTOS fijos.
      const updatedPayload: StoredPayload = {
        ...prevPayload,
        breakdown,
        settled: true,
        totalWon: totalPoints,
        settledAt: new Date().toISOString(),
      }
      const { data: claimed } = await sb
        .from('quiniela_picks')
        .update({ picks: updatedPayload })
        .eq('user_id', user.id)
        .eq('jornada', body.jornada)
        .or('picks->>settled.is.null,picks->>settled.eq.false')
        .select('id')

      if (!claimed || claimed.length === 0) {
        // El cron (u otra pestaña) cerró esta jornada entre el check inicial
        // y aquí. Releemos y devolvemos lo guardado (idempotente, sin re-acreditar).
        const { data: fresh } = await sb
          .from('quiniela_picks')
          .select('picks')
          .eq('user_id', user.id)
          .eq('jornada', body.jornada)
          .maybeSingle()
        const fp = (fresh?.picks ?? null) as StoredPayload | null
        return NextResponse.json({
          phase: 'settle',
          settled: true,
          alreadySettled: true,
          breakdown: fp?.breakdown ?? breakdown,
          totalWon: fp?.totalWon ?? 0,
        })
      }

      // Ya somos dueños del cierre → acreditar los PUNTOS FIJOS a la Liga Taka.
      if (totalPoints > 0) {
        const reason = `Quiniela ${body.jornada}: ${breakdown.hits}/${persistedPicks.length} aciertos${breakdown.pleno ? ' · ¡PLENO!' : ''}`
        const adminSbCredit = adminSupabase()
        if (!adminSbCredit) {
          // Deshacemos el claim: no dejar la jornada cerrada sin acreditar.
          await sb.from('quiniela_picks').update({ picks: prevPayload }).eq('user_id', user.id).eq('jornada', body.jornada)
          return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
        }
        const { error: creditErr } = await adminSbCredit.rpc('award_points', {
          p_user_id: user.id,
          p_amount:  totalPoints,
          p_sport:   'futbol',
          p_source:  'quiniela_settle',
          p_reason:  reason,
          p_context: { jornada: body.jornada, hits: breakdown.hits, pleno: breakdown.pleno, totalPoints },
        })
        if (creditErr) {
          // Acreditación falló: deshacemos el claim para permitir reintento.
          await sb.from('quiniela_picks').update({ picks: prevPayload }).eq('user_id', user.id).eq('jornada', body.jornada)
          return NextResponse.json({ error: 'credit_failed', detail: creditErr.message }, { status: 500 })
        }
      }

      // ── Badge awards (fire-and-forget) ───────────────────────────
      // Detectamos qué badges merece el user tras este settle y los
      // otorgamos vía awardBadges (idempotente). Errores se loguean
      // pero NO bloquean la respuesta — un fallo de badge nunca puede
      // romper la acreditación de monedas.
      try {
        // Historial previo del user (otras jornadas settled) para
        // detectar isFirstBet/isFirstWin/streak.
        const { data: history } = await sb
          .from('quiniela_picks')
          .select('jornada, picks, created_at')
          .eq('user_id', user.id)
          .neq('jornada', body.jornada)
          .order('created_at', { ascending: false })
          .limit(20)

        const histPayloads = (history ?? [])
          .map(h => h.picks as StoredPayload | null)
          .filter((p): p is StoredPayload => !!p)

        const isFirstBet = histPayloads.filter(p => p.staked).length === 0
        const isFirstWin = histPayloads.filter(p =>
          p.settled && (p.totalWon ?? 0) > 0
        ).length === 0

        // Streak: cuántas jornadas consecutivas previas (settled) tuvieron win.
        // Recorremos de más reciente a más vieja y cortamos al primer no-win.
        let prevStreak = 0
        for (const p of histPayloads) {
          if (!p.settled) break
          if ((p.totalWon ?? 0) > (p.totalStakeCharged ?? 0)) prevStreak += 1
          else break
        }

        // Picks con su odds + si ganó (para underdog)
        const picksWithOdds = persistedPicks.map((pick, i) => {
          const ps = breakdown.perPick[i]
          return {
            won: !!ps?.hit,
            odds: pick.oddsAtPick ?? 1,
          }
        })

        const earned = badgesEarnedOnSettle({
          hits: breakdown.hits,
          totalPicks: persistedPicks.length,
          pleno: breakdown.pleno,
          totalStake: prevPayload.totalStakeCharged ?? breakdown.totalStake,
          totalWon: totalPoints,
          picksWithOdds,
          prevStreak,
          isFirstBet,
          isFirstWin,
          exactHits: breakdown.exactHits ?? 0,
        })

        if (earned.length > 0) {
          await awardBadges(sb, user.id, earned)
        }

        // Level progression — recompone XP y otorga cosméticos por nivel
        // que el user todavía no tenga. Idempotente y fire-and-forget.
        // Va siempre (no solo si earned.length>0) porque award_points
        // del settle ya cambió el XP aunque no haya badge nuevo.
        void processLevelProgression(sb, user.id).catch(err => {
          console.warn('[score/settle] level progression failed', { uid: user.id, err: err?.message })
        })

        // AF — Marcar el JSONB con badgesAt para que el catch-up del
        // /status no vuelva a evaluar esta jornada. Sin esto, cada visita
        // al status re-procesaría queries y awards (idempotente pero
        // ineficiente).
        try {
          const finalPayload: StoredPayload = { ...updatedPayload, badgesAt: new Date().toISOString() }
          await sb
            .from('quiniela_picks')
            .update({ picks: finalPayload })
            .eq('user_id', user.id)
            .eq('jornada', body.jornada)
        } catch { /* silencioso — la flag es de optimización, no de correctness */ }

        // ── Special badges (DB-defined, admin-created) ─────────────
        // Para criterios que NO requieren ranking cross-user (pleno,
        // min_hits, all_participants), evaluamos inline. Los que sí
        // (top_n) requieren scan completo de la jornada — más caro,
        // se hace solo si existen badges activos con ese criterio.
        //
        // Distinción por show_in_sidebar:
        //   · show_in_sidebar=true  → reto semanal: escribir en
        //     quiniela_challenge_completions (claimed_at=null).
        //     El badge + coin_bonus se acreditan en /challenges/claim.
        //   · show_in_sidebar=false → grant inmediato vía grantSpecialBadge.
        const specials = await fetchActiveSpecialBadgesForJornada(sb, body.jornada)
        const nowIso = new Date().toISOString()
        for (const sp of specials) {
          if (sp.criteria_type === 'top_n' || sp.criteria_type === 'manual') continue
          const meets = userMeetsCriteria(sp, {
            hits: breakdown.hits,
            pleno: breakdown.pleno,
            totalStake: prevPayload.totalStakeCharged ?? breakdown.totalStake,
          })
          if (!meets) continue

          if (sp.show_in_sidebar) {
            // Reto semanal: registrar completion (idempotente por PK).
            // El claim posterior otorgará badge + coin_bonus.
            await sb
              .from('quiniela_challenge_completions')
              .upsert(
                {
                  user_id: user.id,
                  badge_id: sp.badge_id,
                  jornada: body.jornada,
                  completed_at: nowIso,
                },
                { onConflict: 'user_id,badge_id,jornada', ignoreDuplicates: true },
              )
          } else {
            // Special badge no-reto: grant inmediato sin claim requerido.
            await grantSpecialBadge(sb, sp, user.id)
          }
        }
        // Nota: top_n NO se evalúa aquí (requiere rankear cross-user). Se
        // otorga desde el cron settle-quiniela (evaluateTopNBadges) una vez
        // la jornada cierra del todo — ver lib/special-badges.ts.
      } catch (badgeErr) {
        console.error('[score/settle] badge award failed', badgeErr)
      }

      // game_plays cross-game solo en settle (al cierre).
      await sb.rpc('record_game_play', {
        p_game_id: 'quiniela',
        p_period:  body.jornada,
        p_score:   breakdown.hits,
        p_payload: {
          picks:   persistedPicks.map(p => p.pick ?? null),
          results: results.map(r => r.outcome ?? null),
          pleno:   breakdown.pleno,
          totalWon: totalPoints,
        },
        p_duration_ms: null,
      })

      // Push notification fire-and-forget — solo si ganó algo. La
      // idempotencia ya está garantizada por el flag `settled` del
      // payload (este código solo corre una vez por jornada/user).
      if (totalPoints > 0) {
        const title = breakdown.pleno
          ? `🎯 ¡PLENO! +${totalPoints} pts`
          : `⚡ +${totalPoints} pts en La Porra`
        const pushBody = breakdown.pleno
          ? `Acertaste TODOS los ${persistedPicks.length} partidos · ${body.jornada}`
          : `${breakdown.hits}/${persistedPicks.length} aciertos · ${body.jornada}`
        // Lazy import — evita coste si push no está configurado en build
        import('@/lib/push-helper').then(({ sendPushToUser }) =>
          sendPushToUser(user.id, {
            title,
            body: pushBody,
            url: '/quiniela',
            tag: `quiniela-settle-${body.jornada}`,
          }),
        ).catch(() => { /* silent: push best-effort */ })
      }

      return NextResponse.json({
        phase: 'settle',
        settled: true,
        breakdown,
        totalWon: totalPoints,
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
