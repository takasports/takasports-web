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
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkBearerOrHeader } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic'

// Rango de fechas del Mundial: 11 jun — 26 jul 2026
const WC_START = '20260611'
const WC_END   = '20260726'

interface EspnCompetitor {
  homeAway:   string
  team:       { displayName: string; abbreviation: string }
  score?:     string | { value: number }
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
    const res = await fetch(url, { next: { revalidate: 0 } })
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

function toWinner(homeScore: number | null, awayScore: number | null): '1' | 'X' | '2' | null {
  if (homeScore == null || awayScore == null) return null
  if (homeScore > awayScore) return '1'
  if (awayScore > homeScore) return '2'
  return 'X'
}

const FINAL_STATUSES = new Set([
  'STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_FT', 'STATUS_ENDED',
  'STATUS_FULL_TIME_ET', 'STATUS_PENALTY',
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

  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 503 })
  }

  const fixtures = await fetchWcFixtures()
  if (fixtures.length === 0) {
    return NextResponse.json({ ok: true, fetched: 0, upserted: 0, note: 'ESPN returned no fixtures' })
  }

  const sb    = await createServerSupabaseClient()
  let upserted = 0

  // Cerrar partidos iniciados
  try { await sb.rpc('close_started_ranked_events') } catch { /* no-op */ }

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
    const winner    = isResolved ? toWinner(homeScore, awayScore) : null

    const eventId = `wc26-espn-${ev.id}`
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

    const { error } = await sb.from('ranked_events').upsert(row, {
      onConflict: 'id',
      ignoreDuplicates: false,
    })
    if (!error) upserted++
  }

  return NextResponse.json({ ok: true, fetched: fixtures.length, upserted })
}

export async function GET(req: Request)  { return handle(req) }
export async function POST(req: Request) { return handle(req) }
