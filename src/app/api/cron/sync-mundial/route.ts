// GET/POST /api/cron/sync-mundial
// Sincroniza fixtures del Mundial 2026 desde ESPN → ranked_events.
//
// Requiere header `x-cron-secret` o `Authorization: Bearer <CRON_SECRET>`.
// Seguro llamarlo múltiples veces: upsert con ON CONFLICT DO NOTHING en
// campos inmutables; solo actualiza status/result si el partido resolvió.
//
// ESPN slug: soccer/fifa.world
// Llama también a close_started_ranked_events() para cerrar partidos iniciados.

import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { awardBadges } from '@/lib/badge-awards'
import { sendTelegram } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
// Tope anti-runaway: corta a los 60s en vez del límite por defecto (300s). Su
// fetch a ESPN ya tiene AbortSignal.timeout(10s) más abajo.
export const maxDuration = 60

// Rango de fechas del Mundial: 11 jun — 26 jul 2026
const WC_START = '20260611'
const WC_END   = '20260726'

interface EspnCompetitor {
  homeAway:   string
  team:       { displayName: string; abbreviation: string }
  score?:     string | { value: number }
  winner?:    boolean  // ESPN pone true en el equipo que avanza (penaltis / prórroga)
}

interface EspnStatusType {
  name:    string
  detail:  string
  state:   string
}

interface EspnEvent {
  id:           string
  date:         string
  name:         string
  competitions: {
    competitors: EspnCompetitor[]
    status:      { type: EspnStatusType }
    venue?:      { fullName: string; address?: { city: string } }
    groups?:     { slug: string; shortName: string }
    notes?:      { type: string; headline: string }[]
  }[]
}

async function fetchWcFixtures(): Promise<EspnEvent[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${WC_START}-${WC_END}&limit=200`
  try {
    const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return []
    const json = await res.json() as { events?: EspnEvent[] }
    return json.events ?? []
  } catch {
    return []
  }
}

function scoreToInt(s: string | { value: number } | undefined): number | null {
  if (s == null) return null
  if (typeof s === 'number') return s
  if (typeof s === 'object' && 'value' in s) return s.value
  const n = parseInt(String(s), 10)
  return isNaN(n) ? null : n
}

/**
 * Determina el ganador del partido.
 * Prioridad: flag `winner` de ESPN (cubre penaltis y prórroga donde los
 * marcadores son iguales pero hay un avanzante), luego comparación de scores.
 */
function toWinner(
  homeScore:  number | null,
  awayScore:  number | null,
  homeWinner: boolean | undefined,
  awayWinner: boolean | undefined,
): '1' | 'X' | '2' | null {
  // Penaltis / prórroga: ESPN marca winner=true en el equipo que avanza.
  if (homeWinner === true) return '1'
  if (awayWinner === true) return '2'
  // Partido normal: comparación de scores.
  if (homeScore == null || awayScore == null) return null
  if (homeScore > awayScore) return '1'
  if (awayScore > homeScore) return '2'
  return 'X'
}

// STATUS_FINAL_PEN / STATUS_FINAL_AET son los estados de ESPN para partidos
// decididos en penaltis o prórroga. Sin ellos, los cruces de eliminatoria
// nunca se marcarían como resueltos.
const FINAL_STATUSES = new Set([
  'STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_FT', 'STATUS_ENDED',
  'STATUS_FULL_TIME_ET', 'STATUS_PENALTY',
  'STATUS_FINAL_PEN', 'STATUS_FINAL_AET', 'STATUS_FULL_TIME_AET',
  'STATUS_EXTRA_TIME', 'STATUS_EXTRA_TIME_FINAL',
])

// Partidos icónicos como "featured" (apertura, semifinales, final)
const FEATURED_KEYWORDS = ['final', 'semifinal', 'semif', 'opening', 'apertura', 'third place']

function isFeatured(eventName: string, notes: { type: string; headline: string }[] = []): boolean {
  const n = eventName.toLowerCase()
  if (FEATURED_KEYWORDS.some(kw => n.includes(kw))) return true
  return notes.some(note => FEATURED_KEYWORDS.some(kw => note.headline.toLowerCase().includes(kw)))
}

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 503 })
  }

  const fixtures = await fetchWcFixtures()
  if (fixtures.length === 0) {
    return NextResponse.json({ ok: true, fetched: 0, upserted: 0, note: 'ESPN returned no fixtures' })
  }

  // Usamos admin (service role) para escrituras — ranked_events solo tiene SELECT pública
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'admin_client_unavailable' }, { status: 503 })

  let upserted = 0
  let scored   = 0
  let scoringFailures = 0

  // Cerrar partidos iniciados (vía admin: la función ya no es ejecutable por anon/auth).
  try { await admin.rpc('close_started_ranked_events') } catch { /* no-op */ }

  // Pre-fetch IDs ya resueltos para evitar regresión de status (resolved → open)
  // cuando ESPN devuelve datos desactualizados en la misma pasada.
  const { data: resolvedRows } = await admin
    .from('ranked_events')
    .select('id')
    .eq('sport', 'mundial')
    .eq('status', 'resolved')
  const resolvedIds = new Set((resolvedRows ?? []).map((r: { id: string }) => r.id))

  for (const ev of fixtures) {
    const comp = ev.competitions?.[0]
    if (!comp) continue

    const home = comp.competitors?.find(c => c.homeAway === 'home')
    const away = comp.competitors?.find(c => c.homeAway === 'away')
    if (!home || !away) continue

    const statusName = comp.status?.type?.name ?? ''
    const isResolved = FINAL_STATUSES.has(statusName)
    const isClosed   = comp.status?.type?.state === 'in'  // en curso

    const homeScore = scoreToInt(home.score)
    const awayScore = scoreToInt(away.score)
    const winner    = isResolved ? toWinner(homeScore, awayScore, home.winner, away.winner) : null

    const eventId = `wc26-espn-${ev.id}`

    // Protección anti-regresión: si ya está resolved en DB y ESPN devuelve
    // datos no-finales (race condition o caché de ESPN), saltamos el evento.
    if (resolvedIds.has(eventId) && !isResolved) continue

    const status  = isResolved ? 'resolved' : isClosed ? 'closed' : 'open'
    const result  = isResolved && winner != null
      ? { winner, home_score: homeScore, away_score: awayScore }
      : null

    // Metadata: grupo desde comp.groups o notas
    const groupSlug = comp.groups?.slug ?? ''
    const groupName = comp.groups?.shortName ?? ''
    const venue     = comp.venue?.fullName ?? ''
    const city      = comp.venue?.address?.city ?? ''

    const row = {
      id:          eventId,
      sport:       'mundial',
      competition: 'Mundial 2026',
      event_date:  ev.date,
      team_home:   home.team.displayName,
      team_away:   away.team.displayName,
      featured:    isFeatured(ev.name, comp.notes),
      status,
      result,
      meta: {
        group:    groupName || groupSlug,
        venue,
        city,
        espn_id:  ev.id,
        matchday: null,
      },
    }

    const { error } = await admin.from('ranked_events').upsert(row, {
      onConflict: 'id',
      ignoreDuplicates: false,
    })
    if (!error) {
      upserted++

      // ── Auto-scoring: si ESPN marca el partido como FINAL, distribuir
      //    puntos a los usuarios que acertaron. score_ranked_prediction es
      //    idempotente (solo actúa sobre predicciones con is_correct IS NULL).
      if (isResolved && winner !== null) {
        try {
          await admin.rpc('score_ranked_prediction', {
            p_event_id:   eventId,
            p_winner:     winner,
            p_home_score: homeScore ?? null,
            p_away_score: awayScore ?? null,
          })
          scored++

          // AS1 — Otorgar badges vidente/clarividente a quienes clavaron
          // el marcador exacto en este evento. La RPC escribió
          // `context.exact_hit = true` en point_transactions para esos
          // users, lo usamos como single source of truth.
          // awardBadges es idempotente: si el user ya tiene el badge no
          // se re-otorga ni se duplica push notification.
          try {
            const { data: exactRows } = await admin
              .from('point_transactions')
              .select('user_id')
              .eq('source', 'ranked_prediction')
              .filter('context->>event_id', 'eq', eventId)
              .filter('context->>exact_hit', 'eq', 'true')
            const exactUserIds = [...new Set(
              (exactRows ?? [])
                .map(r => (r as { user_id?: string }).user_id)
                .filter((id): id is string => !!id),
            )]
            for (const userId of exactUserIds) {
              // Vidente: 1er exacto clavado (idempotente, awardBadges lo gestiona).
              await awardBadges(admin, userId, ['vidente'])
              // Clarividente: si lleva ≥3 exact_hit acumulados en Mundial.
              const { count } = await admin
                .from('point_transactions')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('source', 'ranked_prediction')
                .filter('context->>exact_hit', 'eq', 'true')
              if (typeof count === 'number' && count >= 3) {
                await awardBadges(admin, userId, ['clarividente'])
              }
            }
          } catch { /* badges nunca rompen el flow del cron */ }
        } catch {
          // El upsert ya guardó el resultado; lo que falló es el scoring de las
          // predicciones de ESTE evento. Antes era 100% silencioso → ahora se
          // cuenta y se avisa al final (crítico durante el Mundial: sin esto, un
          // fallo de scoring deja predicciones sin puntuar y nadie se entera).
          scoringFailures++
        }
      }
    }
  }

  if (scoringFailures > 0) {
    await sendTelegram(
      `⚠️ sync-mundial: ${scoringFailures} evento(s) con el resultado guardado pero el scoring de predicciones FALLÓ. Revisar score_ranked_prediction / point_transactions.`,
    )
  }

  return NextResponse.json({ ok: true, fetched: fixtures.length, upserted, scored, scoringFailures })
}

export async function GET(req: Request)  { return handle(req) }
export async function POST(req: Request) { return handle(req) }
