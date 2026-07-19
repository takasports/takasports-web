import { NextResponse } from 'next/server'
import { getZone, zoneFromNote } from '@/lib/league-zones'
import type { StandingZone } from '@/lib/league-zones'
import { getPhotosByEspnId, upsertSportEntities, type SeedEntity } from '@/lib/sport-entities'
export type { StandingZone }

// ── Types ────────────────────────────────────────────────────────────
export interface TeamResult {
  matchRef: string
  date: string
  homeTeam: { name: string; abbr: string; logo?: string; id: string }
  awayTeam: { name: string; abbr: string; logo?: string; id: string }
  homeScore?: number | null
  awayScore?: number | null
  status: string
  statusLabel: string
  isHome: boolean
  result?: 'W' | 'L' | 'D'
  venue?: string
  leagueLabel?: string
}

export interface RosterPlayer {
  id: string
  name: string
  shortName: string
  jersey?: string
  position: string
  posAbbr: string
  age?: number
  nationality?: string
  /** País en INGLÉS (ESPN) — no se muestra; corrobora el match de foto anti-homónimo al sembrar. */
  nationalityEn?: string
  /** Fecha de nacimiento ISO "YYYY-MM-DD" (ESPN) — señal dura anti-homónimo al sembrar. */
  birthDate?: string
  /** Headshot de ESPN (sin atribución). Escaso fuera del top-5 europeo. */
  headshot?: string
  /** Foto resuelta por nuestra cascada (Wikimedia/ESPN), cacheada. Se prefiere a `headshot`. */
  photo?: string
  /** Crédito LEGALMENTE obligatorio cuando `photo` es CC (Wikimedia). Ausente si no lo exige. */
  photoAttribution?: string
  goals: number
  assists: number
  shotsOnTarget: number
  yellowCards: number
  redCards: number
  gamesPlayed: number
}

export interface TeamTableRow {
  rank: number
  name: string
  abbr: string
  logo?: string
  teamId?: string
  pts: number
  gp: number
  w: number
  d: number
  l: number
  gf: number
  gc: number
  gd: number
  isMain?: boolean
  zone?: StandingZone
}

export interface TeamDetail {
  id: string
  sport: string
  leagueSlug: string
  leagueLabel: string
  name: string
  shortName: string
  abbr: string
  logo?: string
  color?: string
  altColor?: string
  standingSummary?: string
  record?: { summary: string; gp: number; w: number; d: number; l: number; pts: number }
  results: TeamResult[]
  roster: RosterPlayer[]
  leagueTable: TeamTableRow[]
  featuredPlayer?: RosterPlayer
}

// ── Helpers ──────────────────────────────────────────────────────────
function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}
function asObj(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

async function espnFetch(url: string, revalidate = 300): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(url, { next: { revalidate } })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

const COMP_LABELS: Record<string, string> = {
  'soccer/esp.1':          'LaLiga',
  'soccer/eng.1':          'Premier League',
  'soccer/ita.1':          'Serie A',
  'soccer/ger.1':          'Bundesliga',
  'soccer/fra.1':          'Ligue 1',
  'soccer/uefa.champions': 'Champions League',
  'basketball/nba':        'NBA',
}

// Translate ESPN standing summary (always arrives in English) → Spanish
function translateStanding(s: string): string {
  return s
    .replace(/^(\d+)(st|nd|rd|th) in /, (_, n) => `${n}° en `)
    .replace('Spanish LALIGA', 'LaLiga')
    .replace('English Premier League', 'Premier League')
    .replace('Italian Serie A', 'Serie A')
    .replace('German Bundesliga', 'Bundesliga')
    .replace("French Ligue 1", 'Ligue 1')
    .replace('UEFA Champions League', 'Champions League')
    .replace('National Basketball Association', 'NBA')
}

// Country names English → Spanish (top nationalities)
const COUNTRY_ES: Record<string, string> = {
  'Spain': 'España', 'France': 'Francia', 'Brazil': 'Brasil',
  'Germany': 'Alemania', 'England': 'Inglaterra', 'Portugal': 'Portugal',
  'Argentina': 'Argentina', 'Italy': 'Italia', 'Netherlands': 'Países Bajos',
  'Belgium': 'Bélgica', 'Croatia': 'Croacia', 'Uruguay': 'Uruguay',
  'Colombia': 'Colombia', 'Mexico': 'México', 'Senegal': 'Senegal',
  'Morocco': 'Marruecos', 'Nigeria': 'Nigeria', 'Ivory Coast': "Costa de Marfil",
  'Austria': 'Austria', 'Switzerland': 'Suiza', 'Denmark': 'Dinamarca',
  'Sweden': 'Suecia', 'Norway': 'Noruega', 'Poland': 'Polonia',
  'Serbia': 'Serbia', 'Ukraine': 'Ucrania', 'Turkey': 'Turquía',
  'United States': 'EEUU', 'Japan': 'Japón', 'South Korea': 'Corea del Sur',
  'Ecuador': 'Ecuador', 'Chile': 'Chile', 'Peru': 'Perú',
  'Wales': 'Gales', 'Scotland': 'Escocia', 'Ireland': 'Irlanda',
  'Slovakia': 'Eslovaquia', 'Czech Republic': 'República Checa',
  'Hungary': 'Hungría', 'Greece': 'Grecia', 'Romania': 'Rumanía',
  'Cameroon': 'Camerún', 'Ghana': 'Ghana', 'Egypt': 'Egipto',
  'Algeria': 'Argelia', 'Tunisia': 'Túnez', 'Guinea': 'Guinea',
  'Gambia': 'Gambia', 'Mali': 'Malí', 'Gabon': 'Gabón',
}

function mapStatus(name: string): string {
  if (name === 'STATUS_SCHEDULED') return 'Programado'
  if (name === 'STATUS_FULL_TIME' || name === 'STATUS_FINAL') return 'Final'
  if (name === 'STATUS_POSTPONED') return 'Aplazado'
  if (name === 'STATUS_CANCELED') return 'Cancelado'
  if (name === 'STATUS_HALFTIME') return 'Descanso'
  if (name === 'STATUS_IN_PROGRESS') return 'En juego'
  return 'Final'
}

// ── Schedule → results ───────────────────────────────────────────────
function buildResults(
  events: unknown[],
  teamId: string,
  leagueSlug: string,
  leagueLabel: string,
): TeamResult[] {
  const results: TeamResult[] = []
  const sport = leagueSlug.split('/')[0]
  const league = leagueSlug.split('/').slice(1).join('.')

  for (const raw of events) {
    const ev = asObj(raw)
    if (!ev) continue
    const comps = asArr(ev.competitions)
    const comp = asObj(comps[0])
    if (!comp) continue

    const competitors = asArr(comp.competitors) as Record<string, unknown>[]
    const homeComp = competitors.find(c => c.homeAway === 'home') ?? competitors[0]
    const awayComp = competitors.find(c => c.homeAway === 'away') ?? competitors[1]
    if (!homeComp || !awayComp) continue

    const homeTeamObj = asObj(homeComp.team) ?? {}
    const awayTeamObj = asObj(awayComp.team) ?? {}
    const homeTeamId  = asString(homeTeamObj.id) ?? ''
    const awayTeamId  = asString(awayTeamObj.id) ?? ''
    const isHome = homeTeamId === teamId

    const homeLogo = asString(asArr(homeTeamObj.logos)[0] ? asObj(asArr(homeTeamObj.logos)[0])?.href : undefined)
    const awayLogo = asString(asArr(awayTeamObj.logos)[0] ? asObj(asArr(awayTeamObj.logos)[0])?.href : undefined)

    // Score: schedule API returns score as object with value
    const getScore = (c: Record<string, unknown>): number | null => {
      const s = c.score
      if (s == null) return null
      if (typeof s === 'number') return s
      if (typeof s === 'object') return asNumber(asObj(s)?.value) ?? null
      if (typeof s === 'string') { const n = parseFloat(s); return isNaN(n) ? null : n }
      return null
    }
    const homeScore = getScore(homeComp as Record<string, unknown>)
    const awayScore = getScore(awayComp as Record<string, unknown>)

    const statusObj  = asObj(ev.status) ?? asObj(comp.status)
    const statusName = asString(asObj(statusObj?.type)?.name) ?? ''
    const statusLabel = mapStatus(statusName)

    // Result from team's perspective
    let result: 'W' | 'L' | 'D' | undefined
    const isCompleted = statusName === 'STATUS_FULL_TIME' || statusName === 'STATUS_FINAL'
    if (isCompleted && homeScore != null && awayScore != null) {
      const teamScore = isHome ? homeScore : awayScore
      const oppScore  = isHome ? awayScore : homeScore
      result = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D'
    }

    const venue = asString(asObj(comp.venue)?.fullName)
    const eventId = asString(ev.id) ?? ''
    const matchRef = `${sport}_${league}_${eventId}`

    results.push({
      matchRef,
      date: asString(ev.date) ?? '',
      homeTeam: {
        name: asString(homeTeamObj.displayName) ?? '—',
        abbr: asString(homeTeamObj.abbreviation) ?? '',
        logo: homeLogo,
        id: homeTeamId,
      },
      awayTeam: {
        name: asString(awayTeamObj.displayName) ?? '—',
        abbr: asString(awayTeamObj.abbreviation) ?? '',
        logo: awayLogo,
        id: awayTeamId,
      },
      homeScore,
      awayScore,
      status: statusName,
      statusLabel,
      isHome,
      result,
      venue,
      leagueLabel,
    })
  }
  return results
}

// ── Roster ───────────────────────────────────────────────────────────
function buildRoster(athletes: unknown[]): RosterPlayer[] {
  return athletes.map(raw => {
    const a = asObj(raw)
    if (!a) return null
    const pos = asObj(a.position)
    // Nacionalidad en inglés tal cual la da ESPN — para display se traduce a español (abajo),
    // pero la siembra necesita el original para casarlo con el mapa país→QID de Wikidata.
    const citizenshipEn = asString(asObj(a.citizenshipCountry)?.name) ?? asString(a.citizenship)
    const stats: Record<string, number> = {}
    const cats = asArr(asObj(asObj(a.statistics)?.splits)?.categories) as Record<string, unknown>[]
    for (const cat of cats) {
      for (const s of asArr(cat.stats) as Record<string, unknown>[]) {
        const name = asString(s.name)
        const val  = asNumber(s.value)
        if (name && val !== undefined) stats[name] = val
      }
    }
    return {
      id:           asString(a.id) ?? '',
      name:         asString(a.displayName) ?? '—',
      shortName:    asString(a.shortName) ?? asString(a.displayName) ?? '—',
      jersey:       asString(a.jersey),
      position:     asString(pos?.displayName) ?? asString(pos?.name) ?? '—',
      posAbbr:      asString(pos?.abbreviation) ?? '—',
      age:          asNumber(a.age),
      nationality:  citizenshipEn ? (COUNTRY_ES[citizenshipEn] ?? citizenshipEn) : undefined,
      nationalityEn: citizenshipEn,
      birthDate:    asString(a.dateOfBirth)?.slice(0, 10),
      headshot:     asString(asObj(a.headshot)?.href),
      goals:        stats.totalGoals ?? stats.goals ?? 0,
      assists:      stats.goalAssists ?? stats.assists ?? 0,
      shotsOnTarget: stats.shotsOnTarget ?? 0,
      yellowCards:  stats.yellowCards ?? 0,
      redCards:     stats.redCards ?? 0,
      gamesPlayed:  stats.gamesPlayed ?? stats.appearances ?? 0,
    } as RosterPlayer
  }).filter(Boolean) as RosterPlayer[]
}

// ── Fotos de plantilla (caché propia + siembra lazy) ─────────────────
//
// ESPN casi no trae headshots de plantilla fuera del top-5 europeo (medido: 1 de 51 en
// Brasileirão). Aquí rellenamos la cara desde NUESTRA caché (sport_entity_images, resuelta
// por el cron vía la cascada Wikimedia) y, de paso, sembramos a los que aún no están para
// que el cron les resuelva la foto de cara a la próxima visita.
//
// Lazy a propósito: solo se paga por los equipos que alguien mira, y como la page cachea la
// respuesta 300 s, la siembra corre como mucho cada 5 min por equipo — no satura ni el cron
// ni a Wikimedia. Todo va con guardarraíl: si Supabase no está, la plantilla cae al dorsal
// como siempre y la página no se rompe. Solo fútbol: la caché es football-only y el resto
// (NBA) ya trae buenos headshots de ESPN.
async function enrichAndSeedRoster(
  roster: RosterPlayer[],
  leagueSlug: string,
  club: string,
): Promise<void> {
  const espnIds = roster.map(p => p.id).filter(Boolean)
  if (!espnIds.length) return
  try {
    const photos = await getPhotosByEspnId('football', espnIds)
    for (const player of roster) {
      const hit = photos.get(player.id)
      if (!hit) continue
      player.photo = hit.url
      if (hit.attribution) player.photoAttribution = hit.attribution
    }

    // Siembra idempotente (upsert por slug). Guardo leagueSlug + club para que el pipeline
    // de snapshots también cubra a estos jugadores; nacionalidad + fecha de nacimiento son las
    // señales con las que el cron corroborará la foto contra homónimos (ver entity-images.ts).
    const seeds: SeedEntity[] = roster
      .filter(p => p.id)
      .map(p => ({
        type: 'player', sport: 'football', name: p.name, espnId: p.id, leagueSlug, club,
        nationality: p.nationalityEn ?? null,
        birthDate: p.birthDate ?? null,
      }))
    await upsertSportEntities(seeds)
  } catch (err) {
    // Nunca romper la ficha de equipo por un fallo de la caché de fotos.
    console.error('[team] enrichAndSeedRoster failed:', err)
  }
}

// ── League table ─────────────────────────────────────────────────────
async function fetchTeamTable(leagueSlug: string, teamId: string): Promise<TeamTableRow[]> {
  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/v2/sports/${leagueSlug}/standings`,
      { next: { revalidate: 1800 } }
    )
    if (!res.ok) return []
    const json = await res.json()
    const groups  = asArr(json.children) as Record<string, unknown>[]
    const entries = asArr(asObj(groups[0]?.standings)?.entries) as Record<string, unknown>[]
    if (!entries.length) return []

    // ESPN no siempre devuelve las entradas ordenadas por posición (p. ej. MLS),
    // y abajo usamos el índice como puesto. Ordenamos por el stat 'rank' de ESPN.
    const rankOf = (e: Record<string, unknown>) => {
      const st = asArr(e.stats) as Array<{ name: string; value?: number }>
      return (st.find(s => s.name === 'rank')?.value as number) ?? 999
    }
    entries.sort((a, b) => rankOf(a) - rankOf(b))

    return entries.map((e, i) => {
      const team  = asObj(e.team) ?? {}
      const stats = asArr(e.stats) as Array<{ name: string; value?: number }>
      const sv = (name: string) => Math.round((stats.find(s => s.name === name)?.value as number) ?? 0)
      const w = sv('wins'); const d = sv('ties'); const l = sv('losses')
      const pts = sv('points'); const gd = sv('pointDifferential')
      const gf  = sv('pointsFor'); const gc = sv('pointsAgainst')
      const logos = asArr(team.logos) as Record<string, unknown>[]
      const rowTeamId = asString(team.id) ?? ''
      return {
        rank: i + 1,
        name: asString(team.displayName) ?? '—',
        abbr: asString(team.abbreviation) ?? '',
        logo: asString(logos[0]?.href),
        teamId: rowTeamId,
        pts, gp: w + d + l, w, d, l, gf, gc, gd,
        isMain: rowTeamId === teamId,
        zone: zoneFromNote(asString(asObj(e.note)?.description)) ?? getZone(leagueSlug, i + 1),
      }
    })
  } catch { return [] }
}

// ── Route handler ────────────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // slug shape: "<sport>_<league>_<teamId>" e.g. "soccer_esp.1_86"
  const parts = slug.split('_')
  if (parts.length < 3) return NextResponse.json(null, { status: 400 })
  const teamId    = parts[parts.length - 1]
  const leagueSlug = parts.slice(0, -1).join('/')
  const sport     = leagueSlug.split('/')[0]
  const league    = leagueSlug.split('/').slice(1).join('.')
  const leagueLabel = COMP_LABELS[leagueSlug] ?? leagueSlug

  try {
    const [teamJson, scheduleJson, rosterJson, tableRows] = await Promise.all([
      espnFetch(`https://site.api.espn.com/apis/site/v2/sports/${leagueSlug}/teams/${teamId}`, 3600),
      espnFetch(`https://site.api.espn.com/apis/site/v2/sports/${leagueSlug}/teams/${teamId}/schedule`, 300),
      espnFetch(`https://site.api.espn.com/apis/site/v2/sports/${leagueSlug}/teams/${teamId}/roster`, 3600),
      fetchTeamTable(leagueSlug, teamId),
    ])

    if (!teamJson) return NextResponse.json(null, { status: 404 })

    const team = asObj(teamJson.team) ?? {}
    const logos = asArr(team.logos) as Record<string, unknown>[]
    const logo = asString(logos.find(l => asArr(asObj(l)?.rel).includes('dark'))?.href)
             ?? asString(logos[0]?.href)
             ?? `https://a.espncdn.com/i/teamlogos/${sport}/500/${teamId}.png`

    // Record
    const recordItems = asArr(asObj(team.record)?.items) as Record<string, unknown>[]
    const totalRecord = recordItems.find(r => r.type === 'total') ?? recordItems[0]
    const recordStats = asArr(totalRecord?.stats) as Array<{ name: string; value: number }>
    const sv = (name: string) => Math.round((recordStats.find(s => s.name === name)?.value ?? 0))
    const record = totalRecord ? {
      summary: asString(totalRecord.summary) ?? '',
      gp:  sv('gamesPlayed'),
      w:   sv('wins'),
      d:   sv('ties'),
      l:   sv('losses'),
      pts: sv('points'),
    } : undefined

    // Schedule → results (all: past + upcoming)
    const events = asArr(scheduleJson?.events)
    const results = buildResults(events, teamId, leagueSlug, leagueLabel)

    // Roster
    const athletes = asArr(rosterJson?.athletes)
    const roster = buildRoster(athletes)

    // Rellena caras desde la caché propia + siembra lazy (solo fútbol). Muta `roster` en
    // sitio, así que el jugador destacado (una referencia a un elemento) también hereda foto.
    if (sport === 'soccer') {
      await enrichAndSeedRoster(roster, leagueSlug, asString(team.displayName) ?? '')
    }

    // Featured player: most goals, then most assists
    const outfield = roster.filter(p => p.posAbbr !== 'GK')
    const featured = outfield.sort((a, b) =>
      (b.goals * 3 + b.assists * 2 + b.shotsOnTarget) -
      (a.goals * 3 + a.assists * 2 + a.shotsOnTarget)
    )[0] ?? roster[0]

    const detail: TeamDetail = {
      id:              teamId,
      sport,
      leagueSlug,
      leagueLabel,
      name:            asString(team.displayName) ?? '—',
      shortName:       asString(team.shortDisplayName) ?? asString(team.displayName) ?? '—',
      abbr:            asString(team.abbreviation) ?? '',
      logo,
      color:           asString(team.color),
      altColor:        asString(team.alternateColor),
      standingSummary: asString(team.standingSummary) ? translateStanding(asString(team.standingSummary)!) : undefined,
      record,
      results,
      roster,
      leagueTable:     tableRows,
      featuredPlayer:  featured,
    }

    return NextResponse.json(detail)
  } catch (err) {
    console.error(`[team] fetch failed for ${slug}:`, err)
    return NextResponse.json(null, { status: 500 })
  }
}
