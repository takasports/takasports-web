import { NextResponse } from 'next/server'
import { normalizeTeam, normalizeAthlete, type NormalizedTeam } from '@/lib/teams-catalog'
import { FOOTBALL_LEAGUES } from '@/lib/football-leagues'
import { NATIONAL_TEAM_COMPS, toSpanishNation } from '@/lib/nation-names'

export interface LiveScore {
  id: string
  homeTeam: string
  awayTeam: string
  homeGoals: number | null
  awayGoals: number | null
  status: string      // '1H' | '2H' | 'HT' | 'FT' | 'NS' | 'LIVE' | 'FINAL' etc.
  elapsed: number | null
  sport: string
  // Extended fields
  comp?: string        // league/competition name
  venue?: string       // stadium/venue name
  period?: number      // half (soccer), quarter (basketball)
  clock?: string       // display clock e.g. "45'" or "8:30"
  homeAbbr?: string
  awayAbbr?: string
  homeLogo?: string
  awayLogo?: string
  homePhoto?: string   // athlete headshot URL if available
  awayPhoto?: string
  matchRef?: string   // "{sport}_{league}_{espnId}" for detail page URL
  setsStr?: string    // tennis: formatted set scores e.g. "6-4 7-5 *3-2" (* = active set)
}

interface CacheEntry { data: LiveScore[]; ts: number; hasLive: boolean }
let cache: CacheEntry | null = null
let staleCache: CacheEntry | null = null

// Fase 3 (frescura en vivo, 2026-07-20): la caché in-memory era la mayor fuente de
// retardo (hasta 60s antes de que el origen re-consultara ESPN). Bajada a 20s para
// alinear las cuatro capas (in-memory + revalidate ESPN + s-maxage CDN + poll de
// cliente) todas a ~20s → peor caso de ~60s a ~20s, sin infra nueva y a €0. El CDN
// sigue colapsando a todos los clientes en un fetch de origen, así que el coste sube
// poco; ESPN tolera de sobra (~2 req/s en su API que mueve espn.com). Idle intacto.
const LIVE_TTL  = 20_000
const IDLE_TTL  = 5 * 60_000
const STALE_MAX = 10 * 60_000

// Estados terminales — usados para distinguir si hay partidos *realmente en
// curso* (afecta cadencia de polling / cabeceras CDN). Si todos los eventos
// emitidos son finales, no necesitamos refrescar cada 30s.
const TERMINAL_STATUSES = new Set([
  'FT', 'FINAL', 'FINAL_PEN', 'FINAL_AET', 'POST_GAME', 'END_OF_REGULATION',
  'ABANDONED', 'WALKOVER', 'RETIRED', 'CANCELED', 'POSTPONED', 'SUSPENDED', 'FORFEIT',
])

const ESPN_TEAM_LEAGUES = [
  // TODAS las ligas de fútbol de la lista maestra (no solo el subconjunto
  // live:true). Qué liga está "en temporada" cambia a lo largo del año, así que
  // el filtro real es por estado del partido (en curso / reciente) en
  // fetchTeamLeague. Así una liga que se está jugando (p. ej. J-League o la liga
  // argentina, marcadas live:false) nunca se queda fuera del ticker "En vivo".
  ...FOOTBALL_LEAGUES.map((l) => ({ slug: l.slug, sport: 'soccer', comp: l.comp })),
  { slug: 'basketball/nba', sport: 'basketball', comp: 'NBA' },
]

const TENNIS_SLUGS = ['tennis/atp', 'tennis/wta'] as const

// Estados que mapStatus sabe traducir. Si llega uno fuera de aquí (y no entra
// por la rama completed/state==='post'), se loguea una vez por proceso para
// detectar nuevos códigos ESPN sin esperar a un bug visible. Ver
// match/[ref]/route.ts:KNOWN_STATUSES para la lista canónica.
const _liveWarnedStatuses = new Set<string>()
function warnUnknownLiveStatus(status: string, sport: string) {
  const KNOWN_LIVE = new Set([
    'STATUS_SCHEDULED', 'STATUS_PRE_GAME', 'STATUS_DELAYED', 'STATUS_RAIN_DELAY',
    'STATUS_IN_PROGRESS', 'STATUS_HALFTIME', 'STATUS_FIRST_HALF', 'STATUS_SECOND_HALF',
    'STATUS_END_PERIOD', 'STATUS_END_OF_PERIOD', 'STATUS_OVERTIME', 'STATUS_SHOOTOUT',
    'STATUS_FULL_TIME', 'STATUS_FINAL', 'STATUS_FINAL_PEN', 'STATUS_FINAL_AET',
    'STATUS_POST_GAME', 'STATUS_END_OF_REGULATION',
    'STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_ABANDONED',
    'STATUS_FORFEIT', 'STATUS_WALKOVER', 'STATUS_SUSPENDED', 'STATUS_RETIRED',
  ])
  if (!status || KNOWN_LIVE.has(status) || _liveWarnedStatuses.has(status)) return
  _liveWarnedStatuses.add(status)
  console.warn(`[live] Unknown ESPN status "${status}" (sport=${sport}) — add to mapStatus / KNOWN_LIVE`)
}

function mapStatus(espnStatus: string, sport: string, period?: number, completed?: boolean, state?: string): string {
  // Cualquier evento marcado como terminado por ESPN (incluye STATUS_FINAL_PEN,
  // STATUS_FINAL_AET, STATUS_POST_GAME, etc.) se normaliza a 'FT' para que los
  // consumidores lo filtren como finalizado.
  if (completed === true || state === 'post') return 'FT'
  if (espnStatus === 'STATUS_IN_PROGRESS') {
    if (sport === 'basketball') return period ? `Q${period}` : 'LIVE'
    // Tennis has no halves/sets concept in status — use LIVE so downstream
    // getLiveLabel can derive the set number from homeGoals+awayGoals instead.
    if (sport === 'tennis') return 'LIVE'
    return '1H'
  }
  // ESPN usa STATUS_FIRST_HALF / STATUS_SECOND_HALF en algunas ligas (p. ej.
  // J-League) en vez de STATUS_IN_PROGRESS — sin esto caían al crudo "FIRST_HALF".
  if (espnStatus === 'STATUS_FIRST_HALF')  return '1H'
  if (espnStatus === 'STATUS_HALFTIME')    return 'HT'
  if (espnStatus === 'STATUS_SECOND_HALF') return '2H'
  if (espnStatus === 'STATUS_END_PERIOD') {
    if (sport === 'basketball') return period === 2 ? 'HT' : 'INT'
    return 'HT'
  }
  if (espnStatus === 'STATUS_OVERTIME')    return 'OT'
  if (espnStatus === 'STATUS_FULL_TIME' || espnStatus === 'STATUS_FINAL') return 'FT'
  if (espnStatus === 'STATUS_SCHEDULED')   return 'NS'
  if (espnStatus === 'STATUS_ABANDONED' || espnStatus === 'STATUS_CANCELED' ||
      espnStatus === 'STATUS_WALKOVER'  || espnStatus === 'STATUS_RETIRED'  ||
      espnStatus === 'STATUS_POSTPONED' || espnStatus === 'STATUS_SUSPENDED') return 'FT'
  warnUnknownLiveStatus(espnStatus, sport)
  return espnStatus.replace('STATUS_', '')
}

function parseElapsed(clock: string | undefined): number | null {
  if (!clock) return null
  const match = clock.match(/^(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

function parseSetsWon(scoreStr: string | undefined): [number, number] {
  if (!scoreStr) return [0, 0]
  const sets = scoreStr.trim().split(/\s+/)
  let home = 0, away = 0
  for (const set of sets) {
    const base = set.replace(/\(.*?\)/g, '')
    const [a, b] = base.split('-').map(Number)
    if (isNaN(a) || isNaN(b)) continue
    if (a > b) home++
    else if (b > a) away++
  }
  return [home, away]
}

function parseCurrentSetScore(scoreStr: string | undefined): string | null {
  if (!scoreStr) return null
  const sets = scoreStr.trim().split(/\s+/)
  if (sets.length === 0) return null
  const last = sets[sets.length - 1].replace(/\(.*?\)/g, '')
  const parts = last.split('-').map(Number)
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null
  const [a, b] = parts
  const isComplete = (a >= 6 || b >= 6) && Math.abs(a - b) >= 2
  return isComplete ? null : last
}

/** Build a human-readable set-by-set string for tennis (e.g. "6-4 7-5 *3-2").
 *  The active (incomplete) set is prefixed with * for UI highlighting.
 *  Handles tiebreaks: "7-6(4)" is correctly treated as a completed set. */
function formatTennisSets(homeStr: string | undefined): string {
  if (!homeStr) return ''
  const sets = homeStr.trim().split(/\s+/)
  const parts: string[] = []
  for (const set of sets) {
    const hasTiebreak = /\(.*?\)/.test(set)
    const base = set.replace(/\(.*?\)/g, '')
    const [a, b] = base.split('-').map(Number)
    if (isNaN(a) || isNaN(b)) continue
    const isComplete = hasTiebreak || ((a >= 6 || b >= 6) && Math.abs(a - b) >= 2)
    parts.push(isComplete ? `${a}-${b}` : `*${a}-${b}`)
  }
  return parts.join(' ')
}

// ── Helpers ─────────────────────────────────────────────────────

type RawCompetitor = Record<string, unknown>

function buildScore(
  id: string,
  home: NormalizedTeam,
  away: NormalizedTeam,
  homeGoals: number | null,
  awayGoals: number | null,
  status: string,
  sport: string,
  extras: Partial<LiveScore> = {},
): LiveScore {
  return {
    id,
    homeTeam: home.name,
    awayTeam: away.name,
    homeAbbr: home.abbr,
    awayAbbr: away.abbr,
    homeLogo: home.logo,
    awayLogo: away.logo,
    homeGoals,
    awayGoals,
    status,
    elapsed: null,
    sport,
    ...extras,
  }
}

// ── Football / Basketball (team vs team) ────────────────────────

async function fetchTeamLeague(slug: string, sport: string, comp: string, leagueKey: string): Promise<LiveScore[]> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard`,
      { next: { revalidate: 20 }, signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return []
    const json = await res.json()
    const results: LiveScore[] = []

    for (const ev of json.events ?? []) {
      const competition = ev.competitions?.[0]
      if (!competition) continue
      const statusType = competition.status?.type as { name?: string; completed?: boolean; state?: string } | undefined
      const statusName: string = statusType?.name ?? ''
      const completed = statusType?.completed === true
      const state = statusType?.state
      if (statusName === 'STATUS_SCHEDULED' || statusName === 'STATUS_POSTPONED') continue

      // Descarta partidos YA finalizados que no son de las últimas ~30h. En
      // off-season el scoreboard de ESPN devuelve la última final jugada (de
      // hace semanas) y ensuciaría el ticker "En vivo" (y empujaría fuera a los
      // partidos realmente en curso). Los partidos en juego (state !== 'post')
      // nunca se descartan aquí.
      if (completed === true || state === 'post') {
        const evMs = ev.date ? Date.parse(String(ev.date)) : NaN
        if (Number.isNaN(evMs) || Date.now() - evMs > 30 * 60 * 60 * 1000) continue
      }

      const competitors: RawCompetitor[] = competition.competitors ?? []
      const homeRaw = competitors.find((c) => c.homeAway === 'home') ?? competitors[0]
      const awayRaw = competitors.find((c) => c.homeAway === 'away') ?? competitors[1]
      if (!homeRaw || !awayRaw) continue

      const home = normalizeTeam({
        ...(homeRaw.team as Record<string, unknown>),
        id: (homeRaw.team as Record<string, unknown>)?.id as string | undefined,
        logo: (homeRaw.team as Record<string, unknown>)?.logo as string | undefined,
      })
      const away = normalizeTeam({
        ...(awayRaw.team as Record<string, unknown>),
        id: (awayRaw.team as Record<string, unknown>)?.id as string | undefined,
        logo: (awayRaw.team as Record<string, unknown>)?.logo as string | undefined,
      })
      if (!home || !away) continue
      if (NATIONAL_TEAM_COMPS.has(comp)) {
        // Selecciones → español (Brazil→Brasil…). El feed hace lo mismo sobre el mismo
        // displayName crudo, así que ya coinciden.
        home.name = toSpanishNation(home.name)
        away.name = toSpanishNation(away.name)
      } else {
        // CLUBES: usamos el NOMBRE CRUDO de ESPN (el mismo `displayName` que emite el
        // feed/calendario), NO el del catálogo. El catálogo (normalizeTeam) renombra
        // algunos clubes (p. ej. 'Internazionale'→'Inter Milan') solo en el directo, así
        // que la versión live y la del feed NO colapsaban en el dedup por nombre de la
        // app → el MISMO partido salía DUPLICADO (uno en vivo, otro como próximo). Igualar
        // el nombre al del feed lo arregla; el catálogo sigue dando logo/abbr/colores.
        const homeName = (homeRaw.team as Record<string, unknown>)?.displayName as string | undefined
        const awayName = (awayRaw.team as Record<string, unknown>)?.displayName as string | undefined
        if (homeName?.trim()) home.name = homeName.trim()
        if (awayName?.trim()) away.name = awayName.trim()
      }

      const homeScore = homeRaw.score !== undefined ? Number(homeRaw.score) : null
      const awayScore = awayRaw.score !== undefined ? Number(awayRaw.score) : null

      const statusObj = competition.status as Record<string, unknown> | undefined
      const period    = statusObj?.period as number | undefined
      const clock     = statusObj?.displayClock as string | undefined
      const venue     = (competition.venue as Record<string, unknown>)?.fullName as string | undefined

      const homePhoto = (homeRaw.athlete as Record<string, unknown>)?.headshot as string | undefined
      const awayPhoto = (awayRaw.athlete as Record<string, unknown>)?.headshot as string | undefined

      results.push(buildScore(
        String(ev.id),
        home,
        away,
        homeScore,
        awayScore,
        mapStatus(statusName, sport, period, completed, state),
        sport,
        {
          comp,
          venue,
          period,
          clock,
          elapsed: parseElapsed(clock),
          homePhoto,
          awayPhoto,
          matchRef: `${leagueKey}_${String(ev.id)}`,
        },
      ))
    }
    return results
  } catch (err) {
    console.error(`[live] ESPN fetch failed for ${slug}:`, err)
    return []
  }
}

// ── Tennis (athlete vs athlete) ─────────────────────────────────

// Nombre del jugador de un competidor de tenis, tolerante a las dos formas ESPN:
// /events lo trae plano (`competitor.displayName`); /scoreboard lo anida
// (`competitor.athletes[0].displayName` o `competitor.athlete.displayName`).
function tennisPlayerName(c: RawCompetitor | undefined): string {
  if (!c) return ''
  const ath = c.athlete as Record<string, unknown> | undefined
  const athletes = c.athletes as Array<Record<string, unknown>> | undefined
  const team = c.team as Record<string, unknown> | undefined
  return String(
    ath?.displayName ?? athletes?.[0]?.displayName ?? c.displayName ?? team?.displayName ?? '',
  )
}

// Clave de pareja (sin acentos, sin puntuación, ordenada) para casar el mismo partido
// entre /events y /scoreboard. Ambos endpoints son de la MISMA familia ESPN (mismo tour,
// mismo día) → los displayName coinciden exactos, así que el emparejamiento es fiable.
function tennisPairKey(a: string, b: string): string {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
  return [norm(a), norm(b)].sort().join('~')
}

async function fetchTennisLive(slug: string): Promise<LiveScore[]> {
  const shortSlug = slug.split('/')[1] // 'atp' | 'wta'
  try {
    // Dos fuentes en paralelo: /events da el marcador en vivo (string de sets por
    // jugador) que ya sabíamos leer, y /scoreboard da el id POR PARTIDO (m.id en
    // groupings[].competitions[]) — el mismo que usan el feed y buildTennis para la
    // ficha. El tenis en vivo era la ÚNICA fuente sin matchRef (porque /events da
    // ev.id = id de TORNEO, no único) → sus filas/tarjetas no abrían la ficha (bug
    // reportado). Cruzamos por nombre de jugador para adjuntar un matchRef resoluble
    // SIN tocar el parseo del marcador (cero riesgo para la visualización del directo);
    // si el cruce falla, se degrada a como estaba antes (sin matchRef, no una regresión).
    const [eventsRes, sbRes] = await Promise.all([
      fetch(`https://site.api.espn.com/apis/site/v2/sports/${slug}/events?limit=50`,
        { next: { revalidate: 20 }, signal: AbortSignal.timeout(6000) }),
      fetch(`https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard`,
        { next: { revalidate: 20 }, signal: AbortSignal.timeout(6000) }).catch(() => null),
    ])
    if (!eventsRes.ok) return []
    const json = await eventsRes.json()

    // Mapa (pareja de nombres) → id de partido del scoreboard.
    const idByPair = new Map<string, string>()
    if (sbRes && sbRes.ok) {
      try {
        const sb = await sbRes.json()
        for (const ev of sb.events ?? []) {
          for (const g of ev.groupings ?? []) {
            for (const m of g.competitions ?? []) {
              const cs: RawCompetitor[] = m.competitors ?? []
              const n1 = tennisPlayerName(cs[0])
              const n2 = tennisPlayerName(cs[1])
              if (!n1 || !n2 || m.id == null) continue
              idByPair.set(tennisPairKey(n1, n2), String(m.id))
            }
          }
        }
      } catch { /* scoreboard ilegible → seguimos sin matchRef */ }
    }

    const results: LiveScore[] = []

    for (const ev of json.events ?? []) {
      const statusType = ev.fullStatus?.type as { name?: string; completed?: boolean; state?: string } | undefined
      const statusName: string = statusType?.name ?? ''
      const completed = statusType?.completed === true
      const state = statusType?.state
      if (statusName === 'STATUS_SCHEDULED' || statusName === 'STATUS_POSTPONED') continue

      const competitors: RawCompetitor[] = ev.competitors ?? []
      if (competitors.length < 2) continue

      const home = normalizeAthlete({
        id: competitors[0]?.id as string | undefined,
        displayName: competitors[0]?.displayName as string | undefined,
        shortName: competitors[0]?.shortName as string | undefined,
        abbreviation: competitors[0]?.abbreviation as string | undefined,
      })
      const away = normalizeAthlete({
        id: competitors[1]?.id as string | undefined,
        displayName: competitors[1]?.displayName as string | undefined,
        shortName: competitors[1]?.shortName as string | undefined,
        abbreviation: competitors[1]?.abbreviation as string | undefined,
      })
      if (!home || !away) continue

      const scoreStr     = competitors[0]?.score as string | undefined
      const awayScoreStr = competitors[1]?.score as string | undefined
      const [homeGoals, awayGoals] = parseSetsWon(scoreStr)
      const currentSet = parseCurrentSetScore(scoreStr)
      const tournament = (ev.shortName as string) ?? (slug.includes('wta') ? 'WTA' : 'ATP')
      const setsStr = formatTennisSets(scoreStr)

      let clock: string | undefined
      if (currentSet) {
        const awayCurrentSet = parseCurrentSetScore(awayScoreStr)
        clock = awayCurrentSet ?? currentSet
      }

      // matchRef resoluble (tennis_<tour>_<idPartido>) cruzando con el scoreboard por
      // nombre. Igual formato que el feed → colapsa el duplicado y abre la ficha.
      const matchId = idByPair.get(
        tennisPairKey(
          (competitors[0]?.displayName as string | undefined) ?? '',
          (competitors[1]?.displayName as string | undefined) ?? '',
        ),
      )

      // ESPN devuelve el MISMO ev.id (id de torneo, p. ej. "415-2026") para todos
      // los partidos del mismo torneo → id NO único. Lo combinamos con los ids de
      // los dos jugadores para que cada partido tenga su propia clave (si no,
      // colisionan las React keys y se duplican/pierden partidos en el ticker).
      const cid0 = (competitors[0]?.id as string | undefined) ?? home.abbr ?? '0'
      const cid1 = (competitors[1]?.id as string | undefined) ?? away.abbr ?? '1'
      results.push(buildScore(
        `tennis-${String(ev.id)}-${cid0}-${cid1}`,
        home,
        away,
        homeGoals,
        awayGoals,
        mapStatus(statusName, 'tennis', undefined, completed, state),
        'tennis',
        {
          comp: tournament,
          clock,
          ...(matchId ? { matchRef: `tennis_${shortSlug}_${matchId}` } : {}),
          ...(setsStr ? { setsStr } : {}),
        },
      ))
    }
    return results
  } catch (err) {
    console.error(`[live] ESPN tennis fetch failed for ${slug}:`, err)
    return []
  }
}

// ── UFC (athlete vs athlete por pelea) ──────────────────────────
// La estructura ESPN para MMA es: 1 evento (PPV) → N competitions (peleas) →
// 2 competitors por pelea, cada competitor con su `athlete`.

async function fetchUfcLive(): Promise<LiveScore[]> {
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard',
      { next: { revalidate: 20 }, signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return []
    const json = await res.json()
    const results: LiveScore[] = []

    for (const ev of json.events ?? []) {
      const eventName = (ev.shortName as string) ?? (ev.name as string) ?? 'UFC'
      const venue = (ev.competitions?.[0]?.venue as Record<string, unknown>)?.fullName as string | undefined
      for (const competition of ev.competitions ?? []) {
        const statusType = competition.status?.type as { name?: string; completed?: boolean; state?: string } | undefined
        const statusName: string = statusType?.name ?? ''
        const completed = statusType?.completed === true
        const state = statusType?.state
        if (statusName === 'STATUS_SCHEDULED' || statusName === 'STATUS_POSTPONED') continue

        const competitors: RawCompetitor[] = competition.competitors ?? []
        if (competitors.length < 2) continue

        const home = normalizeAthlete({
          id: (competitors[0]?.athlete as Record<string, unknown>)?.id as string | undefined,
          displayName: (competitors[0]?.athlete as Record<string, unknown>)?.displayName as string | undefined,
          shortName: (competitors[0]?.athlete as Record<string, unknown>)?.shortName as string | undefined,
          abbreviation: competitors[0]?.abbreviation as string | undefined,
          headshot: (competitors[0]?.athlete as Record<string, unknown>)?.headshot as string | { href?: string } | undefined,
        })
        const away = normalizeAthlete({
          id: (competitors[1]?.athlete as Record<string, unknown>)?.id as string | undefined,
          displayName: (competitors[1]?.athlete as Record<string, unknown>)?.displayName as string | undefined,
          shortName: (competitors[1]?.athlete as Record<string, unknown>)?.shortName as string | undefined,
          abbreviation: competitors[1]?.abbreviation as string | undefined,
          headshot: (competitors[1]?.athlete as Record<string, unknown>)?.headshot as string | { href?: string } | undefined,
        })
        if (!home || !away) continue

        const statusObj = competition.status as Record<string, unknown> | undefined
        const period    = statusObj?.period as number | undefined
        const clock     = statusObj?.displayClock as string | undefined

        results.push(buildScore(
          String(competition.id ?? ev.id),
          home,
          away,
          null,
          null,
          mapStatus(statusName, 'mma', period, completed, state),
          'mma',
          {
            comp: eventName,
            venue,
            period,
            clock,
            homePhoto: home.logo,
            awayPhoto: away.logo,
            matchRef: `mma_ufc_${String(competition.id ?? ev.id)}`,
          },
        ))
      }
    }
    return results
  } catch (err) {
    console.error('[live] ESPN UFC fetch failed:', err)
    return []
  }
}

// ── F1 (race-status, no team-vs-team) ───────────────────────────
// Devolvemos un evento con homeTeam = nombre carrera, awayTeam = líder actual.

async function fetchF1Live(): Promise<LiveScore[]> {
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard',
      { next: { revalidate: 20 }, signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return []
    const json = await res.json()
    const results: LiveScore[] = []

    for (const ev of json.events ?? []) {
      const competition = ev.competitions?.[0]
      if (!competition) continue
      const statusName: string = competition.status?.type?.name ?? ''
      if (statusName === 'STATUS_SCHEDULED' || statusName === 'STATUS_POSTPONED') continue
      // Solo emitimos F1 cuando hay carrera en curso. Carreras finalizadas no
      // se cuelan en el "ticker live" — eso lo cubre el endpoint de upcoming.
      if (statusName !== 'STATUS_IN_PROGRESS') continue

      const competitors: RawCompetitor[] = competition.competitors ?? []
      // Ordenar por posición (más bajo = líder)
      const sorted = [...competitors].sort((a, b) => {
        const ap = Number(a.order ?? 999)
        const bp = Number(b.order ?? 999)
        return ap - bp
      })
      const leader = sorted[0]
      const leaderName = (leader?.athlete as Record<string, unknown>)?.displayName as string | undefined
      const raceName = (ev.shortName as string) ?? (ev.name as string) ?? 'F1 GP'

      const statusObj = competition.status as Record<string, unknown> | undefined
      const period    = statusObj?.period as number | undefined
      const totalLaps = competition.numLaps as number | undefined
      const lapInfo = period && totalLaps ? `L${period}/${totalLaps}` : period ? `L${period}` : undefined

      results.push({
        id: String(ev.id),
        homeTeam: raceName,
        awayTeam: leaderName?.trim() ? `Líder: ${leaderName}` : 'En curso',
        homeAbbr: 'F1',
        awayAbbr: leaderName ? leaderName.split(' ').slice(-1)[0].slice(0, 4).toUpperCase() : 'LDR',
        homeGoals: null,
        awayGoals: null,
        status: 'LIVE',
        elapsed: null,
        sport: 'racing',
        comp: 'F1',
        clock: lapInfo,
        period,
        matchRef: `racing_f1_${String(ev.id)}`,
      })
    }
    return results
  } catch (err) {
    console.error('[live] ESPN F1 fetch failed:', err)
    return []
  }
}

// ── API-Sports (solo si hay key) ────────────────────────────────
// CUOTA DE PAGO: api-sports.io free = 100 req/día (y la cuenta está SUSPENDIDA,
// ver CLAUDE.md). Es solo un MERGE de fallback: añade partidos que ESPN no cubre,
// así que su frescura importa poco. Tiene su PROPIA caché de 5 min DESACOPLADA del
// LIVE_TTL del endpoint — si no, el apretón de latencia (LIVE_TTL 60→20s, para la
// frescura de ESPN que es GRATIS) triplicaría estas llamadas de pago (~1440→4320/
// día). Con esta caché quedan ~288/día como mucho, y el `no-store` del fetch evita
// además que el Data Cache de Next las cachee de más. NUNCA ligar esto al LIVE_TTL.
const API_SPORTS_TTL = 5 * 60_000
let apiSportsCache: { data: LiveScore[]; ts: number } | null = null

async function fetchApiSportsLive(): Promise<LiveScore[]> {
  const key = process.env.API_SPORTS_KEY
  if (!key) return []
  if (apiSportsCache && Date.now() - apiSportsCache.ts < API_SPORTS_TTL) return apiSportsCache.data
  try {
    const res = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
      headers: { 'x-apisports-key': key },
      cache: 'no-store',
    })
    if (!res.ok) {
      // Suspendida/agotada → cachea el vacío 5 min para NO re-golpear la cuota.
      console.error(`[live] API-Sports responded ${res.status}`)
      apiSportsCache = { data: [], ts: Date.now() }
      return []
    }
    const json = await res.json()
    if (!Array.isArray(json.response)) { apiSportsCache = { data: [], ts: Date.now() }; return [] }

    const results: LiveScore[] = []
    for (const f of json.response) {
      const fixture = f.fixture as Record<string, unknown>
      const league  = f.league  as Record<string, unknown>
      const teams   = f.teams   as Record<string, Record<string, unknown>>
      const goals   = f.goals   as Record<string, number | null>
      const status  = fixture.status as Record<string, unknown>

      const home = normalizeTeam({
        id: teams.home.id as string | number | undefined,
        displayName: teams.home.name as string | undefined,
        logo: teams.home.logo as string | undefined,
      })
      const away = normalizeTeam({
        id: teams.away.id as string | number | undefined,
        displayName: teams.away.name as string | undefined,
        logo: teams.away.logo as string | undefined,
      })
      if (!home || !away) continue

      // API-Sports usa códigos cortos para estados terminales: FT, AET (prórroga
      // finalizada), PEN (penaltis), AWD (adjudicado), WO (walkover), CANC, PST
      // (postponed), ABD (abandoned), SUSP. Normalizamos a 'FT' para que los
      // consumidores los traten como finalizados — igual que el flag completed
      // de ESPN. PT/HT/2H/ET/BT/P/INT son estados en juego o pausas activas.
      const rawShort = (status.short as string) ?? ''
      const APISPORTS_TERMINAL = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'PST', 'ABD', 'SUSP'])
      const normalizedStatus = APISPORTS_TERMINAL.has(rawShort) ? 'FT' : rawShort

      results.push(buildScore(
        `apisports-${fixture.id}`,
        home,
        away,
        goals.home,
        goals.away,
        normalizedStatus,
        'soccer',
        {
          comp: league.name as string,
          venue: (fixture.venue as Record<string, unknown>)?.name as string | undefined,
          elapsed: status.elapsed as number | null,
        },
      ))
    }
    apiSportsCache = { data: results, ts: Date.now() }
    return results
  } catch (err) {
    console.error('[live] API-Sports fetch failed:', err)
    apiSportsCache = { data: [], ts: Date.now() }
    return []
  }
}

// ── Handler ─────────────────────────────────────────────────────

// Cache headers para CDN edge: todos los usuarios polleando comparten una sola
// respuesta cacheada en el CDN en vez de invocar la función cada vez.
// LIVE: 20s fresh + 40s stale-while-revalidate (alineado con el poll de cliente de
//       20s; el swr sirve la respuesta al instante y refresca en segundo plano, así
//       que el usuario nunca espera aunque caiga justo antes del refresco del CDN).
// IDLE: 120s fresh + 300s stale (no urge si no hay partidos en vivo).
function cacheHeaders(hasLive: boolean, extra: Record<string, string> = {}): Record<string, string> {
  const sMax = hasLive ? 20 : 120
  const swr  = hasLive ? 40 : 300
  return {
    'Cache-Control': `public, s-maxage=${sMax}, stale-while-revalidate=${swr}`,
    'CDN-Cache-Control': `public, s-maxage=${sMax}, stale-while-revalidate=${swr}`,
    ...extra,
  }
}

export async function GET() {
  const now = Date.now()
  const ttl = cache?.hasLive ? LIVE_TTL : IDLE_TTL

  if (cache && now - cache.ts < ttl) {
    return NextResponse.json(cache.data, { headers: cacheHeaders(cache.hasLive) })
  }

  try {
    const [leagueResults, tennisResults, ufcResults, f1Results, apiSportsResults] = await Promise.all([
      Promise.allSettled(ESPN_TEAM_LEAGUES.map(s => fetchTeamLeague(s.slug, s.sport, s.comp, s.slug.replace('/', '_')))),
      Promise.allSettled(TENNIS_SLUGS.map(fetchTennisLive)),
      fetchUfcLive(),
      fetchF1Live(),
      fetchApiSportsLive(),
    ])

    const scores: LiveScore[] = []
    for (const r of leagueResults) { if (r.status === 'fulfilled') scores.push(...r.value) }
    for (const r of tennisResults)  { if (r.status === 'fulfilled') scores.push(...r.value) }
    scores.push(...ufcResults, ...f1Results)

    // Merge API-Sports
    const espnIds = new Set(scores.map(s => `${s.homeTeam}|${s.awayTeam}`))
    for (const s of apiSportsResults) {
      if (!espnIds.has(`${s.homeTeam}|${s.awayTeam}`)) scores.push(s)
    }

    // Garantía de salida: nunca emitimos eventos sin nombres válidos.
    const valid = scores.filter(s => !!s.homeTeam && !!s.awayTeam && s.homeTeam.trim() && s.awayTeam.trim())

    const hasLive = valid.some(s => !TERMINAL_STATUSES.has(s.status))
    cache = { data: valid, ts: now, hasLive }
    staleCache = cache

    return NextResponse.json(valid, { headers: cacheHeaders(hasLive) })
  } catch (err) {
    console.error('[live] Unexpected error fetching live scores:', err)
    if (staleCache && now - staleCache.ts < STALE_MAX) {
      return NextResponse.json(staleCache.data, { headers: cacheHeaders(staleCache.hasLive, { 'X-Cache': 'STALE' }) })
    }
    return NextResponse.json([], { headers: cacheHeaders(false) })
  }
}
