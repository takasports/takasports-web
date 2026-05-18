import { NextResponse } from 'next/server'

// ── Types ────────────────────────────────────────────────────────────
export interface PlayerStat {
  label: string
  value: string
}

export interface PlayerMatch {
  date: string
  opponent: string
  opponentLogo?: string
  homeAway: 'home' | 'away' | ''
  result?: 'W' | 'L' | 'D'
  score?: string
  line: string            // e.g. "1 G · 0 A · 90'"
}

export interface PlayerDetail {
  id: string
  leagueSlug: string       // soccer/esp.1
  leagueLabel: string
  name: string
  headshot?: string
  flag?: string
  position?: string
  jersey?: string
  age?: number
  nationality?: string
  height?: string
  team?: { id: string; name: string; logo?: string; slug: string }
  season?: string
  stats: PlayerStat[]
  recent: PlayerMatch[]
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

async function espnFetch(url: string, revalidate = 1800): Promise<Record<string, unknown> | null> {
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
  'soccer/uefa.europa':    'Europa League',
  'soccer/uefa.conference':'Conference League',
}

const COUNTRY_ES: Record<string, string> = {
  'Spain': 'España', 'France': 'Francia', 'Brazil': 'Brasil', 'Germany': 'Alemania',
  'England': 'Inglaterra', 'Portugal': 'Portugal', 'Argentina': 'Argentina',
  'Italy': 'Italia', 'Netherlands': 'Países Bajos', 'Belgium': 'Bélgica',
  'Croatia': 'Croacia', 'Uruguay': 'Uruguay', 'Colombia': 'Colombia',
  'Mexico': 'México', 'Norway': 'Noruega', 'Poland': 'Polonia', 'Egypt': 'Egipto',
  'United States': 'EEUU', 'Japan': 'Japón', 'Morocco': 'Marruecos', 'Nigeria': 'Nigeria',
}

// ── Gamelog parsing ──────────────────────────────────────────────────
// ESPN soccer gamelog aligns each event's `stats` array with the top-level
// `names` array. We pull goals / assists / minutes / appearances by name.
function statByName(names: string[], stats: unknown[], wanted: string[]): number {
  for (const w of wanted) {
    const idx = names.indexOf(w)
    if (idx >= 0) {
      const raw = stats[idx]
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
      if (Number.isFinite(n)) return n
    }
  }
  return 0
}

function buildRecentAndStats(
  gamelog: Record<string, unknown> | null,
): { stats: PlayerStat[]; recent: PlayerMatch[]; season?: string } {
  if (!gamelog) return { stats: [], recent: [] }

  const names = asArr(gamelog.names).map(n => String(n))
  const eventsMap = asObj(gamelog.events) ?? {}
  const seasonTypes = asArr(gamelog.seasonTypes)

  // Pick the most recent seasonType (last entry) with events.
  let chosen: Record<string, unknown> | undefined
  for (let i = seasonTypes.length - 1; i >= 0; i--) {
    const st = asObj(seasonTypes[i])
    const cats = asArr(st?.categories)
    if (cats.some(c => asArr(asObj(c)?.events).length > 0)) { chosen = st; break }
  }
  const season = asString(chosen?.displayName)

  const eventRows: { id: string; stats: unknown[] }[] = []
  for (const cat of asArr(chosen?.categories)) {
    for (const ev of asArr(asObj(cat)?.events)) {
      const e = asObj(ev)
      const id = asString(e?.eventId)
      if (id) eventRows.push({ id, stats: asArr(e?.stats) })
    }
  }

  let totGoals = 0, totAssists = 0, totMin = 0, apps = 0, totSh = 0
  const recent: PlayerMatch[] = []

  for (const row of eventRows) {
    const g  = statByName(names, row.stats, ['goals', 'totalGoals', 'G'])
    const a  = statByName(names, row.stats, ['assists', 'goalAssists', 'A'])
    const mi = statByName(names, row.stats, ['minutes', 'appearances', 'MIN'])
    const sh = statByName(names, row.stats, ['totalShots', 'shotsTotal', 'SH'])
    totGoals += g; totAssists += a; totSh += sh
    if (mi > 0) { totMin += mi; apps += 1 }

    const ev = asObj(eventsMap[row.id])
    const opp = asObj(ev?.opponent)
    const gameResult = asString(ev?.gameResult)
    const recentEntry: PlayerMatch = {
      date: asString(ev?.gameDate) ?? '',
      opponent: asString(opp?.abbreviation) ?? asString(opp?.displayName) ?? '—',
      opponentLogo: asString(opp?.logo),
      homeAway: (asString(ev?.atVs) === '@' || asString(ev?.homeAway) === 'away') ? 'away'
        : asString(ev?.homeAway) === 'home' ? 'home' : '',
      result: gameResult === 'W' ? 'W' : gameResult === 'L' ? 'L' : gameResult === 'D' ? 'D' : undefined,
      score: asString(ev?.score),
      line: `${g} G · ${a} A · ${Math.round(mi)}'`,
    }
    recent.push(recentEntry)
  }

  recent.reverse() // most recent first

  const stats: PlayerStat[] = [
    { label: 'Partidos',  value: String(apps || eventRows.length) },
    { label: 'Goles',     value: String(Math.round(totGoals)) },
    { label: 'Asist.',    value: String(Math.round(totAssists)) },
    { label: 'Minutos',   value: String(Math.round(totMin)) },
  ]
  if (totSh > 0) stats.push({ label: 'Tiros', value: String(Math.round(totSh)) })

  return { stats, recent: recent.slice(0, 12), season }
}

// ── GET ──────────────────────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  // slug shape: "<sport>_<league>_<playerId>" e.g. "soccer_esp.1_45843"
  const parts = slug.split('_')
  if (parts.length < 3) {
    return NextResponse.json({ error: 'bad slug' }, { status: 400 })
  }
  const playerId   = parts[parts.length - 1]
  const leagueSlug = parts.slice(0, -1).join('/')
  const leagueLabel = COMP_LABELS[leagueSlug] ?? leagueSlug

  const [overviewJson, gamelogJson] = await Promise.all([
    espnFetch(`https://site.web.api.espn.com/apis/common/v3/sports/${leagueSlug}/athletes/${playerId}`, 3600),
    espnFetch(`https://site.web.api.espn.com/apis/common/v3/sports/${leagueSlug}/athletes/${playerId}/gamelog`, 1800),
  ])

  const ath = asObj(overviewJson?.athlete) ?? asObj(overviewJson)
  if (!ath || !asString(ath.displayName)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const team = asObj(ath.team)
  const teamId = asString(team?.id)
  const teamLogos = asArr(team?.logos)
  const teamLogo = asString(asObj(teamLogos[0])?.href)
  const position = asObj(ath.position)
  const citizenshipEn = asString(ath.citizenship)
  const flag = asObj(ath.flag)

  const { stats, recent, season } = buildRecentAndStats(gamelogJson)

  const detail: PlayerDetail = {
    id: playerId,
    leagueSlug,
    leagueLabel,
    name: asString(ath.displayName) ?? '—',
    headshot: asString(asObj(ath.headshot)?.href),
    flag: asString(flag?.href),
    position: asString(position?.displayName) ?? asString(position?.name),
    jersey: asString(ath.jersey),
    age: asNumber(ath.age),
    nationality: citizenshipEn ? (COUNTRY_ES[citizenshipEn] ?? citizenshipEn) : asString(flag?.alt),
    height: asString(ath.displayHeight),
    team: teamId
      ? {
          id: teamId,
          name: asString(team?.displayName) ?? '',
          logo: teamLogo,
          slug: `${leagueSlug.replace('/', '_')}_${teamId}`,
        }
      : undefined,
    season,
    stats,
    recent,
  }

  return NextResponse.json(detail)
}
