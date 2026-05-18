import { NextResponse } from 'next/server'
import { SOURCE_TZ } from '@/lib/timezone'
import { nameMatch } from '@/lib/quiniela'

export interface QuinielaMatch {
  home: string
  away: string
  comp: string
  time: string
  isoDate: string
  odds?: { home: number; draw: number; away: number }
  espnId?: string
  homeLogo?: string
  awayLogo?: string
  homeAbbr?: string
  awayAbbr?: string
  homeShort?: string
  awayShort?: string
  round?: string
}

export interface QuinielaData {
  jornada: string
  matches: QuinielaMatch[]
}

interface CacheEntry { data: QuinielaData; ts: number }
let cache: CacheEntry | null = null
const CACHE_TTL = 10 * 60_000

const FOOTBALL_SOURCES = [
  { slug: 'soccer/fifa.world',       comp: 'Mundial',       oddsKey: 'soccer_fifa_world_cup'      },
  { slug: 'soccer/uefa.champions',   comp: 'Champions',     oddsKey: 'soccer_uefa_champs_league'  },
  { slug: 'soccer/uefa.europa',      comp: 'Europa League', oddsKey: 'soccer_uefa_europa_league'  },
  { slug: 'soccer/esp.copa_del_rey', comp: 'Copa del Rey',  oddsKey: null                          },
  { slug: 'soccer/esp.1',            comp: 'LaLiga',        oddsKey: 'soccer_spain_la_liga'        },
  { slug: 'soccer/eng.1',            comp: 'Premier',       oddsKey: 'soccer_epl'                  },
  { slug: 'soccer/ita.1',            comp: 'Serie A',       oddsKey: 'soccer_italy_serie_a'        },
  { slug: 'soccer/ger.1',            comp: 'Bundesliga',    oddsKey: 'soccer_germany_bundesliga'   },
  { slug: 'soccer/fra.1',            comp: 'Ligue 1',       oddsKey: 'soccer_france_ligue_one'     },
]

function toTimeStr(isoDate: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: SOURCE_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(isoDate))
  const h = parts.find(p => p.type === 'hour')?.value   ?? '00'
  const m = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${h}:${m}`
}

function dateRangeParam(): string {
  const now = new Date()
  const end = new Date(now)
  end.setDate(now.getDate() + 7)
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
  return `${fmt(now)}-${fmt(end)}`
}

function isUpcoming(isoDate: string): boolean {
  const ev  = new Date(isoDate)
  const diffMs = ev.getTime() - Date.now()
  return diffMs > 0 && diffMs < 7 * 86_400_000
}

// fetch con un retry exponencial — mitiga timeouts puntuales de ESPN
async function fetchWithRetry(url: string, opts: RequestInit & { next?: { revalidate?: number } }): Promise<Response | null> {
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, opts)
      if (res.ok) return res
      // Reintenta solo en 5xx
      if (res.status < 500) return res
    } catch { /* network error → retry */ }
    await new Promise(r => setTimeout(r, 200 * (i + 1)))
  }
  return null
}

interface OddsEvent {
  home_team: string
  away_team: string
  bookmakers: { markets: { key: string; outcomes: { name: string; price: number }[] }[] }[]
}

async function fetchOddsForSport(oddsKey: string, apiKey: string): Promise<OddsEvent[]> {
  const url = `https://api.the-odds-api.com/v4/sports/${oddsKey}/odds/?apiKey=${apiKey}&regions=eu&markets=h2h&dateFormat=iso&oddsFormat=decimal`
  const res = await fetchWithRetry(url, { next: { revalidate: 300 } })
  if (!res || !res.ok) return []
  try { return await res.json() } catch { return [] }
}

function extractOdds(ev: OddsEvent): { home: number; draw: number; away: number } | undefined {
  const allOutcomes: Record<string, number[]> = {}
  for (const bk of ev.bookmakers ?? []) {
    const h2h = bk.markets?.find(m => m.key === 'h2h')
    if (!h2h) continue
    for (const o of h2h.outcomes ?? []) {
      if (!allOutcomes[o.name]) allOutcomes[o.name] = []
      allOutcomes[o.name].push(o.price)
    }
  }
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 100) / 100 : 0
  const homeOdds = avg(allOutcomes[ev.home_team] ?? [])
  const awayOdds = avg(allOutcomes[ev.away_team] ?? [])
  const drawOdds = avg(allOutcomes['Draw'] ?? [])
  if (!homeOdds || !awayOdds) return undefined
  return { home: homeOdds, draw: drawOdds || 0, away: awayOdds }
}

async function fetchMatchesFromLeague(slug: string, comp: string): Promise<QuinielaMatch[]> {
  const res = await fetchWithRetry(
    `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard?dates=${dateRangeParam()}&limit=20`,
    { next: { revalidate: 300 } }
  )
  if (!res || !res.ok) return []
  let json: { events?: Array<Record<string, unknown>> }
  try { json = await res.json() } catch { return [] }
  const results: QuinielaMatch[] = []

  for (const ev of json.events ?? []) {
    const competition = (ev.competitions as Array<Record<string, unknown>> | undefined)?.[0]
    if (!competition) continue
    const status = competition.status as Record<string, unknown> | undefined
    const statusName = (status?.type as Record<string, unknown> | undefined)?.name as string ?? ''
    if (statusName === 'STATUS_FINAL' || statusName === 'STATUS_POSTPONED' || statusName === 'STATUS_CANCELED') continue

    const isoDate = (ev.date as string) ?? ''
    if (!isoDate || !isUpcoming(isoDate)) continue

    const competitors = (competition.competitors as Array<Record<string, unknown>>) ?? []
    if (competitors.length < 2) continue

    const homeComp = competitors.find(c => c.homeAway === 'home') ?? competitors[0]
    const awayComp = competitors.find(c => c.homeAway === 'away') ?? competitors[1]
    const homeTeam = homeComp?.team as Record<string, unknown>
    const awayTeam = awayComp?.team as Record<string, unknown>
    const home = (homeTeam?.displayName as string) || (homeTeam?.shortDisplayName as string)
    const away = (awayTeam?.displayName as string) || (awayTeam?.shortDisplayName as string)
    if (!home || !away) continue

    const homeLogo = (homeTeam?.logoDark as string | undefined) ?? (homeTeam?.logo as string | undefined)
    const awayLogo = (awayTeam?.logoDark as string | undefined) ?? (awayTeam?.logo as string | undefined)
    const homeShort = (homeTeam?.shortDisplayName as string | undefined) || undefined
    const awayShort = (awayTeam?.shortDisplayName as string | undefined) || undefined

    const notes = (competition.notes as Array<Record<string, unknown>> | undefined) ?? []
    const round = (notes[0]?.headline as string | undefined) || undefined

    results.push({
      home, away, comp, time: toTimeStr(isoDate), isoDate,
      espnId: ev.id as string,
      homeLogo, awayLogo,
      homeAbbr: homeTeam?.abbreviation as string | undefined,
      awayAbbr: awayTeam?.abbreviation as string | undefined,
      homeShort: homeShort !== home ? homeShort : undefined,
      awayShort: awayShort !== away ? awayShort : undefined,
      round,
    })
  }

  return results.sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

// Mapea el «headline» de ronda de ESPN a la fase del torneo en español
function worldCupPhase(matches: QuinielaMatch[]): string {
  const r = (matches.find(m => m.round)?.round ?? '').toLowerCase()
  if (r.includes('final') && !r.includes('semi') && !r.includes('quarter') && !r.includes('third')) return 'Final'
  if (r.includes('third')) return 'Tercer puesto'
  if (r.includes('semi')) return 'Semifinales'
  if (r.includes('quarter')) return 'Cuartos de final'
  if (r.includes('round of 16') || r.includes('16')) return 'Octavos de final'
  return 'Fase de grupos'
}

// El label de jornada se usa también como identificador (saved picks /
// historial / racha), por eso debe ser ÚNICO por día de competición:
// añadimos la fecha del primer partido del bloque.
function buildJornadaLabel(matches: QuinielaMatch[]): string {
  if (matches.length === 0) return 'Esta semana'

  const dayLabel = (() => {
    const first = [...matches].sort((a, b) => a.isoDate.localeCompare(b.isoDate))[0]
    if (!first?.isoDate) return ''
    return new Intl.DateTimeFormat('es-ES', {
      timeZone: SOURCE_TZ, day: 'numeric', month: 'short',
    }).format(new Date(first.isoDate)).replace('.', '')
  })()

  // Durante el Mundial la quiniela es 100% selecciones: label de torneo
  if (matches.some(m => m.comp === 'Mundial')) {
    return `Mundial · ${worldCupPhase(matches)}${dayLabel ? ` · ${dayLabel}` : ''}`
  }

  // Resto de competiciones: comportamiento original (sin discriminador)
  const comps = [...new Set(matches.map(m => m.comp))]
  if (comps.length > 2) return `${matches.length} partidos`
  return comps.slice(0, 2).join(' · ')
}

const COMP_WEIGHT: Record<string, number> = {
  'Mundial': 6,
  'Champions': 3, 'Europa League': 2.5,
  'LaLiga': 2, 'Premier': 2, 'Bundesliga': 1.8, 'Serie A': 1.8, 'Ligue 1': 1.5,
  'Copa del Rey': 0.8,
}

function matchScore(m: QuinielaMatch): number {
  const cw = COMP_WEIGHT[m.comp] ?? 1
  if (!m.odds) return cw * 0.5
  const { home, away } = m.odds
  const spread = Math.abs(home - away)
  const uncertainty = spread < 0.5 ? 3 : spread < 1 ? 2 : 1
  return cw * uncertainty
}

// Selección dinámica: en lugar de un .slice(0, 5) arbitrario,
// devolvemos hasta MAX_MATCHES manteniendo solo los que están por encima
// de un umbral mínimo de calidad relativo al mejor partido del bloque.
const MIN_MATCHES = 5
const MAX_MATCHES = 10
function selectMatches(all: QuinielaMatch[]): QuinielaMatch[] {
  if (all.length <= MIN_MATCHES) return all
  const sorted = [...all].sort((a, b) => matchScore(b) - matchScore(a))
  const top = matchScore(sorted[0])
  const threshold = top * 0.4 // mantén partidos con al menos 40% de la calidad del mejor
  const picked = sorted.filter(m => matchScore(m) >= threshold).slice(0, MAX_MATCHES)
  // Garantizamos un mínimo
  return picked.length >= MIN_MATCHES ? picked : sorted.slice(0, MIN_MATCHES)
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.ts < CACHE_TTL) return NextResponse.json(cache.data)

  const settled = await Promise.allSettled(
    FOOTBALL_SOURCES.map(s => fetchMatchesFromLeague(s.slug, s.comp))
  )

  const all: QuinielaMatch[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  // Dedupe primero por espnId (estable), luego por par home|away (fallback)
  const seenId = new Set<string>()
  const seenPair = new Set<string>()
  const deduped = all.filter(m => {
    if (m.espnId) {
      if (seenId.has(m.espnId)) return false
      seenId.add(m.espnId)
    }
    const key = `${m.home}|${m.away}|${m.isoDate.slice(0, 10)}`
    if (seenPair.has(key)) return false
    seenPair.add(key)
    return true
  })

  // Enriquecer con cuotas (en paralelo)
  const apiKey = process.env.ODDS_API_KEY
  if (apiKey && deduped.length > 0) {
    const oddsKeys = [...new Set(
      FOOTBALL_SOURCES.filter(s => s.oddsKey).map(s => s.oddsKey as string)
    )]
    const oddsResults = await Promise.allSettled(oddsKeys.map(k => fetchOddsForSport(k, apiKey)))
    const allOddsEvents: OddsEvent[] = []
    for (const r of oddsResults) {
      if (r.status === 'fulfilled') allOddsEvents.push(...r.value)
    }
    for (const match of deduped) {
      const ev = allOddsEvents.find(
        o => nameMatch(o.home_team, match.home) && nameMatch(o.away_team, match.away)
      )
      if (ev) match.odds = extractOdds(ev)
    }
  }

  const selected = selectMatches(deduped)
    // ordenamos por fecha cronológicamente para la UI
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))

  const data: QuinielaData = { jornada: buildJornadaLabel(selected), matches: selected }
  cache = { data, ts: now }
  return NextResponse.json(data)
}
