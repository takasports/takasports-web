import { NextResponse } from 'next/server'
import type { StandingZone } from '@/lib/league-zones'
import { getSpanishBroadcast } from '@/lib/broadcasts'
import { LEAGUE_LABEL_BY_SLUG } from '@/lib/football-leagues'
import { NATIONAL_TEAM_COMPS, toSpanishNation } from '@/lib/nation-names'
import { fetchLeagueTableRows, type LeagueTableRow } from '@/lib/espn-standings'
// Re-exportados para los componentes cliente que ya importan estos tipos desde
// este route (LeagueTable.tsx). La fuente real vive ahora en lib/espn-standings.
export type { StandingZone }
export type { LeagueTableRow }

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
  type: string   // 'goal' | 'yellow' | 'red' | 'penalty' | 'own-goal'
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

export interface MmaFighter {
  name: string
  headshot?: string
  flag?: string
  winner?: boolean
  record?: string
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
  }
  mma?: {
    weightClass?: string
    rounds?: number
    endRound?: number
    endTime?: string
    fighters: MmaFighter[]
    cardName?: string
    note?: string
  }
  racing?: {
    circuit?: string
    results: RacingResult[]
  }
  tennis?: {
    round?: string
    homePlayer?: string
    awayPlayer?: string
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
const SOCCER_STATS = new Set([
  'possessionPct', 'totalShots', 'shotsOnTarget', 'saves',
  'fouls', 'corners', 'wonCorners', 'yellowCards', 'redCards', 'offsides',
])

const SOCCER_LABELS: Record<string, string> = {
  possessionPct:  'Posesión %',
  totalShots:     'Tiros totales',
  shotsOnTarget:  'Tiros a puerta',
  saves:          'Paradas',
  fouls:          'Faltas',
  corners:        'Córners',
  wonCorners:     'Córners',
  yellowCards:    'Tarjetas amarillas',
  redCards:       'Tarjetas rojas',
  offsides:       'Fuera de juego',
}

function buildSoccer(json: Record<string, unknown>, homeId?: string): NonNullable<MatchDetail['soccer']> {
  const stats: MatchStat[] = []
  const boxTeams = asArr(asObj(json.boxscore)?.teams) as Record<string, unknown>[]
  if (boxTeams.length >= 2) {
    const homeStats = asArr((boxTeams.find(t => t.homeAway === 'home') ?? boxTeams[0])?.statistics) as Record<string, unknown>[]
    const awayStats = asArr((boxTeams.find(t => t.homeAway === 'away') ?? boxTeams[1])?.statistics) as Record<string, unknown>[]
    for (const stat of homeStats) {
      const name = asString(stat.name) ?? ''
      if (!SOCCER_STATS.has(name)) continue
      const awayStat = awayStats.find(s => s.name === name)
      stats.push({
        label: SOCCER_LABELS[name] ?? asString(stat.label) ?? name,
        home:  asString(stat.displayValue) ?? String(stat.value ?? ''),
        away:  asString(awayStat?.displayValue) ?? String(awayStat?.value ?? '—'),
      })
    }
  }

  // keyEvents has reliable event data (plays array is often empty for soccer)
  const scoring: ScoringEvent[] = []
  const SCORING_TYPES = new Set(['goal', 'owngoal', 'penalty-goal', 'yellow-card', 'red-card', 'yellow-red-card'])
  for (const ev of asArr(json.keyEvents) as Record<string, unknown>[]) {
    const typeObj = asObj(ev.type)
    const typeKey = asString(typeObj?.type) ?? ''
    if (!SCORING_TYPES.has(typeKey)) continue
    const team = asObj(ev.team)
    // Prefer participants[0].athlete.displayName over shortText (shortText gets truncated at ~30 chars)
    const firstParticipant = asObj(asArr(ev.participants)[0])
    const playerFromParticipant = asString(asObj(firstParticipant?.athlete)?.displayName)
    const shortText = asString(ev.shortText) ?? ''
    const playerFromShort = shortText.replace(/ (Goal|Yellow Card|Red Card|Own Goal|Penalty)$/i, '').trim()
    const player = playerFromParticipant || playerFromShort || undefined
    const playerId = asString(asObj(firstParticipant?.athlete)?.id)
    const clock = asString(asObj(ev.clock)?.displayValue)
    scoring.push({
      team:   asString(team?.id) === homeId ? 'home' : 'away',
      player,
      playerId,
      clock,
      type:   typeKey === 'yellow-card' ? 'yellow'
            : (typeKey === 'red-card' || typeKey === 'yellow-red-card') ? 'red'
            : typeKey === 'owngoal' ? 'own-goal'
            : typeKey === 'penalty-goal' ? 'penalty'
            : 'goal',
    })
  }

  return { stats, scoring }
}

// Minuto a minuto. ESPN da `commentary` en orden ascendente con texto inglés;
// reconstruimos una etiqueta en español desde el tipo estructurado de jugada y
// devolvemos lo más reciente primero (estilo directo). Tipos no mapeados (saque
// de banda, saque de puerta, ruido «noplay») se descartan para no colar inglés.
const COMMENTARY_LABELS: Record<string, string> = {
  'goal':            'Gol',
  'penalty-goal':    'Gol de penalti',
  'own-goal':        'Gol en propia',
  'owngoal':         'Gol en propia',
  'yellow-card':     'Tarjeta amarilla',
  'red-card':        'Tarjeta roja',
  'yellow-red-card': 'Doble amarilla',
  'substitution':    'Cambio',
  'penalty':         'Penalti',
  'penalty-won':     'Penalti',
  'penalty-missed':  'Penalti fallado',
  'penalty-saved':   'Penalti parado',
  'shot-on-target':  'Tiro a puerta',
  'shot-off-target': 'Tiro desviado',
  'shot-blocked':    'Tiro bloqueado',
  'corner-awarded':  'Córner',
  'offside':         'Fuera de juego',
  'foul':            'Falta',
  'handball':        'Mano',
  'halftime':        'Descanso',
  'start-2nd-half':  'Comienza la 2ª parte',
  'fulltime':        'Final del partido',
}
const COMMENTARY_KEY = new Set([
  'goal', 'penalty-goal', 'own-goal', 'owngoal',
  'yellow-card', 'red-card', 'yellow-red-card',
  'substitution', 'penalty', 'penalty-won', 'penalty-missed', 'penalty-saved',
])

function buildSoccerCommentary(json: Record<string, unknown>, homeName?: string, awayName?: string): CommentaryEntry[] {
  const out: CommentaryEntry[] = []
  for (const c of asArr(json.commentary) as Record<string, unknown>[]) {
    const play = asObj(c.play)
    const typeKey = asString(asObj(play?.type)?.type) ?? ''
    let label = COMMENTARY_LABELS[typeKey]
    if (!label && typeKey.startsWith('var')) label = 'Revisión VAR'
    if (!label) continue   // descarta noplay/desconocidos (evita texto inglés)

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
    const isGoal = typeKey.includes('goal')
    const assist = isGoal ? asString(asObj(parts[1]?.athlete)?.displayName) : undefined
    const normType = typeKey === 'owngoal' ? 'own-goal'
                   : typeKey.startsWith('var') ? 'var' : typeKey

    // ESPN registra cada falta dos veces (la falta + «X gana un libre»), mismo
    // tipo, jugador Y equipo → colapsa consecutivas idénticas para no repetir
    // filas (incluye el equipo para no fusionar eventos de equipos distintos).
    const prev = out[out.length - 1]
    if (prev && prev.minute === minute && prev.type === normType
        && prev.player === player && prev.team === team) continue

    out.push({
      minute,
      type: normType,
      label,
      team,
      player,
      assist,
      key: COMMENTARY_KEY.has(typeKey),
    })
  }
  // Más reciente primero; tope defensivo de 130 entradas.
  return out.reverse().slice(0, 130)
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

  return {
    stats,
    quarters: { home: homeQ, away: awayQ },
    leaders,
  }
}

// ── MMA ─────────────────────────────────────────────────────────────
async function buildMma(eventId: string): Promise<{ mma: MatchDetail['mma']; status: string; statusLabel: string; cardName?: string } | null> {
  const json = await espnJson(`https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?event=${eventId}`)
  if (!json) return null
  const card = asArr(json.events)[0] as Record<string, unknown> | undefined
  if (!card) return null
  const cardName = asString(card.name) ?? asString(card.shortName)
  const competitions = asArr(card.competitions) as Record<string, unknown>[]
  const fight = competitions.find(c => asString(c.id) === eventId) ?? competitions[0]
  if (!fight) return null

  const statusObj = asObj(fight.status)
  const statusType = asObj(statusObj?.type)
  const status = asString(statusType?.name) ?? ''
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

  return {
    mma: { weightClass, rounds, endRound, endTime, fighters, cardName, note },
    status,
    statusLabel,
    cardName,
  }
}

// ── Racing (F1) ─────────────────────────────────────────────────────
async function buildRacing(eventId: string): Promise<{ racing: MatchDetail['racing']; status: string; statusLabel: string; venue?: string; raceName?: string } | null> {
  const json = await espnJson(`https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard?event=${eventId}`)
  if (!json) return null
  const ev = (asArr(json.events) as Record<string, unknown>[]).find(e => asString(e.id) === eventId)
              ?? asArr(json.events)[0] as Record<string, unknown> | undefined
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

  const homePlayer = asString(asObj(asArr(home?.athletes)[0])?.displayName)
                  ?? asString(asObj(home?.athlete)?.displayName)
                  ?? asString(asObj(home?.team)?.displayName)
  const awayPlayer = asString(asObj(asArr(away?.athletes)[0])?.displayName)
                  ?? asString(asObj(away?.athlete)?.displayName)
                  ?? asString(asObj(away?.team)?.displayName)
  const round = asString(asObj(comp.round)?.displayName)
             ?? asString(asObj(comp.type)?.text)
             ?? asString(asArr(comp.notes)[0] ? asObj(asArr(comp.notes)[0])?.headline : undefined)
  return {
    round,
    homePlayer,
    awayPlayer,
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
  const ev = (asArr(json.events) as Record<string, unknown>[]).find(e => asString(e.id) === eventId)
              ?? asArr(json.events)[0] as Record<string, unknown> | undefined
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
      return NextResponse.json(detail)
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
      return NextResponse.json(detail)
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
      return NextResponse.json(detail)
    }

    // ─── Tennis: scoreboard lookup (summary returns 400 for match IDs) ─
    if (sport === 'tennis') {
      const data = await buildTennis(eventId, leagueSlug)
      if (!data) return NextResponse.json(null, { status: 404 })
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
      return NextResponse.json(detail)
    }

    // ─── Soccer / Basketball: ESPN summary ──────────────────────────
    const [json, tableRows] = await Promise.all([
      espnJson(`https://site.api.espn.com/apis/site/v2/sports/${leagueSlug}/summary?event=${eventId}`),
      sport === 'soccer' ? fetchLeagueTableRows(leagueSlug) : Promise.resolve([]),
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
      }
    } else if (sport === 'basketball') {
      detail.basketball = buildBasketball(json, homeComp, awayComp)
    }

    return NextResponse.json(detail)
  } catch (err) {
    console.error(`[match] fetch failed for ${ref}:`, err)
    return NextResponse.json(null, { status: 500 })
  }
}
