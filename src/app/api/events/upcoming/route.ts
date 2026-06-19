import { NextResponse } from 'next/server'
import { SOURCE_TZ } from '@/lib/timezone'
import { getSpanishBroadcast } from '@/lib/broadcasts'
import { FOOTBALL_LEAGUES } from '@/lib/football-leagues'
import { NATIONAL_TEAM_COMPS, toSpanishNation } from '@/lib/nation-names'
import { getEventHighlightScore } from '@/lib/competitions'

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

// Fútbol desde la lista maestra; resto de deportes específicos. Orden = prioridad.
const SOURCES = [
  ...FOOTBALL_LEAGUES.map((l) => ({ slug: l.slug, sport: 'soccer', comp: l.comp })),
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
      // Selecciones → español (clubes intactos)
      if (NATIONAL_TEAM_COMPS.has(comp)) {
        homeTeam = toSpanishNation(homeTeam)
        awayTeam = toSpanishNation(awayTeam)
      }

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
    // El endpoint /events solo da el id del TORNEO (ev.id, p. ej. "415-2026"), no
    // el de cada partido. En paralelo pedimos el /scoreboard, que SÍ trae el id de
    // COMPETICIÓN por partido (el que entiende /api/match/[ref]), y lo cruzamos por
    // el par de ids de jugador. Ambas peticiones se cachean 5 min (revalidate 300)
    // como el resto del route.
    const [res, competitionByPair] = await Promise.all([
      fetch(
        `https://site.api.espn.com/apis/site/v2/sports/${slug}/events?limit=50`,
        { next: { revalidate: 300 } }
      ),
      buildTennisCompetitionIndex(slug),
    ])
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

      // ESPN devuelve el MISMO ev.id (id de torneo, p. ej. "415-2026") para todos
      // los partidos del mismo torneo → id NO único. Lo combinamos con los ids de
      // los dos jugadores (mismo esquema que /api/events/live) para que cada
      // partido tenga su propia clave; si no, colisionan las React keys del strip.
      // ⚠️ NO tocar este formato (fix de keys duplicadas, commit dedd4d7).
      const cid0 = (competitors[0]?.id as string | undefined) ?? homeAbbr ?? '0'
      const cid1 = (competitors[1]?.id as string | undefined) ?? awayAbbr ?? '1'

      // matchRef: id de COMPETICIÓN resuelto contra el scoreboard cruzando por el
      // par de ids de jugador (orden-indiferente). Formato idéntico al de lib/espn.ts:
      // tennis_{atp|wta}_<cid>. Solo individuales: el detalle (/api/match) no resuelve
      // los nombres de dobles (mostraría "—" vs "—"), así que los dobles se dejan sin
      // matchRef igual que en fetchTennisLeague. Sin match —o si es ambiguo— queda
      // undefined y la tarjeta degrada a /calendario en vez de a un partido equivocado.
      const isDoubles = homeTeam.includes('/') || (awayTeam ?? '').includes('/')
      const pairKey = isDoubles ? null : tennisPairKey(competitors[0]?.id, competitors[1]?.id)
      const competitionId = pairKey ? competitionByPair.get(pairKey) : null
      const matchRef = competitionId
        ? `${slug.replace('/', '_')}_${competitionId}`
        : undefined

      results.push({
        id: `tennis-${String(ev.id)}-${cid0}-${cid1}`,
        homeTeam,
        awayTeam,
        time: toTimeStr(isoDate),
        dateLabel,
        sport: 'tennis',
        comp: tournament,
        matchRef,
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

// Índice "par de ids de jugador" → id de competición del scoreboard de tenis.
// El /scoreboard expone events[].groupings[].competitions[]: cada competición trae
// su id propio (el que resuelve /api/match/[ref]) y sus dos competidores. Se indexa
// por el par de ids (orden-indiferente). Valor null = par ambiguo (aparece en más de
// una competición, p. ej. dos partidos con rival "TBD") → no se enlaza, para no abrir
// el partido equivocado. Errores → Map vacío (degrada a tarjeta sin matchRef).
async function buildTennisCompetitionIndex(slug: string): Promise<Map<string, string | null>> {
  const index = new Map<string, string | null>()
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return index
    const json = await res.json()
    for (const ev of (json.events ?? []) as Record<string, unknown>[]) {
      for (const g of (ev.groupings ?? []) as Record<string, unknown>[]) {
        for (const m of (g.competitions ?? []) as Record<string, unknown>[]) {
          const competitionId = m.id as string | undefined
          const cs = (m.competitors ?? []) as Record<string, unknown>[]
          if (!competitionId || cs.length < 2) continue
          const key = tennisPairKey(cs[0]?.id, cs[1]?.id)
          if (!key) continue
          // Clave ya vista → par ambiguo → null (no enlazar).
          index.set(key, index.has(key) ? null : competitionId)
        }
      }
    }
  } catch (err) {
    console.error(`[upcoming] ESPN tennis scoreboard index failed for ${slug}:`, err)
  }
  return index
}

// Clave orden-indiferente a partir de los dos ids de competidor del partido.
// Devuelve null si falta alguno (sin par no se puede cruzar de forma fiable).
function tennisPairKey(a: unknown, b: unknown): string | null {
  const ia = a == null ? '' : String(a)
  const ib = b == null ? '' : String(b)
  if (!ia || !ib) return null
  return ia < ib ? `${ia}|${ib}` : `${ib}|${ia}`
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

    // Selección por IMPORTANCIA (Destacados), no por hora: el Inicio (web+app)
    // debe enseñar los partidos que importan, no los que tocan antes. Usamos el
    // MISMO ranking que /calendario (getEventHighlightScore: liga top, equipos/
    // selecciones de renombre, finales, prime time). Se elige top-N por score y
    // luego se devuelve en orden cronológico para que se lea natural.
    const score = (e: UpcomingEvent) =>
      getEventHighlightScore({ comp: e.comp, home: e.homeTeam, away: e.awayTeam, isoDate: e.isoDate })
    const byScore = (a: UpcomingEvent, b: UpcomingEvent) => score(b) - score(a)
    const chrono = (a: UpcomingEvent, b: UpcomingEvent) =>
      (a.isoDate ?? '').localeCompare(b.isoDate ?? '')
    const topBy = (label: (l: string) => boolean, n: number) =>
      all.filter(e => label(e.dateLabel)).sort(byScore).slice(0, n).sort(chrono)

    const today    = topBy(l => l === 'Hoy', 12)
    const tomorrow = topBy(l => l === 'Mañana', 6)
    const rest     = topBy(l => l !== 'Hoy' && l !== 'Mañana', 4)

    const data = today.length > 0
      ? today
      : tomorrow.length > 0
        ? [...tomorrow, ...rest]
        : rest

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
