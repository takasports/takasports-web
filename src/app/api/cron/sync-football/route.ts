// GET/POST /api/cron/sync-football
//
// Publica y liquida las FECHAS de Ranked Fútbol: lee el fixture del núcleo
// europeo desde ESPN, decide con `football-ranked` qué partidos destacados
// componen cada día y los vuelca a `ranked_events` con sport='football'.
//
// Requiere header `x-cron-secret` o `Authorization: Bearer <CRON_SECRET>`.
//
// Hace cuatro cosas, en este orden:
//   1. PUBLICAR  — solo días que aún no existen en base de datos.
//   2. LIQUIDAR  — actualiza status/result de los ya publicados y reparte
//                  puntos de los que ESPN da por terminados.
//   3. PLENO     — premia a quien clavó una Fecha entera, en cuanto cierra.
//   4. CERRAR    — close_started_ranked_events() para los ya empezados.
//
// ── La regla de oro ────────────────────────────────────────────────────────
// Una Fecha publicada NO se recalcula jamás. El cron corre cada 30 min; si
// pudiera reseleccionar, un partido ya pronosticado podría desaparecer del día
// (dejando la predicción huérfana) o perder su x2 a media semana. Publicar es
// irreversible: a partir de ahí el cron solo actualiza resultados.
//
// Es seguro llamarlo N veces: la publicación salta los días existentes y
// score_ranked_prediction solo puntúa predicciones con is_correct IS NULL.

import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { sendTelegram } from '@/lib/telegram'
import { FINAL_STATUSES } from '@/lib/espn'
import { toSpanishNation } from '@/lib/nation-names'
import {
  RANKED_FOOTBALL_SOURCES,
  RANKED_FOOTBALL_SPORT,
  RANKED_WINDOW_DAYS,
  buildRankedDates,
  scoreFixtures,
  rankedFootballId,
  toDateKey,
  type FootballFixture,
} from '@/lib/football-ranked'

export const dynamic = 'force-dynamic'
// Tope anti-runaway: 19 ligas en paralelo, cada una con su propio timeout de
// 10 s. Si algo se atasca, cortamos a los 60 s en vez de consumir los 300 s
// por defecto del plan.
export const maxDuration = 60

/** Días hacia atrás que seguimos mirando para liquidar. El cron corre cada
 *  30 min, así que 3 días es margen de sobra para sobrevivir a una caída de
 *  ESPN o del propio cron sin dejar partidos sin puntuar. */
const LOOKBACK_DAYS = 3

// ── Tipos ESPN (subconjunto que usamos) ──────────────────────────────────────

interface EspnCompetitor {
  homeAway: string
  team?:    { displayName?: string; shortDisplayName?: string; abbreviation?: string; logo?: string; logoDark?: string }
  score?:   string | { value: number }
  winner?:  boolean
}

interface EspnEvent {
  id:           string
  date:         string
  name?:        string
  competitions?: {
    competitors?: EspnCompetitor[]
    status?:      { type?: { name?: string; state?: string } }
    venue?:       { fullName?: string }
    notes?:       { headline?: string }[]
  }[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

/** Ventana que se pide a ESPN: lo ya jugado que queda por liquidar + lo que se
 *  abre a predicción. */
function espnDateRange(now = new Date()): string {
  const from = new Date(now); from.setUTCDate(now.getUTCDate() - LOOKBACK_DAYS)
  const to   = new Date(now); to.setUTCDate(now.getUTCDate() + RANKED_WINDOW_DAYS)
  return `${yyyymmdd(from)}-${yyyymmdd(to)}`
}

function scoreToInt(s: string | { value: number } | undefined): number | null {
  if (s == null) return null
  if (typeof s === 'object' && 'value' in s) return s.value
  const n = parseInt(String(s), 10)
  return Number.isNaN(n) ? null : n
}

/**
 * Ganador del partido. El flag `winner` de ESPN manda sobre el marcador porque
 * es el único que resuelve prórroga y penaltis, donde los goles empatan pero
 * hay un equipo que pasa.
 */
function toWinner(
  homeScore:  number | null,
  awayScore:  number | null,
  homeWinner: boolean | undefined,
  awayWinner: boolean | undefined,
): '1' | 'X' | '2' | null {
  if (homeWinner === true) return '1'
  if (awayWinner === true) return '2'
  if (homeScore == null || awayScore == null) return null
  if (homeScore > awayScore) return '1'
  if (awayScore > homeScore) return '2'
  return 'X'
}

async function fetchLeague(slug: string, range: string, limit: number): Promise<EspnEvent[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard?dates=${range}&limit=${limit}`
  try {
    const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return []
    const json = await res.json() as { events?: EspnEvent[] }
    return json.events ?? []
  } catch {
    return []
  }
}

/** Estado en el que ESPN deja el partido, traducido al vocabulario de ranked_events. */
interface EspnState {
  statusName: string
  isResolved: boolean
  isLive:     boolean
  homeScore:  number | null
  awayScore:  number | null
  winner:     '1' | 'X' | '2' | null
}

function readState(ev: EspnEvent): EspnState | null {
  const comp = ev.competitions?.[0]
  const home = comp?.competitors?.find(c => c.homeAway === 'home')
  const away = comp?.competitors?.find(c => c.homeAway === 'away')
  if (!home || !away) return null

  const statusName = comp?.status?.type?.name ?? ''
  const isResolved = FINAL_STATUSES.has(statusName)
  const homeScore  = scoreToInt(home.score)
  const awayScore  = scoreToInt(away.score)

  return {
    statusName,
    isResolved,
    isLive:    comp?.status?.type?.state === 'in',
    homeScore,
    awayScore,
    winner:    isResolved ? toWinner(homeScore, awayScore, home.winner, away.winner) : null,
  }
}

/** ESPN → fixture normalizado. `null` si al partido le falta algo esencial. */
function toFixture(ev: EspnEvent, comp: string, leagueSlug: string): FootballFixture | null {
  const competition = ev.competitions?.[0]
  const home = competition?.competitors?.find(c => c.homeAway === 'home')
  const away = competition?.competitors?.find(c => c.homeAway === 'away')
  if (!home?.team || !away?.team || !ev.date) return null

  // Los nombres de selección se guardan YA traducidos ("Spain" → "España"),
  // igual que hace el calendario: es lo que se pinta en la tarjeta y lo que
  // debe viajar a la app sin que cada cliente tenga que traducir por su cuenta.
  const homeName = toSpanishNation(home.team.displayName ?? home.team.shortDisplayName ?? '')
  const awayName = toSpanishNation(away.team.displayName ?? away.team.shortDisplayName ?? '')
  if (!homeName || !awayName) return null

  return {
    espnId:     ev.id,
    isoDate:    ev.date,
    comp,
    leagueSlug,
    home:       homeName,
    away:       awayName,
    homeLogo:   home.team.logoDark ?? home.team.logo,
    awayLogo:   away.team.logoDark ?? away.team.logo,
    homeAbbr:   home.team.abbreviation,
    awayAbbr:   away.team.abbreviation,
    stage:      competition?.notes?.[0]?.headline,
    venue:      competition?.venue?.fullName,
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = adminSupabase()
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'admin_client_unavailable' }, { status: 503 })
  }

  // ── 1. Fixture crudo ───────────────────────────────────────────────────────
  const range = espnDateRange()
  const settled = await Promise.allSettled(
    RANKED_FOOTBALL_SOURCES.map(async src => ({
      src,
      events: await fetchLeague(src.slug, range, src.fetchLimit ?? 100),
    })),
  )

  const fixtures: FootballFixture[] = []
  const stateByEspnId = new Map<string, EspnState>()
  // Dedupe con su propio registro y no con el de estados: un mismo partido no
  // debería llegar por dos scoreboards, pero si pasa (supercopas que ESPN
  // cuelga de dos slugs) nos quedamos con el primero. Usar el mapa de estados
  // como registro dejaría pasar un duplicado cada vez que el primero llegara
  // sin estado legible.
  const seen = new Set<string>()

  for (const r of settled) {
    if (r.status !== 'fulfilled') continue
    for (const ev of r.value.events) {
      if (seen.has(ev.id)) continue
      const fixture = toFixture(ev, r.value.src.comp, r.value.src.slug)
      if (!fixture) continue
      seen.add(ev.id)
      const state = readState(ev)
      if (state) stateByEspnId.set(ev.id, state)
      fixtures.push(fixture)
    }
  }

  if (fixtures.length === 0) {
    return NextResponse.json({ ok: true, fetched: 0, published: 0, note: 'ESPN no devolvió fixture' })
  }

  // ── 2. Qué hay ya publicado ────────────────────────────────────────────────
  // Solo la ventana relevante: la tabla acumula temporadas enteras y no hace
  // falta traérselas para decidir qué publicar hoy.
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - LOOKBACK_DAYS - 1)

  const { data: existingRows, error: existingErr } = await admin
    .from('ranked_events')
    .select('id, status, meta')
    .eq('sport', RANKED_FOOTBALL_SPORT)
    .gte('event_date', since.toISOString())

  if (existingErr) {
    return NextResponse.json({ ok: false, error: 'db_read_failed' }, { status: 500 })
  }

  const existingIds   = new Set<string>()
  const publishedDays = new Set<string>()
  const resolvedIds   = new Set<string>()
  const dateKeyById   = new Map<string, string>()
  for (const row of existingRows ?? []) {
    const r = row as { id: string; status: string; meta?: { date_key?: string } }
    existingIds.add(r.id)
    if (r.meta?.date_key) {
      publishedDays.add(r.meta.date_key)
      dateKeyById.set(r.id, r.meta.date_key)
    }
    if (r.status === 'resolved') resolvedIds.add(r.id)
  }

  // ── 3. Publicar las Fechas nuevas ──────────────────────────────────────────
  // Solo días futuros: un día ya jugado que nunca llegó a publicarse no se
  // publica ahora — abrir a predicción un partido con resultado conocido sería
  // regalar puntos.
  const todayKey = toDateKey(new Date().toISOString())
  const publishable = scoreFixtures(fixtures).filter(f => f.dateKey >= todayKey)
  const newDates = buildRankedDates(publishable, publishedDays)

  let published = 0
  for (const date of newDates) {
    const rows = date.matches.map(m => ({
      id:          rankedFootballId(m.espnId),
      sport:       RANKED_FOOTBALL_SPORT,
      competition: m.comp,
      event_date:  m.isoDate,
      team_home:   m.home,
      team_away:   m.away,
      featured:    m.espnId === date.featuredEspnId,
      status:      'open',
      result:      null,
      meta: {
        date_key:        date.dateKey,
        espn_id:         m.espnId,
        league_slug:     m.leagueSlug,
        home_logo:       m.homeLogo  ?? null,
        away_logo:       m.awayLogo  ?? null,
        home_abbr:       m.homeAbbr  ?? null,
        away_abbr:       m.awayAbbr  ?? null,
        stage:           m.stage     ?? null,
        venue:           m.venue     ?? null,
        // Se guarda para poder auditar meses después por qué este partido entró
        // en la Fecha (o por qué fue el Partido del Día) sin reconstruir el
        // estado del fixture de aquel día.
        highlight_score: m.score,
      },
    }))

    // ignoreDuplicates: si dos ejecuciones del cron se solapan, la segunda no
    // debe pisar lo que escribió la primera — el estado y el featured del día
    // ya publicado mandan.
    const { error } = await admin
      .from('ranked_events')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    if (!error) published += rows.length
  }

  // ── 4. Liquidar lo publicado ───────────────────────────────────────────────
  let resolved = 0
  let scoringFailures = 0
  /** Días cuya composición ha cambiado en esta pasada: son los únicos donde el
   *  pleno puede haberse completado ahora. */
  const touchedDays = new Set<string>()

  for (const [espnId, state] of stateByEspnId) {
    const id = rankedFootballId(espnId)
    if (!existingIds.has(id)) continue          // no publicado → nada que liquidar
    if (resolvedIds.has(id)) continue           // ya resuelto → idempotencia
    if (!state.isResolved || state.winner === null) {
      // En juego: solo movemos el estado para que la UI lo pinte en vivo.
      if (state.isLive) {
        await admin.from('ranked_events').update({ status: 'closed' }).eq('id', id)
      }
      continue
    }

    // score_ranked_prediction escribe el resultado, marca el evento como
    // resolved y acredita puntos en una sola transacción idempotente.
    //
    // OJO: supabase-js NO lanza cuando la RPC falla, devuelve { error }. Con un
    // try/catch alrededor, un fallo de scoring se contaría como éxito y la
    // alerta de más abajo no saltaría nunca: partidos resueltos, usuarios sin
    // sus puntos y ni un log. Hay que mirar `error` explícitamente.
    const { error: rpcErr } = await admin.rpc('score_ranked_prediction', {
      p_event_id:   id,
      p_winner:     state.winner,
      p_home_score: state.homeScore,
      p_away_score: state.awayScore,
    })
    if (rpcErr) {
      scoringFailures++
    } else {
      resolved++
      const dk = dateKeyById.get(id)
      if (dk) touchedDays.add(dk)
    }
  }

  // ── 4b. Pleno de la Fecha ──────────────────────────────────────────────────
  // Solo puede completarse un día en el que acabamos de resolver algo. La RPC
  // se encarga de comprobar que la Fecha esté cerrada entera y de no pagar dos
  // veces, así que llamarla de más es inofensivo.
  let plenos = 0
  for (const dateKey of touchedDays) {
    const { data: awarded, error: plenoErr } = await admin.rpc('award_fecha_pleno', { p_date_key: dateKey })
    if (!plenoErr && typeof awarded === 'number') plenos += awarded
  }

  // ── 5. Cerrar los ya empezados ─────────────────────────────────────────────
  // Cosmético: los picks ya se bloquean 60 min antes del kickoff en la API, así
  // que si esto falla nadie puede colar una predicción tardía.
  await admin.rpc('close_started_ranked_events')

  if (scoringFailures > 0) {
    await sendTelegram(
      `⚠️ sync-football: ${scoringFailures} partido(s) con resultado de ESPN pero el scoring FALLÓ. ` +
      `Revisar score_ranked_prediction / point_transactions.`,
    )
  }

  return NextResponse.json({
    ok: true,
    fetched:   fixtures.length,
    newDates:  newDates.map(d => ({ date: d.dateKey, matches: d.matches.length })),
    published,
    resolved,
    plenos,
    scoringFailures,
  })
}

export async function GET(req: Request)  { return handle(req) }
export async function POST(req: Request) { return handle(req) }
