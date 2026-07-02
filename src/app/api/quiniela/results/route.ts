import { NextResponse } from 'next/server'
import type { MatchResult } from '@/lib/quiniela'
import { QUINIELA_RESULTS_DAYS_BACK, QUINIELA_RESULTS_LIMIT } from '@/lib/quiniela'

export type { MatchResult }

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
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - QUINIELA_RESULTS_DAYS_BACK)
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
  return `${fmt(start)}-${fmt(now)}`
}

async function fetchWithRetry(url: string): Promise<Response | null> {
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, { next: { revalidate: 120 } })
      if (res.ok) return res
      if (res.status < 500) return res
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 200 * (i + 1)))
  }
  return null
}

// Estados ESPN que tratamos como "anulado": el partido NO se jugó ni
// se va a jugar. El stake del user debe devolverse, el pick no cuenta
// como acierto ni como fallo.
const CANCELLED_STATUSES = new Set([
  'STATUS_POSTPONED',
  'STATUS_CANCELED',
  'STATUS_CANCELLED',
  'STATUS_FORFEIT',
  'STATUS_ABANDONED',
])

// Estados ESPN que tratamos como "final" (partido terminado). DEBE coincidir con
// FINAL_STATUSES_ESPN del cron settle-quiniela: ESPN cierra muchos partidos de
// fútbol como STATUS_FULL_TIME (no STATUS_FINAL), así que mirar solo STATUS_FINAL
// dejaba esos resultados sin mostrar aquí aunque el cron SÍ los liquidaba.
const FINAL_STATUSES = new Set([
  'STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_FT', 'STATUS_ENDED',
])

async function fetchResultsFromLeague(slug: string): Promise<MatchResult[]> {
  const res = await fetchWithRetry(
    `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard?dates=${dateRangeParam()}&limit=${QUINIELA_RESULTS_LIMIT}`
  )
  if (!res || !res.ok) return []
  let json: { events?: Array<Record<string, unknown>> }
  try { json = await res.json() } catch { return [] }
  const results: MatchResult[] = []

  for (const ev of json.events ?? []) {
    const competition = (ev.competitions as Array<Record<string, unknown>> | undefined)?.[0]
    if (!competition) continue
    const status = competition.status as Record<string, unknown> | undefined
    const statusName = (status?.type as Record<string, unknown> | undefined)?.name as string ?? ''
    const isFinal = FINAL_STATUSES.has(statusName)
    const isCancelled = CANCELLED_STATUSES.has(statusName)
    if (!isFinal && !isCancelled) continue

    const competitors = (competition.competitors as Array<Record<string, unknown>>) ?? []
    if (competitors.length < 2) continue

    const homeComp = competitors.find(c => c.homeAway === 'home') ?? competitors[0]
    const awayComp = competitors.find(c => c.homeAway === 'away') ?? competitors[1]
    const homeTeam = homeComp?.team as Record<string, unknown>
    const awayTeam = awayComp?.team as Record<string, unknown>
    const home = (homeTeam?.displayName as string) || (homeTeam?.shortDisplayName as string)
    const away = (awayTeam?.displayName as string) || (awayTeam?.shortDisplayName as string)
    if (!home || !away) continue

    // Cancelados: sin goles, outcome dummy 'X' (no se usa porque cancelled=true).
    // Finales: parseamos goles normalmente.
    if (isCancelled) {
      results.push({
        home, away,
        homeGoals: 0, awayGoals: 0,
        outcome: 'X',
        cancelled: true,
        espnId: ev.id as string,
      })
      continue
    }

    const homeGoals = parseInt(String(homeComp?.score ?? '0'), 10)
    const awayGoals = parseInt(String(awayComp?.score ?? '0'), 10)
    if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) continue

    const outcome: '1' | 'X' | '2' =
      homeGoals > awayGoals ? '1' : homeGoals < awayGoals ? '2' : 'X'

    results.push({ home, away, homeGoals, awayGoals, outcome, espnId: ev.id as string })
  }
  return results
}

interface CacheEntry { data: MatchResult[]; ts: number }
let cache: CacheEntry | null = null
const CACHE_TTL = 2 * 60_000

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.ts < CACHE_TTL) return NextResponse.json(cache.data)

  const settled = await Promise.allSettled(FOOTBALL_SLUGS.map(fetchResultsFromLeague))
  const all: MatchResult[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  // Dedupe primero por espnId, luego por par como fallback
  const seenId = new Set<string>()
  const seenPair = new Set<string>()
  const deduped = all.filter(m => {
    if (m.espnId) {
      if (seenId.has(m.espnId)) return false
      seenId.add(m.espnId)
    }
    const key = `${m.home}|${m.away}`
    if (seenPair.has(key)) return false
    seenPair.add(key)
    return true
  })

  cache = { data: deduped, ts: now }
  return NextResponse.json(deduped)
}
