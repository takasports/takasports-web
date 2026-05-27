import { NextResponse } from 'next/server'
import { SOURCE_TZ } from '@/lib/timezone'
import { nameMatch } from '@/lib/quiniela'
import { adminSupabase } from '@/lib/supabase-admin'
import { computeInternalOdds, neutralOdds } from '@/lib/internal-odds'

export interface QuinielaMatch {
  home: string
  away: string
  comp: string
  time: string
  isoDate: string
  odds?: { home: number; draw: number; away: number }
  // Origen de las cuotas:
  //   · 'bookmaker' = the-odds-api (cuotas reales del mercado)
  //   · 'internal'  = sistema interno basado en standings ESPN +
  //                   neutrales (fallback cuando bookmaker no responde)
  // La UI puede mostrar un badge sutil "📊 Estimada" cuando es internal.
  oddsSource?: 'bookmaker' | 'internal'
  espnId?: string
  // Slug ESPN de la competición (e.g. 'soccer/esp.1') — necesario para
  // llamadas posteriores al endpoint summary (goleadores, lineups) y
  // para que el sistema interno de cuotas use las standings correctas.
  leagueSlug?: string
  homeLogo?: string
  awayLogo?: string
  homeAbbr?: string
  awayAbbr?: string
  homeShort?: string
  awayShort?: string
  round?: string
  // El partido de mayor matchScore de la jornada queda marcado para
  // el feature «Goleador del partido destacado». Lo marca el GET tras
  // selectMatches() y antes del re-sort cronológico.
  isFeatured?: boolean
}

export interface QuinielaData {
  jornada: string
  matches: QuinielaMatch[]
}

interface CacheEntry { data: QuinielaData; ts: number; mundial: boolean }
let cache: CacheEntry | null = null
// 30 min: the-odds-api free tier es ~500 req/mes. Con TTL bajo + pedir
// todas las ligas se agota en horas. Subir TTL y pedir solo las ligas
// presentes mantiene el consumo dentro del free tier.
const CACHE_TTL = 30 * 60_000

// ─────────────────────────────────────────────────────────────────
// Dos sistemas sobre la misma base:
//  · MUNDIAL  → durante la ventana del torneo, la quiniela es 100%
//               selecciones (solo soccer/fifa.world).
//  · LIGA     → resto del año, quiniela de clubes (inicio de temporada).
// El modo se auto-resuelve por fecha; QUINIELA_MUNDIAL=on|off fuerza.
// Tras la final no hay que tocar nada: la ventana caduca sola.
// ─────────────────────────────────────────────────────────────────
const WORLD_CUP_START = Date.UTC(2026, 5, 11)        // 11 jun 2026 00:00 UTC
const WORLD_CUP_END   = Date.UTC(2026, 6, 20)        // 20 jul 2026 00:00 UTC (final 19 jul)

function isMundialMode(now = Date.now()): boolean {
  const flag = process.env.QUINIELA_MUNDIAL?.toLowerCase()
  if (flag === 'on')  return true
  if (flag === 'off') return false
  return now >= WORLD_CUP_START && now < WORLD_CUP_END
}

const WORLD_CUP_SOURCE = {
  slug: 'soccer/fifa.world', comp: 'Mundial', oddsKey: 'soccer_fifa_world_cup',
}

const LEAGUE_SOURCES = [
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

// Caché por liga de LARGA duración + COMPARTIDA entre instancias
// (Supabase) para que serverless cold starts no multipliquen llamadas
// a the-odds-api. ~240 req/mes en Mundial (1 oddsKey) → cabe en free.
// Stale-on-failure: si el cupo se agota o la API falla, servimos la
// última línea conocida (real, vieja) en vez de vacío → nunca crashea.
// L1 (Map por instancia) reduce idas a Supabase dentro de una misma
// instancia caliente.
interface OddsCacheEntry { events: OddsEvent[]; ts: number; empty: boolean }
const oddsBySport = new Map<string, OddsCacheEntry>()       // L1 in-memory
const ODDS_TTL_OK    = 3 * 3_600_000   // 3 h si hubo datos
const ODDS_TTL_EMPTY = 20 * 60_000     // 20 min si vino vacío/erróneo

async function readOddsCacheL2(oddsKey: string): Promise<OddsCacheEntry | null> {
  const sb = adminSupabase()
  if (!sb) return null
  const { data } = await sb
    .from('quiniela_odds_cache')
    .select('events,ts,empty')
    .eq('odds_key', oddsKey)
    .maybeSingle()
  if (!data) return null
  return {
    events: (data.events as OddsEvent[]) ?? [],
    ts: new Date(data.ts as string).getTime(),
    empty: !!data.empty,
  }
}

async function writeOddsCacheL2(oddsKey: string, entry: OddsCacheEntry): Promise<void> {
  const sb = adminSupabase()
  if (!sb) return
  await sb.from('quiniela_odds_cache').upsert({
    odds_key: oddsKey,
    events: entry.events as unknown as object,
    ts: new Date(entry.ts).toISOString(),
    empty: entry.empty,
  })
}

async function fetchOddsForSport(oddsKey: string, apiKey: string): Promise<OddsEvent[]> {
  const now = Date.now()

  // L1: caché in-memory de la instancia (hot path).
  const l1 = oddsBySport.get(oddsKey)
  if (l1 && now - l1.ts < (l1.empty ? ODDS_TTL_EMPTY : ODDS_TTL_OK)) return l1.events

  // L2: caché compartida en Supabase (cold start friendly).
  const l2 = await readOddsCacheL2(oddsKey).catch(() => null)
  if (l2 && now - l2.ts < (l2.empty ? ODDS_TTL_EMPTY : ODDS_TTL_OK)) {
    oddsBySport.set(oddsKey, l2)
    return l2.events
  }

  // Origen: the-odds-api. Si falla y hay L2 stale → servimos lo viejo.
  const url = `https://api.the-odds-api.com/v4/sports/${oddsKey}/odds/?apiKey=${apiKey}&regions=eu&markets=h2h&dateFormat=iso&oddsFormat=decimal`
  const res = await fetchWithRetry(url, { next: { revalidate: 300 } })
  if (!res || !res.ok) {
    if (l2 && l2.events.length > 0) {
      // Stale-on-failure: línea real vieja > vacío. No reescribe ts.
      oddsBySport.set(oddsKey, l2)
      return l2.events
    }
    const empty: OddsCacheEntry = { events: [], ts: now, empty: true }
    oddsBySport.set(oddsKey, empty)
    writeOddsCacheL2(oddsKey, empty).catch(() => {})
    return []
  }
  let json: OddsEvent[]
  try { json = await res.json() } catch { json = [] }
  // Si vino vacío pero teníamos data buena → preferir la stale.
  if (json.length === 0 && l2 && l2.events.length > 0) {
    oddsBySport.set(oddsKey, l2)
    return l2.events
  }
  const fresh: OddsCacheEntry = { events: json, ts: now, empty: json.length === 0 }
  oddsBySport.set(oddsKey, fresh)
  writeOddsCacheL2(oddsKey, fresh).catch(() => {})
  return json
}

// ⚠️ SOLO QA/DEV — jamás en producción. Genera una línea plausible y
// DETERMINISTA (estable por partido) para poder verificar la mecánica
// de cuota-multiplicador sin depender del cupo de the-odds-api.
// Se activa únicamente con QUINIELA_DEV_ODDS=on (no setear en prod).
function devSeedOdds(home: string, away: string): { home: number; draw: number; away: number } {
  const seed = (home + away).split('').reduce((s, c, i) => s + c.charCodeAt(0) * (i + 7), 0)
  const ph = 0.30 + ((seed % 1000) / 1000) * 0.32          // 0.30–0.62
  const pd = 0.22 + (((seed >> 3) % 100) / 100) * 0.10     // 0.22–0.32
  const pa = Math.max(0.12, 1 - ph - pd)
  const margin = 1.06
  const mk = (p: number) => Math.max(1.05, Math.round((1 / (p * margin)) * 100) / 100)
  return { home: mk(ph), draw: mk(pd), away: mk(pa) }
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
      leagueSlug: slug,
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

  // Quiniela de liga: mismo discriminador por día para que la racha
  // por jornada y la persistencia de picks funcionen también aquí.
  const comps = [...new Set(matches.map(m => m.comp))]
  const base = comps.length > 2 ? `${matches.length} partidos` : comps.slice(0, 2).join(' · ')
  return `${base}${dayLabel ? ` · ${dayLabel}` : ''}`
}

const COMP_WEIGHT: Record<string, number> = {
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
  const mundial = isMundialMode(now)
  if (cache && cache.mundial === mundial && now - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  // Sistema activo: solo el Mundial durante la ventana, clubes el resto del año
  const sources = mundial ? [WORLD_CUP_SOURCE] : LEAGUE_SOURCES

  const settled = await Promise.allSettled(
    sources.map(s => fetchMatchesFromLeague(s.slug, s.comp))
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
    // Solo pedir cuotas de las ligas que REALMENTE tienen partidos en
    // este bloque (no las 7 siempre) → recorta drásticamente el consumo
    // del free tier de the-odds-api.
    const compsPresent = new Set(deduped.map(m => m.comp))
    const oddsKeys = [...new Set(
      sources
        .filter(s => s.oddsKey && compsPresent.has(s.comp))
        .map(s => s.oddsKey as string)
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
      if (ev) {
        const extracted = extractOdds(ev)
        if (extracted) {
          match.odds = extracted
          match.oddsSource = 'bookmaker'
        }
      }
    }
  }

  // ── Cascada a cuotas internas ────────────────────────────────────
  // Para los matches que no recibieron cuotas del bookmaker (cupo
  // agotado, downtime, liga sin cobertura), generamos cuotas internas
  // a partir de las standings ESPN (pts + gd del club a este momento).
  // Si tampoco hay standings disponibles (Copa, Champions KO), caemos
  // a cuotas neutrales para que la jornada nunca quede bloqueada.
  // Esto reemplaza el comportamiento previo de QUINIELA_DEV_ODDS en
  // producción — el dev override sigue funcionando aparte para QA.
  for (const match of deduped) {
    if (match.odds || !match.leagueSlug) continue
    const internal = await computeInternalOdds(match.home, match.away, match.leagueSlug)
    match.odds = internal ?? neutralOdds()
    match.oddsSource = 'internal'
  }

  // QA only: rellena cuotas sintéticas si faltan (cupo agotado) para
  // poder probar el ×cuota. Gated por env — nunca en producción.
  // En la práctica ya no debería disparar porque el sistema interno
  // arriba cubre todos los casos; queda como override explícito de QA.
  if (process.env.QUINIELA_DEV_ODDS === 'on') {
    for (const m of deduped) if (!m.odds) m.odds = devSeedOdds(m.home, m.away)
  }

  // Modo Mundial: TODOS los partidos del torneo aparecen (sin filtrar
  // por calidad/matchScore). El user puede apostar en cualquier partido
  // del Mundial, no solo los destacados. Visión del producto: el Mundial
  // es el evento principal y todo el catálogo debe estar disponible.
  //
  // Modo normal (clubes): selectMatches filtra a los 5-10 mejores por
  // matchScore para no abrumar al usuario en jornadas con 30+ partidos.
  let selectedByScore: QuinielaMatch[]
  if (mundial) {
    selectedByScore = [...deduped].sort((a, b) => matchScore(b) - matchScore(a))
  } else {
    selectedByScore = selectMatches(deduped)
  }

  // El primer partido por matchScore queda marcado como featured (para
  // el feature de goleador destacado). Aplica tanto a Mundial como
  // clubes — siempre hay 1 destacado por jornada.
  if (selectedByScore.length > 0 && selectedByScore[0].espnId && selectedByScore[0].leagueSlug) {
    selectedByScore[0].isFeatured = true
  }
  const selected = selectedByScore.sort((a, b) => a.isoDate.localeCompare(b.isoDate))

  const data: QuinielaData = { jornada: buildJornadaLabel(selected), matches: selected }
  cache = { data, ts: now, mundial }
  return NextResponse.json(data)
}
