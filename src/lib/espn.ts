import type { SportEvent, TeamStanding } from './types'
import { getSportStyle } from './sports'
import { SOURCE_TZ } from './timezone'
import { getSpanishBroadcast } from './broadcasts'
import { FOOTBALL_LEAGUES, TABLE_LEAGUE_SLUGS } from './football-leagues'
import { fetchLeagueTable } from './espn-standings'
import { standingsUsable } from './standings-window'
import { NATIONAL_TEAM_COMPS, toSpanishNation } from './nation-names'
import { athletePhoto } from './athlete-photos'
import { setsStrFromLinescores } from './tennis-sets'
import { pickRacingSession } from './racing-sessions'

interface EspnSource {
  slug: string
  sport: string
  comp: string
  teamSport: boolean
  /** Ventana de futuros en días (por defecto 21). */
  daysAhead?: number
  /** Tope de eventos del scoreboard (por defecto 75). */
  fetchLimit?: number
}

const SOURCES: EspnSource[] = [
  // Fútbol — lista maestra compartida (lib/football-leagues)
  ...FOOTBALL_LEAGUES.map((l): EspnSource => ({
    slug: l.slug, sport: 'Fútbol', comp: l.comp, teamSport: true,
    daysAhead: l.daysAhead, fetchLimit: l.fetchLimit,
  })),
  { slug: 'basketball/nba',           sport: 'NBA',     comp: 'NBA',        teamSport: true  },
  { slug: 'racing/f1',                sport: 'F1',      comp: 'Fórmula 1',  teamSport: false },
  { slug: 'mma/ufc',                  sport: 'UFC',     comp: 'UFC',        teamSport: false },
]

const TENNIS_SLUGS = ['tennis/atp', 'tennis/wta']

// Only show top-tier tournaments, skip doubles (names with '/')
const TENNIS_TOP_TOURNAMENTS = [
  'australian open', 'roland garros', 'wimbledon', 'us open',
  'indian wells', 'miami open', 'monte carlo', 'madrid open', 'rome',
  'canada', 'cincinnati', 'shanghai', 'paris masters', 'vienna',
  'barcelona', 'hamburg', 'halle', "queen's", 'eastbourne',
  'dubai', 'doha', 'rotterdam', 'munich', 'lyon', 'geneva',
  'madrid', 'rome masters', 'internazionali',
  // WTA
  'wta finals', 'pan pacific', 'toronto', 'guadalajara',
]

function isTennisTopTournament(tournamentName: string): boolean {
  const n = tournamentName.toLowerCase()
  return TENNIS_TOP_TOURNAMENTS.some(t => n.includes(t))
}

function isTennisDoubles(player1: string, player2: string): boolean {
  return player1.includes('/') || player2.includes('/')
}

// Cara (headshot) del atleta desde el competidor de ESPN. `athlete.headshot` llega como
// string o como { href }. Devuelve la URL o undefined (→ la fila mostrará solo el nombre).
function espnHeadshot(competitor: Record<string, unknown> | undefined): string | undefined {
  const hs = (competitor?.athlete as Record<string, unknown> | undefined)?.headshot
  if (!hs) return undefined
  if (typeof hs === 'string') return hs
  const href = (hs as { href?: string }).href
  return typeof href === 'string' ? href : undefined
}

// Final "no normal" de un partido de tenis. Un abandono deja los sets sin
// cerrar, así que la fila mostraba "Final 0 - 0": cierto y a la vez ilegible.
function tennisFinishNote(statusName: string | undefined): string | undefined {
  if (statusName === 'STATUS_RETIRED') return 'Abandono'
  if (statusName === 'STATUS_WALKOVER') return 'W.O.'
  return undefined
}

const DAYS_ES   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function toDateLabel(isoDate: string): string {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).format(new Date())
  const eventStr = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).format(new Date(isoDate))
  const diffDays = Math.round(
    (new Date(eventStr).getTime() - new Date(todayStr).getTime()) / 86_400_000
  )
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Mañana'
  if (diffDays < 0) return 'Pasado'
  const d = new Date(eventStr + 'T12:00:00Z')
  return `${DAYS_ES[d.getUTCDay()]} · ${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]}`
}

function toTimeStr(isoDate: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: SOURCE_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(isoDate))
  const h = parts.find(p => p.type === 'hour')?.value   ?? '00'
  const m = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${h}:${m}`
}

function dateRangeParam(daysAhead: number): string {
  const now = new Date()
  const end = new Date(now)
  end.setDate(now.getDate() + daysAhead)
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
  return `${fmt(now)}-${fmt(end)}`
}

function dateRangePastParam(daysBack: number): string {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - daysBack)
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
  return `${fmt(start)}-${fmt(now)}`
}

function parseScore(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v === 'object') {
    const val = (v as Record<string, unknown>).value
    if (typeof val === 'number') return val
  }
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? null : n }
  return null
}

// Estados de ESPN para "partido terminado". Incluye las variantes de prórroga y
// penaltis (STATUS_FINAL_AET / STATUS_FINAL_PEN y sus alias): las eliminatorias
// —finales incluidas— se deciden así, y sin ellas se caían de Resultados (la
// final del Mundial ARG-ESP acabó en STATUS_FINAL_AET). Alineado con el resto
// del repo (ficha de partido, /api/match, cron sync-mundial).
export const FINAL_STATUSES = new Set([
  'STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_FT', 'STATUS_ENDED',
  'STATUS_FINAL_PEN', 'STATUS_FINAL_AET',
  'STATUS_FULL_TIME_ET', 'STATUS_FULL_TIME_AET', 'STATUS_PENALTY',
])

interface RawEvent {
  isoDate: string
  event: SportEvent
  /** Slug ESPN de la liga de origen ('soccer/esp.1'). Lo usa attachStandings
   *  para pedir UNA tabla por liga presente en el feed. */
  leagueSlug?: string
}

// Aborta el fetch a ESPN si tarda más de `ms`. Sin esto, una sola liga colgada
// bloquea todo el Promise.allSettled (hasta el timeout de socket de Node, ~2min)
// y congela el render del calendario. Al abortar, fetch lanza → el caller lo
// captura y sigue con el resto. Conserva el revalidate 300 de la caché de Next.
async function espnFetch(url: string, ms = 8000): Promise<Response> {
  return fetch(url, { next: { revalidate: 300 }, signal: AbortSignal.timeout(ms) })
}

// ── Mundial: fase y grupo de cada partido ───────────────────────────────────
// ESPN da la fase del torneo en season.slug del evento; el grupo concreto
// (A–L) se deriva del standings (teamId → grupo). Etiqueta cada tarjeta del
// calendario con "Grupo A" / "Octavos" / "Final"…
const WC_SLUG = 'soccer/fifa.world'
const WC_STAGE_ES: Record<string, string> = {
  'group-stage':      'Fase de grupos',
  'round-of-32':      'Dieciseisavos',
  'round-of-16':      'Octavos',
  'quarterfinals':    'Cuartos',
  'semifinals':       'Semifinales',
  '3rd-place-match':  'Tercer puesto',
  'final':            'Final',
}

async function fetchWorldCupGroupLetters(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/v2/sports/${WC_SLUG}/standings`,
      { next: { revalidate: 1800 }, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return map
    const json = await res.json()
    for (const child of ((json as Record<string, unknown>).children as Record<string, unknown>[]) ?? []) {
      const letter = ((child.name as string) ?? '').replace(/^Group\s+/i, '')
      const entries = ((child.standings as Record<string, unknown>)?.entries as Record<string, unknown>[]) ?? []
      for (const e of entries) {
        const id = (e.team as Record<string, unknown>)?.id as string | undefined
        if (id && letter) map.set(id, letter)
      }
    }
  } catch { /* sin standings: stage degrada a la fase genérica */ }
  return map
}

function wcStageLabel(
  ev: Record<string, unknown>,
  homeTeamId: string | undefined,
  groups: Map<string, string>,
): string | undefined {
  const phase = ((ev.season as Record<string, unknown>)?.slug as string) ?? ''
  if (phase === 'group-stage') {
    const letter = homeTeamId ? groups.get(homeTeamId) : undefined
    return letter ? `Grupo ${letter}` : WC_STAGE_ES[phase]
  }
  return WC_STAGE_ES[phase]
}

async function fetchLeague(source: EspnSource): Promise<RawEvent[]> {
  const { accent } = getSportStyle(source.sport)
  const url = `https://site.api.espn.com/apis/site/v2/sports/${source.slug}/scoreboard?dates=${dateRangeParam(source.daysAhead ?? 21)}&limit=${source.fetchLimit ?? 75}`

  let json: Record<string, unknown>
  try {
    const res = await espnFetch(url)
    if (!res.ok) return []
    json = await res.json()
  } catch {
    return []
  }

  const results: RawEvent[] = []
  const espnEvents = (json.events as unknown[]) ?? []
  const wcGroups = source.slug === WC_SLUG && espnEvents.length
    ? await fetchWorldCupGroupLetters()
    : null

  for (const raw of espnEvents) {
    const ev = raw as Record<string, unknown>

    // Motor: un Gran Premio es UN evento con VARIAS sesiones y `competitions[0]`
    // son los libres del viernes. La sesión que representa al GP es la carrera:
    // de ella salen la hora, el estado y (en el histórico) el ganador.
    const racing = source.slug.startsWith('racing/')
    const session = racing ? pickRacingSession(ev.competitions) : null
    const comp = (session?.comp ?? ((ev.competitions as unknown[]) ?? [])[0]) as Record<string, unknown> | undefined
    if (!comp) continue

    const isoDate = (racing ? (comp.date as string | undefined) : undefined) ?? (ev.date as string | undefined)
    if (!isoDate) continue

    const dateLabel = toDateLabel(isoDate)
    if (dateLabel === 'Pasado') continue

    const statusName = ((comp.status as Record<string, unknown>)?.type as Record<string, unknown>)?.name as string | undefined
    if (statusName === 'STATUS_POSTPONED') continue
    if (statusName && FINAL_STATUSES.has(statusName) && dateLabel !== 'Hoy') continue

    const competitors = (comp.competitors as Record<string, unknown>[]) ?? []

    let home: string
    let away: string | null = null

    let homeLogo: string | undefined
    let awayLogo: string | undefined
    let homeAbbr: string | undefined
    let awayAbbr: string | undefined
    // Ids de ESPN de los dos equipos → enlace de cada nombre a su ficha.
    let homeId: string | undefined
    let awayId: string | undefined

    if (source.teamSport && competitors.length >= 2) {
      const homeComp = competitors.find(c => c.homeAway === 'home') ?? competitors[0]
      const awayComp = competitors.find(c => c.homeAway === 'away') ?? competitors[1]
      const homeTeamObj = homeComp.team as Record<string, unknown>
      const awayTeamObj = awayComp.team as Record<string, unknown>
      home      = (homeTeamObj?.displayName as string) ?? ''
      away      = (awayTeamObj?.displayName as string) ?? null
      // Selecciones → español (Brazil→Brasil…); clubes se dejan tal cual.
      if (NATIONAL_TEAM_COMPS.has(source.comp)) {
        home = toSpanishNation(home)
        away = toSpanishNation(away)
      }
      homeAbbr  = homeTeamObj?.abbreviation as string | undefined
      awayAbbr  = awayTeamObj?.abbreviation as string | undefined
      homeLogo  = (homeTeamObj?.logoDark ?? homeTeamObj?.logo) as string | undefined
      awayLogo  = (awayTeamObj?.logoDark ?? awayTeamObj?.logo) as string | undefined
      homeId    = homeTeamObj?.id as string | undefined
      awayId    = awayTeamObj?.id as string | undefined
    } else {
      home = (ev.name as string) ?? (ev.shortName as string) ?? source.sport
    }

    if (!home) continue

    const venue  = ((comp.venue as Record<string, unknown>)?.fullName as string) ?? undefined
    const broadcast = getSpanishBroadcast(source.comp, source.sport)
    const matchRef  = `${source.slug.replace('/', '_')}_${ev.id as string}`
    const homeTeamId = source.teamSport && competitors.length >= 2
      ? ((competitors.find(c => c.homeAway === 'home') ?? competitors[0])?.team as Record<string, unknown>)?.id as string | undefined
      : undefined
    const stage = wcGroups ? wcStageLabel(ev, homeTeamId, wcGroups) : session?.label

    // UFC: la velada llega como "UFC 329: A vs B" → parseamos los dos peleadores para
    // poner su CARA (foto del top-list curado) en la fila; el resto sale con el nombre.
    let homePhoto: string | undefined
    let awayPhoto: string | undefined
    if (source.sport === 'UFC') {
      const fm = /^(.*?):\s*(.+?)\s+vs\.?\s+(.+)$/i.exec(home)
      if (fm) {
        homePhoto = athletePhoto(fm[2].trim())
        awayPhoto = athletePhoto(fm[3].trim())
      }
    }

    results.push({
      isoDate,
      leagueSlug: source.slug,
      event: {
        id:        `espn-${source.slug.replace(/\//g, '-')}-${ev.id as string}`,
        home,
        away,
        sport:     source.sport,
        comp:      source.comp,
        date:      dateLabel,
        time:      toTimeStr(isoDate),
        accent,
        isoDate,
        venue,
        stage,
        broadcast,
        homeLogo,
        awayLogo,
        homeAbbr,
        awayAbbr,
        homeTeamId: homeId,
        awayTeamId: awayId,
        homePhoto,
        awayPhoto,
        matchRef,
        source:    'espn' as const,
      },
    })
  }

  return results
}

// Tennis uses /scoreboard endpoint — gives individual match IDs for detail pages
async function fetchTennisLeague(slug: string): Promise<RawEvent[]> {
  const { accent } = getSportStyle('Tenis')
  const isWta = slug.includes('wta')
  const comp = isWta ? 'WTA' : 'ATP'
  const shortSlug = slug.split('/')[1] // 'atp' or 'wta'
  // En Grand Slams / Masters combinados, el endpoint de CADA tour devuelve el torneo
  // ENTERO (mens + womens), así que sin filtrar por cuadro el feed emitía cada individual
  // DOS veces (una por tour, con ids distintos espn-tennis-atp-* / -wta-*). Nos quedamos
  // solo con el cuadro individual de ESTE tour (igual que fetchTennisPast) → sin duplicar.
  const wantGrouping = isWta ? 'womens-singles' : 'mens-singles'
  const url = `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard`

  let json: Record<string, unknown>
  try {
    const res = await espnFetch(url)
    if (!res.ok) return []
    json = await res.json()
  } catch {
    return []
  }

  const results: RawEvent[] = []
  const espnEvents = (json.events as unknown[]) ?? []

  for (const rawEv of espnEvents) {
    const ev = rawEv as Record<string, unknown>
    const tournamentName = (ev.name as string) ?? (ev.shortName as string) ?? comp
    if (!isTennisTopTournament(tournamentName)) continue

    const groupings = (ev.groupings as unknown[]) ?? []
    for (const rawG of groupings) {
      const g = rawG as Record<string, unknown>
      const gSlug = (g.grouping as Record<string, unknown> | undefined)?.slug as string | undefined
      if (gSlug !== wantGrouping) continue // solo el cuadro individual de ESTE tour (no duplica combinados)
      const competitions = (g.competitions as unknown[]) ?? []

      for (const rawM of competitions) {
        const m = rawM as Record<string, unknown>
        const isoDate = m.date as string | undefined
        if (!isoDate) continue

        const dateLabel = toDateLabel(isoDate)
        if (dateLabel === 'Pasado') continue

        const statusType = (m.status as Record<string, unknown>)?.type as Record<string, unknown> | undefined
        const statusName = statusType?.name as string | undefined
        if (statusName === 'STATUS_POSTPONED') continue
        if (statusName && FINAL_STATUSES.has(statusName) && dateLabel !== 'Hoy') continue
        // Bandera de ESPN "el partido ya no sigue": cubre FINAL y también
        // STATUS_RETIRED (abandono), que NO está en FINAL_STATUSES y por eso
        // sigue viviendo en el feed como si estuviera por jugarse.
        const isOver = statusType?.completed === true

        const competitors = (m.competitors as Record<string, unknown>[]) ?? []
        if (competitors.length < 2) continue

        const home = ((competitors[0]?.athlete as Record<string, unknown>)?.displayName as string | undefined)
                  ?? (competitors[0]?.displayName as string | undefined)
        const away = ((competitors[1]?.athlete as Record<string, unknown>)?.displayName as string | undefined)
                  ?? (competitors[1]?.displayName as string | undefined)
        if (!home || !away || home === 'TBD' || away === 'TBD') continue
        if (isTennisDoubles(home, away)) continue

        const matchId  = m.id as string
        const matchRef = `tennis_${shortSlug}_${matchId}`

        results.push({
          isoDate,
          event: {
            id:        `espn-${slug.replace(/\//g, '-')}-${matchId}`,
            home,
            away,
            sport:     'Tenis',
            comp:      tournamentName,
            date:      dateLabel,
            time:      toTimeStr(isoDate),
            accent,
            isoDate,
            broadcast: getSpanishBroadcast(tournamentName, 'Tenis'),
            matchRef,
            // Cara del jugador (headshot de ESPN) para la fila del calendario. Coste 0
            // (ESPN lo da en el propio scoreboard). Si falta, la fila muestra solo el nombre.
            homePhoto: espnHeadshot(competitors[0]) ?? athletePhoto(home),
            awayPhoto: espnHeadshot(competitors[1]) ?? athletePhoto(away),
            // Id del atleta: lo usa attachAthletePhotos para leer la foto ya
            // resuelta por el cron (Wikimedia), que es la buena.
            homeAthleteId: competitors[0]?.id as string | undefined,
            awayAthleteId: competitors[1]?.id as string | undefined,
            // Los partidos de HOY ya terminados siguen en el feed (arriba solo se
            // descartan los finales de OTROS días): al salir del directo, este es
            // el único sitio del que la fila puede sacar el set a set.
            //
            // SOLO si el partido ya acabó: en uno EN JUEGO, los linescores traen
            // el set en curso y aquí no hay forma de marcarlo como activo, así que
            // "1-4" se leería como un set cerrado. Mientras se juega manda el
            // directo, que sí distingue el set abierto.
            setsStr:   isOver
              ? (setsStrFromLinescores(competitors[0]?.linescores, competitors[1]?.linescores) || undefined)
              : undefined,
            // Un partido de HOY ya acabado tiene que PARECERLO: sin esto el feed
            // lo servía como si estuviera por jugarse (sin marcador y sin marca de
            // final), así que la fila enseñaba la hora del saque de un partido
            // terminado — y nunca llegaba a pintar el set a set.
            ...(isOver
              ? {
                  isPast: true,
                  homeScore: countTennisSets(competitors[0]),
                  awayScore: countTennisSets(competitors[1]),
                  finishNote: tennisFinishNote(statusName),
                }
              : {}),
            source:    'espn' as const,
          },
        })
      }
    }
  }

  return results
}

// ── Clasificación en la fila (Fase 2 del rediseño del calendario) ───────────
// Adjunta a cada evento el puesto y los puntos de sus dos equipos. Se hace en
// UNA pasada al final y solo para las ligas que REALMENTE tienen partidos en el
// feed (no las 20 de TABLE_LEAGUE_SLUGS a ciegas): una tabla por liga presente,
// en paralelo, y el fetch de ESPN ya se cachea 30 min. Coste $0 (API pública).
//
// Va aquí y no en la página para que lo hereden los DOS clientes: el calendario
// web (que llama a fetchEspnEvents en su SSR) y la app (que consume el mismo
// feed por /api/events/feed).
function standingKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(fc|cf|sl|sad|sc|afc|fk|ac|as|ss|rc|rcd|ud|sd|cd)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

// Ligas de las que el CALENDARIO saca clasificación. Es TABLE_LEAGUE_SLUGS (las
// de fútbol, que ya alimentan /partido y /liga) más la NBA, que aquí sí encaja
// porque la fila compara solo dentro de la misma conferencia. No se añade a
// TABLE_LEAGUE_SLUGS para no cambiar de rebote esas otras páginas.
const CALENDAR_STANDINGS_SLUGS: ReadonlySet<string> = new Set([
  ...TABLE_LEAGUE_SLUGS,
  'basketball/nba',
])

/** Nombres largos de conferencia → etiqueta corta para la fila. */
function shortGroupName(group: string | undefined): string | undefined {
  if (!group) return undefined
  const g = group.toLowerCase()
  if (g.includes('eastern')) return 'Este'
  if (g.includes('western')) return 'Oeste'
  return group.replace(/\s*(Conference|Conferencia|Zona|Group|Grupo)\s*/gi, '').trim() || group
}

/** ¿En esta liga quedar último significa descender? En la NBA, no. */
function hasRelegation(leagueSlug: string): boolean {
  return leagueSlug.startsWith('soccer/')
}

async function attachStandings(raw: RawEvent[]): Promise<void> {
  const slugs = new Set<string>()
  for (const r of raw) {
    if (r.leagueSlug && CALENDAR_STANDINGS_SLUGS.has(r.leagueSlug)) slugs.add(r.leagueSlug)
  }
  if (slugs.size === 0) return

  const now = new Date()
  const tables = await Promise.allSettled(
    [...slugs].map(async slug => ({ slug, table: await fetchLeagueTable(slug) })),
  )

  // slug → (nombre normalizado → puesto/puntos/zona). Se indexa por nombre
  // porque el evento trae `home`/`away` como texto, no el id de ESPN.
  const bySlug = new Map<string, Map<string, TeamStanding>>()
  for (const t of tables) {
    if (t.status !== 'fulfilled') continue
    const { rows, season } = t.value.table
    // ÚNICO interruptor: temporada en marcha + jornadas suficientes. Se enciende
    // y se apaga solo con lo que publica ESPN — sin cron ni fechas a mano.
    if (!standingsUsable(rows, season, now)) continue

    const relegation = hasRelegation(t.value.slug)
    const sizeByGroup = new Map<string, number>()
    for (const row of rows) sizeByGroup.set(row.group ?? '', (sizeByGroup.get(row.group ?? '') ?? 0) + 1)

    const byName = new Map<string, TeamStanding>()
    for (const row of rows) {
      const st: TeamStanding = {
        rank: row.rank,
        pts: row.pts,
        zone: row.zone,
        of: sizeByGroup.get(row.group ?? '') ?? rows.length,
        record: row.record,
        group: shortGroupName(row.group),
        relegation,
      }
      byName.set(standingKey(row.name), st)
      if (row.abbr) byName.set(standingKey(row.abbr), st)
    }
    bySlug.set(t.value.slug, byName)
  }

  for (const r of raw) {
    const byName = r.leagueSlug ? bySlug.get(r.leagueSlug) : undefined
    if (!byName || !r.event.away) continue
    const h = byName.get(standingKey(r.event.home))
    const a = byName.get(standingKey(r.event.away))
    // Los dos o ninguno, y del MISMO grupo. Comparar el 1º del Este con el 1º
    // del Oeste daría un "Líder vs 1º" sin sentido, y enseñar el puesto de uno
    // solo parecería un fallo. Con ambos en la misma tabla, todo cuadra.
    if (h && a && h.group === a.group) {
      r.event.homeStanding = h
      r.event.awayStanding = a
    }
  }
}

export async function fetchEspnEvents(): Promise<SportEvent[]> {
  const [leagueResults, tennisResults] = await Promise.all([
    Promise.allSettled(SOURCES.map(fetchLeague)),
    Promise.allSettled(TENNIS_SLUGS.map(fetchTennisLeague)),
  ])

  const raw: RawEvent[] = []

  for (const r of leagueResults) {
    if (r.status === 'fulfilled') raw.push(...r.value)
  }
  for (const r of tennisResults) {
    if (r.status === 'fulfilled') raw.push(...r.value)
  }

  raw.sort((a, b) => a.isoDate.localeCompare(b.isoDate))

  // Puesto y puntos de cada equipo (una tabla por liga presente en el feed).
  // Best-effort: si ESPN falla, los eventos salen sin standing y la fila los omite.
  await attachStandings(raw)

  // ── Dedup ─────────────────────────────────────────────────────────────────
  // For non-team sports (F1, UFC) ESPN returns multiple sessions per event
  // (FP1, Qualifying, Race…) with the same name. Keep only the first/earliest.
  const seenIds       = new Set<string>()
  const seenNonTeam   = new Set<string>()   // sport|home → earliest session

  return raw
    .map(r => r.event)
    .filter(ev => {
      if (seenIds.has(ev.id)) return false
      seenIds.add(ev.id)

      if (ev.away === null) {
        // Non-team: deduplicate by sport+name, keep the earliest (already sorted)
        const key = `${ev.sport}|${ev.home}`
        if (seenNonTeam.has(key)) return false
        seenNonTeam.add(key)
      }
      return true
    })
}

// Ganador de un evento individual pasado (F1: 1º por 'order'; UFC: ganador del
// combate estelar, identificado porque sus peleadores aparecen en el nombre del
// cartel). Devuelve undefined si no se puede determinar.
function pastWinner(ev: Record<string, unknown>, comp: Record<string, unknown> | undefined, sport: string): string | undefined {
  try {
    if (sport === 'F1') {
      const cs = (comp?.competitors as Record<string, unknown>[]) ?? []
      const first = [...cs].sort((a, b) => Number(a.order ?? 99) - Number(b.order ?? 99))[0]
      const name = ((first?.athlete as Record<string, unknown> | undefined)?.displayName as string | undefined)
                ?? (first?.displayName as string | undefined)
      return name || undefined
    }
    if (sport === 'UFC') {
      const card = ((ev.name as string) ?? '').toLowerCase()
      for (const f of (ev.competitions as Record<string, unknown>[]) ?? []) {
        const cs = (f.competitors as Record<string, unknown>[]) ?? []
        if (cs.length < 2) continue
        const names = cs.map(c => ((c.athlete as Record<string, unknown> | undefined)?.displayName as string) ?? '')
        const inCard = names.filter(n => {
          const last = n.split(' ').pop()?.toLowerCase() ?? ''
          return last.length > 2 && card.includes(last)
        })
        if (inCard.length >= 2) {
          const win = cs.find(c => c.winner === true)
          return ((win?.athlete as Record<string, unknown> | undefined)?.displayName as string) || undefined
        }
      }
    }
  } catch { /* ignore */ }
  return undefined
}

// ── Past results (last N days) ────────────────────────────────────────────
async function fetchLeaguePast(source: EspnSource, daysBack = 10): Promise<RawEvent[]> {
  const { accent } = getSportStyle(source.sport)
  const url = `https://site.api.espn.com/apis/site/v2/sports/${source.slug}/scoreboard?dates=${dateRangePastParam(daysBack)}&limit=${source.fetchLimit ?? 50}`

  let json: Record<string, unknown>
  try {
    const res = await espnFetch(url)
    if (!res.ok) return []
    json = await res.json()
  } catch {
    return []
  }

  const results: RawEvent[] = []
  const espnEvents = (json.events as unknown[]) ?? []
  const wcGroups = source.slug === WC_SLUG && espnEvents.length
    ? await fetchWorldCupGroupLetters()
    : null

  for (const raw of espnEvents) {
    const ev = raw as Record<string, unknown>

    // Misma corrección que en los futuros: en motor hay que mirar la CARRERA.
    // Aquí importa el doble, porque de esta sesión sale el GANADOR: con los
    // libres, `pastWinner` habría publicado como vencedor del Gran Premio al
    // más rápido del viernes.
    const racing = source.slug.startsWith('racing/')
    const session = racing ? pickRacingSession(ev.competitions) : null
    const comp = (session?.comp ?? ((ev.competitions as unknown[]) ?? [])[0]) as Record<string, unknown> | undefined
    if (!comp) continue

    const isoDate = (racing ? (comp.date as string | undefined) : undefined) ?? (ev.date as string | undefined)
    if (!isoDate) continue

    const statusName = ((comp.status as Record<string, unknown>)?.type as Record<string, unknown>)?.name as string | undefined
    if (!statusName || !FINAL_STATUSES.has(statusName)) continue

    const competitors = (comp.competitors as Record<string, unknown>[]) ?? []
    let home: string
    let away: string | null = null
    let homeLogo: string | undefined
    let awayLogo: string | undefined
    let homeAbbr: string | undefined
    let awayAbbr: string | undefined
    // Ids de ESPN de los dos equipos → enlace de cada nombre a su ficha.
    let homeId: string | undefined
    let awayId: string | undefined
    let homeScore: number | null = null
    let awayScore: number | null = null
    let resultNote: string | undefined

    if (source.teamSport && competitors.length >= 2) {
      const homeComp = competitors.find(c => c.homeAway === 'home') ?? competitors[0]
      const awayComp = competitors.find(c => c.homeAway === 'away') ?? competitors[1]
      const homeTeamObj = homeComp.team as Record<string, unknown>
      const awayTeamObj = awayComp.team as Record<string, unknown>
      home      = (homeTeamObj?.displayName as string) ?? ''
      away      = (awayTeamObj?.displayName as string) ?? null
      // Selecciones → español (Brazil→Brasil…); clubes se dejan tal cual.
      if (NATIONAL_TEAM_COMPS.has(source.comp)) {
        home = toSpanishNation(home)
        away = toSpanishNation(away)
      }
      homeAbbr  = homeTeamObj?.abbreviation as string | undefined
      awayAbbr  = awayTeamObj?.abbreviation as string | undefined
      homeLogo  = (homeTeamObj?.logoDark ?? homeTeamObj?.logo) as string | undefined
      awayLogo  = (awayTeamObj?.logoDark ?? awayTeamObj?.logo) as string | undefined
      homeId    = homeTeamObj?.id as string | undefined
      awayId    = awayTeamObj?.id as string | undefined
      homeScore = parseScore(homeComp.score)
      awayScore = parseScore(awayComp.score)
    } else {
      home = (ev.name as string) ?? (ev.shortName as string) ?? source.sport
      resultNote = pastWinner(ev, comp, source.sport)
    }

    if (!home) continue

    const venue    = ((comp.venue as Record<string, unknown>)?.fullName as string) ?? undefined
    const matchRef = `${source.slug.replace('/', '_')}_${ev.id as string}`
    const homeTeamId = source.teamSport && competitors.length >= 2
      ? ((competitors.find(c => c.homeAway === 'home') ?? competitors[0])?.team as Record<string, unknown>)?.id as string | undefined
      : undefined
    const stage = wcGroups ? wcStageLabel(ev, homeTeamId, wcGroups) : session?.label

    results.push({
      isoDate,
      event: {
        id:        `espn-past-${source.slug.replace(/\//g, '-')}-${ev.id as string}`,
        home,
        away,
        sport:     source.sport,
        comp:      source.comp,
        date:      toDateLabel(isoDate),
        time:      toTimeStr(isoDate),
        accent,
        isoDate,
        venue,
        stage,
        homeLogo,
        awayLogo,
        homeAbbr,
        awayAbbr,
        homeTeamId: homeId,
        awayTeamId: awayId,
        matchRef,
        homeScore,
        awayScore,
        isPast:    true,
        resultNote,
        source:    'espn' as const,
      },
    })
  }

  return results
}

// ── Mundial: resultados del torneo completo ────────────────────────────────
// Todos los partidos YA jugados del Mundial (con marcador, fase/grupo, sede),
// desde el día inaugural — no solo los últimos 10 días. Alimenta la sección
// "Resultados" de /calendario/mundial. Más recientes primero.
const WC_START_UTC = Date.UTC(2026, 5, 11) // 11 jun 2026

export async function fetchWorldCupResults(): Promise<SportEvent[]> {
  const src = SOURCES.find(s => s.slug === WC_SLUG)
  if (!src) return []
  const daysBack = Math.min(45, Math.max(2, Math.ceil((Date.now() - WC_START_UTC) / 86_400_000) + 1))
  const rows = await fetchLeaguePast(src, daysBack)
  return rows
    .map(r => r.event)
    .sort((a, b) => (b.isoDate ?? '').localeCompare(a.isoDate ?? ''))
}

// ── Tennis past (resultados del torneo top en curso) ───────────────────────
// El endpoint de tenis ignora ?dates= y devuelve el torneo activo con todos sus
// matches; filtramos por estado final y ventana temporal en memoria. Los sets
// ganados se cuentan desde linescores[].winner (games por set con flag).
function countTennisSets(competitor: Record<string, unknown> | undefined): number | null {
  const ls = competitor?.linescores as Array<{ winner?: boolean }> | undefined
  if (!Array.isArray(ls) || ls.length === 0) return null
  return ls.filter(s => s?.winner === true).length
}

async function fetchTennisPast(slug: string, daysBack = 10): Promise<RawEvent[]> {
  const { accent } = getSportStyle('Tenis')
  const isWta = slug.includes('wta')
  const comp = isWta ? 'WTA' : 'ATP'
  const shortSlug = isWta ? 'wta' : 'atp'
  // Cada tour aporta su propio cuadro individual: en Grand Slams combinados los
  // dos endpoints devuelven el torneo entero, así que de /atp tomamos men's y de
  // /wta women's para no duplicar. Fuera de GS cada endpoint ya trae solo su género.
  const wantGrouping = isWta ? 'womens-singles' : 'mens-singles'
  const url = `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard`

  let json: Record<string, unknown>
  try {
    const res = await espnFetch(url)
    if (!res.ok) return []
    json = await res.json()
  } catch {
    return []
  }

  const cutoff = Date.now() - daysBack * 86_400_000
  const results: RawEvent[] = []
  const espnEvents = (json.events as unknown[]) ?? []

  for (const rawEv of espnEvents) {
    const ev = rawEv as Record<string, unknown>
    const tournamentName = (ev.name as string) ?? (ev.shortName as string) ?? comp
    if (!isTennisTopTournament(tournamentName)) continue

    const groupings = (ev.groupings as unknown[]) ?? []
    for (const rawG of groupings) {
      const g = rawG as Record<string, unknown>
      const gSlug = (g.grouping as Record<string, unknown> | undefined)?.slug as string | undefined
      if (gSlug !== wantGrouping) continue   // solo el cuadro individual del tour
      const competitions = (g.competitions as unknown[]) ?? []

      for (const rawM of competitions) {
        const m = rawM as Record<string, unknown>
        const isoDate = m.date as string | undefined
        if (!isoDate || new Date(isoDate).getTime() < cutoff) continue

        // Excluir la fase previa (qualifying): solo cuadro final.
        const roundName = ((m.round as Record<string, unknown>)?.displayName as string) ?? ''
        if (/qualif/i.test(roundName)) continue

        const statusName = ((m.status as Record<string, unknown>)?.type as Record<string, unknown>)?.name as string | undefined
        if (!statusName || !FINAL_STATUSES.has(statusName)) continue

        const competitors = (m.competitors as Record<string, unknown>[]) ?? []
        if (competitors.length < 2) continue

        const home = ((competitors[0]?.athlete as Record<string, unknown>)?.displayName as string | undefined)
                  ?? (competitors[0]?.displayName as string | undefined)
        const away = ((competitors[1]?.athlete as Record<string, unknown>)?.displayName as string | undefined)
                  ?? (competitors[1]?.displayName as string | undefined)
        if (!home || !away || home === 'TBD' || away === 'TBD') continue
        if (isTennisDoubles(home, away)) continue

        const matchId  = m.id as string
        const matchRef = `tennis_${shortSlug}_${matchId}`

        results.push({
          isoDate,
          event: {
            id:        `espn-past-tennis-${matchId}`,
            home,
            away,
            sport:     'Tenis',
            comp:      tournamentName,
            date:      toDateLabel(isoDate),
            time:      toTimeStr(isoDate),
            accent,
            isoDate,
            matchRef,
            homeScore: countTennisSets(competitors[0]),
            awayScore: countTennisSets(competitors[1]),
            // Set a set FIJADO: al acabar, el partido sale de /api/events/live y
            // con él su setsStr, así que la fila se quedaba solo con los sets
            // ganados. Los linescores del scoreboard lo conservan.
            setsStr:   setsStrFromLinescores(competitors[0]?.linescores, competitors[1]?.linescores) || undefined,
            homePhoto: espnHeadshot(competitors[0]) ?? athletePhoto(home),
            awayPhoto: espnHeadshot(competitors[1]) ?? athletePhoto(away),
            isPast:    true,
            source:    'espn' as const,
          },
        })
      }
    }
  }

  // Cap por tour: evita inundar el histórico con rondas completas (qualy/1ª ronda).
  results.sort((a, b) => b.isoDate.localeCompare(a.isoDate))
  return results.slice(0, 40)
}

export async function fetchEspnPastEvents(): Promise<SportEvent[]> {
  const [leagueResults, tennisResults] = await Promise.all([
    Promise.allSettled(SOURCES.map(s => fetchLeaguePast(s, 10))),
    Promise.allSettled(TENNIS_SLUGS.map(s => fetchTennisPast(s, 10))),
  ])
  const raw: RawEvent[] = []
  for (const r of leagueResults) {
    if (r.status === 'fulfilled') raw.push(...r.value)
  }
  for (const r of tennisResults) {
    if (r.status === 'fulfilled') raw.push(...r.value)
  }
  // Most recent first
  raw.sort((a, b) => b.isoDate.localeCompare(a.isoDate))
  // Dedup por id (un mismo partido de un Grand Slam puede llegar por ambos tours).
  const seen = new Set<string>()
  return raw.filter(r => {
    if (seen.has(r.event.id)) return false
    seen.add(r.event.id)
    return true
  }).map(r => r.event)
}
