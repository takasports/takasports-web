// ── Datos de competición (ESPN, gratis) ─────────────────────────────────────
// Clasificación + máximos goleadores de una liga, reutilizables tanto en el
// detalle de partido (/partido) como en la página de competición
// (/calendario/[slug]). Antes la tabla vivía dentro del route de /api/match;
// se extrajo aquí para no duplicarla. Coste $0 (API pública de ESPN).

import { getZone, zoneFromNote } from '@/lib/league-zones'
import type { StandingZone } from '@/lib/league-zones'
import { TABLE_LEAGUE_SLUGS } from '@/lib/football-leagues'

// ── Tipos ────────────────────────────────────────────────────────────
export interface LeagueTableRow {
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
  highlight?: 'home' | 'away'
  zone?: StandingZone
}

export interface ScorerRow {
  rank: number
  playerId: string
  name: string
  teamId?: string
  teamLogo?: string
  goals: number
  assists?: number
  matches?: number
}

// ── Helpers ──────────────────────────────────────────────────────────
function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
function asObj(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

// Año de inicio de temporada europea (ago→may). Ago-Dic → Y; Ene-Jul → Y-1.
function seasonStartYear(): number {
  const now = new Date()
  return now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
}

// ── Clasificación ─────────────────────────────────────────────────────
// Ligas con clasificación: lib/football-leagues (TABLE_LEAGUE_SLUGS).
export async function fetchLeagueTableRows(leagueSlug: string): Promise<Omit<LeagueTableRow, 'highlight'>[]> {
  if (!TABLE_LEAGUE_SLUGS.has(leagueSlug)) return []
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
      return {
        rank: i + 1,
        name: asString(team.displayName) ?? '—',
        abbr: asString(team.abbreviation) ?? '',
        logo: asString(logos[0]?.href),
        teamId: asString(team.id),
        pts, gp: w + d + l, w, d, l, gf, gc, gd,
        zone: zoneFromNote(asString(asObj(e.note)?.description)) ?? getZone(leagueSlug, i + 1),
      }
    })
  } catch { return [] }
}

// ── Máximos goleadores (Pichichi) ─────────────────────────────────────
// ESPN Core devuelve los líderes por categoría (goals/assists…) con el atleta
// y el equipo como $ref. El nombre del jugador no viene inline → se resuelve en
// paralelo (1 fetch ligero por jugador, cacheado 1 h). Goles/asistencias/PJ ya
// vienen en displayValue/shortDisplayValue, así que no hay que resolver stats.
const ID_FROM_REF = (ref: string | undefined, kind: 'athletes' | 'teams'): string | undefined => {
  if (!ref) return undefined
  const m = new RegExp(`/${kind}/(\\d+)`).exec(ref)
  return m?.[1]
}

export async function fetchTopScorers(leagueSlug: string, limit = 8): Promise<ScorerRow[]> {
  if (!leagueSlug.startsWith('soccer/')) return []
  const leagueId = leagueSlug.replace(/^soccer\//, '')
  const year = seasonStartYear()
  try {
    const res = await fetch(
      `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${leagueId}/seasons/${year}/types/1/leaders`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const json = await res.json()
    const cats = asArr(json.categories) as Record<string, unknown>[]
    const goalsCat = cats.find(c => asString(c.name) === 'goalsLeaders')
                  ?? cats.find(c => asString(c.name) === 'goals')
    const leaders = asArr(goalsCat?.leaders) as Record<string, unknown>[]
    if (!leaders.length) return []

    const top = leaders.slice(0, limit).map((l) => {
      const goals = Math.round((l.value as number) ?? 0)
      const playerId = ID_FROM_REF(asString(asObj(l.athlete)?.$ref), 'athletes')
      const teamId   = ID_FROM_REF(asString(asObj(l.team)?.$ref), 'teams')
      const short = asString(l.shortDisplayValue) ?? ''
      const assists = /A:\s*(\d+)/.exec(short)?.[1]
      const matches = /M:\s*(\d+)/.exec(short)?.[1]
      const athleteRef = asString(asObj(l.athlete)?.$ref)?.replace(/^http:/, 'https:')
      return { goals, playerId, teamId, assists, matches, athleteRef }
    }).filter(s => s.playerId && s.goals > 0)

    // Resuelve nombres en paralelo. Si alguno falla, se descarta esa fila.
    const resolved = await Promise.all(top.map(async (s) => {
      if (!s.athleteRef) return null
      try {
        const r = await fetch(s.athleteRef, { next: { revalidate: 3600 } })
        if (!r.ok) return null
        const a = await r.json()
        const name = asString(a.displayName) ?? asString(a.shortName)
        if (!name) return null
        return {
          playerId: s.playerId!,
          name,
          teamId: s.teamId,
          teamLogo: s.teamId ? `https://a.espncdn.com/i/teamlogos/soccer/500/${s.teamId}.png` : undefined,
          goals: s.goals,
          assists: s.assists != null ? Number(s.assists) : undefined,
          matches: s.matches != null ? Number(s.matches) : undefined,
        }
      } catch { return null }
    }))

    const out: ScorerRow[] = []
    for (const r of resolved) {
      if (!r) continue
      out.push({ rank: out.length + 1, ...r })
    }
    return out
  } catch { return [] }
}
