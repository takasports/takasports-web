import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/constants'
import type { TeamResult } from '@/app/api/team/[slug]/route'

// ── Types ────────────────────────────────────────────────────────────
export interface PlayerStat {
  label: string
  value: string
}

export interface PlayerDetail {
  id: string
  leagueSlug: string       // soccer/esp.1
  leagueLabel: string
  name: string
  /** Real headshot (NBA has them; soccer does not — falls back to club crest). */
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
  /** Recent matches of the player's club (ESPN has no per-player soccer log). */
  recent: TeamResult[]
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

async function jsonFetch(url: string, revalidate: number): Promise<Record<string, unknown> | null> {
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
  'basketball/nba':        'NBA',
}

const COUNTRY_ES: Record<string, string> = {
  'Spain': 'España', 'France': 'Francia', 'Brazil': 'Brasil', 'Germany': 'Alemania',
  'England': 'Inglaterra', 'Portugal': 'Portugal', 'Argentina': 'Argentina',
  'Italy': 'Italia', 'Netherlands': 'Países Bajos', 'Belgium': 'Bélgica',
  'Croatia': 'Croacia', 'Uruguay': 'Uruguay', 'Colombia': 'Colombia',
  'Mexico': 'México', 'Norway': 'Noruega', 'Poland': 'Polonia', 'Egypt': 'Egipto',
  'United States': 'EEUU', 'Japan': 'Japón', 'Morocco': 'Marruecos', 'Nigeria': 'Nigeria',
}

// European season start year: Aug→May. Aug-Dec → Y; Jan-Jul → Y-1.
function seasonStartYear(): number {
  const now = new Date()
  return now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}

// Curated soccer season stats from ESPN Core (≈100 stats available; we surface
// the meaningful ones). Order = display order. `core` flag = always show even
// if 0; others are hidden when 0/absent so the card stays clean.
const SOCCER_STAT_PICKS: { key: string; label: string; core?: boolean }[] = [
  { key: 'appearances',      label: 'Partidos',          core: true },
  { key: 'subAppearances',   label: 'Supl.' },
  { key: 'minutes',          label: 'Minutos' },
  { key: 'totalGoals',       label: 'Goles',             core: true },
  { key: 'goalAssists',      label: 'Asistencias',       core: true },
  { key: 'totalShots',       label: 'Tiros' },
  { key: 'shotsOnTarget',    label: 'Tiros a puerta' },
  { key: 'bigChanceCreated', label: 'Ocasiones creadas' },
  { key: 'accuratePasses',   label: 'Pases acertados' },
  { key: 'totalPasses',      label: 'Pases' },
  { key: 'interceptions',    label: 'Intercepciones' },
  { key: 'foulsCommitted',   label: 'Faltas' },
  { key: 'yellowCards',      label: 'Amarillas' },
  { key: 'redCards',         label: 'Rojas' },
  { key: 'saves',            label: 'Paradas' },
  { key: 'cleanSheet',       label: 'Porterías a 0' },
]

interface CoreStat { name?: string; displayValue?: string; value?: number }

function buildSoccerStats(statsJson: Record<string, unknown> | null): { stats: PlayerStat[]; season?: string } {
  const splits = asObj(statsJson?.splits)
  const cats = asArr(splits?.categories)
  if (!cats.length) return { stats: [] }
  const byName = new Map<string, CoreStat>()
  for (const c of cats)
    for (const s of asArr(asObj(c)?.stats)) {
      const st = asObj(s)
      const n = asString(st?.name)
      if (n && !byName.has(n)) byName.set(n, st as CoreStat)
    }

  const acc = byName.get('accuratePasses')?.value
  const tot = byName.get('totalPasses')?.value
  const passPctNum = typeof acc === 'number' && typeof tot === 'number' && tot > 0
    ? Math.round((acc / tot) * 100) : undefined

  const stats: PlayerStat[] = []
  for (const p of SOCCER_STAT_PICKS) {
    const s = byName.get(p.key)
    if (!s) { continue }
    const num = typeof s.value === 'number' ? s.value : undefined
    if (!p.core && (num === undefined || num === 0)) continue
    let value = s.displayValue ?? (num != null ? String(num) : '')
    if (p.key === 'minutes' && num != null) value = String(Math.round(num))
    if (!value) continue
    stats.push({ label: p.label, value })
    if (p.key === 'accuratePasses' && passPctNum != null)
      stats.push({ label: '% Pases', value: `${passPctNum}%` })
  }
  const seasonObj = asObj(statsJson?.season)
  return { stats, season: asString(seasonObj?.displayName) }
}

// statsSummary uses English short labels — translate the common ones (NBA).
const STAT_LABEL_ES: Record<string, string> = {
  'STRT-SUBIN': 'Titular (supl.)',
  'G':          'Goles',
  'A':          'Asistencias',
  'SH':         'Tiros',
  'ST':         'Tiros a puerta',
  'YC':         'Amarillas',
  'RC':         'Rojas',
  'FC':         'Faltas com.',
  'FA':         'Faltas rec.',
  // NBA
  'PPG':        'Puntos/partido',
  'RPG':        'Rebotes/partido',
  'APG':        'Asist./partido',
  'FG%':        '% Tiros campo',
  '3P%':        '% Triples',
  'FT%':        '% T. libres',
  'BPG':        'Tapones/partido',
  'SPG':        'Robos/partido',
  'MPG':        'Minutos/partido',
}

// ── GET ──────────────────────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  // slug shape: "<sport>_<league>_<playerId>" e.g. "soccer_esp.1_231388"
  const parts = slug.split('_')
  if (parts.length < 3) {
    return NextResponse.json({ error: 'bad slug' }, { status: 400 })
  }
  const playerId   = parts[parts.length - 1]
  const leagueSlug = parts.slice(0, -1).join('/')
  const leagueLabel = COMP_LABELS[leagueSlug] ?? leagueSlug

  const overviewJson = await jsonFetch(
    `https://site.web.api.espn.com/apis/common/v3/sports/${leagueSlug}/athletes/${playerId}`,
    3600,
  )

  const ath = asObj(overviewJson?.athlete)
  if (!ath || !asString(ath.displayName)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const team = asObj(ath.team)
  const teamId = asString(team?.id)
  const teamLogo = teamId
    ? `https://a.espncdn.com/i/teamlogos/soccer/500/${teamId}.png`
    : undefined
  const teamSlug = teamId ? `${leagueSlug.replace('/', '_')}_${teamId}` : undefined
  const position = asObj(ath.position)
  const citizenshipEn = asString(ath.citizenship)
  const flag = asObj(ath.flag)

  // Season stats. Soccer → ESPN Core full per-player stats (every player who
  // has played gets a full card, à la SofaScore). NBA → statsSummary (rich for
  // basketball: PPG/RPG/APG…). Bio always comes from the overview above.
  const sport = leagueSlug.split('/')[0]
  const leagueId = leagueSlug.split('/').slice(1).join('.')
  let stats: PlayerStat[] = []
  let season: string | undefined

  if (sport === 'soccer') {
    const y = seasonStartYear()
    const statsJson = await jsonFetch(
      `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${leagueId}/seasons/${y}/types/1/athletes/${playerId}/statistics/0?lang=en`,
      3600,
    )
    const built = buildSoccerStats(statsJson)
    stats = built.stats
    season = built.season ?? `${y}-${String((y + 1) % 100).padStart(2, '0')}`
  } else {
    const ss = asObj(ath.statsSummary)
    season = asString(ss?.displayName)
    stats = asArr(ss?.statistics).flatMap(raw => {
      const s = asObj(raw)
      const abbr = asString(s?.shortDisplayName) ?? asString(s?.abbreviation) ?? ''
      const value = asString(s?.displayValue)
      if (!value) return []
      return [{ label: STAT_LABEL_ES[abbr] ?? asString(s?.displayName) ?? abbr, value }]
    })
  }

  // Player's club recent matches — reuse the existing team endpoint.
  let recent: TeamResult[] = []
  if (teamSlug) {
    const base = process.env.NEXT_PUBLIC_SITE_URL
      ?? (process.env.NODE_ENV === 'production' ? SITE_URL : 'http://localhost:3000')
    const teamJson = await jsonFetch(`${base}/api/team/${teamSlug}`, 300)
    const results = asArr(teamJson?.results) as TeamResult[]
    const played = results.filter(r => r.result || r.status === 'STATUS_IN_PROGRESS')
    recent = played.slice(-10).reverse()
  }

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
      ? { id: teamId, name: asString(team?.name) ?? asString(team?.displayName) ?? '', logo: teamLogo, slug: teamSlug! }
      : undefined,
    season,
    stats,
    recent,
  }

  return NextResponse.json(detail)
}
