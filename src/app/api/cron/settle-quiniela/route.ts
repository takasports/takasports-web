// GET/POST /api/cron/settle-quiniela
// Liquida automáticamente todas las quinielas selladas pero no cerradas
// cuando los resultados de ESPN ya están disponibles.
//
// Hasta ahora el settle era client-triggered (el usuario entraba y lo
// disparaba desde el navegador). Este cron lo hace sin intervención.
//
// Seguridad: protegido por CRON_SECRET (header x-cron-secret).
// Idempotencia: el flag `settled` del JSONB previene doble acreditación.
//
// Lógica de seguridad: solo settlea una jornada si ESPN ya tiene
// resultado para >= MIN_COVERAGE_PCT de sus picks. Evita settleos
// prematuros cuando los partidos aún no terminaron.
//
// Vercel cron schedule: "30 0,6,12,18 * * *" (cada 6h)
// Se puede forzar manualmente con: curl -X POST <url> -H "x-cron-secret: ..."

import { NextResponse }       from 'next/server'
import { adminSupabase }      from '@/lib/supabase-admin'
import { scorePicks, resultForPick, QUINIELA_RESULTS_DAYS_BACK, QUINIELA_RESULTS_LIMIT } from '@/lib/quiniela'
import { enrichResultsWithFeatured } from '@/lib/quiniela-featured'
import type { SavedPick, MatchResult, ScoreBreakdown } from '@/lib/quiniela'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { apiError } from '@/lib/api-utils'
import { evaluateTopNBadges } from '@/lib/special-badges'
import { sendTelegram } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const maxDuration = 60  // hasta 1 min — puede procesar muchos usuarios

// Porcentaje mínimo de picks con resultado ESPN para atrevernos a settlequiniela.
// Evita settleos prematuros cuando la jornada aún tiene partidos por jugar.
const MIN_COVERAGE_PCT = 0.6

// Fuentes ESPN con resultados de fútbol (últimos 10 días)
const FOOTBALL_SLUGS = [
  'soccer/fifa.world',
  'soccer/uefa.champions',
  'soccer/uefa.europa',
  'soccer/esp.copa_del_rey',
  'soccer/esp.1',
  'soccer/eng.1',
  'soccer/ita.1',
  'soccer/ger.1',
  'soccer/fra.1',
]

function dateRangeParam(): string {
  const now   = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - QUINIELA_RESULTS_DAYS_BACK)
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
  return `${fmt(start)}-${fmt(now)}`
}

const FINAL_STATUSES_ESPN = new Set([
  'STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_FT', 'STATUS_ENDED',
])
const CANCELLED_STATUSES_ESPN = new Set([
  'STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_CANCELLED',
  'STATUS_FORFEIT', 'STATUS_ABANDONED',
])

async function fetchAllResults(): Promise<MatchResult[]> {
  const settled = await Promise.allSettled(
    FOOTBALL_SLUGS.map(async slug => {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard?dates=${dateRangeParam()}&limit=${QUINIELA_RESULTS_LIMIT}`
        const res = await fetch(url, { next: { revalidate: 0 } })
        if (!res.ok) return []
        const json = await res.json() as { events?: unknown[] }
        const results: MatchResult[] = []
        for (const raw of json.events ?? []) {
          const ev   = raw as Record<string, unknown>
          const comp = (ev.competitions as Record<string, unknown>[] | undefined)?.[0]
          if (!comp) continue
          const statusName = ((comp.status as Record<string, unknown>)?.type as Record<string, unknown>)?.name as string ?? ''
          const isFinal     = FINAL_STATUSES_ESPN.has(statusName)
          const isCancelled = CANCELLED_STATUSES_ESPN.has(statusName)
          if (!isFinal && !isCancelled) continue

          const competitors = (comp.competitors as Record<string, unknown>[]) ?? []
          const homeComp = competitors.find(c => c.homeAway === 'home') ?? competitors[0]
          const awayComp = competitors.find(c => c.homeAway === 'away') ?? competitors[1]
          const home = ((homeComp?.team as Record<string, unknown>)?.displayName as string) ?? ''
          const away = ((awayComp?.team as Record<string, unknown>)?.displayName as string) ?? ''
          if (!home || !away) continue

          if (isCancelled) {
            results.push({ home, away, homeGoals: 0, awayGoals: 0, outcome: 'X', cancelled: true })
            continue
          }
          const homeGoals = parseInt(String(homeComp?.score ?? '0'), 10)
          const awayGoals = parseInt(String(awayComp?.score ?? '0'), 10)
          if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) continue
          const outcome = homeGoals > awayGoals ? '1' : homeGoals < awayGoals ? '2' : 'X' as MatchResult['outcome']
          results.push({ home, away, homeGoals, awayGoals, outcome })
        }
        return results
      } catch { return [] }
    })
  )
  const all: MatchResult[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }
  // Dedup por par home|away
  const seen = new Set<string>()
  return all.filter(m => {
    const k = `${m.home.toLowerCase()}|${m.away.toLowerCase()}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

interface QuinielaPicks {
  picks:              SavedPick[]
  staked:             boolean
  settled:            boolean
  /** Recibo del scoring. Lo necesita el catch-up de badges (/status). */
  breakdown?:         ScoreBreakdown
  totalStakeCharged?: number
  totalWon?:          number
  totalRefunded?:     number
  stakedAt?:          string
  settledAt?:         string
}

interface PicksRow {
  id:       string
  user_id:  string
  jornada:  string
  picks:    QuinielaPicks
}

// ── ¿ESPN ya tiene resultado para este pick? ───────────────────────────────
// Reutiliza resultForPick de quiniela.ts, el MISMO emparejador que usa el
// scoring — así la comprobación de cobertura y la puntuación deciden idéntico.
// Antes esta función tenía su propia comparación por subcadena del primer
// palabro ('real' casaba con "Real Sociedad" = cobertura inflada → cierre
// prematuro y puntos perdidos; 'psg' NO casaba con "Paris Saint-Germain" =
// cobertura infravalorada → la jornada no cerraba nunca).
function hasResult(pick: SavedPick, results: MatchResult[]): boolean {
  return resultForPick(pick, results) !== undefined
}

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'admin_client_unavailable' }, { status: 503 })

  // 1. Picks sellados pero no liquidados (consulta barata) — PRIMERO.
  //    Si no hay nada que liquidar, salimos AQUÍ sin gastar las llamadas a
  //    ESPN (9 fetches): el cron corre 4×/día y la mayoría de las pasadas no
  //    tienen jornada pendiente. Reordenado (antes ESPN iba primero) — no
  //    cambia el comportamiento: con 0 pendientes el código ya salía antes
  //    de settlear, enriquecer y evaluar badges top_n.
  //    Filtramos en DB con JSONB path operators para no desperdiciar los 500 slots
  //    en rows ya liquidados. Sin filtro en DB, con volumen alto los pending al
  //    final de la cola nunca se procesarían.
  const { data: rows, error: fetchErr } = await admin
    .from('quiniela_picks')
    .select('id, user_id, jornada, picks')
    .eq('picks->>staked', 'true')
    .or('picks->>settled.is.null,picks->>settled.eq.false')
    .order('created_at', { ascending: true })
    .limit(500)

  if (fetchErr) {
    await sendTelegram(`⚠️ settle-quiniela: fallo al leer picks pendientes — ${String(fetchErr.message).replace(/[<>]/g, '')}`)
    return apiError('server_error', 500, { ok: false })
  }

  // El filtro DB ya excluye settled; el filter JS actúa como doble verificación
  const pending = (rows ?? []).filter((r: unknown) => {
    const row = r as PicksRow
    return row.picks?.staked === true && row.picks?.settled !== true
  }) as PicksRow[]

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, settled_count: 0, note: 'no pending picks' })
  }

  // 2. Resultados ESPN (solo si HAY picks pendientes que liquidar)
  const results = await fetchAllResults()
  if (results.length === 0) {
    return NextResponse.json({ ok: true, settled_count: 0, note: 'no ESPN results available' })
  }

  // T — Marcar el partido featured de la jornada activa en los results.
  // Sin esto, scorePick no aplica el bonus x2 en la liquidación batch
  // y los users que aciertan el destacado se quedan sin el premio
  // que sí se promete en la UI.
  await enrichResultsWithFeatured(results)

  let settledCount = 0
  let skippedCount = 0
  const errors: string[] = []

  for (const row of pending) {
    try {
      const payload   = row.picks
      const savedPicks = payload.picks ?? []
      if (savedPicks.length === 0) continue

      // Cobertura: qué porcentaje de picks tiene resultado en ESPN
      const covered = savedPicks.filter(p => hasResult(p, results)).length
      const coverage = covered / savedPicks.length

      if (coverage < MIN_COVERAGE_PCT) {
        // Jornada aún no tiene suficientes resultados — esperar
        skippedCount++
        continue
      }

      // Scoring — modelo SIN apuestas: la Liga Taka recibe los PUNTOS FIJOS
      // (tendencia 1 ×2 destacado + exacto 3 + pleno 5), no stake×cuota.
      const breakdown = scorePicks(savedPicks, results)
      const totalPoints = breakdown.totalPoints

      // ── CLAIM atómico (lock por `settled`) ──────────────────────────
      // Marcamos settled=true + guardamos `breakdown` ANTES de acreditar, y
      // SOLO si la jornada seguía sin cerrar. Si el cliente (o este mismo
      // cron en otra pasada) ya la cerró, el UPDATE afecta 0 filas y
      // saltamos → cierra la ventana de doble acreditación (award_points NO
      // es idempotente). Guardar `breakdown` además permite que el catch-up
      // de badges (/api/quiniela/status) las otorgue después.
      const claimedPayload: QuinielaPicks = {
        ...payload,
        breakdown,
        settled:   true,
        totalWon:  totalPoints,
        settledAt: new Date().toISOString(),
      }
      const { data: claimed, error: claimErr } = await admin
        .from('quiniela_picks')
        .update({ picks: claimedPayload })
        .eq('id', row.id)
        .or('picks->>settled.is.null,picks->>settled.eq.false')
        .select('id')

      if (claimErr) {
        errors.push(`user ${row.user_id} claim failed: ${claimErr.message}`)
        continue
      }
      if (!claimed || claimed.length === 0) {
        // Otro proceso (cliente settle) ya cerró esta jornada — no re-acreditar.
        skippedCount++
        continue
      }

      // Ya somos dueños del cierre → acreditar los puntos fijos.
      if (totalPoints > 0) {
        const reason = `Quiniela ${row.jornada}: ${breakdown.hits}/${savedPicks.length} aciertos${breakdown.pleno ? ' · ¡PLENO!' : ''}`
        const { error: ptErr } = await admin.rpc('award_points', {
          p_user_id: row.user_id,
          p_amount:  totalPoints,
          p_sport:   'futbol',
          p_source:  'quiniela_settle',
          p_reason:  reason,
          p_context: { jornada: row.jornada, hits: breakdown.hits, pleno: breakdown.pleno, totalPoints },
        })
        if (ptErr) {
          // La acreditación falló: deshacemos el claim para reintentar en la
          // próxima pasada (vuelve a quedar settled=false, sin puntos).
          await admin.from('quiniela_picks').update({ picks: payload }).eq('id', row.id)
          errors.push(`user ${row.user_id} jornada ${row.jornada}: ${ptErr.message}`)
          continue
        }
      }

      // record_game_play para el leaderboard de juegos (best-effort).
      try {
        await admin.rpc('record_game_play', {
          p_game_id: 'quiniela',
          p_period:  row.jornada,
          p_score:   breakdown.hits,
          p_payload: {
            picks:   savedPicks.map(p => p.pick),
            pleno:   breakdown.pleno,
            totalWon: totalPoints,
          },
          p_duration_ms: null,
        })
      } catch { /* stats best-effort */ }

      settledCount++

      // Push notification (fire-and-forget, best-effort)
      if (totalPoints > 0) {
        import('@/lib/push-helper').then(({ sendPushToUser }) =>
          sendPushToUser(row.user_id, {
            title:  breakdown.pleno ? `🎯 ¡PLENO! +${totalPoints} pts` : `⚡ +${totalPoints} pts en la Quiniela`,
            body:   `${breakdown.hits}/${savedPicks.length} aciertos · ${row.jornada}`,
            url:    '/predicciones',
            tag:    `quiniela-settle-${row.jornada}`,
          })
        ).catch(() => null)
      }
    } catch (e) {
      errors.push(`user ${row.user_id}: ${String(e)}`)
    }
  }

  // ── Special badges top_n (cross-user) ──────────────────────────────
  // Tras liquidar, otorga los badges "TOP N del ranking semanal" de las
  // jornadas que ya cerraron del todo. Best-effort: no debe romper el
  // settle. Normalmente no-op (0 badges top_n activos).
  let topN: Awaited<ReturnType<typeof evaluateTopNBadges>> | undefined
  try {
    topN = await evaluateTopNBadges(admin)
  } catch (e) {
    errors.push(`top_n eval failed: ${String(e)}`)
  }

  // Si hubo fallos al liquidar a algún usuario o al evaluar badges, avisar (antes
  // se devolvían en la respuesta JSON pero nadie los veía → fallo silencioso).
  if (errors.length > 0) {
    await sendTelegram(
      `⚠️ settle-quiniela cerró con ${errors.length} error(es): ${errors.slice(0, 5).join(' | ').replace(/[<>]/g, '')}`,
    )
  }

  return NextResponse.json({
    ok:            true,
    pending_found: pending.length,
    settled_count: settledCount,
    skipped_count: skippedCount,
    errors:        errors.length > 0 ? errors.slice(0, 10) : undefined,
    results_available: results.length,
    top_n:         topN,
  })
}

export async function GET(req: Request)  { return handle(req) }
export async function POST(req: Request) { return handle(req) }
