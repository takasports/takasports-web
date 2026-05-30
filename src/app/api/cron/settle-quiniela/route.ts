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
import { scorePicks }         from '@/lib/quiniela'
import type { SavedPick, MatchResult } from '@/lib/quiniela'
import { checkBearerOrHeader } from '@/lib/auth-utils'

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
  start.setDate(now.getDate() - 10)
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
        const url = `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard?dates=${dateRangeParam()}&limit=30`
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

// ── nameMatch ligero (simplificado de quiniela.ts) ────────────────────────
// Verifica si ESPN tiene resultado para un pick dado.
// Usa AND (no OR) para que ambas palabras clave coincidan — evita falsos
// positivos cuando equipos de diferentes partidos comparten el mismo nombre
// inicial (ej. "Sporting Braga" y "Sporting Kansas City").
function hasResult(pick: SavedPick, results: MatchResult[]): boolean {
  const h = pick.home.toLowerCase().split(' ')[0]
  const a = pick.away.toLowerCase().split(' ')[0]
  return results.some(r =>
    r.home.toLowerCase().includes(h) && r.away.toLowerCase().includes(a)
  )
}

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'admin_client_unavailable' }, { status: 503 })

  // 1. Resultados ESPN
  const results = await fetchAllResults()
  if (results.length === 0) {
    return NextResponse.json({ ok: true, settled_count: 0, note: 'no ESPN results available' })
  }

  // 2. Picks sellados pero no liquidados
  //    Filtramos en JS porque el filter JSONB en Supabase JS es verboso y poco fiable
  const { data: rows, error: fetchErr } = await admin
    .from('quiniela_picks')
    .select('id, user_id, jornada, picks')
    .order('created_at', { ascending: true })
    .limit(500)

  if (fetchErr) {
    return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 })
  }

  const pending = (rows ?? []).filter((r: unknown) => {
    const row = r as PicksRow
    return row.picks?.staked === true && row.picks?.settled !== true
  }) as PicksRow[]

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, settled_count: 0, note: 'no pending picks' })
  }

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

      // Scoring
      const breakdown = scorePicks(savedPicks, results)
      const totalWon      = breakdown.totalCoins
      const totalRefunded = breakdown.totalRefund

      // Refund de partidos cancelados
      if (totalRefunded > 0) {
        await admin.rpc('add_coins', {
          p_amount:  totalRefunded,
          p_reason:  `Quiniela ${row.jornada}: devolución por partidos anulados`,
          p_context: { source: 'quiniela_refund_auto', jornada: row.jornada, totalRefunded },
          p_user_id: row.user_id,
        })
      }

      // Acreditación de ganancias
      if (totalWon > 0) {
        const reason = `Quiniela ${row.jornada}: ${breakdown.hits}/${savedPicks.length} aciertos${breakdown.pleno ? ' · ¡PLENO!' : ''}`
        const { error: coinErr } = await admin.rpc('add_coins', {
          p_amount:  totalWon,
          p_reason:  reason,
          p_context: {
            source:  'quiniela_settle_auto',
            jornada: row.jornada,
            hits:    breakdown.hits,
            pleno:   breakdown.pleno,
            totalWon,
          },
          p_user_id: row.user_id,
        })
        if (coinErr) {
          errors.push(`user ${row.user_id} jornada ${row.jornada}: ${coinErr.message}`)
          continue  // no marcar settled si falló la acreditación
        }
      }

      // También acreditar puntos Taka (1 pt por participar en quiniela)
      // + record game_play para el leaderboard de juegos
      try {
        await admin.rpc('record_game_play', {
          p_game_id: 'quiniela',
          p_period:  row.jornada,
          p_score:   breakdown.hits,
          p_payload: {
            picks:   savedPicks.map(p => p.pick),
            pleno:   breakdown.pleno,
            totalWon,
          },
          p_duration_ms: null,
        })
      } catch { /* stats best-effort */ }

      // Marcar settled
      const updatedPayload: QuinielaPicks = {
        ...payload,
        settled:    true,
        totalWon,
        totalRefunded,
        settledAt:  new Date().toISOString(),
      }
      const { error: updateErr } = await admin
        .from('quiniela_picks')
        .update({ picks: updatedPayload })
        .eq('id', row.id)

      if (updateErr) {
        errors.push(`user ${row.user_id} update failed: ${updateErr.message}`)
        continue
      }

      settledCount++

      // Push notification (fire-and-forget, best-effort)
      if (totalWon > 0) {
        import('@/lib/push-helper').then(({ sendPushToUser }) =>
          sendPushToUser(row.user_id, {
            title:  breakdown.pleno ? `🎯 ¡PLENO! +${totalWon}🪙` : `🪙 +${totalWon} en la Quiniela`,
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

  return NextResponse.json({
    ok:            true,
    pending_found: pending.length,
    settled_count: settledCount,
    skipped_count: skippedCount,
    errors:        errors.length > 0 ? errors.slice(0, 10) : undefined,
    results_available: results.length,
  })
}

export async function GET(req: Request)  { return handle(req) }
export async function POST(req: Request) { return handle(req) }
