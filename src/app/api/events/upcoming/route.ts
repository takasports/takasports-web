import { NextResponse } from 'next/server'
import { SOURCE_TZ } from '@/lib/timezone'
import { getSpanishBroadcast } from '@/lib/broadcasts'

export interface UpcomingEvent {
  id: string
  homeTeam: string
  awayTeam: string | null
  time: string       // "21:00" en SOURCE_TZ
  dateLabel: string  // "Hoy" | "Mañana"
  sport: string      // 'soccer'|'basketball'|'racing'|'mma'|'tennis'
  comp: string
  matchRef?: string  // "{sport}_{league}_{espnId}" for detail page URL
  homeLogo?: string
  awayLogo?: string
  homeAbbr?: string
  awayAbbr?: string
  isoDate?: string   // ISO-8601 — para countdown client-side
  broadcast?: string // canal TV (si está mapeado)
}

interface CacheEntry { data: UpcomingEvent[]; ts: number }
let cache: CacheEntry | null = null
let staleCache: CacheEntry | null = null
const CACHE_TTL  = 5 * 60_000  // 5 min fresh
const STALE_MAX  = 30 * 60_000 // serve stale up to 30 min after expiry

// Ordered by display priority
const SOURCES = [
  { slug: 'soccer/uefa.champions',   sport: 'soccer',     comp: 'Champions'  },
  { slug: 'soccer/uefa.europa',      sport: 'soccer',     comp: 'Europa'     },
  { slug: 'soccer/uefa.europa.conf', sport: 'soccer',     comp: 'Conference' },
  { slug: 'soccer/uefa.super_cup',   sport: 'soccer',     comp: 'Super Cup'  },
  { slug: 'soccer/uefa.nations',     sport: 'soccer',     comp: 'Nations'    },
  { slug: 'soccer/esp.copa_del_rey', sport: 'soccer',     comp: 'Copa Rey'   },
  { slug: 'soccer/esp.1',           sport: 'soccer',     comp: 'LaLiga'     },
  { slug: 'soccer/eng.1',           sport: 'soccer',     comp: 'Premier'    },
  { slug: 'soccer/ita.1',           sport: 'soccer',     comp: 'Serie A'    },
  { slug: 'soccer/ger.1',           sport: 'soccer',     comp: 'Bundesliga' },
  { slug: 'soccer/fra.1',           sport: 'soccer',     comp: 'Ligue 1'    },
  { slug: 'basketball/nba',         sport: 'basketball', comp: 'NBA'        },
  { slug: 'racing/f1',              sport: 'racing',     comp: 'F1'         },
  { slug: 'mma/ufc',                sport: 'mma',        comp: 'UFC'        },
  // Tennis: ATP + WTA — aparece en el strip cuando no hay live
  { slug: 'tennis/atp',             sport: 'tennis',     comp: 'ATP'        },
  { slug: 'tennis/wta',             sport: 'tennis',     comp: 'WTA'        },
]

function toTimeStr(isoDate: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: SOURCE_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(isoDate))
  const h = parts.find(p => p.type === 'hour')?.value   ?? '00'
  const m = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${h}:${m}`
}

function toDateLabel(isoDate: string): string | null {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).format(new Date())
  const eventStr = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).format(new Date(isoDate))
  const diff = Math.round((new Date(eventStr).getTime() - new Date(todayStr).getTime()) / 86_400_000)
  if (diff < 0) return null          // past
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff <= 3) {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const d = new Date(eventStr + 'T12:00:00Z')
    return `${days[d.getUTCDay()]}`
  }
  return null  // too far ahead
}

async function fetchUpcomingFromLeague(
  slug: string, sport: string, comp: string
): Promise<UpcomingEvent[]> {
  // Tennis uses /events endpoint (not /scoreboard) — different structure
  if (sport === 'tennis') return fetchUpcomingTennis(slug, comp)

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const json = await res.json()
    const results: UpcomingEvent[] = []

    for (const ev of json.events ?? []) {
      const competition = ev.competitions?.[0]
      if (!competition) continue
      const statusName: string = competition.status?.type?.name ?? ''
      if (statusName !== 'STATUS_SCHEDULED') continue

      const isoDate: string = ev.date ?? ''
      if (!isoDate) continue

      const dateLabel = toDateLabel(isoDate)
      if (!dateLabel) continue

      const competitors: Record<string, unknown>[] = competition.competitors ?? []
      let homeTeam: string
      let awayTeam: string | null = null

      let homeLogo: string | undefined
      let awayLogo: string | undefined
      let homeAbbr: string | undefined
      let awayAbbr: string | undefined

      if (competitors.length >= 2) {
        const home = competitors.find(c => c.homeAway === 'home') ?? competitors[0]
        const away = competitors.find(c => c.homeAway === 'away') ?? competitors[1]
        const homeTeamObj = home?.team as Record<string, unknown>
        const awayTeamObj = away?.team as Record<string, unknown>
        homeTeam  = homeTeamObj?.displayName as string ?? homeTeamObj?.shortDisplayName as string ?? ''
        awayTeam  = awayTeamObj?.displayName as string ?? null
        homeAbbr  = homeTeamObj?.abbreviation as string | undefined
        awayAbbr  = awayTeamObj?.abbreviation as string | undefined
        homeLogo  = (homeTeamObj?.logoDark ?? homeTeamObj?.logo) as string | undefined
        awayLogo  = (awayTeamObj?.logoDark ?? awayTeamObj?.logo) as string | undefined
      } else {
        homeTeam = ev.name as string ?? ev.shortName as string ?? comp
      }

      if (!homeTeam) continue

      results.push({
        id: String(ev.id),
        homeTeam,
        awayTeam,
        time: toTimeStr(isoDate),
        dateLabel,
        sport,
        comp,
        matchRef: `${slug.replace('/', '_')}_${String(ev.id)}`,
        homeLogo,
        awayLogo,
        homeAbbr,
        awayAbbr,
        isoDate,
        broadcast: getSpanishBroadcast(comp, sport) ?? undefined,
      })
    }

    // Sort by date ascending
    results.sort((a, b) => {
      const ta = json.events.find((e: Record<string, unknown>) => String(e.id) === a.id)?.date ?? ''
      const tb = json.events.find((e: Record<string, unknown>) => String(e.id) === b.id)?.date ?? ''
      return ta.localeCompare(tb)
    })

    return results
  } catch (err) {
    console.error(`[upcoming] ESPN fetch failed for ${slug}:`, err)
    return []
  }
}

// Tennis uses a different ESPN endpoint structure (ev.competitors vs competition.competitors).
// Limit to 3 matches per tour to avoid flooding the strip.
async function fetchUpcomingTennis(slug: string, comp: string): Promise<UpcomingEvent[]> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${slug}/events?limit=50`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const json = await res.json()
    const results: UpcomingEvent[] = []

    for (const ev of json.events ?? []) {
      const statusName: string = ev.fullStatus?.type?.name ?? ''
      if (statusName !== 'STATUS_SCHEDULED') continue

      const isoDate: string = ev.date ?? ''
      if (!isoDate) continue

      const dateLabel = toDateLabel(isoDate)
      if (!dateLabel) continue

      const competitors: Record<string, unknown>[] = ev.competitors ?? []
      if (competitors.length < 2) continue

      const homeTeam  = (competitors[0]?.displayName as string) ?? ''
      const awayTeam  = (competitors[1]?.displayName as string) ?? null
      const homeAbbr  = (competitors[0]?.abbreviation as string) ?? undefined
      const awayAbbr  = (competitors[1]?.abbreviation as string) ?? undefined
      const tournament = (ev.shortName as string) ?? comp

      if (!homeTeam) continue

      results.push({
        id: String(ev.id),
        homeTeam,
        awayTeam,
        time: toTimeStr(isoDate),
        dateLabel,
        sport: 'tennis',
        comp: tournament,
        matchRef: `${slug.replace('/', '_')}_${String(ev.id)}`,
        isoDate,
      })

      // Limit to 3 matches per tour (ATP or WTA) to keep the strip clean
      if (results.length >= 3) break
    }

    results.sort((a, b) => (a.isoDate ?? '').localeCompare(b.isoDate ?? ''))
    return results
  } catch (err) {
    console.error(`[upcoming] ESPN tennis fetch failed for ${slug}:`, err)
    return []
  }
}

// Upcoming events: cambian poco. Cache edge 5min fresh + 15min stale.
const UPCOMING_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
  'CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
} as const

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data, { headers: UPCOMING_CACHE_HEADERS })
  }

  try {
    const settled = await Promise.allSettled(
      SOURCES.map(s => fetchUpcomingFromLeague(s.slug, s.sport, s.comp))
    )

    // Collect all upcoming events, keeping source priority order
    const all: UpcomingEvent[] = []
    for (const r of settled) {
      if (r.status === 'fulfilled') all.push(...r.value)
    }

    // If every source returned empty (total ESPN outage) fall back to stale
    if (all.length === 0 && staleCache && now - staleCache.ts < STALE_MAX) {
      return NextResponse.json(staleCache.data, {
        headers: { ...UPCOMING_CACHE_HEADERS, 'X-Cache': 'STALE' },
      })
    }

    // Sort: today first, then tomorrow, then next days — capped at 10
    // (the strip shows 6; the extra allows the client to do its own capping)
    const today    = all.filter(e => e.dateLabel === 'Hoy').slice(0, 6)
    const tomorrow = all.filter(e => e.dateLabel === 'Mañana').slice(0, 4)
    const rest     = all.filter(e => e.dateLabel !== 'Hoy' && e.dateLabel !== 'Mañana').slice(0, 3)

    const data = today.length > 0
      ? today.slice(0, 10)
      : tomorrow.length > 0
        ? [...tomorrow, ...rest].slice(0, 10)
        : rest.slice(0, 10)

    cache = { data, ts: now }
    staleCache = cache
    return NextResponse.json(data, { headers: UPCOMING_CACHE_HEADERS })
  } catch (err) {
    console.error('[upcoming] Unexpected error:', err)
    if (staleCache && now - staleCache.ts < STALE_MAX) {
      return NextResponse.json(staleCache.data, {
        headers: { ...UPCOMING_CACHE_HEADERS, 'X-Cache': 'STALE' },
      })
    }
    return NextResponse.json([], { headers: UPCOMING_CACHE_HEADERS })
  }
}
