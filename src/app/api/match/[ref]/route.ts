import { NextResponse } from 'next/server'
import type { StandingZone } from '@/lib/league-zones'
import { getSpanishBroadcast } from '@/lib/broadcasts'
import { LEAGUE_LABEL_BY_SLUG } from '@/lib/football-leagues'
import { NATIONAL_TEAM_COMPS, toSpanishNation } from '@/lib/nation-names'
import { fetchLeagueTableRows, fetchTournamentGroups, type LeagueTableRow } from '@/lib/espn-standings'
import { getPastEventByRef, type H2HResult, type H2HMatch, type FormResult } from '@/lib/past-events'
import {
  normalizeScoringType, commentaryLabelFor, SOCCER_STAT_ORDER, SOCCER_LABELS,
} from '@/lib/espn-soccer'
// Re-exportados para los componentes cliente que ya importan estos tipos desde
// este route (LeagueTable.tsx). La fuente real vive ahora en lib/espn-standings.
export type { StandingZone }
export type { LeagueTableRow }

// Caché de borde: el detalle del partido es PÚBLICO (datos de ESPN, sin cookies
// ni usuario), así el sondeo del marcador (client-side cada 20s) y el self-fetch
// de la página golpean el CDN en vez de re-ejecutar la función o llamar a ESPN.
// La frescura se ADAPTA al estado: un partido EN VIVO necesita 15s, pero uno
// TERMINADO no cambia (1h) y uno PROGRAMADO casi tampoco (5min). Conservador: si
// el estado no es confiablemente final/programado, se queda en 15s → NUNCA se
// sobre-cachea un partido en directo (no mostraría el marcador viejo).
const FINAL_STATUSES = new Set([
  'STATUS_FULL_TIME', 'STATUS_FINAL', 'STATUS_FINAL_PEN', 'STATUS_FINAL_AET',
  'STATUS_POST_GAME', 'STATUS_END_OF_REGULATION',
  'STATUS_CANCELED', 'STATUS_ABANDONED', 'STATUS_FORFEIT', 'STATUS_WALKOVER', 'STATUS_RETIRED',
])
const UPCOMING_STATUSES = new Set(['STATUS_SCHEDULED', 'STATUS_PRE_GAME'])

function matchCache(status: string | undefined) {
  const s = status ?? ''
  const maxAge = FINAL_STATUSES.has(s) ? 3600 : UPCOMING_STATUSES.has(s) ? 300 : 15
  const swr = maxAge === 15 ? 60 : maxAge * 4
  const cc = `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`
  return { headers: { 'Cache-Control': cc, 'CDN-Cache-Control': cc } }
}

export type SportKind = 'soccer' | 'basketball' | 'mma' | 'racing' | 'tennis' | 'golf' | 'other'

export interface MatchStat {
  label: string
  home: string
  away: string
}

export interface ScoringEvent {
  team: 'home' | 'away'
  player?: string
  playerId?: string   // id ESPN del atleta → enlace a /jugador
  clock?: string
  type: string   // 'goal' | 'yellow' | 'red' | 'penalty' | 'penalty-missed' | 'own-goal'
  detail?: string // matiz en español ("De cabeza", "De falta", "Parado"…) — cuenta el partido
}

// Entrada del minuto a minuto (commentary de ESPN, ya localizada). El texto
// original viene en inglés → no se usa: se reconstruye una etiqueta en español
// a partir del tipo estructurado de jugada + equipo + jugador. ESPN no da el id
// del atleta en commentary, así que el feed no enlaza (los goles sí enlazan en
// el "Resumen" vía keyEvents).
export interface CommentaryEntry {
  minute?: string
  type: string          // tipo ESPN normalizado (goal, foul, shot-on-target…)
  label: string         // etiqueta en español
  team?: 'home' | 'away'
  player?: string
  assist?: string       // segundo participante en goles (asistencia)
  key: boolean          // evento destacado (gol/tarjeta/cambio/penalti/VAR)
}

export interface BasketballLeader {
  team: 'home' | 'away'
  category: string
  player: string
  playerId?: string   // id ESPN del atleta → enlace a /jugador
  headshot?: string
  value: string
  summary?: string
}

// Boxscore de baloncesto: una fila por jugador con las stats clave del partido
// (del boxscore.players[].statistics[].athletes[] de ESPN). Starters primero;
// los que no jugaron (dnp) llevan stats vacías.
export interface BoxPlayer {
  name: string
  jersey?: string
  pos?: string
  starter: boolean
  dnp: boolean
  min?: string
  pts?: string
  reb?: string
  ast?: string
  fg?: string
  threePt?: string
  plusMinus?: string
}
export interface BoxTeam {
  players: BoxPlayer[]
  totals: { pts?: string; reb?: string; ast?: string }
}

export interface MmaFighter {
  name: string
  headshot?: string
  flag?: string
  winner?: boolean
  record?: string
}

// Un combate de la cartelera (para listar la velada completa al abrir el evento).
export interface MmaFight {
  fighters: MmaFighter[]   // [home, away]
  weightClass?: string
  rounds?: number
  endRound?: number
  endTime?: string
  note?: string            // método/resultado
  statusLabel?: string     // "Final", "R2 3:45", hora…
  isMain?: boolean         // combate estelar (primero de la cartelera)
}

export interface RacingResult {
  pos: number
  driver: string
  team?: string
  time?: string
}

export interface GolfLeader {
  pos: string
  player: string
  score: string
  today?: string
}

export interface TennisSet {
  home: (string | null)[]
  away: (string | null)[]
}

export interface LineupPlayer {
  id?: string
  name: string
  shortName?: string
  jersey?: string
  posAbbr?: string
  headshot?: string
}

export interface TeamLineup {
  formation?: string  // e.g. "4-3-3"
  starters: LineupPlayer[]
  bench: LineupPlayer[]
}

export interface MatchDetail {
  id: string
  sport: SportKind
  leagueSlug: string
  leagueLabel: string
  status: string
  statusLabel: string
  venue?: string
  broadcast?: string
  startDate?: string   // ISO-8601 UTC — para countdown y export .ics

  // Team-sport common (soccer, basketball)
  homeTeam?: string
  awayTeam?: string
  homeAbbr?: string
  awayAbbr?: string
  homeLogo?: string
  awayLogo?: string
  homeTeamId?: string
  awayTeamId?: string
  homeScore?: number | null
  awayScore?: number | null

  soccer?: {
    stats: MatchStat[]
    scoring: ScoringEvent[]
    commentary?: CommentaryEntry[]
  }
  basketball?: {
    stats: MatchStat[]
    quarters: { home: (number | null)[]; away: (number | null)[] }
    leaders: BasketballLeader[]
    boxscore?: { home: BoxTeam; away: BoxTeam }
  }
  mma?: {
    weightClass?: string
    rounds?: number
    endRound?: number
    endTime?: string
    fighters: MmaFighter[]
    cardName?: string
    note?: string
    fights?: MmaFight[]      // cartelera completa (todos los combates, estelar primero)
  }
  racing?: {
    circuit?: string
    results: RacingResult[]
  }
  tennis?: {
    round?: string
    tournament?: string        // nombre del torneo (Wimbledon, Nordea Open…)
    homePlayer?: string
    awayPlayer?: string
    homeFlag?: string          // URL de la bandera del país (ESPN)
    awayFlag?: string
    homeCountry?: string       // nombre del país (flag.alt)
    awayCountry?: string
    homeWon?: boolean          // ganador del partido
    awayWon?: boolean
    sets: TennisSet
    setWinners?: ('home' | 'away' | null)[]   // ganador de cada set
  }
  golf?: {
    round?: string
    leaderboard: GolfLeader[]
  }

  // Lineups + league table (soccer/basketball)
  lineups?: { home: TeamLineup; away: TeamLineup }
  leagueTable?: LeagueTableRow[]
  /** Título alternativo de la tabla (Mundial: "Grupo A" en vez de la liga). */
  leagueTableLabel?: string

  // Cara a cara + forma reciente, extraídos del PROPIO summary de ESPN
  // (headToHeadGames / lastFiveGames): coste 0, ya viajan en el payload. Una
  // fuente → dos renders (app y web). `recentForm` es POSICIONAL (home/away) para
  // no depender de la traducción de nombres de selección; más reciente primero.
  headToHead?: H2HResult
  recentForm?: { home: FormResult[]; away: FormResult[] }
}

// ── Helpers ─────────────────────────────────────────────────────────
const COMP_LABELS: Record<string, string> = {
  'soccer/esp.1':          'LaLiga',
  'soccer/eng.1':          'Premier League',
  'soccer/ita.1':          'Serie A',
  'soccer/ger.1':          'Bundesliga',
  'soccer/fra.1':          'Ligue 1',
  'soccer/uefa.champions': 'Champions League',
  'basketball/nba':        'NBA',
  'racing/f1':             'Fórmula 1',
  'mma/ufc':               'UFC',
  'tennis/atp':            'ATP',
  'tennis/wta':            'WTA',
  'golf/pga':              'PGA Tour',
}

function detectSport(leagueSlug: string): SportKind {
  if (leagueSlug.startsWith('soccer/')) return 'soccer'
  if (leagueSlug.startsWith('basketball/')) return 'basketball'
  if (leagueSlug.startsWith('mma/')) return 'mma'
  if (leagueSlug.startsWith('racing/')) return 'racing'
  if (leagueSlug.startsWith('tennis/')) return 'tennis'
  if (leagueSlug.startsWith('golf/')) return 'golf'
  return 'other'
}

// Estados conocidos — si llega uno fuera de este set, se loguea una vez por
// proceso (warnUnknownStatus). Permite detectar nuevos códigos de ESPN sin
// esperar a un bug visible en producción.
const KNOWN_STATUSES = new Set([
  'STATUS_SCHEDULED', 'STATUS_PRE_GAME', 'STATUS_DELAYED', 'STATUS_RAIN_DELAY',
  'STATUS_IN_PROGRESS', 'STATUS_HALFTIME', 'STATUS_FIRST_HALF', 'STATUS_SECOND_HALF',
  'STATUS_END_PERIOD', 'STATUS_END_OF_PERIOD', 'STATUS_OVERTIME', 'STATUS_SHOOTOUT',
  'STATUS_FULL_TIME', 'STATUS_FINAL', 'STATUS_FINAL_PEN', 'STATUS_FINAL_AET',
  'STATUS_POST_GAME', 'STATUS_END_OF_REGULATION',
  'STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_ABANDONED',
  'STATUS_FORFEIT', 'STATUS_WALKOVER', 'STATUS_SUSPENDED', 'STATUS_RETIRED',
])
const _warnedStatuses = new Set<string>()
function warnUnknownStatus(status: string, context: string) {
  if (!status || KNOWN_STATUSES.has(status) || _warnedStatuses.has(status)) return
  _warnedStatuses.add(status)
  console.warn(`[match] Unknown ESPN status "${status}" in ${context} — add to mapStatusLabel/KNOWN_STATUSES`)
}

function mapStatusLabel(espnStatus: string, period?: number, clock?: string, sport?: SportKind): string {
  // Pre-game / scheduled
  if (espnStatus === 'STATUS_SCHEDULED' || espnStatus === 'STATUS_PRE_GAME') return 'Programado'
  if (espnStatus === 'STATUS_DELAYED' || espnStatus === 'STATUS_RAIN_DELAY') return 'Retrasado'
  // Terminal (cubre variantes que antes caían al fallback con etiqueta cruda)
  if (espnStatus === 'STATUS_FULL_TIME' || espnStatus === 'STATUS_FINAL' ||
      espnStatus === 'STATUS_POST_GAME' || espnStatus === 'STATUS_END_OF_REGULATION') return 'Final'
  if (espnStatus === 'STATUS_FINAL_PEN') return 'Final (penaltis)'
  if (espnStatus === 'STATUS_FINAL_AET') return 'Final (prórroga)'
  if (espnStatus === 'STATUS_POSTPONED') return 'Aplazado'
  if (espnStatus === 'STATUS_CANCELED')  return 'Cancelado'
  if (espnStatus === 'STATUS_ABANDONED') return 'Abandonado'
  if (espnStatus === 'STATUS_SUSPENDED') return 'Suspendido'
  if (espnStatus === 'STATUS_FORFEIT')   return 'No presentado'
  if (espnStatus === 'STATUS_WALKOVER')  return 'Walkover'
  if (espnStatus === 'STATUS_RETIRED')   return 'Retirado'
  // Live
  if (sport === 'soccer') {
    if (espnStatus === 'STATUS_HALFTIME')    return 'Descanso'
    if (espnStatus === 'STATUS_FIRST_HALF')  return `1T ${clock ?? ''}`.trim()
    if (espnStatus === 'STATUS_SECOND_HALF') return `2T ${clock ?? ''}`.trim()
    if (espnStatus === 'STATUS_IN_PROGRESS') return `${period === 2 ? '2T' : '1T'} ${clock ?? ''}`.trim()
    if (espnStatus === 'STATUS_OVERTIME')    return `Prórr. ${clock ?? ''}`.trim()
    if (espnStatus === 'STATUS_SHOOTOUT')    return 'Penaltis'
  }
  if (sport === 'basketball') {
    if (espnStatus === 'STATUS_END_PERIOD' || espnStatus === 'STATUS_END_OF_PERIOD') return `Fin Q${period ?? ''}`
    if (espnStatus === 'STATUS_HALFTIME')   return 'Descanso'
    if (espnStatus === 'STATUS_IN_PROGRESS') return `Q${period ?? 1} ${clock ?? ''}`.trim()
    if (espnStatus === 'STATUS_OVERTIME')    return `OT ${clock ?? ''}`.trim()
  }
  warnUnknownStatus(espnStatus, `mapStatusLabel(sport=${sport})`)
  return espnStatus.replace('STATUS_', '')
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}
function asObj(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : undefined
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

// Escudo del equipo. En el summary de ESPN, logo/logoDark a veces vienen null
// (NBA) y el escudo está en el array `logos` (con variante 'dark' para fondo
// oscuro). Además ESPN guarda los logos de NBA en la ruta 'nba', no 'basketball'.
const LOGO_PATH: Record<string, string> = { basketball: 'nba' }
function pickTeamLogo(teamObj: Record<string, unknown> | undefined, sport: SportKind): string | undefined {
  if (!teamObj) return undefined
  const direct = asString(teamObj.logoDark) ?? asString(teamObj.logo)
  if (direct) return direct
  const logos = asArr(teamObj.logos) as Record<string, unknown>[]
  if (logos.length) {
    const rels = (l: Record<string, unknown>) => asArr(l.rel).map(r => String(r))
    const dark = logos.find(l => rels(l).includes('dark') && !rels(l).includes('scoreboard'))
    const def  = logos.find(l => rels(l).includes('default'))
    const href = asString((dark ?? def ?? logos[0])?.href)
    if (href) return href
  }
  const id = asString(teamObj.id)
  if (id) return `https://a.espncdn.com/i/teamlogos/${LOGO_PATH[sport] ?? sport}/500/${id}.png`
  return undefined
}

async function espnJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(url, { next: { revalidate: 15 } })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

// ── Lineups ─────────────────────────────────────────────────────────
function buildLineups(json: Record<string, unknown>): MatchDetail['lineups'] | undefined {
  const rosters = asArr(json.rosters) as Record<string, unknown>[]
  if (rosters.length < 1) return undefined

  const parse = (r: Record<string, unknown>): TeamLineup => {
    const formation = asString(r.formation)
    const all = asArr(r.roster) as Record<string, unknown>[]
    const starters: LineupPlayer[] = []
    const bench: LineupPlayer[] = []
    for (const p of all) {
      const ath = asObj(p.athlete)
      const pos = asObj(p.position)
      const player: LineupPlayer = {
        id:        asString(ath?.id),
        name:      asString(ath?.displayName) ?? '—',
        shortName: asString(ath?.shortName),
        jersey:    asString(p.jersey),
        posAbbr:   asString(pos?.abbreviation),
        headshot:  asString(asObj(ath?.headshot)?.href),
      }
      if (p.starter === true) starters.push(player)
      else bench.push(player)
    }
    return { formation, starters, bench }
  }

  const homeR = rosters.find(r => r.homeAway === 'home') ?? rosters[0]
  const awayR = rosters.find(r => r.homeAway === 'away') ?? rosters[1]
  if (!homeR || !awayR) return undefined

  const result = { home: parse(homeR), away: parse(awayR) }
  if (!result.home.starters.length && !result.away.starters.length) return undefined
  return result
}

// ── Soccer ──────────────────────────────────────────────────────────
// (config de estadísticas y normalización de tipos → @/lib/espn-soccer)

function buildSoccer(json: Record<string, unknown>, homeId?: string): NonNullable<MatchDetail['soccer']> {
  // Estadísticas curadas EN ORDEN (SOCCER_STAT_ORDER) con los nombres REALES del
  // boxscore de ESPN. Iterar el orden (en vez del array crudo) da una secuencia
  // estable y permite añadir pase/entradas/intercepciones/despejes/centros.
  const stats: MatchStat[] = []
  const boxTeams = asArr(asObj(json.boxscore)?.teams) as Record<string, unknown>[]
  if (boxTeams.length >= 2) {
    const homeStats = asArr((boxTeams.find(t => t.homeAway === 'home') ?? boxTeams[0])?.statistics) as Record<string, unknown>[]
    const awayStats = asArr((boxTeams.find(t => t.homeAway === 'away') ?? boxTeams[1])?.statistics) as Record<string, unknown>[]
    const byName = (arr: Record<string, unknown>[], name: string) => arr.find(s => asString(s.name) === name)
    // ESPN da `passPct` como RATIO ("0.9") → saldría "0.9%" (inútil). Recalculamos
    // el porcentaje real (entero) desde accuratePasses/totalPasses.
    const passPctOf = (arr: Record<string, unknown>[]): string | null => {
      const acc = Number(asString(byName(arr, 'accuratePasses')?.displayValue))
      const tot = Number(asString(byName(arr, 'totalPasses')?.displayValue))
      return Number.isFinite(acc) && Number.isFinite(tot) && tot > 0 ? String(Math.round((acc / tot) * 100)) : null
    }
    for (const name of SOCCER_STAT_ORDER) {
      const h = byName(homeStats, name)
      const a = byName(awayStats, name)
      if (!h && !a) continue
      let home = asString(h?.displayValue) ?? String(h?.value ?? '—')
      let away = asString(a?.displayValue) ?? String(a?.value ?? '—')
      if (name === 'passPct') {
        home = passPctOf(homeStats) ?? home
        away = passPctOf(awayStats) ?? away
      }
      stats.push({
        label: SOCCER_LABELS[name] ?? asString(h?.label) ?? asString(a?.label) ?? name,
        home,
        away,
      })
    }
  }

  // keyEvents lleva los eventos fiables (el array `plays` suele venir vacío en
  // fútbol). normalizeScoringType separa el sufijo "---xxx" de ESPN, así los
  // goles de cabeza/volea/falta y el penalti marcado YA no se pierden (antes se
  // descartaban por comparar el tipo exacto), y un penalti parado no cuela como gol.
  const scoring: ScoringEvent[] = []
  for (const ev of asArr(json.keyEvents) as Record<string, unknown>[]) {
    const rawType = asString(asObj(ev.type)?.type) ?? ''
    const norm = normalizeScoringType(rawType)
    if (!norm) continue
    const team = asObj(ev.team)
    // participants[0].athlete.displayName es más fiable que shortText (se trunca ~30 chars).
    const firstParticipant = asObj(asArr(ev.participants)[0])
    const playerFromParticipant = asString(asObj(firstParticipant?.athlete)?.displayName)
    const shortText = asString(ev.shortText) ?? ''
    const playerFromShort = shortText.replace(/ (Goal|Yellow Card|Red Card|Own Goal|Penalty)$/i, '').trim()
    const player = playerFromParticipant || playerFromShort || undefined
    const playerId = asString(asObj(firstParticipant?.athlete)?.id)
    const clock = asString(asObj(ev.clock)?.displayValue)
    scoring.push({
      team: asString(team?.id) === homeId ? 'home' : 'away',
      player,
      playerId,
      clock,
      type: norm.type,
      detail: norm.detail,
    })
  }

  return { stats, scoring }
}

// Minuto a minuto. ESPN da `commentary` en orden ascendente con texto inglés;
// reconstruimos una etiqueta en español desde el tipo estructurado de jugada
// (con su matiz "---xxx", vía commentaryLabelFor) y devolvemos lo más reciente
// primero (estilo directo). Tipos no mapeados (saque de banda, «noplay», ruido)
// se descartan para no colar inglés.
function buildSoccerCommentary(json: Record<string, unknown>, homeName?: string, awayName?: string): CommentaryEntry[] {
  const out: CommentaryEntry[] = []
  for (const c of asArr(json.commentary) as Record<string, unknown>[]) {
    const play = asObj(c.play)
    const rawType = asString(asObj(play?.type)?.type) ?? ''
    const mapped = commentaryLabelFor(rawType)
    if (!mapped) continue   // descarta noplay/desconocidos (evita texto inglés)

    const minute = asString(asObj(c.time)?.displayValue)
                ?? asString(asObj(play?.clock)?.displayValue)
    const teamName = asString(asObj(play?.team)?.displayName)
    // Mapeo por nombre contra AMBOS equipos (commentary.play.team no trae id):
    // si solo coincide uno, queda undefined en vez de etiquetar mal como 'away'.
    const team: 'home' | 'away' | undefined =
      teamName && teamName === homeName ? 'home'
      : teamName && teamName === awayName ? 'away'
      : undefined
    const parts = asArr(play?.participants) as Record<string, unknown>[]
    const player = asString(asObj(parts[0]?.athlete)?.displayName)
    const isGoal = mapped.type === 'goal' || mapped.type === 'penalty-goal'
    const assist = isGoal ? asString(asObj(parts[1]?.athlete)?.displayName) : undefined

    // ESPN registra cada falta dos veces (la falta + «X gana un libre»), mismo
    // tipo, jugador Y equipo → colapsa consecutivas idénticas para no repetir
    // filas (incluye el equipo para no fusionar eventos de equipos distintos).
    const prev = out[out.length - 1]
    if (prev && prev.minute === minute && prev.type === mapped.type
        && prev.player === player && prev.team === team) continue

    out.push({
      minute,
      type: mapped.type,
      label: mapped.label,
      team,
      player,
      assist,
      key: mapped.key,
    })
  }
  // Más reciente primero; tope defensivo de 300 entradas (antes 130 recortaba
  // partidos largos). El render pinta todo lo que recibe.
  return out.reverse().slice(0, 300)
}

// ── Cara a cara + forma reciente (del PROPIO summary de ESPN) ────────
// headToHeadGames: array por equipo con sus últimos enfrentamientos directos.
// lastFiveGames: array por equipo con sus últimos 5 partidos (gameResult W/D/L).
// Ambos vienen GRATIS en el summary → coste 0, sin tocar Supabase.

function buildHeadToHead(
  json: Record<string, unknown>,
  homeTeamId?: string,
  translate: (s: string) => string = (s) => s,
): H2HResult | undefined {
  const groups = asArr(json.headToHeadGames) as Record<string, unknown>[]
  if (!groups.length) return undefined
  const seen = new Set<string>()
  const matches: H2HMatch[] = []
  let wins = 0, draws = 0, losses = 0
  for (const g of groups) {
    for (const ev of asArr(g.events) as Record<string, unknown>[]) {
      const id = asString(ev.id) ?? ''
      if (id && seen.has(id)) continue   // el mismo cruce aparece en ambos equipos
      if (id) seen.add(id)
      const hId = asString(ev.homeTeamId)
      const aId = asString(ev.awayTeamId)
      const hScore = numOrNull(ev.homeTeamScore)
      const aScore = numOrNull(ev.awayTeamScore)
      // Nombre/escudo de cada lado: uno es `g.team`, el otro `ev.opponent`. El
      // nombre se traduce igual que el marcador (selecciones → español) para que
      // el resaltado por fila del render case con match.homeTeam.
      const gTeam = asObj(g.team)
      const opp = asObj(ev.opponent)
      const gTeamId = asString(gTeam?.id)
      const nameFor = (side: 'home' | 'away') => {
        const sideId = side === 'home' ? hId : aId
        const raw = sideId === gTeamId ? asString(gTeam?.displayName) : asString(opp?.displayName)
        return raw ? translate(raw) : raw
      }
      const abbrFor = (side: 'home' | 'away') => {
        const sideId = side === 'home' ? hId : aId
        return sideId === gTeamId ? asString(gTeam?.abbreviation) : asString(opp?.abbreviation)
      }
      const logoFor = (side: 'home' | 'away') => {
        const sideId = side === 'home' ? hId : aId
        return sideId === gTeamId ? asString(gTeam?.logo) : asString(opp?.logo)
      }
      matches.push({
        id: id || `${hId}-${aId}-${asString(ev.gameDate) ?? ''}`,
        isoDate: asString(ev.gameDate) ?? '',
        comp: asString(ev.leagueName) ?? asString(ev.competitionName) ?? '',
        home: nameFor('home') ?? '—',
        away: nameFor('away') ?? '—',
        homeScore: hScore,
        awayScore: aScore,
        homeLogo: logoFor('home'),
        awayLogo: logoFor('away'),
        homeAbbr: abbrFor('home'),
        awayAbbr: abbrFor('away'),
      })
      // Balance desde la óptica del equipo LOCAL del partido actual.
      if (homeTeamId && hScore != null && aScore != null) {
        const homeIsCurrent = hId === homeTeamId
        const curScore = homeIsCurrent ? hScore : aScore
        const oppScore = homeIsCurrent ? aScore : hScore
        if (curScore > oppScore) wins++
        else if (curScore < oppScore) losses++
        else draws++
      }
    }
  }
  if (!matches.length) return undefined
  // Más reciente primero.
  matches.sort((a, b) => (b.isoDate || '').localeCompare(a.isoDate || ''))
  return { matches, wins, draws, losses }
}

// H2H de BALONCESTO: el summary de NBA no trae headToHeadGames, pero sí
// `seasonseries` (Regular Season + Playoffs) con los enfrentamientos directos de
// la temporada. Misma forma H2HResult → un render (H2H tab) sirve para ambos.
function buildBasketballH2H(json: Record<string, unknown>, homeTeamId?: string): H2HResult | undefined {
  const series = asArr(json.seasonseries) as Record<string, unknown>[]
  if (!series.length) return undefined
  const seen = new Set<string>()
  const matches: H2HMatch[] = []
  let wins = 0, draws = 0, losses = 0
  for (const s of series) {
    for (const ev of asArr(s.events) as Record<string, unknown>[]) {
      const id = asString(ev.id) ?? ''
      if (id && seen.has(id)) continue
      if (id) seen.add(id)
      const comps = asArr(ev.competitors) as Record<string, unknown>[]
      const homeC = comps.find(c => asString(c.homeAway) === 'home') ?? comps[0]
      const awayC = comps.find(c => asString(c.homeAway) === 'away') ?? comps[1]
      if (!homeC || !awayC) continue
      const hTeam = asObj(homeC.team), aTeam = asObj(awayC.team)
      const hScore = numOrNull(homeC.score), aScore = numOrNull(awayC.score)
      matches.push({
        id: id || `${asString(hTeam?.id)}-${asString(aTeam?.id)}-${asString(ev.date) ?? ''}`,
        isoDate: asString(ev.date) ?? '',
        comp: asString(s.title) ?? '',
        home: asString(hTeam?.displayName) ?? asString(hTeam?.abbreviation) ?? '—',
        away: asString(aTeam?.displayName) ?? asString(aTeam?.abbreviation) ?? '—',
        homeScore: hScore,
        awayScore: aScore,
        homeLogo: asString(hTeam?.logo),
        awayLogo: asString(aTeam?.logo),
        homeAbbr: asString(hTeam?.abbreviation),
        awayAbbr: asString(aTeam?.abbreviation),
      })
      // Balance desde la óptica del equipo LOCAL del partido actual (solo jugados).
      const stName = asString(asObj(ev.statusType)?.name)
      const completed = asObj(ev.statusType)?.completed === true || stName === 'STATUS_FINAL'
      if (homeTeamId && completed && hScore != null && aScore != null) {
        const hIsCurrent = asString(hTeam?.id) === homeTeamId
        const cur = hIsCurrent ? hScore : aScore
        const opp = hIsCurrent ? aScore : hScore
        if (cur > opp) wins++
        else if (cur < opp) losses++
        else draws++
      }
    }
  }
  if (!matches.length) return undefined
  matches.sort((a, b) => (b.isoDate || '').localeCompare(a.isoDate || ''))
  return { matches, wins, draws, losses }
}

function buildRecentForm(json: Record<string, unknown>, homeTeamId?: string, awayTeamId?: string): MatchDetail['recentForm'] {
  const groups = asArr(json.lastFiveGames) as Record<string, unknown>[]
  if (!groups.length) return undefined
  const formOf = (teamId?: string): FormResult[] => {
    if (!teamId) return []
    const g = groups.find(grp => asString(asObj(grp.team)?.id) === teamId)
    if (!g) return []
    const results: FormResult[] = []
    for (const ev of asArr(g.events) as Record<string, unknown>[]) {
      const r = asString(ev.gameResult)
      if (r === 'W' || r === 'D' || r === 'L') results.push(r)
    }
    // ESPN los da del más antiguo al más reciente → invertimos (más reciente primero).
    return results.reverse()
  }
  const home = formOf(homeTeamId)
  const away = formOf(awayTeamId)
  if (!home.length && !away.length) return undefined
  return { home, away }
}

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number') return Number.isNaN(v) ? null : v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  }
  return null
}

// ── Basketball ──────────────────────────────────────────────────────
const NBA_STATS = new Set([
  'fieldGoalPct', 'threePointFieldGoalPct', 'freeThrowPct',
  'totalRebounds', 'assists', 'steals', 'blocks', 'turnovers',
  'pointsInPaint', 'fastBreakPoints', 'fouls',
])

const NBA_LABELS: Record<string, string> = {
  fieldGoalPct: 'Tiros de campo %',
  threePointFieldGoalPct: 'Triples %',
  freeThrowPct: 'Tiros libres %',
  totalRebounds: 'Rebotes',
  assists: 'Asistencias',
  steals: 'Robos',
  blocks: 'Tapones',
  turnovers: 'Pérdidas',
  pointsInPaint: 'Puntos en la pintura',
  fastBreakPoints: 'Puntos al contraataque',
  fouls: 'Faltas',
}

function buildBasketball(
  json: Record<string, unknown>,
  homeComp: Record<string, unknown> | undefined,
  awayComp: Record<string, unknown> | undefined,
): MatchDetail['basketball'] {
  const stats: MatchStat[] = []
  const boxTeams = asArr(asObj(json.boxscore)?.teams) as Record<string, unknown>[]
  if (boxTeams.length >= 2) {
    const homeStats = asArr((boxTeams.find(t => t.homeAway === 'home') ?? boxTeams[0])?.statistics) as Record<string, unknown>[]
    const awayStats = asArr((boxTeams.find(t => t.homeAway === 'away') ?? boxTeams[1])?.statistics) as Record<string, unknown>[]
    for (const stat of homeStats) {
      const name = asString(stat.name) ?? ''
      if (!NBA_STATS.has(name)) continue
      const awayStat = awayStats.find(s => s.name === name)
      stats.push({
        label: NBA_LABELS[name] ?? asString(stat.label) ?? name,
        home:  asString(stat.displayValue) ?? String(stat.value ?? ''),
        away:  asString(awayStat?.displayValue) ?? String(awayStat?.value ?? '—'),
      })
    }
  }

  const homeQ = asArr(homeComp?.linescores).map(l => {
    const v = asObj(l)?.value
    return typeof v === 'number' ? v : null
  })
  const awayQ = asArr(awayComp?.linescores).map(l => {
    const v = asObj(l)?.value
    return typeof v === 'number' ? v : null
  })

  const homeId = asString(homeComp?.id)
  const leaders: BasketballLeader[] = []
  for (const teamLeaders of asArr(json.leaders) as Record<string, unknown>[]) {
    const teamObj = asObj(teamLeaders.team)
    const side: 'home' | 'away' = asString(teamObj?.id) === homeId ? 'home' : 'away'
    for (const cat of asArr(teamLeaders.leaders) as Record<string, unknown>[]) {
      const top = asObj(asArr(cat.leaders)[0])
      if (!top) continue
      const athlete = asObj(top.athlete)
      const player = asString(athlete?.displayName) ?? asString(athlete?.shortName)
      if (!player) continue
      const headshot = asString(asObj(athlete?.headshot)?.href)
      const value = asString(top.displayValue) ?? String(top.value ?? '')
      const summary = asString(top.summary)
      leaders.push({
        team: side,
        category: asString(cat.displayName) ?? asString(cat.name) ?? '',
        player,
        playerId: asString(athlete?.id),
        headshot,
        value,
        summary,
      })
    }
  }

  // Boxscore por jugador (ambos equipos): stats clave alineadas a las labels de ESPN.
  let boxscore: NonNullable<MatchDetail['basketball']>['boxscore']
  const boxPlayers = asArr(asObj(json.boxscore)?.players) as Record<string, unknown>[]
  if (boxPlayers.length >= 2) {
    const homeBox = boxPlayers.find(t => asString(asObj(t.team)?.id) === homeId) ?? boxPlayers[0]
    const awayBox = boxPlayers.find(t => t !== homeBox) ?? boxPlayers[1]
    boxscore = { home: parseBoxTeam(homeBox), away: parseBoxTeam(awayBox) }
  }

  return {
    stats,
    quarters: { home: homeQ, away: awayQ },
    leaders,
    boxscore,
  }
}

// Una fila por jugador desde boxscore.players[team].statistics[0]. Localiza cada
// columna por NOMBRE (MIN/PTS/REB/AST/FG/3PT/+/-) para no depender del orden.
function parseBoxTeam(teamBox: Record<string, unknown>): BoxTeam {
  const grp = asObj(asArr(teamBox.statistics)[0])
  const names = (asArr(grp?.names) as unknown[]).map(n => asString(n) ?? '')
  const at = (row: (string | undefined)[], key: string) => {
    const i = names.indexOf(key)
    return i >= 0 ? row[i] : undefined
  }
  const players: BoxPlayer[] = (asArr(grp?.athletes) as Record<string, unknown>[]).map(a => {
    const ath = asObj(a.athlete)
    const row = (asArr(a.stats) as unknown[]).map(v => asString(v))
    const dnp = a.didNotPlay === true || row.length === 0
    return {
      name: asString(ath?.displayName) ?? asString(ath?.shortName) ?? '—',
      jersey: asString(ath?.jersey),
      pos: asString(asObj(ath?.position)?.abbreviation),
      starter: a.starter === true,
      dnp,
      min: at(row, 'MIN'),
      pts: at(row, 'PTS'),
      reb: at(row, 'REB'),
      ast: at(row, 'AST'),
      fg: at(row, 'FG'),
      threePt: at(row, '3PT'),
      plusMinus: at(row, '+/-'),
    }
  })
  const totals = (asArr(grp?.totals) as unknown[]).map(v => asString(v))
  return {
    players,
    totals: { pts: at(totals, 'PTS'), reb: at(totals, 'REB'), ast: at(totals, 'AST') },
  }
}

// ── MMA ─────────────────────────────────────────────────────────────
// Mapea UN combate del scoreboard (competition) a MmaFight, reutilizado para el
// combate destacado y para cada fila de la cartelera completa.
function mapMmaFight(fight: Record<string, unknown>, isMain: boolean): MmaFight {
  const statusObj  = asObj(fight.status)
  const statusType = asObj(statusObj?.type)
  const status     = asString(statusType?.name) ?? ''
  const statusLabel = asString(statusType?.shortDetail) ?? mapStatusLabel(status)
  const weightClass = asString(asObj(fight.type)?.abbreviation)
  const rounds = asNumber(asObj(asObj(fight.format)?.regulation)?.periods)
  const ended = asObj(statusType)?.completed === true
  const endRound = ended ? asNumber(statusObj?.period) : undefined
  const endTime = ended ? asString(statusObj?.displayClock) : undefined
  const note = asString(asArr(fight.notes)[0] ? asObj(asArr(fight.notes)[0])?.headline : undefined)
  const fighters: MmaFighter[] = (asArr(fight.competitors) as Record<string, unknown>[]).map(c => {
    const ath = asObj(c.athlete)
    return {
      name:     asString(ath?.displayName) ?? '—',
      headshot: asString(asObj(ath?.headshot)?.href),
      flag:     asString(asObj(ath?.flag)?.alt),
      winner:   c.winner === true,
      record:   asString(asObj(asArr(ath?.records)[0])?.summary),
    }
  })
  return { fighters, weightClass, rounds, endRound, endTime, note, statusLabel, isMain }
}

async function buildMma(eventId: string): Promise<{ mma: MatchDetail['mma']; status: string; statusLabel: string; cardName?: string } | null> {
  const json = await espnJson(`https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?event=${eventId}`)
  if (!json) return null
  const card = asArr(json.events)[0] as Record<string, unknown> | undefined
  if (!card) return null
  const cardName = asString(card.name) ?? asString(card.shortName)
  const competitions = asArr(card.competitions) as Record<string, unknown>[]
  if (competitions.length === 0) return null

  // Combate DESTACADO = el que casa el id (fila EN VIVO por-combate) o, si el id es el
  // de la CARTELERA (fila del calendario), el primero = combate estelar. El resto de la
  // velada se devuelve en `fights` para mostrar la cartelera COMPLETA al abrir el evento.
  const foundIdx = competitions.findIndex(c => asString(c.id) === eventId)
  const featuredIdx = foundIdx >= 0 ? foundIdx : 0
  const fights = competitions.map((c, i) => mapMmaFight(c, i === 0))
  const featured = fights[featuredIdx] ?? fights[0]

  const featStatusType = asObj(asObj(competitions[featuredIdx]?.status)?.type)
  const status = asString(featStatusType?.name) ?? ''
  const statusLabel = asString(featStatusType?.shortDetail) ?? mapStatusLabel(status)

  return {
    mma: {
      weightClass: featured.weightClass,
      rounds:      featured.rounds,
      endRound:    featured.endRound,
      endTime:     featured.endTime,
      fighters:    featured.fighters,
      cardName,
      note:        featured.note,
      fights,
    },
    status,
    statusLabel,
    cardName,
  }
}

// ── Racing (F1) ─────────────────────────────────────────────────────
async function buildRacing(eventId: string): Promise<{ racing: MatchDetail['racing']; status: string; statusLabel: string; venue?: string; raceName?: string } | null> {
  const json = await espnJson(`https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard?event=${eventId}`)
  if (!json) return null
  // ESPN IGNORA ?event= en el scoreboard y devuelve SIEMPRE la carrera actual. Si el
  // id pedido no está entre los eventos devueltos (cualquier carrera pasada salvo la
  // vigente), devolvemos null → 404 honesto, en vez de caer a events[0] y pintar los
  // datos de OTRA carrera (Top10/circuito) bajo esta URL con estado 200.
  const ev = (asArr(json.events) as Record<string, unknown>[]).find(e => asString(e.id) === eventId)
  if (!ev) return null
  const comp = asArr(ev.competitions)[0] as Record<string, unknown> | undefined
  const statusObj = asObj(comp?.status ?? ev.status)
  const statusType = asObj(statusObj?.type)
  const status = asString(statusType?.name) ?? ''
  const statusLabel = asString(statusType?.shortDetail) ?? mapStatusLabel(status)
  const venue = asString(asObj(comp?.venue)?.fullName)
  const raceName = asString(ev.name)

  const competitors = asArr(comp?.competitors) as Record<string, unknown>[]
  const results: RacingResult[] = competitors
    .map(c => {
      const ath = asObj(c.athlete)
      const stats = asArr(c.statistics) as Record<string, unknown>[]
      const time = asString(stats.find(s => s.name === 'totalTime' || s.name === 'behindTime')?.displayValue)
      return {
        pos: Number(asString(c.order) ?? asNumber(c.order) ?? 99),
        driver: asString(ath?.displayName) ?? '—',
        team:   asString(asObj(ath?.team)?.displayName) ?? asString(asObj(c.team)?.displayName),
        time,
      }
    })
    .sort((a, b) => a.pos - b.pos)
    .slice(0, 10)

  return { racing: { circuit: venue, results }, status, statusLabel, venue, raceName }
}

// ── Tennis ──────────────────────────────────────────────────────────
async function buildTennis(eventId: string, leagueSlug: string): Promise<{
  tennis: MatchDetail['tennis']
  homePlayer?: string
  awayPlayer?: string
  status: string
  statusLabel: string
  venue?: string
} | null> {
  const json = await espnJson(`https://site.api.espn.com/apis/site/v2/sports/${leagueSlug}/scoreboard`)
  if (!json) return null

  for (const rawEv of asArr(json.events) as Record<string, unknown>[]) {
    for (const rawG of asArr(rawEv.groupings) as Record<string, unknown>[]) {
      for (const m of asArr(rawG.competitions) as Record<string, unknown>[]) {
        if (asString(m.id) !== eventId) continue

        const tennis = buildTennisFromCompetition(m)
        // El nombre del torneo vive en el evento padre (Wimbledon, Nordea Open…).
        if (tennis) tennis.tournament = asString(rawEv.name)
        const statusObj  = asObj(asObj(m.status)?.type)
        const statusName = asString(statusObj?.name) ?? ''
        const statusLabel = asString(statusObj?.shortDetail) ?? mapStatusLabel(statusName)
        const venue = asString(asObj(m.venue)?.fullName)
        return { tennis, homePlayer: tennis?.homePlayer, awayPlayer: tennis?.awayPlayer, status: statusName, statusLabel, venue }
      }
    }
  }
  return null
}

function buildTennisFromCompetition(comp: Record<string, unknown>): MatchDetail['tennis'] {
  const competitors = asArr(comp.competitors) as Record<string, unknown>[]
  const home = competitors.find(c => c.homeAway === 'home') ?? competitors[0]
  const away = competitors.find(c => c.homeAway === 'away') ?? competitors[1]
  const homeLines = asArr(home?.linescores).map(asObj)
  const awayLines = asArr(away?.linescores).map(asObj)
  const setVal = (l: Record<string, unknown> | undefined) => {
    const v = l?.value
    return v != null ? String(v) : null
  }
  const homeSets = homeLines.map(setVal)
  const awaySets = awayLines.map(setVal)

  // Ganador de cada set: ESPN marca winner en el linescore del set cerrado; si
  // falta, se compara el número de juegos (el set en curso queda sin ganador).
  const setCount = Math.max(homeLines.length, awayLines.length)
  const setWinners: ('home' | 'away' | null)[] = []
  for (let i = 0; i < setCount; i++) {
    const h = homeLines[i]; const a = awayLines[i]
    if (h?.winner === true) setWinners.push('home')
    else if (a?.winner === true) setWinners.push('away')
    else {
      const hv = typeof h?.value === 'number' ? h.value as number : null
      const av = typeof a?.value === 'number' ? a.value as number : null
      setWinners.push(hv != null && av != null && hv !== av ? (hv > av ? 'home' : 'away') : null)
    }
  }

  // El competidor de tenis trae el atleta directo (singles) o dentro de
  // `athletes[]` (dobles). Sacamos el objeto atleta de forma robusta para leer
  // nombre + bandera del país (flag.href = URL, flag.alt = país).
  const athOf = (c: Record<string, unknown> | undefined) =>
    asObj(c?.athlete) ?? asObj(asObj(asArr(c?.athletes)[0])?.athlete) ?? asObj(asArr(c?.athletes)[0])
  const homeAth = athOf(home)
  const awayAth = athOf(away)
  const homePlayer = asString(homeAth?.displayName) ?? asString(asObj(home?.team)?.displayName)
  const awayPlayer = asString(awayAth?.displayName) ?? asString(asObj(away?.team)?.displayName)
  const round = asString(asObj(comp.round)?.displayName)
             ?? asString(asObj(comp.type)?.text)
             ?? asString(asArr(comp.notes)[0] ? asObj(asArr(comp.notes)[0])?.headline : undefined)
  return {
    round,
    homePlayer,
    awayPlayer,
    homeFlag: asString(asObj(homeAth?.flag)?.href),
    awayFlag: asString(asObj(awayAth?.flag)?.href),
    homeCountry: asString(asObj(homeAth?.flag)?.alt),
    awayCountry: asString(asObj(awayAth?.flag)?.alt),
    homeWon: home?.winner === true,
    awayWon: away?.winner === true,
    sets: { home: homeSets, away: awaySets },
    setWinners,
  }
}

// ── Golf (PGA leaderboard top) ──────────────────────────────────────
async function buildGolf(eventId: string): Promise<{ golf: MatchDetail['golf']; status: string; statusLabel: string; raceName?: string; venue?: string } | null> {
  const json = await espnJson(`https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=${eventId}`)
  if (!json) return null
  // Mismo caso que buildRacing: el scoreboard ignora ?event= y da el torneo actual. Si
  // el id pedido no aparece, 404 en vez de pintar OTRO torneo bajo esta URL.
  const ev = (asArr(json.events) as Record<string, unknown>[]).find(e => asString(e.id) === eventId)
  if (!ev) return null
  const comp = asArr(ev.competitions)[0] as Record<string, unknown> | undefined
  const statusObj = asObj(comp?.status ?? ev.status)
  const statusType = asObj(statusObj?.type)
  const status = asString(statusType?.name) ?? ''
  const statusLabel = asString(statusType?.shortDetail) ?? mapStatusLabel(status)

  const round = asString(asObj(comp?.status)?.period ? `Ronda ${asObj(comp?.status)?.period}` : undefined)

  const competitors = asArr(comp?.competitors) as Record<string, unknown>[]
  const leaderboard: GolfLeader[] = competitors.slice(0, 10).map(c => {
    const ath = asObj(c.athlete)
    const stats = asArr(c.statistics) as Record<string, unknown>[]
    return {
      pos:    asString(c.status ? asObj(c.status)?.position?.toString() : undefined)
              ?? asString(asObj(asObj(c.status)?.position)?.id)
              ?? String(asNumber(c.order) ?? ''),
      player: asString(ath?.displayName) ?? '—',
      score:  asString(c.score) ?? asString(stats.find(s => s.name === 'scoreToPar')?.displayValue) ?? '',
      today:  asString(stats.find(s => s.name === 'thru')?.displayValue),
    }
  })

  return {
    golf: { round, leaderboard },
    status,
    statusLabel,
    venue: asString(asObj(comp?.venue)?.fullName),
    raceName: asString(ev.name),
  }
}

// ── Route handler ───────────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params

  // ref shape: "<sport>_<league>[.subleague]_<eventId>" → leagueSlug = "<sport>/<league>[...]"
  const parts = ref.split('_')
  if (parts.length < 3) return NextResponse.json(null, { status: 400 })
  const eventId    = parts[parts.length - 1]
  const leagueSlug = parts.slice(0, -1).join('/')
  const sport      = detectSport(leagueSlug)
  const leagueLabel = COMP_LABELS[leagueSlug] ?? LEAGUE_LABEL_BY_SLUG[leagueSlug] ?? parts.slice(0, -1).join(' · ')

  // Selecciones → español (Brazil→Brasil…); los clubes se dejan tal cual (son
  // nombres propios). Mismo criterio que lib/espn.ts: el slug ESPN mapea a su
  // nombre de competición vía LEAGUE_LABEL_BY_SLUG y solo se traduce si está en
  // NATIONAL_TEAM_COMPS (Mundial, Amistoso, Nations, Eurocopa…). Así el detalle
  // queda coherente con el calendario, que ya traduce en fetchLeague.
  const isNationalTeam = NATIONAL_TEAM_COMPS.has(LEAGUE_LABEL_BY_SLUG[leagueSlug] ?? '')
  const nat = <T extends string | null | undefined>(name: T): T =>
    isNationalTeam ? toSpanishNation(name) : name

  try {
    // ─── MMA: needs scoreboard fallback (summary returns 404) ────────
    if (sport === 'mma') {
      const data = await buildMma(eventId)
      if (!data) return NextResponse.json(null, { status: 404 })
      const detail: MatchDetail = {
        id: eventId,
        sport,
        leagueSlug,
        leagueLabel,
        status: data.status,
        statusLabel: data.statusLabel,
        mma: data.mma,
      }
      return NextResponse.json(detail, matchCache(detail.status))
    }

    // ─── Racing (F1) ──────────────────────────────────────────────────
    if (sport === 'racing') {
      const data = await buildRacing(eventId)
      if (!data) return NextResponse.json(null, { status: 404 })
      const detail: MatchDetail = {
        id: eventId,
        sport,
        leagueSlug,
        leagueLabel,
        status: data.status,
        statusLabel: data.statusLabel,
        venue: data.venue,
        racing: data.racing,
      }
      return NextResponse.json(detail, matchCache(detail.status))
    }

    // ─── Golf (PGA) ───────────────────────────────────────────────────
    if (sport === 'golf') {
      const data = await buildGolf(eventId)
      if (!data) return NextResponse.json(null, { status: 404 })
      const detail: MatchDetail = {
        id: eventId,
        sport,
        leagueSlug,
        leagueLabel,
        status: data.status,
        statusLabel: data.statusLabel,
        venue: data.venue,
        golf: data.golf,
      }
      return NextResponse.json(detail, matchCache(detail.status))
    }

    // ─── Tennis: scoreboard lookup (summary returns 400 for match IDs) ─
    if (sport === 'tennis') {
      const data = await buildTennis(eventId, leagueSlug)
      if (data) {
        const detail: MatchDetail = {
          id: eventId,
          sport,
          leagueSlug,
          leagueLabel,
          homeTeam: data.homePlayer,
          awayTeam: data.awayPlayer,
          status: data.status,
          statusLabel: data.statusLabel,
          venue: data.venue,
          tennis: data.tennis,
        }
        return NextResponse.json(detail, matchCache(detail.status))
      }
      // El scoreboard del torneo ya rotó (torneo terminado) → el partido no está en
      // vivo. Recuperamos el RESULTADO archivado (past_events) para no dar 404. Solo
      // tenemos sets GANADOS (no juegos por set), así que la ficha muestra el marcador
      // por sets + ganador. Antes cualquier resultado de tenis reciente daba 404.
      const past = await getPastEventByRef(ref)
      if (past && past.away) {
        const hw = past.homeScore ?? null
        const aw = past.awayScore ?? null
        const known = hw != null && aw != null
        const detail: MatchDetail = {
          id: eventId,
          sport,
          leagueSlug,
          leagueLabel,
          homeTeam: past.home,
          awayTeam: past.away,
          homeScore: hw,
          awayScore: aw,
          status: 'STATUS_FINAL',
          statusLabel: 'Final',
          startDate: past.isoDate,
          tennis: {
            homePlayer: past.home,
            awayPlayer: past.away,
            homeWon: known ? hw > aw : undefined,
            awayWon: known ? aw > hw : undefined,
            sets: { home: hw != null ? [String(hw)] : [], away: aw != null ? [String(aw)] : [] },
            setWinners: known ? [hw > aw ? 'home' : aw > hw ? 'away' : null] : [],
          },
        }
        return NextResponse.json(detail, matchCache(detail.status))
      }
      return NextResponse.json(null, { status: 404 })
    }

    // ─── Soccer / Basketball: ESPN summary ──────────────────────────
    const [json, tableRows, wcGroups] = await Promise.all([
      espnJson(`https://site.api.espn.com/apis/site/v2/sports/${leagueSlug}/summary?event=${eventId}`),
      sport === 'soccer' ? fetchLeagueTableRows(leagueSlug) : Promise.resolve([]),
      // Mundial: la clasificación relevante del partido es su grupo (A–L).
      leagueSlug === 'soccer/fifa.world' ? fetchTournamentGroups(leagueSlug) : Promise.resolve([]),
    ])
    if (!json) return NextResponse.json(null, { status: 404 })

    const header = asObj(json.header)
    const comp   = asArr(header?.competitions)[0] as Record<string, unknown> | undefined
    if (!comp) return NextResponse.json(null, { status: 404 })

    const competitors = asArr(comp.competitors) as Record<string, unknown>[]
    const homeComp = competitors.find(c => c.homeAway === 'home') ?? competitors[0]
    const awayComp = competitors.find(c => c.homeAway === 'away') ?? competitors[1]
    const homeTeamObj = asObj(homeComp?.team)
    const awayTeamObj = asObj(awayComp?.team)

    const statusObj  = asObj(comp.status)
    const statusType = asObj(statusObj?.type)
    const statusName = asString(statusType?.name) ?? ''
    const period     = asNumber(statusObj?.period)
    const clock      = asString(statusObj?.displayClock)

    const venue     = asString(asObj(comp.venue)?.fullName) ?? asString(asObj(asObj(json.gameInfo)?.venue)?.fullName)
    const broadcast = getSpanishBroadcast(leagueLabel, sport) ?? undefined

    const detail: MatchDetail = {
      id:          eventId,
      sport,
      leagueSlug,
      leagueLabel,
      homeTeam:    nat(asString(homeTeamObj?.displayName)) ?? '—',
      awayTeam:    nat(asString(awayTeamObj?.displayName)) ?? '—',
      homeAbbr:    asString(homeTeamObj?.abbreviation),
      awayAbbr:    asString(awayTeamObj?.abbreviation),
      homeLogo:    pickTeamLogo(homeTeamObj, sport),
      awayLogo:    pickTeamLogo(awayTeamObj, sport),
      homeTeamId:  asString(homeTeamObj?.id),
      awayTeamId:  asString(awayTeamObj?.id),
      homeScore:   homeComp?.score != null ? Number(homeComp.score) : null,
      awayScore:   awayComp?.score != null ? Number(awayComp.score) : null,
      status:      statusName,
      statusLabel: mapStatusLabel(statusName, period, clock, sport),
      venue,
      broadcast,
      startDate:   asString(comp.date) ?? asString(header?.date),
    }

    if (sport === 'soccer') {
      const soccer = buildSoccer(json, asString(homeTeamObj?.id))
      // Side mapping con los nombres ORIGINALES (sin traducir), que son los que
      // trae commentary.play.team.displayName.
      soccer.commentary = buildSoccerCommentary(
        json,
        asString(homeTeamObj?.displayName),
        asString(awayTeamObj?.displayName),
      )
      detail.soccer  = soccer
      detail.lineups = buildLineups(json)
      if (tableRows.length) {
        const homeTeamName = asString(homeTeamObj?.displayName)
        const awayTeamName = asString(awayTeamObj?.displayName)
        detail.leagueTable = tableRows.map(row => ({
          ...row,
          highlight: row.name === homeTeamName ? 'home'
                   : row.name === awayTeamName ? 'away'
                   : undefined,
        }))
      } else if (wcGroups.length) {
        // Grupo del Mundial que contiene a los equipos del partido. Match por
        // teamId (los nombres del grupo van traducidos al español y los del
        // summary vienen en inglés — el id es estable en ambos).
        const hId = asString(homeTeamObj?.id)
        const aId = asString(awayTeamObj?.id)
        const group = wcGroups.find(g => g.rows.some(r => r.teamId === hId || r.teamId === aId))
        if (group) {
          detail.leagueTable = group.rows.map(row => ({
            ...row,
            highlight: row.teamId === hId ? 'home' as const
                     : row.teamId === aId ? 'away' as const
                     : undefined,
          }))
          detail.leagueTableLabel = `Mundial · ${group.name}`
        }
      }
    } else if (sport === 'basketball') {
      detail.basketball = buildBasketball(json, homeComp, awayComp)
    }

    // Cara a cara + forma reciente del PROPIO summary de ESPN (soccer/basket).
    // Una fuente → dos renders (app y web); coste 0. Solo deportes de equipo con
    // ambos equipos identificados.
    if (homeTeamObj && awayTeamObj) {
      const hId = asString(homeTeamObj.id)
      const aId = asString(awayTeamObj.id)
      detail.headToHead = sport === 'basketball'
        ? buildBasketballH2H(json, hId)
        : buildHeadToHead(json, hId, nat)
      detail.recentForm = buildRecentForm(json, hId, aId)
    }

    return NextResponse.json(detail, matchCache(detail.status))
  } catch (err) {
    console.error(`[match] fetch failed for ${ref}:`, err)
    return NextResponse.json(null, { status: 500 })
  }
}
